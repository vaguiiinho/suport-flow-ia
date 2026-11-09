import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { OrganizationContext } from "../../../shared/organization/organization-context";
import { TicketDetailRecord, TicketRecord, TicketRepositoryPort } from "../domain/ticket-repository.port";
import { sanitizeCitations, TicketService } from "./ticket.service";

const organizationId = randomUUID();
const conversationId = randomUUID();
const anonymous: OrganizationContext = {
  organizationId,
  actor: { kind: "ANONYMOUS", conversationId, sessionId: randomUUID() }
};
const attendant: OrganizationContext = {
  organizationId,
  actor: { kind: "ATTENDANT", userId: randomUUID(), sessionId: randomUUID() }
};

class MemoryTicketRepository implements TicketRepositoryPort {
  tickets: TicketRecord[] = [];
  messages: TicketDetailRecord["messages"] = [];
  async createConfirmed(input: Omit<TicketRecord, "id" | "createdAt" | "updatedAt"> & { idempotencyKey: string }) {
    const existing = this.tickets.find(
      (ticket) =>
        ticket.organizationId === input.organizationId &&
        (ticket as TicketRecord & { idempotencyKey?: string }).idempotencyKey === input.idempotencyKey
    );
    if (existing) return existing;
    const ticket = { ...input, id: randomUUID(), createdAt: new Date(), updatedAt: new Date() } as TicketRecord & {
      idempotencyKey: string;
    };
    this.tickets.push(ticket);
    return ticket;
  }
  async list(requestedOrganizationId: string) {
    return this.tickets.filter((ticket) => ticket.organizationId === requestedOrganizationId);
  }
  async find(requestedOrganizationId: string, ticketId: string) {
    return (
      this.tickets.find((ticket) => ticket.organizationId === requestedOrganizationId && ticket.id === ticketId) ?? null
    );
  }
  async findDetail(requestedOrganizationId: string, ticketId: string): Promise<TicketDetailRecord | null> {
    const ticket = await this.find(requestedOrganizationId, ticketId);
    if (!ticket) return null;
    return {
      ticket,
      messages: this.messages,
      history: [
        { id: randomUUID(), type: "CREATED", actorUserId: null, changes: { status: "OPEN" }, createdAt: new Date() }
      ]
    };
  }
  async updateManual(input: {
    organizationId: string;
    ticketId: string;
    status?: TicketRecord["status"];
    priority?: TicketRecord["priority"];
    category?: string | null;
  }) {
    const ticket = await this.find(input.organizationId, input.ticketId);
    if (!ticket) return null;
    Object.assign(ticket, {
      status: input.status ?? ticket.status,
      priority: input.priority ?? ticket.priority,
      category: input.category ?? ticket.category
    });
    return ticket;
  }
}

function input(overrides: Partial<Parameters<TicketService["createConfirmed"]>[1]> = {}) {
  return {
    conversationId,
    confirmed: true,
    idempotencyKey: "create-ticket-1",
    summary: "Password reset",
    description: "I cannot reset my password.",
    contactEmail: "customer@example.test",
    ...overrides
  };
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
  await assert.rejects(() => service.createConfirmed(anonymous, input({ conversationId: randomUUID() })), {
    status: 403
  });
});

test("allows only an attendant to list and manually update a ticket", async () => {
  const repository = new MemoryTicketRepository();
  const service = new TicketService(repository);
  const ticket = await service.createConfirmed(anonymous, input());
  assert.throws(() => service.list(anonymous, {}), { status: 403 });
  const updated = await service.updateManual(attendant, ticket.id, {
    status: "RESOLVED",
    priority: "LOW",
    category: "ACCOUNT"
  });
  assert.equal(updated.status, "RESOLVED");
  assert.equal(updated.priority, "LOW");
});

test("shows the ticket conversation to attendants with sanitized citations only", async () => {
  const repository = new MemoryTicketRepository();
  const service = new TicketService(repository);
  const ticket = await service.createConfirmed(anonymous, input());
  const sourceId = randomUUID();
  repository.messages = [
    { id: randomUUID(), role: "USER", content: "How do I reset?", citations: null, createdAt: new Date() },
    {
      id: randomUUID(),
      role: "ASSISTANT",
      content: "Use the reset link.",
      citations: {
        citations: [
          { chunkId: randomUUID(), sourceId, sourceVersion: 2, title: "Reset guide", page: 3, content: "secret" }
        ],
        execution: { requestId: "req-1", model: "test-model" }
      },
      createdAt: new Date()
    }
  ];

  await assert.rejects(() => service.detail(anonymous, ticket.id), { status: 403 });
  await assert.rejects(() => service.detail({ ...attendant, organizationId: randomUUID() }, ticket.id), {
    status: 404
  });

  const detail = await service.detail(attendant, ticket.id);
  assert.equal(detail.id, ticket.id);
  assert.equal(detail.messages.length, 2);
  assert.deepEqual(detail.messages[0]!.citations, []);
  assert.deepEqual(detail.messages[1]!.citations, [{ sourceId, sourceVersion: 2, title: "Reset guide", page: 3 }]);
  assert.equal(detail.history[0]!.type, "CREATED");
  assert.equal(JSON.stringify(detail).includes("req-1"), false);
});

test("ignores malformed stored citations", () => {
  assert.deepEqual(sanitizeCitations(undefined), []);
  assert.deepEqual(sanitizeCitations({ citations: "nope" }), []);
  assert.deepEqual(sanitizeCitations([{ title: "No source" }, 42, null]), []);
  assert.deepEqual(sanitizeCitations([{ sourceId: "s", sourceVersion: 1, title: "T" }]), [
    { sourceId: "s", sourceVersion: 1, title: "T", page: null }
  ]);
});
