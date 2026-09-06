export const KNOWLEDGE_REPOSITORY = Symbol("KNOWLEDGE_REPOSITORY");

export type KnowledgeType = "ARTICLE" | "PDF";
export type KnowledgeVisibility = "PUBLIC" | "INTERNAL";
export type KnowledgeIndexingStatus = "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED";

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

export interface KnowledgeRepositoryPort {
  listLatest(organizationId: string, type?: KnowledgeType): Promise<KnowledgeSourceVersion[]>;
  findLatest(organizationId: string, familyId: string): Promise<KnowledgeSourceVersion | null>;
  findVersions(organizationId: string, familyId: string): Promise<KnowledgeSourceVersion[]>;
  createVersion(input: CreateKnowledgeVersionInput): Promise<KnowledgeSourceVersion>;
  softDeleteFamily(organizationId: string, familyId: string, deletedAt: Date): Promise<KnowledgeSourceVersion[]>;
}
