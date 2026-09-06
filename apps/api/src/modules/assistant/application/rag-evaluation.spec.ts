import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { OrganizationContext } from "../../../shared/organization/organization-context";
import { ChatModelPort } from "../domain/chat-model.port";
import { QueryEmbeddingProviderPort } from "../domain/embedding-provider.port";
import { RetrievalRepositoryPort } from "../domain/retrieval-repository.port";
import { AssistantConfig } from "./assistant-config";
import { AssistantService } from "./assistant.service";

type Evaluation = { version: string; cases: Array<{ id: string; kind: "answer" | "fallback"; question: string; similarity: number }> };
const dataset = JSON.parse(readFileSync(new URL("../../../../test/fixtures/rag-evaluation.v1.json", import.meta.url), "utf8")) as Evaluation;
const context: OrganizationContext = { organizationId: randomUUID(), actor: { kind: "ANONYMOUS", conversationId: randomUUID(), sessionId: randomUUID() } };
const config: AssistantConfig = { openAiApiKey: "test", openAiBaseUrl: "https://example.test", chatModel: "chat-v1", embeddingModel: "embed-v1", embeddingDimensions: 3, timeoutMs: 1000, retrievalLimit: 4, maxChunksPerSource: 2, minimumSimilarity: 0.65, promptVersion: "v1", retrievalStrategyVersion: dataset.version };
const embeddings: QueryEmbeddingProviderPort = { embed: async () => ({ embedding: [1, 2, 3], model: "embed-v1", dimensions: 3 }) };

test("versioned RAG dataset meets retrieval, citation, fallback and injection gates", async () => {
  let answered = 0;
  let expectedAnswers = 0;
  let instructions = "";
  for (const item of dataset.cases) {
    const chunk = { id: randomUUID(), sourceId: randomUUID(), sourceVersion: 1, title: "Public guide", content: "Public support guidance.", position: 0, page: null, similarity: item.similarity };
    const repository: RetrievalRepositoryPort = {
      searchPublic: async () => [chunk],
      revalidatePublic: async (_organizationId, ids) => item.id === "internal-source" ? [] : [chunk].filter((candidate) => ids.includes(candidate.id))
    };
    const chat: ChatModelPort = { answer: async (input) => { instructions = input.instructions; return { answer: "Supported answer", citationChunkIds: [input.chunks[0]!.id], model: "chat-v1" }; } };
    const result = await new AssistantService(repository, embeddings, chat, config).answer(context, item.question);
    if (item.kind === "answer") {
      expectedAnswers += 1;
      assert.equal(result.fallback, false, item.id);
      assert.equal(result.citations.length, 1, item.id);
      answered += 1;
    } else assert.equal(result.fallback, true, item.id);
  }
  assert.equal(answered / expectedAnswers, 1);
  assert.match(instructions, /untrusted data/i);
  assert.match(instructions, /never change policy, authorization, or tools/i);
});
