import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import {
  AnonymousSessionRecord,
  AttendantSessionRecord,
  AuthEventInput,
  AuthRepositoryPort,
  OrganizationRecord,
  UserRecord
} from "../domain/auth-repository.port";

@Injectable()
export class PrismaAuthRepository implements AuthRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  findOrganizationBySlug(slug: string): Promise<OrganizationRecord | null> {
    return this.prisma.organization.findUnique({ where: { slug }, select: { id: true, active: true } });
  }

  findUserByEmail(organizationId: string, email: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({
      where: { organizationId_email: { organizationId, email } },
      select: {
        id: true,
        organizationId: true,
        email: true,
        passwordHash: true,
        role: true,
        status: true
      }
    });
  }

  async countRecentLoginFailures(
    organizationId: string,
    subjectHash: string,
    networkHash: string,
    since: Date
  ): Promise<{ bySubject: number; byNetwork: number }> {
    const where = { organizationId, type: "LOGIN_FAILED" as const, createdAt: { gte: since } };
    const [bySubject, byNetwork] = await Promise.all([
      this.prisma.authEvent.count({ where: { ...where, subjectHash } }),
      this.prisma.authEvent.count({ where: { ...where, networkHash } })
    ]);
    return { bySubject, byNetwork };
  }

  async recordAuthEvent(input: AuthEventInput): Promise<void> {
    await this.prisma.authEvent.create({ data: input });
  }

  createAttendantSession(input: {
    organizationId: string;
    userId: string;
    tokenHash: string;
    csrfTokenHash: string;
    expiresAt: Date;
  }): Promise<AttendantSessionRecord> {
    return this.prisma.attendantSession.create({
      data: input,
      include: {
        user: { select: { email: true, role: true, status: true } },
        organization: { select: { active: true } }
      }
    });
  }

  findAttendantSessionByTokenHash(tokenHash: string): Promise<AttendantSessionRecord | null> {
    return this.prisma.attendantSession.findUnique({
      where: { tokenHash },
      include: {
        user: { select: { email: true, role: true, status: true } },
        organization: { select: { active: true } }
      }
    });
  }

  async rotateCsrfToken(sessionId: string, csrfTokenHash: string): Promise<void> {
    await this.prisma.attendantSession.update({ where: { id: sessionId }, data: { csrfTokenHash } });
  }

  async revokeAttendantSession(sessionId: string, revokedAt: Date): Promise<void> {
    await this.prisma.attendantSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt }
    });
  }

  createAnonymousSession(input: {
    organizationId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<AnonymousSessionRecord> {
    return this.prisma.$transaction(async (transaction) => {
      const conversation = await transaction.conversation.create({
        data: { organizationId: input.organizationId }
      });
      return transaction.anonymousSession.create({
        data: { ...input, conversationId: conversation.id },
        include: { organization: { select: { active: true } } }
      });
    });
  }

  findAnonymousSessionByTokenHash(tokenHash: string): Promise<AnonymousSessionRecord | null> {
    return this.prisma.anonymousSession.findUnique({
      where: { tokenHash },
      include: { organization: { select: { active: true } } }
    });
  }
}
