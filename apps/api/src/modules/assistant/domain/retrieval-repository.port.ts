import { RetrievedChunk } from "./assistant-types";

export const RETRIEVAL_REPOSITORY = Symbol("RETRIEVAL_REPOSITORY");

export interface RetrievalRepositoryPort {
  searchPublic(input: {
    organizationId: string;
    embedding: number[];
    embeddingModel: string;
    embeddingDimensions: number;
    limit: number;
  }): Promise<RetrievedChunk[]>;
  revalidatePublic(organizationId: string, chunkIds: string[]): Promise<RetrievedChunk[]>;
}
