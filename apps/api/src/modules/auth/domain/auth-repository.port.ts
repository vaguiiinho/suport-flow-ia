export const AUTH_REPOSITORY = Symbol("AUTH_REPOSITORY");

export type AuthEventKind = "ATTENDANT_BOOTSTRAPPED" | "LOGIN_SUCCEEDED" | "LOGIN_FAILED" | "LOGIN_BLOCKED" | "LOGOUT";

export interface OrganizationRecord {
  id: string;
  active: boolean;
}

export interface UserRecord {
  id: string;
  organizationId: string;
  email: string;
  passwordHash: string;
  role: "ATTENDANT";
  status: "ACTIVE" | "DISABLED";
}

export interface AttendantSessionRecord {
  id: string;
  organizationId: string;
  userId: string;
  csrfTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  user: Pick<UserRecord, "email" | "role" | "status">;
  organization: { active: boolean };
}

export interface AnonymousSessionRecord {
  id: string;
  organizationId: string;
  conversationId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  organization: { active: boolean };
}

export interface AuthEventInput {
  organizationId: string;
  userId?: string;
  type: AuthEventKind;
  subjectHash: string;
  networkHash: string;
}

export interface AuthRepositoryPort {
  findOrganizationBySlug(slug: string): Promise<OrganizationRecord | null>;
  findUserByEmail(organizationId: string, email: string): Promise<UserRecord | null>;
  countRecentLoginFailures(
    organizationId: string,
    subjectHash: string,
    networkHash: string,
    since: Date
  ): Promise<{ bySubject: number; byNetwork: number }>;
  recordAuthEvent(input: AuthEventInput): Promise<void>;
  createAttendantSession(input: {
    organizationId: string;
    userId: string;
    tokenHash: string;
    csrfTokenHash: string;
    expiresAt: Date;
  }): Promise<AttendantSessionRecord>;
  findAttendantSessionByTokenHash(tokenHash: string): Promise<AttendantSessionRecord | null>;
  rotateCsrfToken(sessionId: string, csrfTokenHash: string): Promise<void>;
  revokeAttendantSession(sessionId: string, revokedAt: Date): Promise<void>;
  createAnonymousSession(input: {
    organizationId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<AnonymousSessionRecord>;
  findAnonymousSessionByTokenHash(tokenHash: string): Promise<AnonymousSessionRecord | null>;
}
