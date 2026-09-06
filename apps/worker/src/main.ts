import "dotenv/config";
import { createServer } from "node:http";
import { Pool } from "pg";
import { createHealthResponse } from "./health";
import { readWorkerConfig } from "./ingestion/config";
import { IngestionWorker } from "./ingestion/ingestion-worker";
import { TextExtractor } from "./ingestion/text-extractor";
import { LocalFileReader } from "./infrastructure/local-file-reader";
import { OpenAiEmbeddingProvider } from "./infrastructure/openai-embedding-provider";
import { PostgresIngestionRepository } from "./infrastructure/postgres-ingestion-repository";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const config = readWorkerConfig(process.env);
const pool = new Pool({ connectionString, max: 5 });
const repository = new PostgresIngestionRepository(pool);
const worker = new IngestionWorker(
  repository,
  new TextExtractor(new LocalFileReader(config.fileStorageRoot)),
  new OpenAiEmbeddingProvider(config.embedding),
  {
    workerId: config.workerId,
    maxAttempts: config.maxAttempts,
    claimTimeoutMs: config.claimTimeoutMs,
    retryBaseMs: config.retryBaseMs,
    batchSize: config.batchSize,
    chunkMaxCharacters: config.chunkMaxCharacters,
    chunkOverlapCharacters: config.chunkOverlapCharacters
  }
);

async function isDatabaseReady(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET" || request.url !== "/health") {
    response.writeHead(404).end();
    return;
  }

  const databaseReady = await isDatabaseReady();
  const health = createHealthResponse(databaseReady);
  response.writeHead(databaseReady ? 200 : 503, { "content-type": "application/json" });
  response.end(JSON.stringify(health));
});

const port = config.port;
server.listen(port, "0.0.0.0", () => {
  console.log(`Worker listening on port ${port}`);
});

let stopping = false;
let timer: NodeJS.Timeout | undefined;

async function poll(): Promise<void> {
  if (stopping) return;
  try {
    const result = await worker.runOnce();
    if (result.failure) {
      console.warn(`Ingestion job ${result.jobId} failed with ${result.failure.code}`);
    }
    timer = setTimeout(() => void poll(), result.processed ? 0 : config.pollIntervalMs);
  } catch {
    // Database failures are observed through readiness; do not log source content or provider details.
    timer = setTimeout(() => void poll(), config.pollIntervalMs);
  }
}

void poll();

async function shutdown(): Promise<void> {
  stopping = true;
  if (timer) clearTimeout(timer);
  server.close();
  await pool.end();
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
