import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service";

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
  const organization = await prisma.organization.create({ data: { name: "Chat HTTP", slug: process.env.DEFAULT_ORGANIZATION_SLUG } });
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
    await prisma.organization.delete({ where: { id: organization.id } });
    await prisma.$disconnect();
  });

  const sessionResponse = await fetch(`${baseUrl}/api/v1/anonymous-sessions`, { method: "POST", headers: { origin: trustedOrigin } });
  assert.equal(sessionResponse.status, 201);
  const session = await sessionResponse.json() as { conversationId: string };
  const cookie = sessionResponse.headers.get("set-cookie")!.split(";", 1)[0]!;

  const messageResponse = await fetch(`${baseUrl}/api/v1/conversations/${session.conversationId}/messages`, {
    method: "POST", headers: { cookie, origin: trustedOrigin, "content-type": "application/json" }, body: JSON.stringify({ content: "I need help." })
  });
  assert.equal(messageResponse.status, 201);
  const message = await messageResponse.json() as { answer: { fallback: boolean; citations: unknown[] } };
  assert.equal(message.answer.fallback, true);
  assert.deepEqual(message.answer.citations, []);
  assert.equal(await prisma.message.count({ where: { conversationId: session.conversationId } }), 2);

  const ticketPayload = { conversationId: session.conversationId, confirmed: true, summary: "Need help", description: "I need help.", contactEmail: "customer@example.test" };
  const create = () => fetch(`${baseUrl}/api/v1/tickets`, { method: "POST", headers: { cookie, origin: trustedOrigin, "content-type": "application/json", "idempotency-key": "chat-ticket-key" }, body: JSON.stringify(ticketPayload) });
  const first = await create();
  assert.equal(first.status, 201);
  const ticket = await first.json() as { id: string; status: string };
  const retry = await create();
  assert.equal(retry.status, 201);
  assert.equal((await retry.json() as { id: string }).id, ticket.id);
  assert.equal(await prisma.ticket.count({ where: { organizationId: organization.id } }), 1);
  assert.equal((await prisma.ticketAuditEvent.count({ where: { ticketId: ticket.id } })), 1);

  const unconfirmed = await fetch(`${baseUrl}/api/v1/tickets`, { method: "POST", headers: { cookie, origin: trustedOrigin, "content-type": "application/json", "idempotency-key": "unconfirmed-key" }, body: JSON.stringify({ ...ticketPayload, confirmed: false }) });
  assert.equal(unconfirmed.status, 409);
});
