export interface WorkerConfig {
  port: number;
  workerId: string;
  pollIntervalMs: number;
  claimTimeoutMs: number;
  maxAttempts: number;
  retryBaseMs: number;
  batchSize: number;
  chunkMaxCharacters: number;
  chunkOverlapCharacters: number;
  fileStorageRoot: string;
  embedding: {
    apiKey: string | undefined;
    baseUrl: string;
    model: string;
    dimensions: number;
    timeoutMs: number;
  };
}

function readPositiveInteger(environment: NodeJS.ProcessEnv, name: string, fallback: number, minimum = 1): number {
  const raw = environment[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum)
    throw new Error(`${name} must be an integer greater than or equal to ${minimum}`);
  return value;
}

function readPort(environment: NodeJS.ProcessEnv): number {
  const port = readPositiveInteger(environment, "WORKER_PORT", 3002);
  if (port > 65535) throw new Error("WORKER_PORT must be an integer between 1 and 65535");
  return port;
}

export function readWorkerConfig(environment: NodeJS.ProcessEnv): WorkerConfig {
  const workerId = environment.WORKER_ID?.trim() || `worker-${process.pid}`;
  const model = environment.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small";
  const baseUrl = (environment.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
  if (!/^https:\/\//.test(baseUrl)) throw new Error("OPENAI_BASE_URL must use HTTPS");
  return {
    port: readPort(environment),
    workerId,
    pollIntervalMs: readPositiveInteger(environment, "INGESTION_POLL_INTERVAL_MS", 2000, 100),
    claimTimeoutMs: readPositiveInteger(environment, "INGESTION_CLAIM_TIMEOUT_MS", 120000, 1000),
    maxAttempts: readPositiveInteger(environment, "INGESTION_MAX_ATTEMPTS", 3),
    retryBaseMs: readPositiveInteger(environment, "INGESTION_RETRY_BASE_MS", 5000, 100),
    batchSize: readPositiveInteger(environment, "INGESTION_EMBEDDING_BATCH_SIZE", 32),
    chunkMaxCharacters: readPositiveInteger(environment, "INGESTION_CHUNK_MAX_CHARACTERS", 1200, 200),
    chunkOverlapCharacters: readPositiveInteger(environment, "INGESTION_CHUNK_OVERLAP_CHARACTERS", 200, 0),
    fileStorageRoot: environment.FILE_STORAGE_ROOT?.trim() || "./uploads",
    embedding: {
      apiKey: environment.OPENAI_API_KEY?.trim() || undefined,
      baseUrl,
      model,
      dimensions: readPositiveInteger(environment, "OPENAI_EMBEDDING_DIMENSIONS", 1536),
      timeoutMs: readPositiveInteger(environment, "OPENAI_EMBEDDING_TIMEOUT_MS", 30000, 1000)
    }
  };
}
