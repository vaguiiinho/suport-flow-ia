-- Phase 3 stores one row per immutable source version. Existing rows become
-- the first version of their own family so this migration is safe on seeded
-- and development databases created before version history was introduced.
ALTER TABLE "KnowledgeSource"
ADD COLUMN "familyId" UUID,
ADD COLUMN "mimeType" TEXT,
ADD COLUMN "pageCount" INTEGER,
ADD COLUMN "deletedAt" TIMESTAMP(3);

UPDATE "KnowledgeSource" SET "familyId" = "id" WHERE "familyId" IS NULL;

ALTER TABLE "KnowledgeSource" ALTER COLUMN "familyId" SET NOT NULL;

DROP INDEX "KnowledgeSource_organizationId_contentHash_version_key";

CREATE UNIQUE INDEX "KnowledgeSource_organizationId_familyId_version_key"
ON "KnowledgeSource"("organizationId", "familyId", "version");

CREATE INDEX "KnowledgeSource_organizationId_familyId_version_idx"
ON "KnowledgeSource"("organizationId", "familyId", "version");

CREATE INDEX "KnowledgeSource_organizationId_type_deletedAt_updatedAt_idx"
ON "KnowledgeSource"("organizationId", "type", "deletedAt", "updatedAt");

CREATE INDEX "KnowledgeSource_organizationId_contentHash_idx"
ON "KnowledgeSource"("organizationId", "contentHash");

CREATE UNIQUE INDEX "KnowledgeSource_one_active_version_per_family_idx"
ON "KnowledgeSource"("organizationId", "familyId")
WHERE "active" = true AND "deletedAt" IS NULL;

ALTER TABLE "KnowledgeSource"
ADD CONSTRAINT "KnowledgeSource_version_positive_check" CHECK ("version" > 0),
ADD CONSTRAINT "KnowledgeSource_page_count_positive_check" CHECK ("pageCount" IS NULL OR "pageCount" > 0),
ADD CONSTRAINT "KnowledgeSource_active_succeeded_check" CHECK (NOT "active" OR "indexingStatus" = 'SUCCEEDED');
