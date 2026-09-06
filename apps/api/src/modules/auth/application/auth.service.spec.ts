import assert from "node:assert/strict";
import test from "node:test";
import { AuthConfig } from "./auth-config";
import { AuthService } from "./auth.service";
import {
  AnonymousSessionRecord,
  AttendantSessionRecord,
  AuthEventInput,
  AuthRepositoryPort,
  OrganizationRecord,
  UserRecord
} from "../domain/auth-repository.port";
import {
  InvalidCredentialsError,
  InvalidCsrfTokenError,
  InvalidSessionError,
  LoginRateLimitedError
} from "../domain/auth-errors";
import { CryptoPasswordHasher } from "../infrastructure/crypto-password-hasher";
import { CryptoSessionToken } from "../infrastructure/crypto-session-token";

const config: AuthConfig = {
  defaultOrganizationSlug: "support-flow",
  securityPepper: "test-pepper-with-at-least-thirty-two-characters",
  attendantSessionTtlSeconds: 3600,
  anonymousSessionTtlSeconds: 7200,
  loginMaxAttempts: 2,
  loginWindowSeconds: 900,
  cookieSecure: false,
  trustedOrigins: ["http://localhost:3000"]
};

class MemoryAuthRepository implements AuthRepositoryPort {
  organization: OrganizationRecord = { id: "organization-a", active: true };
  user: UserRecord | null = null;
  failures = { bySubject: 0, byNetwork: 0 };
  events: AuthEventInput[] = [];
  attendantSessions = new Map<string, AttendantSessionRecord>();
  anonymousSessions = new Map<string, AnonymousSessionRecord>();

  async findOrganizationBySlug(_slug: string): Promise<OrganizationRecord | null> {
    return this.organization;
  }

  async findUserByEmail(organizationId: string, email: string): Promise<UserRecord | null> {
    return this.user?.organizationId === organizationId && this.user.email === email ? this.user : null;
  }

  async countRecentLoginFailures() {
    return this.failures;
  }

  async recordAuthEvent(input: AuthEventInput): Promise<void> {
    this.events.push(input);
  }

  async createAttendantSession(input: {
    organizationId: string;
    userId: string;
    tokenHash: string;
    csrfTokenHash: string;
    expiresAt: Date;
  }): Promise<AttendantSessionRecord> {
    const record: AttendantSessionRecord = {
      id: "attendant-session",
      organizationId: input.organizationId,
      userId: input.userId,
      csrfTokenHash: input.csrfTokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null,
      user: { email: this.user!.email, role: "ATTENDANT", status: this.user!.status },
      organization: { active: this.organization.active }
    };
    this.attendantSessions.set(input.tokenHash, record);
    return record;
  }

  async findAttendantSessionByTokenHash(tokenHash: string): Promise<AttendantSessionRecord | null> {
    return this.attendantSessions.get(tokenHash) ?? null;
  }

  async rotateCsrfToken(sessionId: string, csrfTokenHash: string): Promise<void> {
    for (const session of this.attendantSessions.values()) {
      if (session.id === sessionId) session.csrfTokenHash = csrfTokenHash;
    }
  }

  async revokeAttendantSession(sessionId: string, revokedAt: Date): Promise<void> {
    for (const session of this.attendantSessions.values()) {
      if (session.id === sessionId) session.revokedAt = revokedAt;
    }
  }

  async createAnonymousSession(input: {
    organizationId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<AnonymousSessionRecord> {
    const record: AnonymousSessionRecord = {
      id: "anonymous-session",
      organizationId: input.organizationId,
      conversationId: "conversation-a",
      expiresAt: input.expiresAt,
      revokedAt: null,
      organization: { active: this.organization.active }
    };
    this.anonymousSessions.set(input.tokenHash, record);
    return record;
  }

  async findAnonymousSessionByTokenHash(tokenHash: string): Promise<AnonymousSessionRecord | null> {
    return this.anonymousSessions.get(tokenHash) ?? null;
  }
}

async function fixture() {
  const repository = new MemoryAuthRepository();
  const passwordHasher = new CryptoPasswordHasher();
  repository.user = {
    id: "user-a",
    organizationId: repository.organization.id,
    email: "agent@example.com",
    passwordHash: await passwordHasher.hash("correct-password"),
    role: "ATTENDANT",
    status: "ACTIVE"
  };
  const tokens = new CryptoSessionToken();
  return { repository, tokens, service: new AuthService(repository, passwordHasher, tokens, config) };
}

test("logs in, resolves the server-side organization and revokes the session", async () => {
  const { repository, service } = await fixture();
  const login = await service.login(" AGENT@example.com ", "correct-password", "127.0.0.1");

  assert.equal(login.context.organizationId, "organization-a");
  assert.equal(login.context.actor.kind, "ATTENDANT");
  service.validateCsrfToken((await service.resolveAttendantSession(login.sessionToken)).session, login.csrfToken);

  const resolved = await service.resolveAttendantSession(login.sessionToken);
  await service.logout(resolved.session, "127.0.0.1");
  await assert.rejects(() => service.resolveAttendantSession(login.sessionToken), InvalidSessionError);
  assert.deepEqual(
    repository.events.map((event) => event.type),
    ["LOGIN_SUCCEEDED", "LOGOUT"]
  );
});

test("rejects invalid credentials and disabled accounts without changing the response type", async () => {
  const { repository, service } = await fixture();
  await assert.rejects(
    () => service.login("agent@example.com", "wrong-password", "127.0.0.1"),
    InvalidCredentialsError
  );
  repository.user!.status = "DISABLED";
  await assert.rejects(
    () => service.login("agent@example.com", "correct-password", "127.0.0.1"),
    InvalidCredentialsError
  );
  assert.equal(repository.events.filter((event) => event.type === "LOGIN_FAILED").length, 2);
});

test("enforces persistent login throttling", async () => {
  const { repository, service } = await fixture();
  repository.failures.bySubject = config.loginMaxAttempts;
  await assert.rejects(
    () => service.login("agent@example.com", "correct-password", "127.0.0.1"),
    LoginRateLimitedError
  );
  assert.equal(repository.events.at(-1)?.type, "LOGIN_BLOCKED");
});

test("rejects expired sessions and invalid CSRF tokens", async () => {
  const { service } = await fixture();
  const login = await service.login("agent@example.com", "correct-password", "127.0.0.1");
  const resolved = await service.resolveAttendantSession(login.sessionToken);
  assert.throws(() => service.validateCsrfToken(resolved.session, "wrong-token"), InvalidCsrfTokenError);
  resolved.session.expiresAt = new Date(Date.now() - 1);
  await assert.rejects(() => service.resolveAttendantSession(login.sessionToken), InvalidSessionError);
});

test("creates an anonymous session bound to the default organization and conversation", async () => {
  const { service } = await fixture();
  const created = await service.createAnonymousSession();
  const context = await service.resolveAnonymousSession(created.sessionToken);
  assert.equal(context.organizationId, "organization-a");
  assert.deepEqual(context.actor, {
    kind: "ANONYMOUS",
    conversationId: "conversation-a",
    sessionId: "anonymous-session"
  });
});
