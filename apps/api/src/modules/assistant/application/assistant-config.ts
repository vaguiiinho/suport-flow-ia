export const ASSISTANT_CONFIG = Symbol("ASSISTANT_CONFIG");

export interface AssistantConfig {
  openAiApiKey: string | undefined;
  openAiBaseUrl: string;
  chatModel: string;
  embeddingModel: string;
  embeddingDimensions: number;
  timeoutMs: number;
  retrievalLimit: number;
  maxChunksPerSource: number;
  minimumSimilarity: number;
  promptVersion: string;
  retrievalStrategyVersion: string;
}

function positiveInteger(value: string | undefined, fallback: number, name: string): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

export function readAssistantConfig(environment: NodeJS.ProcessEnv): AssistantConfig {
  const minimumSimilarity = Number(environment.ASSISTANT_MINIMUM_SIMILARITY ?? "0.65");
  if (!Number.isFinite(minimumSimilarity) || minimumSimilarity < -1 || minimumSimilarity > 1) {
    throw new Error("ASSISTANT_MINIMUM_SIMILARITY must be between -1 and 1");
  }
  return {
    openAiApiKey: environment.OPENAI_API_KEY?.trim() || undefined,
    openAiBaseUrl: (environment.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, ""),
    chatModel: environment.OPENAI_CHAT_MODEL?.trim() || "gpt-4.1-mini",
    embeddingModel: environment.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small",
    embeddingDimensions: positiveInteger(environment.OPENAI_EMBEDDING_DIMENSIONS, 1536, "OPENAI_EMBEDDING_DIMENSIONS"),
    timeoutMs: positiveInteger(environment.ASSISTANT_TIMEOUT_MS, 15000, "ASSISTANT_TIMEOUT_MS"),
    retrievalLimit: positiveInteger(environment.ASSISTANT_RETRIEVAL_LIMIT, 12, "ASSISTANT_RETRIEVAL_LIMIT"),
    maxChunksPerSource: positiveInteger(
      environment.ASSISTANT_MAX_CHUNKS_PER_SOURCE,
      2,
      "ASSISTANT_MAX_CHUNKS_PER_SOURCE"
    ),
    minimumSimilarity,
    promptVersion: environment.ASSISTANT_PROMPT_VERSION?.trim() || "support-answer-v1",
    retrievalStrategyVersion: environment.ASSISTANT_RETRIEVAL_STRATEGY_VERSION?.trim() || "public-cosine-diverse-v1"
  };
}
