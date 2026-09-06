export const KNOWLEDGE_REPOSITORY = Symbol("KNOWLEDGE_REPOSITORY");

export type KnowledgeType = "ARTICLE" | "PDF";
export type KnowledgeVisibility = "PUBLIC" | "INTERNAL";
export type KnowledgeIndexingStatus = "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED";
export type IngestionOperation = "INDEX" | "REINDEX";

export interface KnowledgeSourceVersion {
  id: string;
  familyId: string;
  organizationId: string;
  type: KnowledgeType;
  visibility: KnowledgeVisibility;
  title: string;
  content: string | null;
  storageKey: string | null;
  mimeType: string | null;
  pageCount: number | null;
  contentHash: string;
  version: number;
  indexingStatus: KnowledgeIndexingStatus;
  active: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateKnowledgeVersionInput {
  id: string;
  familyId: string;
  organizationId: string;
  type: KnowledgeType;
  visibility: KnowledgeVisibility;
  title: string;
  content?: string;
  storageKey?: string;
  mimeType?: string;
  pageCount?: number;
  contentHash: string;
  version: number;
}

export interface CreateKnowledgeVersionOptions {
  deactivateActiveVersion: boolean;
}

export interface IngestionJobRecord {
  id: string;
  organizationId: string;
  sourceId: string;
  operation: IngestionOperation;
  status: KnowledgeIndexingStatus;
  idempotencyKey: string;
  strategyVersion: string;
  attempts: number;
  progress: number;
  availableAt: Date;
  claimedAt: Date | null;
  claimedBy: string | null;
  heartbeatAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateIngestionJobInput {
  id: string;
  organizationId: string;
  sourceId: string;
  operation: IngestionOperation;
  idempotencyKey: string;
  strategyVersion: string;
}

export interface KnowledgeVersionWithJob {
  source: KnowledgeSourceVersion;
  job: IngestionJobRecord;
}

export interface KnowledgeRepositoryPort {
  listLatest(organizationId: string, type?: KnowledgeType): Promise<KnowledgeSourceVersion[]>;
  findLatest(organizationId: string, familyId: string): Promise<KnowledgeSourceVersion | null>;
  findVersions(organizationId: string, familyId: string): Promise<KnowledgeSourceVersion[]>;
  createVersion(
    input: CreateKnowledgeVersionInput,
    options?: CreateKnowledgeVersionOptions
  ): Promise<KnowledgeSourceVersion>;
  createVersionWithJob(
    input: CreateKnowledgeVersionInput,
    job: CreateIngestionJobInput,
    options?: CreateKnowledgeVersionOptions
  ): Promise<KnowledgeVersionWithJob>;
  createReindexJob(input: CreateIngestionJobInput): Promise<IngestionJobRecord>;
  findIngestionJob(organizationId: string, jobId: string): Promise<IngestionJobRecord | null>;
  softDeleteFamily(organizationId: string, familyId: string, deletedAt: Date): Promise<KnowledgeSourceVersion[]>;
}
