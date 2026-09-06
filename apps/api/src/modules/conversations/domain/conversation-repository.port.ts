export const CONVERSATION_REPOSITORY = Symbol("CONVERSATION_REPOSITORY");

export interface StoredMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  citations: unknown;
  createdAt: Date;
}

export interface ConversationRepositoryPort {
  countRecentUserMessages(organizationId: string, conversationId: string, since: Date): Promise<number>;
  createMessage(input: {
    organizationId: string;
    conversationId: string;
    role: "USER" | "ASSISTANT";
    content: string;
    citations?: unknown;
  }): Promise<StoredMessage>;
}
