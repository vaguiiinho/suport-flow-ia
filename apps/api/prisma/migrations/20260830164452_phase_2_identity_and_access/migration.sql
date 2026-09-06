/*
  Warnings:

  - You are about to drop the column `sessionHash` on the `Conversation` table. All the data in the column will be lost.
  - You are about to drop the column `active` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "AuthEventType" AS ENUM ('ATTENDANT_BOOTSTRAPPED', 'LOGIN_SUCCEEDED', 'LOGIN_FAILED', 'LOGIN_BLOCKED', 'LOGOUT');

-- DropIndex
DROP INDEX "Conversation_organizationId_sessionHash_key";

-- DropIndex
DROP INDEX "User_organizationId_active_idx";

-- AlterTable
ALTER TABLE "Conversation" DROP COLUMN "sessionHash";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "active",
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "AttendantSession" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "csrfTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendantSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnonymousSession" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnonymousSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthEvent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID,
    "type" "AuthEventType" NOT NULL,
    "subjectHash" TEXT NOT NULL,
    "networkHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendantSession_tokenHash_key" ON "AttendantSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AttendantSession_organizationId_userId_revokedAt_expiresAt_idx" ON "AttendantSession"("organizationId", "userId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "AttendantSession_expiresAt_idx" ON "AttendantSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnonymousSession_conversationId_key" ON "AnonymousSession"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "AnonymousSession_tokenHash_key" ON "AnonymousSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AnonymousSession_organizationId_revokedAt_expiresAt_idx" ON "AnonymousSession"("organizationId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "AnonymousSession_expiresAt_idx" ON "AnonymousSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthEvent_organizationId_subjectHash_type_createdAt_idx" ON "AuthEvent"("organizationId", "subjectHash", "type", "createdAt");

-- CreateIndex
CREATE INDEX "AuthEvent_organizationId_networkHash_type_createdAt_idx" ON "AuthEvent"("organizationId", "networkHash", "type", "createdAt");

-- CreateIndex
CREATE INDEX "AuthEvent_organizationId_userId_createdAt_idx" ON "AuthEvent"("organizationId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "User_organizationId_status_idx" ON "User"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "AttendantSession" ADD CONSTRAINT "AttendantSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendantSession" ADD CONSTRAINT "AttendantSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnonymousSession" ADD CONSTRAINT "AnonymousSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnonymousSession" ADD CONSTRAINT "AnonymousSession_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthEvent" ADD CONSTRAINT "AuthEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthEvent" ADD CONSTRAINT "AuthEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
