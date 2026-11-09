import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { TicketDetailRecord, TicketRecord, TicketRepositoryPort } from "../domain/ticket-repository.port";

@Injectable()
export class PrismaTicketRepository implements TicketRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async createConfirmed(
    input: Omit<TicketRecord, "id" | "createdAt" | "updatedAt"> & { idempotencyKey: string }
  ): Promise<TicketRecord> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.ticket.findUnique({
          where: {
            organizationId_idempotencyKey: {
              organizationId: input.organizationId,
              idempotencyKey: input.idempotencyKey
            }
          }
        });
        if (existing) return existing;
        const conversation = await transaction.conversation.findFirst({
          where: { id: input.conversationId, organizationId: input.organizationId, status: "OPEN" },
          select: { id: true }
        });
        if (!conversation) throw new Error("Conversation unavailable");
        const ticket = await transaction.ticket.create({ data: input });
        await transaction.ticketAuditEvent.create({
          data: {
            organizationId: input.organizationId,
            ticketId: ticket.id,
            type: "CREATED",
            changes: { status: ticket.status }
          }
        });
        await transaction.conversation.update({ where: { id: conversation.id }, data: { status: "ESCALATED" } });
        return ticket;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await this.prisma.ticket.findUnique({
          where: {
            organizationId_idempotencyKey: {
              organizationId: input.organizationId,
              idempotencyKey: input.idempotencyKey
            }
          }
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  list(
    organizationId: string,
    filters: { status?: TicketRecord["status"]; priority?: TicketRecord["priority"] }
  ): Promise<TicketRecord[]> {
    return this.prisma.ticket.findMany({ where: { organizationId, ...filters }, orderBy: { updatedAt: "desc" } });
  }

  find(organizationId: string, ticketId: string): Promise<TicketRecord | null> {
    return this.prisma.ticket.findFirst({ where: { id: ticketId, organizationId } });
  }

  async findDetail(organizationId: string, ticketId: string): Promise<TicketDetailRecord | null> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, organizationId },
      include: {
        conversation: {
          select: {
            organizationId: true,
            messages: {
              where: { role: { in: ["USER", "ASSISTANT"] } },
              orderBy: { createdAt: "asc" },
              select: { id: true, role: true, content: true, citations: true, createdAt: true }
            }
          }
        },
        auditEvents: {
          where: { organizationId },
          orderBy: { createdAt: "asc" },
          select: { id: true, type: true, actorUserId: true, changes: true, createdAt: true }
        }
      }
    });
    if (!ticket) return null;
    const { conversation, auditEvents, idempotencyKey: _idempotencyKey, ...record } = ticket;
    return {
      ticket: record,
      messages:
        conversation.organizationId === organizationId
          ? conversation.messages.map((message) => ({
              ...message,
              role: message.role === "USER" ? "USER" : "ASSISTANT"
            }))
          : [],
      history: auditEvents
    };
  }

  async updateManual(input: {
    organizationId: string;
    ticketId: string;
    actorUserId: string;
    status?: TicketRecord["status"];
    priority?: TicketRecord["priority"];
    category?: string | null;
  }): Promise<TicketRecord | null> {
    const { organizationId, ticketId, actorUserId, ...data } = input;
    if (Object.values(data).every((value) => value === undefined)) return this.find(organizationId, ticketId);
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.ticket.updateMany({ where: { id: ticketId, organizationId }, data });
      if (updated.count === 0) return null;
      const ticket = await transaction.ticket.findFirstOrThrow({ where: { id: ticketId, organizationId } });
      await transaction.ticketAuditEvent.create({
        data: { organizationId, ticketId, actorUserId, type: "UPDATED", changes: data }
      });
      return ticket;
    });
  }
}
