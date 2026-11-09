import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { OrganizationContext } from "../../../shared/organization/organization-context";
import {
  TICKET_REPOSITORY,
  TicketAuditEntry,
  TicketPriority,
  TicketRecord,
  TicketRepositoryPort,
  TicketStatus
} from "../domain/ticket-repository.port";

export interface CreateTicketInput {
  conversationId: string;
  confirmed: boolean;
  idempotencyKey: string;
  summary: string;
  description: string;
  contactEmail?: string;
  contactPhone?: string;
  category?: string;
  priority?: TicketPriority;
}

export interface TicketCitationView {
  sourceId: string;
  sourceVersion: number;
  title: string;
  page: number | null;
}

export interface TicketMessageView {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  citations: TicketCitationView[];
  createdAt: Date;
}

export type TicketDetailView = TicketRecord & { messages: TicketMessageView[]; history: TicketAuditEntry[] };

/**
 * Keeps only the citation fields an attendant needs. Execution metadata (request id, model, prompt
 * version) and any unexpected payload stored with the message are never exposed.
 */
export function sanitizeCitations(stored: unknown): TicketCitationView[] {
  const list = Array.isArray(stored)
    ? stored
    : stored && typeof stored === "object" && Array.isArray((stored as { citations?: unknown }).citations)
      ? (stored as { citations: unknown[] }).citations
      : [];
  const result: TicketCitationView[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const { sourceId, sourceVersion, title, page } = item as Record<string, unknown>;
    if (typeof sourceId !== "string" || typeof title !== "string" || typeof sourceVersion !== "number") continue;
    result.push({ sourceId, sourceVersion, title, page: typeof page === "number" ? page : null });
  }
  return result;
}

@Injectable()
export class TicketService {
  constructor(@Inject(TICKET_REPOSITORY) private readonly repository: TicketRepositoryPort) {}

  async createConfirmed(context: OrganizationContext, input: CreateTicketInput): Promise<TicketRecord> {
    if (context.actor.kind !== "ANONYMOUS" || context.actor.conversationId !== input.conversationId) {
      throw new ForbiddenException("Conversation does not belong to this session");
    }
    if (!input.confirmed) throw new ConflictException("Explicit confirmation is required before creating a ticket");
    if (!input.idempotencyKey || input.idempotencyKey.length > 200)
      throw new BadRequestException("Idempotency-Key header is required");
    if (!input.contactEmail?.trim() && !input.contactPhone?.trim()) {
      throw new BadRequestException("A contact email or phone is required");
    }
    return this.repository.createConfirmed({
      organizationId: context.organizationId,
      conversationId: input.conversationId,
      idempotencyKey: input.idempotencyKey,
      number: `TCK-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`,
      summary: input.summary.trim(),
      description: input.description.trim(),
      contactEmail: input.contactEmail?.trim() || null,
      contactPhone: input.contactPhone?.trim() || null,
      category: input.category?.trim() || null,
      priority: input.priority ?? "MEDIUM",
      status: "OPEN"
    });
  }

  list(
    context: OrganizationContext,
    filters: { status?: TicketStatus; priority?: TicketPriority }
  ): Promise<TicketRecord[]> {
    this.attendant(context);
    return this.repository.list(context.organizationId, filters);
  }

  async find(context: OrganizationContext, ticketId: string): Promise<TicketRecord> {
    this.attendant(context);
    const ticket = await this.repository.find(context.organizationId, ticketId);
    if (!ticket) throw new NotFoundException("Ticket not found");
    return ticket;
  }

  async detail(context: OrganizationContext, ticketId: string): Promise<TicketDetailView> {
    this.attendant(context);
    const detail = await this.repository.findDetail(context.organizationId, ticketId);
    if (!detail) throw new NotFoundException("Ticket not found");
    return {
      ...detail.ticket,
      messages: detail.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        citations: message.role === "ASSISTANT" ? sanitizeCitations(message.citations) : [],
        createdAt: message.createdAt
      })),
      history: detail.history
    };
  }

  async updateManual(
    context: OrganizationContext,
    ticketId: string,
    input: { status?: TicketStatus; priority?: TicketPriority; category?: string | null }
  ): Promise<TicketRecord> {
    const actor = this.attendant(context);
    const ticket = await this.repository.updateManual({
      organizationId: context.organizationId,
      ticketId,
      actorUserId: actor.userId,
      ...input
    });
    if (!ticket) throw new NotFoundException("Ticket not found");
    return ticket;
  }

  private attendant(context: OrganizationContext) {
    if (context.actor.kind !== "ATTENDANT") throw new ForbiddenException("Attendant session required");
    return context.actor;
  }
}
