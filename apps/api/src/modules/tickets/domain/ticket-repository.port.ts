export const TICKET_REPOSITORY = Symbol("TICKET_REPOSITORY");

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface TicketRecord {
  id: string;
  organizationId: string;
  conversationId: string;
  number: string;
  summary: string;
  description: string;
  contactEmail: string | null;
  contactPhone: string | null;
  category: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketConversationMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  citations: unknown;
  createdAt: Date;
}

export interface TicketAuditEntry {
  id: string;
  type: "CREATED" | "UPDATED";
  actorUserId: string | null;
  changes: unknown;
  createdAt: Date;
}

export interface TicketDetailRecord {
  ticket: TicketRecord;
  messages: TicketConversationMessage[];
  history: TicketAuditEntry[];
}

export interface TicketRepositoryPort {
  createConfirmed(
    input: Omit<TicketRecord, "id" | "createdAt" | "updatedAt"> & { idempotencyKey: string }
  ): Promise<TicketRecord>;
  list(organizationId: string, filters: { status?: TicketStatus; priority?: TicketPriority }): Promise<TicketRecord[]>;
  find(organizationId: string, ticketId: string): Promise<TicketRecord | null>;
  findDetail(organizationId: string, ticketId: string): Promise<TicketDetailRecord | null>;
  updateManual(input: {
    organizationId: string;
    ticketId: string;
    actorUserId: string;
    status?: TicketStatus;
    priority?: TicketPriority;
    category?: string | null;
  }): Promise<TicketRecord | null>;
}
