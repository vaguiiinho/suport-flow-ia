export interface EmbeddingBatch {
  embeddings: number[][];
  model: string;
  dimensions: number;
  inputTokens: number;
}

export interface EmbeddingProviderPort {
  embed(texts: string[]): Promise<EmbeddingBatch>;
}
