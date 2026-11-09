import { QueryEmbeddingProviderPort } from "../domain/embedding-provider.port";
import { AssistantConfig } from "../application/assistant-config";

interface EmbeddingResponse {
  data?: Array<{ embedding?: unknown; index?: unknown }>;
  model?: unknown;
}

export class OpenAiQueryEmbeddingProvider implements QueryEmbeddingProviderPort {
  constructor(
    private readonly config: AssistantConfig,
    private readonly fetchImplementation: typeof fetch = fetch
  ) {}

  async embed(text: string): Promise<{ embedding: number[]; model: string; dimensions: number }> {
    if (!this.config.openAiApiKey) throw new Error("Embedding provider is not configured");
    let response: Response;
    try {
      response = await this.fetchImplementation(`${this.config.openAiBaseUrl}/embeddings`, {
        method: "POST",
        headers: { authorization: `Bearer ${this.config.openAiApiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: this.config.embeddingModel,
          input: text,
          dimensions: this.config.embeddingDimensions,
          encoding_format: "float"
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs)
      });
    } catch {
      throw new Error("Embedding provider is unavailable");
    }
    if (!response.ok) throw new Error("Embedding provider rejected the request");
    const body = (await response.json()) as EmbeddingResponse;
    const entry = body.data?.find((item) => item.index === 0) ?? body.data?.[0];
    if (typeof body.model !== "string" || !Array.isArray(entry?.embedding))
      throw new Error("Invalid embedding response");
    const embedding = entry.embedding.map(Number);
    if (embedding.length !== this.config.embeddingDimensions || embedding.some((item) => !Number.isFinite(item))) {
      throw new Error("Invalid embedding response");
    }
    return { embedding, model: body.model, dimensions: embedding.length };
  }
}
