import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { AssistantService } from "../../assistant/application/assistant.service";
import { OrganizationContext } from "../../../shared/organization/organization-context";
import { CONVERSATION_CONFIG, ConversationConfig } from "./conversation-config";
import { CONVERSATION_REPOSITORY, ConversationRepositoryPort } from "../domain/conversation-repository.port";

export interface TicketDraft {
  summary: string;
  category: "GENERAL";
  priority: "MEDIUM";
  requiresReview: true;
  requiresConfirmation: true;
}

@Injectable()
export class ConversationService {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly repository: ConversationRepositoryPort,
    private readonly assistant: AssistantService,
    @Inject(CONVERSATION_CONFIG) private readonly config: ConversationConfig
  ) {}

  async sendMessage(context: OrganizationContext, conversationId: string, contentInput: string, requestId?: string) {
    if (context.actor.kind !== "ANONYMOUS" || context.actor.conversationId !== conversationId) {
      throw new ForbiddenException("Conversation does not belong to this session");
    }
    const content = contentInput.trim();
    if (!content || content.length > this.config.messageMaxCharacters) throw new BadRequestException("Invalid message content");
    const since = new Date(Date.now() - this.config.messageRateWindowSeconds * 1000);
    const recent = await this.repository.countRecentUserMessages(context.organizationId, conversationId, since);
    if (recent >= this.config.messageRateLimit) {
      throw new HttpException("Too many messages. Please wait before trying again.", HttpStatus.TOO_MANY_REQUESTS);
    }

    const user = await this.repository.createMessage({
      organizationId: context.organizationId,
      conversationId,
      role: "USER",
      content
    });
    const assistant = await this.assistant.answer(context, content);
    const reply = await this.repository.createMessage({
      organizationId: context.organizationId,
      conversationId,
      role: "ASSISTANT",
      content: assistant.answer,
      citations: { citations: assistant.citations, execution: { requestId: requestId ?? null, ...assistant.metadata } }
    });
    return {
      message: { id: user.id, role: user.role, content: user.content, createdAt: user.createdAt.toISOString() },
      answer: { ...assistant, createdAt: reply.createdAt.toISOString() },
      ticketDraft: assistant.canOpenTicket ? this.ticketDraft(content) : null
    };
  }

  private ticketDraft(content: string): TicketDraft {
    const normalized = content.replace(/\s+/g, " ").trim();
    return {
      summary: normalized.slice(0, 160),
      category: "GENERAL",
      priority: "MEDIUM",
      requiresReview: true,
      requiresConfirmation: true
    };
  }
}
