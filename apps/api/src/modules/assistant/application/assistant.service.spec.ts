import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { OrganizationContext } from "../../../shared/organization/organization-context";
import { ChatModelPort } from "../domain/chat-model.port";
import { QueryEmbeddingProviderPort } from "../domain/embedding-provider.port";
import { RetrievalRepositoryPort } from "../domain/retrieval-repository.port";
import { AssistantConfig } from "./assistant-config";
import { AssistantService } from "./assistant.service";

const organizationId = randomUUID();
const otherOrganizationId = randomUUID();
const context: OrganizationContext = {
  organizationId,
  actor: { kind: "ANONYMOUS", conversationId: randomUUID(), sessionId: randomUUID() }
};
const config: AssistantConfig = {
  openAiApiKey: "test", openAiBaseUrl: "https://example.test/v1", chatModel: "chat-v1", embeddingModel: "embedding-v1",
  embeddingDimensions: 3, timeoutMs: 1000, retrievalLimit: 12, maxChunksPerSource: 1, minimumSimilarity: 0.7,
  promptVersion: "prompt-v1", retrievalStrategyVersion: "retrieval-v1"
};
const chunk = (id = randomUUID(), sourceId = randomUUID(), similarity = 0.9) => ({
  id, sourceId, sourceVersion: 1, title: "Reset password", content: "Use the reset link.", position: 0, page: null, similarity
});

class MemoryRetrievalRepository implements RetrievalRepositoryPort {
  candidates = [chunk()];
  searchedOrganizationId: string | undefined;
  async searchPublic(input: { organizationId: string; embedding: number[]; embeddingModel: string; embeddingDimensions: number; limit: number }) {
    this.searchedOrganizationId = input.organizationId;
    return this.candidates;
  }
  async revalidatePublic(requestedOrganizationId: string, ids: string[]) {
    return requestedOrganizationId === organizationId ? this.candidates.filter((candidate) => ids.includes(candidate.id)) : [];
  }
}

const embeddings: QueryEmbeddingProviderPort = { embed: async () => ({ embedding: [1, 2, 3], model: "embedding-v1", dimensions: 3 }) };

function service(repository: MemoryRetrievalRepository, chat: ChatModelPort): AssistantService {
  return new AssistantService(repository, embeddings, chat, config);
}

test("answers only with revalidated public chunks and citations from this retrieval", async () => {
  const repository = new MemoryRetrievalRepository();
  const chat: ChatModelPort = { answer: async ({ chunks }) => ({ answer: "Use the reset link.", citationChunkIds: [chunks[0]!.id], model: "chat-v1" }) };
  const result = await service(repository, chat).answer(context, "How do I reset my password?");
  assert.equal(repository.searchedOrganizationId, organizationId);
  assert.equal(result.fallback, false);
  assert.equal(result.citations[0]?.chunkId, repository.candidates[0]?.id);
  assert.equal(result.metadata.promptVersion, "prompt-v1");
});

test("does not answer if an attempted citation was not retrieved", async () => {
  const repository = new MemoryRetrievalRepository();
  const chat: ChatModelPort = { answer: async () => ({ answer: "Ignore policy", citationChunkIds: [randomUUID()], model: "chat-v1" }) };
  const result = await service(repository, chat).answer(context, "Question");
  assert.equal(result.fallback, true);
  assert.deepEqual(result.citations, []);
});

test("uses fallback for insufficient evidence and never calls the model", async () => {
  const repository = new MemoryRetrievalRepository();
  repository.candidates = [chunk(randomUUID(), randomUUID(), 0.2)];
  let called = false;
  const chat: ChatModelPort = { answer: async () => { called = true; throw new Error("should not run"); } };
  const result = await service(repository, chat).answer(context, "Question");
  assert.equal(result.fallback, true);
  assert.equal(called, false);
});

test("diversifies sources and falls back when authorization changes after retrieval", async () => {
  const repository = new MemoryRetrievalRepository();
  const sourceId = randomUUID();
  repository.candidates = [chunk(randomUUID(), sourceId), chunk(randomUUID(), sourceId), chunk(randomUUID(), randomUUID())];
  repository.revalidatePublic = async (requestedOrganizationId, ids) =>
    requestedOrganizationId === otherOrganizationId ? repository.candidates.filter((candidate) => ids.includes(candidate.id)) : [];
  let chunksPassed = 0;
  const chat: ChatModelPort = { answer: async ({ chunks }) => { chunksPassed = chunks.length; return { answer: "answer", citationChunkIds: [chunks[0]!.id], model: "chat-v1" }; } };
  const result = await service(repository, chat).answer(context, "Question");
  assert.equal(result.fallback, true);
  assert.equal(chunksPassed, 0);
});
