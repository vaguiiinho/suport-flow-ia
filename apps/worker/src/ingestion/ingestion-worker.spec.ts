import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { EmbeddingProviderPort } from "../domain/embedding-provider.port";
import { TextExtractor } from "./text-extractor";
import { IngestionRepositoryPort, IngestionWorker } from "./ingestion-worker";
import { ClaimedIngestionJob, IngestionFailure, IngestionSource, PersistedChunk } from "./types";

const organizationId = randomUUID();
const sourceId = randomUUID();
const job: ClaimedIngestionJob = {
  id: randomUUID(),
  organizationId,
  sourceId,
  operation: "INDEX",
  status: "PROCESSING",
  strategyVersion: "support-flow-ingestion-v1",
  attempts: 1,
  claimedBy: "worker-test"
};
const source: IngestionSource = {
  id: sourceId,
  familyId: randomUUID(),
  organizationId,
  type: "ARTICLE",
  visibility: "PUBLIC",
  content: "A support article with enough content to become a chunk.",
  storageKey: null,
  contentHash: "hash",
  version: 1,
  active: false
};

class MemoryRepository implements IngestionRepositoryPort {
  completeCalls: Array<{ chunks: PersistedChunk[]; source: IngestionSource }> = [];
  failures: IngestionFailure[] = [];
  nextSource: IngestionSource | null = source;

  async claimNext(): Promise<ClaimedIngestionJob | null> {
    return job;
  }

  async loadSource(): Promise<IngestionSource | null> {
    return this.nextSource;
  }

  async heartbeat(): Promise<boolean> {
    return true;
  }

  async complete(_job: ClaimedIngestionJob, completedSource: IngestionSource, chunks: PersistedChunk[]): Promise<void> {
    this.completeCalls.push({ source: completedSource, chunks });
  }

  async fail(_job: ClaimedIngestionJob, failure: IngestionFailure): Promise<void> {
    this.failures.push(failure);
  }
}

function createWorker(repository: MemoryRepository, embeddingProvider: EmbeddingProviderPort): IngestionWorker {
  const extractor = {
    extract: async () => [{ content: source.content!, page: null }]
  } as unknown as TextExtractor;
  return new IngestionWorker(repository, extractor, embeddingProvider, {
    workerId: "worker-test",
    maxAttempts: 3,
    claimTimeoutMs: 1000,
    retryBaseMs: 100,
    batchSize: 5,
    chunkMaxCharacters: 200,
    chunkOverlapCharacters: 20
  });
}

test("processes a claimed source, records progress, and completes atomically", async () => {
  const repository = new MemoryRepository();
  const worker = createWorker(repository, {
    embed: async (texts) => ({
      embeddings: texts.map(() => [1, 2, 3]),
      model: "fake-embedding-v1",
      dimensions: 3,
      inputTokens: 4
    })
  });

  const result = await worker.runOnce();
  assert.deepEqual(result, { processed: true, jobId: job.id });
  assert.equal(repository.failures.length, 0);
  assert.equal(repository.completeCalls.length, 1);
  assert.equal(repository.completeCalls[0]?.chunks[0]?.embedding.length, 3);
  assert.equal(repository.completeCalls[0]?.chunks[0]?.position, 0);
});

test("never completes a job when the source does not belong to its organization", async () => {
  const repository = new MemoryRepository();
  repository.nextSource = { ...source, organizationId: randomUUID() };
  const worker = createWorker(repository, {
    embed: async () => ({ embeddings: [], model: "fake", dimensions: 3, inputTokens: 0 })
  });

  const result = await worker.runOnce();
  assert.equal(result.failure?.code, "SOURCE_NOT_FOUND");
  assert.equal(repository.completeCalls.length, 0);
  assert.equal(repository.failures[0]?.retryable, false);
});
