import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { AssistantService } from "../../assistant/application/assistant.service";
import { OrganizationContext } from "../../../shared/organization/organization-context";
import { ConversationConfig } from "./conversation-config";
import { ConversationService } from "./conversation.service";
import { ConversationRepositoryPort } from "../domain/conversation-repository.port";

const organizationId = randomUUID();
const conversationId = randomUUID();
const context: OrganizationContext = {
  organizationId,
  actor: { kind: "ANONYMOUS", conversationId, sessionId: randomUUID() }
};
const config: ConversationConfig = { messageMaxCharacters: 4000, messageRateLimit: 2, messageRateWindowSeconds: 60 };

class MemoryRepository implements ConversationRepositoryPort {
  messages: Array<{ role: "USER" | "ASSISTANT"; content: string; citations?: unknown }> = [];
  recent = 0;
  async countRecentUserMessages(): Promise<number> {
    return this.recent;
  }
  async createMessage(input: { role: "USER" | "ASSISTANT"; content: string; citations?: unknown }) {
    this.messages.push(input);
    return { id: randomUUID(), ...input, citations: input.citations ?? null, createdAt: new Date() };
  }
}

function assistant(): AssistantService {
  return {
    answer: async () => ({
      answer: "Use the reset link.",
      citations: [],
      fallback: true,
      canOpenTicket: true,
      metadata: { promptVersion: "v1", retrievalStrategyVersion: "v1", model: null }
    })
  } as unknown as AssistantService;
}

test("persists the customer message and safe assistant fallback without creating a ticket", async () => {
  const repository = new MemoryRepository();
  const service = new ConversationService(repository, assistant(), config);
  const result = await service.sendMessage(context, conversationId, "  I need help resetting my password.  ");
  assert.deepEqual(
    repository.messages.map((message) => message.role),
    ["USER", "ASSISTANT"]
  );
  assert.equal(repository.messages[0]?.content, "I need help resetting my password.");
  assert.equal(result.answer.fallback, true);
  assert.equal(result.ticketDraft?.requiresConfirmation, true);
  assert.equal(result.ticketDraft?.summary, "I need help resetting my password.");
});

test("rejects a conversation id that was not resolved from the anonymous session", async () => {
  const service = new ConversationService(new MemoryRepository(), assistant(), config);
  await assert.rejects(() => service.sendMessage(context, randomUUID(), "Question"), { status: 403 });
});

test("limits messages before persisting or calling the model", async () => {
  const repository = new MemoryRepository();
  repository.recent = 2;
  const service = new ConversationService(repository, assistant(), config);
  await assert.rejects(() => service.sendMessage(context, conversationId, "Question"), { status: 429 });
  assert.equal(repository.messages.length, 0);
});
