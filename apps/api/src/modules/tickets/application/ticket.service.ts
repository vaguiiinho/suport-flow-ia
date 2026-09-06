import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { OrganizationContext } from "../../../shared/organization/organization-context";
import { TICKET_REPOSITORY, TicketPriority, TicketRecord, TicketRepositoryPort, TicketStatus } from "../domain/ticket-repository.port";

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

@Injectable()
export class TicketService {
  constructor(@Inject(TICKET_REPOSITORY) private readonly repository: TicketRepositoryPort) {}

  async createConfirmed(context: OrganizationContext, input: CreateTicketInput): Promise<TicketRecord> {
    if (context.actor.kind !== "ANONYMOUS" || context.actor.conversationId !== input.conversationId) {
      throw new ForbiddenException("Conversation does not belong to this session");
    }
    if (!input.confirmed) throw new ConflictException("Explicit confirmation is required before creating a ticket");
    if (!input.idempotencyKey || input.idempotencyKey.length > 200) throw new BadRequestException("Idempotency-Key header is required");
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

  list(context: OrganizationContext, filters: { status?: TicketStatus; priority?: TicketPriority }): Promise<TicketRecord[]> {
    this.attendant(context);
    return this.repository.list(context.organizationId, filters);
  }

  async find(context: OrganizationContext, ticketId: string): Promise<TicketRecord> {
    this.attendant(context);
    const ticket = await this.repository.find(context.organizationId, ticketId);
    if (!ticket) throw new NotFoundException("Ticket not found");
    return ticket;
  }

  async updateManual(
    context: OrganizationContext,
    ticketId: string,
    input: { status?: TicketStatus; priority?: TicketPriority; category?: string | null }
  ): Promise<TicketRecord> {
    const actor = this.attendant(context);
    const ticket = await this.repository.updateManual({ organizationId: context.organizationId, ticketId, actorUserId: actor.userId, ...input });
    if (!ticket) throw new NotFoundException("Ticket not found");
    return ticket;
  }

  private attendant(context: OrganizationContext) {
    if (context.actor.kind !== "ATTENDANT") throw new ForbiddenException("Attendant session required");
    return context.actor;
  }
}
