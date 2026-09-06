import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { ConversationRepositoryPort, StoredMessage } from "../domain/conversation-repository.port";

@Injectable()
export class PrismaConversationRepository implements ConversationRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  countRecentUserMessages(organizationId: string, conversationId: string, since: Date): Promise<number> {
    return this.prisma.message.count({
      where: { role: "USER", createdAt: { gte: since }, conversation: { id: conversationId, organizationId, status: "OPEN" } }
    });
  }

  async createMessage(input: {
    organizationId: string;
    conversationId: string;
    role: "USER" | "ASSISTANT";
    content: string;
    citations?: unknown;
  }): Promise<StoredMessage> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: input.conversationId, organizationId: input.organizationId, status: "OPEN" },
      select: { id: true }
    });
    if (!conversation) throw new Error("Conversation unavailable");
    const message = await this.prisma.message.create({
      data: { conversationId: conversation.id, role: input.role, content: input.content, citations: input.citations as never }
    });
    return { ...message, role: message.role as "USER" | "ASSISTANT" };
  }
}
