import { Inject, Injectable } from "@nestjs/common";
import { createHmac } from "node:crypto";
import { OrganizationContext } from "../../../shared/organization/organization-context";
import { AUTH_CONFIG, AuthConfig } from "./auth-config";
import { AUTH_REPOSITORY, AttendantSessionRecord, AuthRepositoryPort } from "../domain/auth-repository.port";
import {
  AuthConfigurationError,
  InvalidCredentialsError,
  InvalidCsrfTokenError,
  InvalidSessionError,
  LoginRateLimitedError
} from "../domain/auth-errors";
import { PASSWORD_HASHER, PasswordHasherPort } from "../domain/password-hasher.port";
import { SESSION_TOKEN, SessionTokenPort } from "../domain/session-token.port";

export interface AttendantSessionResult {
  sessionToken: string;
  csrfToken: string;
  expiresAt: Date;
  user: { id: string; email: string; role: "ATTENDANT" };
  context: OrganizationContext;
}

export interface AnonymousSessionResult {
  sessionToken: string;
  expiresAt: Date;
  conversationId: string;
  context: OrganizationContext;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repository: AuthRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
    @Inject(SESSION_TOKEN) private readonly tokens: SessionTokenPort,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig
  ) {}

  async login(emailInput: string, password: string, networkIdentity: string): Promise<AttendantSessionResult> {
    const email = emailInput.trim().toLowerCase();
    const organization = await this.defaultOrganization();
    const subjectHash = this.auditHash(`email:${email}`);
    const networkHash = this.auditHash(`network:${networkIdentity}`);
    const since = new Date(Date.now() - this.config.loginWindowSeconds * 1000);
    const failures = await this.repository.countRecentLoginFailures(organization.id, subjectHash, networkHash, since);

    if (failures.bySubject >= this.config.loginMaxAttempts || failures.byNetwork >= this.config.loginMaxAttempts * 10) {
      await this.repository.recordAuthEvent({
        organizationId: organization.id,
        type: "LOGIN_BLOCKED",
        subjectHash,
        networkHash
      });
      throw new LoginRateLimitedError(this.config.loginWindowSeconds);
    }

    const user = await this.repository.findUserByEmail(organization.id, email);
    let passwordMatches = false;
    if (user) {
      passwordMatches = await this.passwordHasher.verify(password, user.passwordHash);
    } else {
      await this.passwordHasher.hash(password);
    }

    if (!user || !passwordMatches || user.status !== "ACTIVE") {
      await this.repository.recordAuthEvent({
        organizationId: organization.id,
        userId: user?.id,
        type: "LOGIN_FAILED",
        subjectHash,
        networkHash
      });
      throw new InvalidCredentialsError("Invalid credentials");
    }

    const sessionToken = this.tokens.issue();
    const csrfToken = this.tokens.issue();
    const expiresAt = new Date(Date.now() + this.config.attendantSessionTtlSeconds * 1000);
    const session = await this.repository.createAttendantSession({
      organizationId: organization.id,
      userId: user.id,
      tokenHash: this.tokens.hash(sessionToken),
      csrfTokenHash: this.tokens.hash(csrfToken),
      expiresAt
    });
    await this.repository.recordAuthEvent({
      organizationId: organization.id,
      userId: user.id,
      type: "LOGIN_SUCCEEDED",
      subjectHash,
      networkHash
    });

    return {
      sessionToken,
      csrfToken,
      expiresAt,
      user: { id: user.id, email: user.email, role: user.role },
      context: {
        organizationId: organization.id,
        actor: { kind: "ATTENDANT", userId: user.id, sessionId: session.id }
      }
    };
  }

  async resolveAttendantSession(rawToken: string | undefined): Promise<{
    session: AttendantSessionRecord;
    context: OrganizationContext;
  }> {
    if (!rawToken) throw new InvalidSessionError("Missing session");
    const session = await this.repository.findAttendantSessionByTokenHash(this.tokens.hash(rawToken));
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now() ||
      session.user.status !== "ACTIVE" ||
      !session.organization.active
    ) {
      throw new InvalidSessionError("Invalid session");
    }
    return {
      session,
      context: {
        organizationId: session.organizationId,
        actor: { kind: "ATTENDANT", userId: session.userId, sessionId: session.id }
      }
    };
  }

  validateCsrfToken(session: AttendantSessionRecord, csrfToken: string | undefined): void {
    if (!csrfToken || !this.tokens.matches(csrfToken, session.csrfTokenHash)) {
      throw new InvalidCsrfTokenError("Invalid CSRF token");
    }
  }

  async rotateCsrfToken(sessionId: string): Promise<string> {
    const csrfToken = this.tokens.issue();
    await this.repository.rotateCsrfToken(sessionId, this.tokens.hash(csrfToken));
    return csrfToken;
  }

  async logout(session: AttendantSessionRecord, networkIdentity: string): Promise<void> {
    await this.repository.revokeAttendantSession(session.id, new Date());
    await this.repository.recordAuthEvent({
      organizationId: session.organizationId,
      userId: session.userId,
      type: "LOGOUT",
      subjectHash: this.auditHash(`email:${session.user.email}`),
      networkHash: this.auditHash(`network:${networkIdentity}`)
    });
  }

  async createAnonymousSession(): Promise<AnonymousSessionResult> {
    const organization = await this.defaultOrganization();
    const sessionToken = this.tokens.issue();
    const expiresAt = new Date(Date.now() + this.config.anonymousSessionTtlSeconds * 1000);
    const session = await this.repository.createAnonymousSession({
      organizationId: organization.id,
      tokenHash: this.tokens.hash(sessionToken),
      expiresAt
    });
    return {
      sessionToken,
      expiresAt,
      conversationId: session.conversationId,
      context: {
        organizationId: organization.id,
        actor: {
          kind: "ANONYMOUS",
          conversationId: session.conversationId,
          sessionId: session.id
        }
      }
    };
  }

  async resolveAnonymousSession(rawToken: string | undefined): Promise<OrganizationContext> {
    if (!rawToken) throw new InvalidSessionError("Missing anonymous session");
    const session = await this.repository.findAnonymousSessionByTokenHash(this.tokens.hash(rawToken));
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now() || !session.organization.active) {
      throw new InvalidSessionError("Invalid anonymous session");
    }
    return {
      organizationId: session.organizationId,
      actor: {
        kind: "ANONYMOUS",
        conversationId: session.conversationId,
        sessionId: session.id
      }
    };
  }

  private auditHash(value: string): string {
    return createHmac("sha256", this.config.securityPepper).update(value).digest("hex");
  }

  private async defaultOrganization(): Promise<{ id: string }> {
    const organization = await this.repository.findOrganizationBySlug(this.config.defaultOrganizationSlug);
    if (!organization?.active) {
      throw new AuthConfigurationError("Default organization is unavailable");
    }
    return { id: organization.id };
  }
}
