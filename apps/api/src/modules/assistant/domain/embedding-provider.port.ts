export const QUERY_EMBEDDING_PROVIDER = Symbol("QUERY_EMBEDDING_PROVIDER");

export interface QueryEmbeddingProviderPort {
  embed(text: string): Promise<{ embedding: number[]; model: string; dimensions: number }>;
}
