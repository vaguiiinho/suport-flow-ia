import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { AuthConfig } from "../src/modules/auth/application/auth-config";
import { AuthService } from "../src/modules/auth/application/auth.service";
import { InvalidCredentialsError } from "../src/modules/auth/domain/auth-errors";
import { CryptoPasswordHasher } from "../src/modules/auth/infrastructure/crypto-password-hasher";
import { CryptoSessionToken } from "../src/modules/auth/infrastructure/crypto-session-token";
import { PrismaAuthRepository } from "../src/modules/auth/infrastructure/prisma-auth.repository";

test("authentication remains scoped to the server-resolved organization", async (context) => {
  const prisma = new PrismaService();
  await prisma.$connect();
  context.after(async () => prisma.$disconnect());

  const suffix = randomUUID();
  const slugA = `auth-a-${suffix}`;
  const organizationA = await prisma.organization.create({ data: { name: "Auth A", slug: slugA } });
  const organizationB = await prisma.organization.create({
    data: { name: "Auth B", slug: `auth-b-${suffix}` }
  });
  context.after(async () => {
    await prisma.authEvent.deleteMany({ where: { organizationId: { in: [organizationA.id, organizationB.id] } } });
    await prisma.attendantSession.deleteMany({
      where: { organizationId: { in: [organizationA.id, organizationB.id] } }
    });
    await prisma.anonymousSession.deleteMany({
      where: { organizationId: { in: [organizationA.id, organizationB.id] } }
    });
    await prisma.conversation.deleteMany({
      where: { organizationId: { in: [organizationA.id, organizationB.id] } }
    });
    await prisma.user.deleteMany({ where: { organizationId: { in: [organizationA.id, organizationB.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [organizationA.id, organizationB.id] } } });
  });

  const hasher = new CryptoPasswordHasher();
  const email = `same-${suffix}@example.com`;
  await prisma.user.createMany({
    data: [
      {
        organizationId: organizationA.id,
        email,
        passwordHash: await hasher.hash("password-for-organization-a")
      },
      {
        organizationId: organizationB.id,
        email,
        passwordHash: await hasher.hash("password-for-organization-b")
      }
    ]
  });

  const config: AuthConfig = {
    defaultOrganizationSlug: slugA,
    securityPepper: "integration-pepper-with-at-least-thirty-two-characters",
    attendantSessionTtlSeconds: 3600,
    anonymousSessionTtlSeconds: 7200,
    loginMaxAttempts: 5,
    loginWindowSeconds: 900,
    cookieSecure: false,
    trustedOrigins: ["http://localhost:3000"]
  };
  const tokens = new CryptoSessionToken();
  const service = new AuthService(new PrismaAuthRepository(prisma), hasher, tokens, config);

  await assert.rejects(
    () => service.login(email, "password-for-organization-b", "integration-network"),
    InvalidCredentialsError
  );
  const login = await service.login(email, "password-for-organization-a", "integration-network");
  assert.equal(login.context.organizationId, organizationA.id);

  const persistedSession = await prisma.attendantSession.findUniqueOrThrow({
    where: { tokenHash: tokens.hash(login.sessionToken) }
  });
  assert.notEqual(persistedSession.tokenHash, login.sessionToken);
  assert.equal(persistedSession.organizationId, organizationA.id);

  const anonymous = await service.createAnonymousSession();
  assert.equal(anonymous.context.organizationId, organizationA.id);
  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: anonymous.conversationId }
  });
  assert.equal(conversation.organizationId, organizationA.id);
});
