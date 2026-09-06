export type IngestionStatus = "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED";
export type SourceType = "ARTICLE" | "PDF";
export type SourceVisibility = "PUBLIC" | "INTERNAL";

export interface ClaimedIngestionJob {
  id: string;
  organizationId: string;
  sourceId: string;
  operation: "INDEX" | "REINDEX";
  status: "PROCESSING";
  strategyVersion: string;
  attempts: number;
  claimedBy: string;
}

export interface IngestionSource {
  id: string;
  familyId: string;
  organizationId: string;
  type: SourceType;
  visibility: SourceVisibility;
  content: string | null;
  storageKey: string | null;
  contentHash: string;
  version: number;
  active: boolean;
}

export interface TextFragment {
  content: string;
  page: number | null;
}

export interface IngestionChunk extends TextFragment {
  position: number;
}

export interface PersistedChunk extends IngestionChunk {
  embedding: number[];
}

export interface IngestionFailure {
  code: string;
  message: string;
  retryable: boolean;
}
