import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { EmbeddingProviderPort } from "../domain/embedding-provider.port";
import { PostgresIngestionRepository } from "../infrastructure/postgres-ingestion-repository";
import { TextExtractor } from "./text-extractor";
import { IngestionWorker } from "./ingestion-worker";

const databaseUrl = process.env.DATABASE_URL;

test(
  "claims, retries, and activates chunks without crossing organization boundaries",
  { skip: !databaseUrl },
  async (context) => {
    const pool = new Pool({ connectionString: databaseUrl });
    const repository = new PostgresIngestionRepository(pool);
    const suffix = randomUUID();
    const organizationA = randomUUID();
    const organizationB = randomUUID();
    const familyId = randomUUID();
    const activeSourceId = randomUUID();
    const pendingSourceId = randomUUID();
    const pendingJobId = randomUUID();
    const otherSourceId = randomUUID();
    const otherJobId = randomUUID();
    context.after(async () => {
      try {
        await pool.query(`DELETE FROM "KnowledgeSource" WHERE "organizationId" = ANY($1::uuid[])`, [
          [organizationA, organizationB]
        ]);
        await pool.query(`DELETE FROM "Organization" WHERE "id" = ANY($1::uuid[])`, [[organizationA, organizationB]]);
      } finally {
        await pool.end();
      }
    });

    await pool.query(
      `INSERT INTO "Organization" ("id", "name", "slug", "updatedAt")
     VALUES ($1, 'Worker A', $2, NOW()), ($3, 'Worker B', $4, NOW())`,
      [organizationA, `worker-a-${suffix}`, organizationB, `worker-b-${suffix}`]
    );
    const insertSource = async (
      id: string,
      organizationId: string,
      sourceFamilyId: string,
      version: number,
      status: "PENDING" | "SUCCEEDED",
      active: boolean
    ) => {
      await pool.query(
        `INSERT INTO "KnowledgeSource" (
         "id", "familyId", "organizationId", "type", "visibility", "title", "content", "contentHash",
         "version", "indexingStatus", "active", "updatedAt"
       ) VALUES ($1, $2, $3, 'ARTICLE', 'PUBLIC', 'Worker source', 'Useful support content for indexing.', $4, $5, $6, $7, NOW())`,
        [id, sourceFamilyId, organizationId, `hash-${id}`, version, status, active]
      );
    };
    await insertSource(activeSourceId, organizationA, familyId, 1, "SUCCEEDED", true);
    await insertSource(pendingSourceId, organizationA, familyId, 2, "PENDING", false);
    await insertSource(otherSourceId, organizationB, randomUUID(), 1, "PENDING", false);
    await pool.query(
      `INSERT INTO "KnowledgeChunk" (
       "id", "organizationId", "sourceId", "sourceVersion", "visibility", "strategyVersion", "embeddingModel",
       "embeddingDimensions", "position", "content", "active"
     ) VALUES ($1, $2, $3, 1, 'PUBLIC', 'legacy-v0', 'legacy', 0, 0, 'Old active chunk', true)`,
      [randomUUID(), organizationA, activeSourceId]
    );
    await pool.query(
      `INSERT INTO "IngestionJob" (
       "id", "organizationId", "sourceId", "operation", "status", "idempotencyKey", "strategyVersion", "availableAt", "updatedAt"
     ) VALUES
       ($1, $2, $3, 'INDEX', 'PENDING', $4, 'support-flow-ingestion-v1', '2000-01-01', NOW()),
       ($5, $6, $7, 'INDEX', 'PENDING', $8, 'support-flow-ingestion-v1', '2100-01-01', NOW())`,
      [
        pendingJobId,
        organizationA,
        pendingSourceId,
        `job-${pendingJobId}`,
        otherJobId,
        organizationB,
        otherSourceId,
        `job-${otherJobId}`
      ]
    );

    const extractor = {
      extract: async () => [{ content: "Useful support content for indexing.", page: null }]
    } as unknown as TextExtractor;
    const embeddings: EmbeddingProviderPort = {
      embed: async (texts) => ({
        embeddings: texts.map(() => [0.1, 0.2, 0.3]),
        model: "fake-embedding-v1",
        dimensions: 3,
        inputTokens: 3
      })
    };
    const worker = new IngestionWorker(repository, extractor, embeddings, {
      workerId: "worker-integration",
      maxAttempts: 3,
      claimTimeoutMs: 60_000,
      retryBaseMs: 1,
      batchSize: 10,
      chunkMaxCharacters: 200,
      chunkOverlapCharacters: 20
    });

    const processed = await worker.runOnce();
    assert.equal(processed.jobId, pendingJobId);
    const [oldSource, newSource, job, chunks, otherJob] = await Promise.all([
      pool.query<{ active: boolean }>(`SELECT "active" FROM "KnowledgeSource" WHERE "id" = $1`, [activeSourceId]),
      pool.query<{ active: boolean; indexingStatus: string }>(
        `SELECT "active", "indexingStatus" FROM "KnowledgeSource" WHERE "id" = $1`,
        [pendingSourceId]
      ),
      pool.query<{ status: string; progress: number }>(
        `SELECT "status", "progress" FROM "IngestionJob" WHERE "id" = $1`,
        [pendingJobId]
      ),
      pool.query<{ organizationId: string; active: boolean; embeddingDimensions: number }>(
        `SELECT "organizationId", "active", "embeddingDimensions" FROM "KnowledgeChunk" WHERE "sourceId" = $1`,
        [pendingSourceId]
      ),
      pool.query<{ status: string }>(`SELECT "status" FROM "IngestionJob" WHERE "id" = $1`, [otherJobId])
    ]);
    assert.equal(oldSource.rows[0]?.active, false);
    assert.deepEqual(newSource.rows[0], { active: true, indexingStatus: "SUCCEEDED" });
    assert.deepEqual(job.rows[0], { status: "SUCCEEDED", progress: 100 });
    assert.deepEqual(chunks.rows[0], { organizationId: organizationA, active: true, embeddingDimensions: 3 });
    assert.equal(otherJob.rows[0]?.status, "PENDING");

    const retrySourceId = randomUUID();
    const retryJobId = randomUUID();
    await insertSource(retrySourceId, organizationA, randomUUID(), 1, "PENDING", false);
    await pool.query(
      `INSERT INTO "IngestionJob" (
       "id", "organizationId", "sourceId", "operation", "status", "idempotencyKey", "strategyVersion", "availableAt", "updatedAt"
     ) VALUES ($1, $2, $3, 'INDEX', 'PENDING', $4, 'support-flow-ingestion-v1', '1999-01-01', NOW())`,
      [retryJobId, organizationA, retrySourceId, `job-${retryJobId}`]
    );
    const claimedRetry = await repository.claimNext("worker-retry", 3, 60_000);
    assert.equal(claimedRetry?.id, retryJobId);
    if (!claimedRetry) throw new Error("Expected retry job to be claimed");
    await repository.fail(
      claimedRetry,
      { code: "EMBEDDING_UNAVAILABLE", message: "The embedding provider is unavailable", retryable: true },
      3,
      1
    );
    const retry = await pool.query<{ status: string; attempts: number; errorCode: string }>(
      `SELECT "status", "attempts", "errorCode" FROM "IngestionJob" WHERE "id" = $1`,
      [retryJobId]
    );
    assert.deepEqual(retry.rows[0], { status: "PENDING", attempts: 1, errorCode: "EMBEDDING_UNAVAILABLE" });

    const interruptedSourceId = randomUUID();
    const interruptedJobId = randomUUID();
    await insertSource(interruptedSourceId, organizationA, randomUUID(), 1, "PENDING", false);
    await pool.query(
      `INSERT INTO "IngestionJob" (
       "id", "organizationId", "sourceId", "operation", "status", "idempotencyKey", "strategyVersion",
       "attempts", "claimedBy", "claimedAt", "heartbeatAt", "availableAt", "updatedAt"
     ) VALUES ($1, $2, $3, 'INDEX', 'PROCESSING', $4, 'support-flow-ingestion-v1', 0, 'stopped-worker', '2000-01-01', '2000-01-01', '1998-01-01', NOW())`,
      [interruptedJobId, organizationA, interruptedSourceId, `job-${interruptedJobId}`]
    );
    const reclaimed = await repository.claimNext("worker-reclaimed", 3, 60_000);
    assert.equal(reclaimed?.id, interruptedJobId);
    assert.equal(reclaimed?.attempts, 1);
    assert.equal(reclaimed?.claimedBy, "worker-reclaimed");
  }
);
