import { EmbeddingProviderPort } from "../domain/embedding-provider.port";
import { TextExtractor } from "./text-extractor";
import { createChunks } from "./chunker";
import { sanitizeIngestionError, IngestionError } from "./errors";
import { ClaimedIngestionJob, IngestionFailure, IngestionSource, PersistedChunk } from "./types";

export interface IngestionRepositoryPort {
  claimNext(workerId: string, maxAttempts: number, claimTimeoutMs: number): Promise<ClaimedIngestionJob | null>;
  loadSource(job: ClaimedIngestionJob): Promise<IngestionSource | null>;
  heartbeat(job: ClaimedIngestionJob, progress: number): Promise<boolean>;
  complete(
    job: ClaimedIngestionJob,
    source: IngestionSource,
    chunks: PersistedChunk[],
    embeddingModel: string,
    embeddingDimensions: number
  ): Promise<void>;
  fail(job: ClaimedIngestionJob, failure: IngestionFailure, maxAttempts: number, retryBaseMs: number): Promise<void>;
}

export interface IngestionWorkerOptions {
  workerId: string;
  maxAttempts: number;
  claimTimeoutMs: number;
  retryBaseMs: number;
  batchSize: number;
  chunkMaxCharacters: number;
  chunkOverlapCharacters: number;
}

export class IngestionWorker {
  constructor(
    private readonly repository: IngestionRepositoryPort,
    private readonly extractor: TextExtractor,
    private readonly embeddings: EmbeddingProviderPort,
    private readonly options: IngestionWorkerOptions
  ) {}

  async runOnce(): Promise<{ processed: boolean; jobId?: string; failure?: IngestionFailure }> {
    const job = await this.repository.claimNext(
      this.options.workerId,
      this.options.maxAttempts,
      this.options.claimTimeoutMs
    );
    if (!job) return { processed: false };
    try {
      await this.process(job);
      return { processed: true, jobId: job.id };
    } catch (error) {
      const failure = sanitizeIngestionError(error);
      await this.repository.fail(job, failure, this.options.maxAttempts, this.options.retryBaseMs);
      return { processed: true, jobId: job.id, failure };
    }
  }

  private async process(job: ClaimedIngestionJob): Promise<void> {
    const source = await this.repository.loadSource(job);
    if (!source || source.organizationId !== job.organizationId || source.id !== job.sourceId) {
      throw new IngestionError("SOURCE_NOT_FOUND", "The source is unavailable for ingestion", false);
    }
    if (!(await this.repository.heartbeat(job, 5))) {
      throw new IngestionError("JOB_CLAIM_LOST", "The ingestion job claim is no longer valid", true);
    }
    const fragments = await this.extractor.extract(source);
    const chunks = createChunks(fragments, {
      maxCharacters: this.options.chunkMaxCharacters,
      overlapCharacters: this.options.chunkOverlapCharacters
    });
    const persisted: PersistedChunk[] = [];
    let embeddingModel: string | undefined;
    let embeddingDimensions: number | undefined;
    for (let start = 0; start < chunks.length; start += this.options.batchSize) {
      const batch = chunks.slice(start, start + this.options.batchSize);
      const result = await this.embeddings.embed(batch.map((chunk) => chunk.content));
      if (result.embeddings.length !== batch.length) {
        throw new IngestionError(
          "EMBEDDING_RESPONSE_INVALID",
          "The embedding provider returned an incomplete response",
          true
        );
      }
      if (embeddingModel && (embeddingModel !== result.model || embeddingDimensions !== result.dimensions)) {
        throw new IngestionError(
          "EMBEDDING_RESPONSE_INCONSISTENT",
          "The embedding provider changed within one job",
          true
        );
      }
      embeddingModel = result.model;
      embeddingDimensions = result.dimensions;
      for (let index = 0; index < batch.length; index += 1) {
        const chunk = batch[index];
        const embedding = result.embeddings[index];
        if (!chunk || !embedding) {
          throw new IngestionError(
            "EMBEDDING_RESPONSE_INVALID",
            "The embedding provider returned an incomplete response",
            true
          );
        }
        persisted.push({ ...chunk, embedding });
      }
      const progress = 10 + Math.floor(((start + batch.length) / chunks.length) * 80);
      if (!(await this.repository.heartbeat(job, progress))) {
        throw new IngestionError("JOB_CLAIM_LOST", "The ingestion job claim is no longer valid", true);
      }
    }
    if (!embeddingModel || !embeddingDimensions) {
      throw new IngestionError("EMBEDDING_RESPONSE_INVALID", "The embedding provider returned no embeddings", true);
    }
    await this.repository.complete(job, source, persisted, embeddingModel, embeddingDimensions);
  }
}
