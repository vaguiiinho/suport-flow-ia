import { Pool, PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { IngestionError } from "../ingestion/errors";
import { ClaimedIngestionJob, IngestionFailure, IngestionSource, PersistedChunk } from "../ingestion/types";

interface ClaimRow {
  id: string;
  organizationId: string;
  sourceId: string;
  operation: "INDEX" | "REINDEX";
  strategyVersion: string;
  attempts: number;
  claimedBy: string;
}

function vectorLiteral(vector: number[]): string {
  if (vector.length === 0 || vector.some((value) => !Number.isFinite(value))) {
    throw new IngestionError("EMBEDDING_RESPONSE_INVALID", "The embedding response contains an invalid vector", true);
  }
  return `[${vector.join(",")}]`;
}

export class PostgresIngestionRepository {
  constructor(private readonly pool: Pool) {}

  async claimNext(workerId: string, maxAttempts: number, claimTimeoutMs: number): Promise<ClaimedIngestionJob | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<ClaimRow>(
        `WITH candidate AS (
           SELECT job."id"
           FROM "IngestionJob" AS job
           INNER JOIN "KnowledgeSource" AS source ON source."id" = job."sourceId"
           WHERE source."organizationId" = job."organizationId"
             AND source."deletedAt" IS NULL
             AND job."attempts" < $2
             AND (
               (job."status" = 'PENDING' AND job."availableAt" <= NOW())
               OR (
                 job."status" = 'PROCESSING'
                 AND COALESCE(job."heartbeatAt", job."claimedAt") < NOW() - ($3 * INTERVAL '1 millisecond')
               )
             )
           ORDER BY job."availableAt" ASC, job."createdAt" ASC
           FOR UPDATE OF job SKIP LOCKED
           LIMIT 1
         )
         UPDATE "IngestionJob" AS job
         SET
           "status" = 'PROCESSING',
           "attempts" = job."attempts" + 1,
           "claimedBy" = $1,
           "claimedAt" = NOW(),
           "heartbeatAt" = NOW(),
           "errorCode" = NULL,
           "errorMessage" = NULL,
           "updatedAt" = NOW()
         FROM candidate
         WHERE job."id" = candidate."id"
         RETURNING
           job."id",
           job."organizationId",
           job."sourceId",
           job."operation",
           job."strategyVersion",
           job."attempts",
           job."claimedBy"`,
        [workerId, maxAttempts, claimTimeoutMs]
      );
      const row = result.rows[0];
      if (!row) {
        await client.query("COMMIT");
        return null;
      }
      await client.query(
        `UPDATE "KnowledgeSource"
         SET "indexingStatus" = 'PROCESSING', "updatedAt" = NOW()
         WHERE "id" = $1 AND "organizationId" = $2 AND "active" = false`,
        [row.sourceId, row.organizationId]
      );
      await client.query("COMMIT");
      return { ...row, status: "PROCESSING" };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async loadSource(job: ClaimedIngestionJob): Promise<IngestionSource | null> {
    const result = await this.pool.query<IngestionSource>(
      `SELECT
         "id", "familyId", "organizationId", "type", "visibility", "content", "storageKey",
         "contentHash", "version", "active"
       FROM "KnowledgeSource"
       WHERE "id" = $1 AND "organizationId" = $2 AND "deletedAt" IS NULL`,
      [job.sourceId, job.organizationId]
    );
    return result.rows[0] ?? null;
  }

  async heartbeat(job: ClaimedIngestionJob, progress: number): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE "IngestionJob"
       SET "heartbeatAt" = NOW(), "progress" = GREATEST("progress", $4), "updatedAt" = NOW()
       WHERE "id" = $1 AND "organizationId" = $2 AND "claimedBy" = $3 AND "status" = 'PROCESSING'`,
      [job.id, job.organizationId, job.claimedBy, Math.max(0, Math.min(99, progress))]
    );
    return result.rowCount === 1;
  }

  async complete(
    job: ClaimedIngestionJob,
    source: IngestionSource,
    chunks: PersistedChunk[],
    embeddingModel: string,
    embeddingDimensions: number
  ): Promise<void> {
    if (chunks.length === 0)
      throw new IngestionError("SOURCE_WITHOUT_EXTRACTABLE_TEXT", "The source contains no extractable text", false);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query<{ familyId: string; visibility: "PUBLIC" | "INTERNAL" }>(
        `SELECT source."familyId", source."visibility"
         FROM "IngestionJob" AS job
         INNER JOIN "KnowledgeSource" AS source ON source."id" = job."sourceId"
         WHERE job."id" = $1
           AND job."organizationId" = $2
           AND job."claimedBy" = $3
           AND job."status" = 'PROCESSING'
           AND source."organizationId" = job."organizationId"
           AND source."id" = $4
           AND source."contentHash" = $5
           AND source."deletedAt" IS NULL
         FOR UPDATE OF job, source`,
        [job.id, job.organizationId, job.claimedBy, source.id, source.contentHash]
      );
      const current = locked.rows[0];
      if (!current) throw new IngestionError("JOB_CLAIM_LOST", "The ingestion job claim is no longer valid", true);

      await client.query(`DELETE FROM "KnowledgeChunk" WHERE "sourceId" = $1`, [source.id]);
      await this.insertChunks(client, source, job.strategyVersion, chunks, embeddingModel, embeddingDimensions);

      await client.query(
        `UPDATE "KnowledgeChunk" AS chunk
         SET "active" = false
         FROM "KnowledgeSource" AS version
         WHERE chunk."sourceId" = version."id"
           AND version."organizationId" = $1
           AND version."familyId" = $2`,
        [source.organizationId, current.familyId]
      );
      await client.query(
        `UPDATE "KnowledgeSource"
         SET "active" = false, "updatedAt" = NOW()
         WHERE "organizationId" = $1 AND "familyId" = $2 AND "id" <> $3 AND "active" = true`,
        [source.organizationId, current.familyId, source.id]
      );
      await client.query(
        `UPDATE "KnowledgeSource"
         SET "active" = true, "indexingStatus" = 'SUCCEEDED', "updatedAt" = NOW()
         WHERE "id" = $1 AND "organizationId" = $2 AND "active" = false`,
        [source.id, source.organizationId]
      );
      await client.query(`UPDATE "KnowledgeChunk" SET "active" = true WHERE "sourceId" = $1`, [source.id]);
      await client.query(
        `UPDATE "IngestionJob"
         SET "status" = 'SUCCEEDED', "progress" = 100, "heartbeatAt" = NOW(), "completedAt" = NOW(), "updatedAt" = NOW()
         WHERE "id" = $1 AND "organizationId" = $2 AND "claimedBy" = $3 AND "status" = 'PROCESSING'`,
        [job.id, job.organizationId, job.claimedBy]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async fail(
    job: ClaimedIngestionJob,
    failure: IngestionFailure,
    maxAttempts: number,
    retryBaseMs: number
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query<{ attempts: number; sourceId: string }>(
        `SELECT "attempts", "sourceId"
         FROM "IngestionJob"
         WHERE "id" = $1 AND "organizationId" = $2 AND "claimedBy" = $3 AND "status" = 'PROCESSING'
         FOR UPDATE`,
        [job.id, job.organizationId, job.claimedBy]
      );
      const row = current.rows[0];
      if (!row) {
        await client.query("COMMIT");
        return;
      }
      const shouldRetry = failure.retryable && row.attempts < maxAttempts;
      if (shouldRetry) {
        const delayMs = retryBaseMs * 2 ** Math.max(0, row.attempts - 1);
        await client.query(
          `UPDATE "IngestionJob"
           SET
             "status" = 'PENDING',
             "availableAt" = NOW() + ($4 * INTERVAL '1 millisecond'),
             "claimedAt" = NULL,
             "claimedBy" = NULL,
             "heartbeatAt" = NULL,
             "errorCode" = $5,
             "errorMessage" = $6,
             "updatedAt" = NOW()
           WHERE "id" = $1 AND "organizationId" = $2 AND "claimedBy" = $3`,
          [job.id, job.organizationId, job.claimedBy, delayMs, failure.code, failure.message]
        );
        await client.query(
          `UPDATE "KnowledgeSource"
           SET "indexingStatus" = 'PENDING', "updatedAt" = NOW()
           WHERE "id" = $1 AND "organizationId" = $2 AND "active" = false`,
          [row.sourceId, job.organizationId]
        );
      } else {
        await client.query(
          `UPDATE "IngestionJob"
           SET
             "status" = 'FAILED',
             "heartbeatAt" = NOW(),
             "errorCode" = $4,
             "errorMessage" = $5,
             "completedAt" = NOW(),
             "updatedAt" = NOW()
           WHERE "id" = $1 AND "organizationId" = $2 AND "claimedBy" = $3`,
          [job.id, job.organizationId, job.claimedBy, failure.code, failure.message]
        );
        await client.query(
          `UPDATE "KnowledgeSource"
           SET "indexingStatus" = 'FAILED', "updatedAt" = NOW()
           WHERE "id" = $1 AND "organizationId" = $2 AND "active" = false`,
          [row.sourceId, job.organizationId]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private async insertChunks(
    client: PoolClient,
    source: IngestionSource,
    strategyVersion: string,
    chunks: PersistedChunk[],
    embeddingModel: string,
    embeddingDimensions: number
  ): Promise<void> {
    for (let start = 0; start < chunks.length; start += 100) {
      const batch = chunks.slice(start, start + 100);
      const values: unknown[] = [];
      const rows = batch.map((chunk, index) => {
        const offset = index * 12;
        values.push(
          randomUUID(),
          source.organizationId,
          source.id,
          source.version,
          source.visibility,
          strategyVersion,
          embeddingModel,
          embeddingDimensions,
          chunk.position,
          chunk.page,
          chunk.content,
          vectorLiteral(chunk.embedding)
        );
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}::vector, false)`;
      });
      await client.query(
        `INSERT INTO "KnowledgeChunk" (
           "id", "organizationId", "sourceId", "sourceVersion", "visibility", "strategyVersion", "embeddingModel",
           "embeddingDimensions", "position", "page", "content", "embedding", "active"
         ) VALUES ${rows.join(", ")}`,
        values
      );
    }
  }
}
