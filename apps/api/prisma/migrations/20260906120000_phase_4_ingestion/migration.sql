-- Preserve organization and visibility on chunks so retrieval can apply both
-- authorization filters without trusting a later join alone.
ALTER TABLE "KnowledgeChunk"
  ADD COLUMN "organizationId" UUID,
  ADD COLUMN "visibility" "KnowledgeVisibility",
  ADD COLUMN "strategyVersion" TEXT NOT NULL DEFAULT 'legacy-v0',
  ADD COLUMN "embeddingModel" TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN "embeddingDimensions" INTEGER NOT NULL DEFAULT 0;

UPDATE "KnowledgeChunk" AS chunk
SET
  "organizationId" = source."organizationId",
  "visibility" = source."visibility"
FROM "KnowledgeSource" AS source
WHERE source."id" = chunk."sourceId";

ALTER TABLE "KnowledgeChunk"
  ALTER COLUMN "organizationId" SET NOT NULL,
  ALTER COLUMN "visibility" SET NOT NULL;

ALTER TABLE "IngestionJob"
  ADD COLUMN "heartbeatAt" TIMESTAMP(3);

ALTER TABLE "IngestionJob"
  ADD CONSTRAINT "IngestionJob_attempts_nonnegative" CHECK ("attempts" >= 0),
  ADD CONSTRAINT "IngestionJob_progress_range" CHECK ("progress" >= 0 AND "progress" <= 100);

CREATE INDEX "KnowledgeChunk_organizationId_visibility_active_idx"
  ON "KnowledgeChunk"("organizationId", "visibility", "active");

CREATE UNIQUE INDEX "IngestionJob_organizationId_sourceId_strategyVersion_active_key"
  ON "IngestionJob"("organizationId", "sourceId", "strategyVersion")
  WHERE "status" IN ('PENDING', 'PROCESSING');
