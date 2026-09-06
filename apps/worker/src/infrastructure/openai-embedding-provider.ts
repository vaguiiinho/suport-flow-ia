import { EmbeddingBatch, EmbeddingProviderPort } from "../domain/embedding-provider.port";
import { IngestionError } from "../ingestion/errors";

export interface OpenAiEmbeddingConfig {
  apiKey: string | undefined;
  baseUrl: string;
  model: string;
  dimensions: number;
  timeoutMs: number;
}

interface OpenAiEmbeddingResponse {
  data?: Array<{ embedding?: unknown; index?: unknown }>;
  model?: unknown;
  usage?: { prompt_tokens?: unknown; total_tokens?: unknown };
}

export class OpenAiEmbeddingProvider implements EmbeddingProviderPort {
  constructor(
    private readonly config: OpenAiEmbeddingConfig,
    private readonly fetchImplementation: typeof fetch = fetch
  ) {}

  async embed(texts: string[]): Promise<EmbeddingBatch> {
    if (texts.length === 0)
      return { embeddings: [], model: this.config.model, dimensions: this.config.dimensions, inputTokens: 0 };
    if (!this.config.apiKey) {
      throw new IngestionError("EMBEDDING_PROVIDER_UNCONFIGURED", "The embedding provider is not configured", false);
    }
    if (texts.some((text) => text.trim().length === 0)) {
      throw new IngestionError("EMBEDDING_INPUT_INVALID", "Embedding input cannot be empty", false);
    }

    const signal = AbortSignal.timeout(this.config.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImplementation(`${this.config.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.config.apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: this.config.model,
          input: texts,
          dimensions: this.config.dimensions,
          encoding_format: "float"
        }),
        signal
      });
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === "TimeoutError";
      throw new IngestionError(
        timedOut ? "EMBEDDING_TIMEOUT" : "EMBEDDING_UNAVAILABLE",
        timedOut ? "The embedding provider timed out" : "The embedding provider is unavailable",
        true
      );
    }

    if (!response.ok) {
      throw new IngestionError(
        response.status === 429 ? "EMBEDDING_RATE_LIMITED" : "EMBEDDING_PROVIDER_ERROR",
        response.status === 429
          ? "The embedding provider rate limit was reached"
          : "The embedding provider rejected the request",
        response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500
      );
    }

    let body: OpenAiEmbeddingResponse;
    try {
      body = (await response.json()) as OpenAiEmbeddingResponse;
    } catch {
      throw new IngestionError(
        "EMBEDDING_RESPONSE_INVALID",
        "The embedding provider returned an invalid response",
        true
      );
    }
    if (!Array.isArray(body.data) || body.data.length !== texts.length || typeof body.model !== "string") {
      throw new IngestionError(
        "EMBEDDING_RESPONSE_INVALID",
        "The embedding provider returned an incomplete response",
        true
      );
    }

    const embeddings = [...body.data]
      .sort((left, right) => Number(left.index) - Number(right.index))
      .map((entry) => {
        if (!Array.isArray(entry.embedding) || entry.embedding.length !== this.config.dimensions) {
          throw new IngestionError(
            "EMBEDDING_DIMENSIONS_INVALID",
            "The embedding response has an unexpected dimension",
            true
          );
        }
        const vector = entry.embedding.map((value) => Number(value));
        if (vector.some((value) => !Number.isFinite(value))) {
          throw new IngestionError(
            "EMBEDDING_RESPONSE_INVALID",
            "The embedding response contains an invalid vector",
            true
          );
        }
        return vector;
      });

    const inputTokens = Number(body.usage?.prompt_tokens ?? body.usage?.total_tokens ?? 0);
    return {
      embeddings,
      model: body.model,
      dimensions: this.config.dimensions,
      inputTokens: Number.isFinite(inputTokens) && inputTokens >= 0 ? inputTokens : 0
    };
  }
}
