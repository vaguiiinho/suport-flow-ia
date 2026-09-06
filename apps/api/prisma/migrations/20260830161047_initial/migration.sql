-- EnableExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ATTENDANT');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'ESCALATED', 'CLOSED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "KnowledgeSourceType" AS ENUM ('ARTICLE', 'PDF');

-- CreateEnum
CREATE TYPE "KnowledgeVisibility" AS ENUM ('PUBLIC', 'INTERNAL');

-- CreateEnum
CREATE TYPE "IndexingStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "IngestionOperation" AS ENUM ('INDEX', 'REINDEX');

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ATTENDANT',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "citations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "category" TEXT,
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeSource" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "type" "KnowledgeSourceType" NOT NULL,
    "visibility" "KnowledgeVisibility" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "storageKey" TEXT,
    "contentHash" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "indexingStatus" "IndexingStatus" NOT NULL DEFAULT 'PENDING',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "sourceVersion" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "page" INTEGER,
    "content" TEXT NOT NULL,
    "embedding" vector,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionJob" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "operation" "IngestionOperation" NOT NULL,
    "status" "IndexingStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "strategyVersion" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "claimedBy" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "User_organizationId_active_idx" ON "User"("organizationId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "User_organizationId_email_key" ON "User"("organizationId", "email");

-- CreateIndex
CREATE INDEX "Conversation_organizationId_status_updatedAt_idx" ON "Conversation"("organizationId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_organizationId_sessionHash_key" ON "Conversation"("organizationId", "sessionHash");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Ticket_organizationId_status_createdAt_idx" ON "Ticket"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Ticket_organizationId_priority_createdAt_idx" ON "Ticket"("organizationId", "priority", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_organizationId_number_key" ON "Ticket"("organizationId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_organizationId_idempotencyKey_key" ON "Ticket"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "KnowledgeSource_organizationId_visibility_active_idx" ON "KnowledgeSource"("organizationId", "visibility", "active");

-- CreateIndex
CREATE INDEX "KnowledgeSource_organizationId_indexingStatus_updatedAt_idx" ON "KnowledgeSource"("organizationId", "indexingStatus", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeSource_organizationId_contentHash_version_key" ON "KnowledgeSource"("organizationId", "contentHash", "version");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_sourceId_active_idx" ON "KnowledgeChunk"("sourceId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeChunk_sourceId_sourceVersion_position_key" ON "KnowledgeChunk"("sourceId", "sourceVersion", "position");

-- CreateIndex
CREATE INDEX "IngestionJob_organizationId_status_availableAt_idx" ON "IngestionJob"("organizationId", "status", "availableAt");

-- CreateIndex
CREATE INDEX "IngestionJob_sourceId_createdAt_idx" ON "IngestionJob"("sourceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IngestionJob_organizationId_idempotencyKey_key" ON "IngestionJob"("organizationId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSource" ADD CONSTRAINT "KnowledgeSource_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "KnowledgeSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "KnowledgeSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
