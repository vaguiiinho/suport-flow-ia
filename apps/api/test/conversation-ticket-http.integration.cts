import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { CryptoPasswordHasher } from "../src/modules/auth/infrastructure/crypto-password-hasher";

const trustedOrigin = "http://localhost:3000";

test("anonymous chat persists fallback replies and creates one ticket only after confirmation", async (context) => {
  const suffix = randomUUID();
  process.env.DEFAULT_ORGANIZATION_SLUG = `chat-http-${suffix}`;
  process.env.AUTH_SECURITY_PEPPER = "conversation-ticket-http-pepper-with-at-least-thirty-two-characters";
  process.env.WEB_ORIGIN = trustedOrigin;
  process.env.COOKIE_SECURE = "false";
  process.env.OPENAI_API_KEY = "";
  const prisma = new PrismaService();
  await prisma.$connect();
  const organization = await prisma.organization.create({
    data: { name: "Chat HTTP", slug: process.env.DEFAULT_ORGANIZATION_SLUG }
  });
  const attendantEmail = `ticket-attendant-${suffix}@example.com`;
  const attendantPassword = "ticket-attendant-password";
  await prisma.user.create({
    data: {
      organizationId: organization.id,
      email: attendantEmail,
      passwordHash: await new CryptoPasswordHasher().hash(attendantPassword)
    }
  });
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  await app.listen(0, "127.0.0.1");
  const baseUrl = await app.getUrl();
  context.after(async () => {
    await app.close();
    await prisma.ticketAuditEvent.deleteMany({ where: { organizationId: organization.id } });
    await prisma.ticket.deleteMany({ where: { organizationId: organization.id } });
    await prisma.anonymousSession.deleteMany({ where: { organizationId: organization.id } });
    await prisma.conversation.deleteMany({ where: { organizationId: organization.id } });
    await prisma.authEvent.deleteMany({ where: { organizationId: organization.id } });
    await prisma.attendantSession.deleteMany({ where: { organizationId: organization.id } });
    await prisma.user.deleteMany({ where: { organizationId: organization.id } });
    await prisma.organization.delete({ where: { id: organization.id } });
    await prisma.$disconnect();
  });

  const sessionResponse = await fetch(`${baseUrl}/api/v1/anonymous-sessions`, {
    method: "POST",
    headers: { origin: trustedOrigin }
  });
  assert.equal(sessionResponse.status, 201);
  const session = (await sessionResponse.json()) as { conversationId: string };
  const cookie = sessionResponse.headers.get("set-cookie")!.split(";", 1)[0]!;

  const messageResponse = await fetch(`${baseUrl}/api/v1/conversations/${session.conversationId}/messages`, {
    method: "POST",
    headers: { cookie, origin: trustedOrigin, "content-type": "application/json" },
    body: JSON.stringify({ content: "I need help." })
  });
  assert.equal(messageResponse.status, 201);
  const message = (await messageResponse.json()) as { answer: { fallback: boolean; citations: unknown[] } };
  assert.equal(message.answer.fallback, true);
  assert.deepEqual(message.answer.citations, []);
  assert.equal(await prisma.message.count({ where: { conversationId: session.conversationId } }), 2);

  const ticketPayload = {
    conversationId: session.conversationId,
    confirmed: true,
    summary: "Need help",
    description: "I need help.",
    contactEmail: "customer@example.test"
  };
  const create = () =>
    fetch(`${baseUrl}/api/v1/tickets`, {
      method: "POST",
      headers: {
        cookie,
        origin: trustedOrigin,
        "content-type": "application/json",
        "idempotency-key": "chat-ticket-key"
      },
      body: JSON.stringify(ticketPayload)
    });
  const first = await create();
  assert.equal(first.status, 201);
  const ticket = (await first.json()) as { id: string; status: string };
  const retry = await create();
  assert.equal(retry.status, 201);
  assert.equal(((await retry.json()) as { id: string }).id, ticket.id);
  assert.equal(await prisma.ticket.count({ where: { organizationId: organization.id } }), 1);
  assert.equal(await prisma.ticketAuditEvent.count({ where: { ticketId: ticket.id } }), 1);

  const unconfirmed = await fetch(`${baseUrl}/api/v1/tickets`, {
    method: "POST",
    headers: {
      cookie,
      origin: trustedOrigin,
      "content-type": "application/json",
      "idempotency-key": "unconfirmed-key"
    },
    body: JSON.stringify({ ...ticketPayload, confirmed: false })
  });
  assert.equal(unconfirmed.status, 409);

  const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: trustedOrigin },
    body: JSON.stringify({ email: attendantEmail, password: attendantPassword })
  });
  assert.equal(login.status, 200);
  const { csrfToken } = (await login.json()) as { csrfToken: string };
  const attendantCookie = login.headers.get("set-cookie")!.split(";", 1)[0]!;

  assert.equal((await fetch(`${baseUrl}/api/v1/tickets/${ticket.id}`, { headers: { cookie } })).status, 401);
  assert.equal(
    (await fetch(`${baseUrl}/api/v1/tickets/not-a-uuid`, { headers: { cookie: attendantCookie } })).status,
    400
  );
  assert.equal(
    (await fetch(`${baseUrl}/api/v1/tickets/${randomUUID()}`, { headers: { cookie: attendantCookie } })).status,
    404
  );
  assert.equal(
    (await fetch(`${baseUrl}/api/v1/tickets?status=BOGUS`, { headers: { cookie: attendantCookie } })).status,
    400
  );
  const filtered = await fetch(`${baseUrl}/api/v1/tickets?status=OPEN&priority=MEDIUM`, {
    headers: { cookie: attendantCookie }
  });
  assert.equal(filtered.status, 200);
  assert.equal(((await filtered.json()) as unknown[]).length, 1);

  const updated = await fetch(`${baseUrl}/api/v1/tickets/${ticket.id}`, {
    method: "PATCH",
    headers: {
      cookie: attendantCookie,
      origin: trustedOrigin,
      "content-type": "application/json",
      "x-csrf-token": csrfToken
    },
    body: JSON.stringify({ status: "IN_PROGRESS", category: "ACCOUNT" })
  });
  assert.equal(updated.status, 200);

  const detailResponse = await fetch(`${baseUrl}/api/v1/tickets/${ticket.id}`, {
    headers: { cookie: attendantCookie }
  });
  assert.equal(detailResponse.status, 200);
  const detail = (await detailResponse.json()) as {
    status: string;
    idempotencyKey?: string;
    messages: Array<{ role: string; citations: unknown[] }>;
    history: Array<{ type: string }>;
  };
  assert.equal(detail.status, "IN_PROGRESS");
  assert.equal(detail.idempotencyKey, undefined);
  assert.deepEqual(
    detail.messages.map((item) => item.role),
    ["USER", "ASSISTANT"]
  );
  assert.deepEqual(detail.messages[1]!.citations, []);
  assert.deepEqual(
    detail.history.map((item) => item.type),
    ["CREATED", "UPDATED"]
  );
  assert.equal(JSON.stringify(detail).includes("execution"), false);

  const jobs = await fetch(`${baseUrl}/api/v1/ingestion-jobs?status=FAILED&limit=10`, {
    headers: { cookie: attendantCookie }
  });
  assert.equal(jobs.status, 200);
  assert.deepEqual(await jobs.json(), []);
  assert.equal(
    (await fetch(`${baseUrl}/api/v1/ingestion-jobs?status=BOGUS`, { headers: { cookie: attendantCookie } })).status,
    422
  );
  assert.equal(
    (await fetch(`${baseUrl}/api/v1/ingestion-jobs?limit=500`, { headers: { cookie: attendantCookie } })).status,
    422
  );
  assert.equal((await fetch(`${baseUrl}/api/v1/ingestion-jobs`, { headers: { cookie } })).status, 401);
});
