import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { OrganizationContext } from "../../../shared/organization/organization-context";
import { TicketRecord, TicketRepositoryPort } from "../domain/ticket-repository.port";
import { TicketService } from "./ticket.service";

const organizationId = randomUUID();
const conversationId = randomUUID();
const anonymous: OrganizationContext = { organizationId, actor: { kind: "ANONYMOUS", conversationId, sessionId: randomUUID() } };
const attendant: OrganizationContext = { organizationId, actor: { kind: "ATTENDANT", userId: randomUUID(), sessionId: randomUUID() } };

class MemoryTicketRepository implements TicketRepositoryPort {
  tickets: TicketRecord[] = [];
  async createConfirmed(input: Omit<TicketRecord, "id" | "createdAt" | "updatedAt"> & { idempotencyKey: string }) {
    const existing = this.tickets.find((ticket) => ticket.organizationId === input.organizationId && (ticket as TicketRecord & { idempotencyKey?: string }).idempotencyKey === input.idempotencyKey);
    if (existing) return existing;
    const ticket = { ...input, id: randomUUID(), createdAt: new Date(), updatedAt: new Date() } as TicketRecord & { idempotencyKey: string };
    this.tickets.push(ticket);
    return ticket;
  }
  async list(requestedOrganizationId: string) { return this.tickets.filter((ticket) => ticket.organizationId === requestedOrganizationId); }
  async find(requestedOrganizationId: string, ticketId: string) { return this.tickets.find((ticket) => ticket.organizationId === requestedOrganizationId && ticket.id === ticketId) ?? null; }
  async updateManual(input: { organizationId: string; ticketId: string; status?: TicketRecord["status"]; priority?: TicketRecord["priority"]; category?: string | null }) {
    const ticket = await this.find(input.organizationId, input.ticketId);
    if (!ticket) return null;
    Object.assign(ticket, { status: input.status ?? ticket.status, priority: input.priority ?? ticket.priority, category: input.category ?? ticket.category });
    return ticket;
  }
}

function input(overrides: Partial<Parameters<TicketService["createConfirmed"]>[1]> = {}) {
  return { conversationId, confirmed: true, idempotencyKey: "create-ticket-1", summary: "Password reset", description: "I cannot reset my password.", contactEmail: "customer@example.test", ...overrides };
}

test("creates a ticket only after explicit confirmation and keeps idempotent retries", async () => {
  const repository = new MemoryTicketRepository();
  const service = new TicketService(repository);
  const first = await service.createConfirmed(anonymous, input());
  const retry = await service.createConfirmed(anonymous, input());
  assert.equal(first.id, retry.id);
  assert.equal(first.status, "OPEN");
  assert.equal(repository.tickets.length, 1);
});

test("rejects absent confirmation, contact or a conversation from another session", async () => {
  const service = new TicketService(new MemoryTicketRepository());
  await assert.rejects(() => service.createConfirmed(anonymous, input({ confirmed: false })), { status: 409 });
  await assert.rejects(() => service.createConfirmed(anonymous, input({ contactEmail: undefined })), { status: 400 });
  await assert.rejects(() => service.createConfirmed(anonymous, input({ conversationId: randomUUID() })), { status: 403 });
});

test("allows only an attendant to list and manually update a ticket", async () => {
  const repository = new MemoryTicketRepository();
  const service = new TicketService(repository);
  const ticket = await service.createConfirmed(anonymous, input());
  assert.throws(() => service.list(anonymous, {}), { status: 403 });
  const updated = await service.updateManual(attendant, ticket.id, { status: "RESOLVED", priority: "LOW", category: "ACCOUNT" });
  assert.equal(updated.status, "RESOLVED");
  assert.equal(updated.priority, "LOW");
});
