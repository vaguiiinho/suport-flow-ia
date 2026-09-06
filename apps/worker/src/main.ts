import "dotenv/config";
import { createServer } from "node:http";
import { Pool } from "pg";
import { createHealthResponse } from "./health";

function readWorkerPort(rawValue: string | undefined): number {
  const port = Number(rawValue ?? "3002");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("WORKER_PORT must be an integer between 1 and 65535");
  }
  return port;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({ connectionString, max: 2 });

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

const port = readWorkerPort(process.env.WORKER_PORT);
server.listen(port, "0.0.0.0", () => {
  console.log(`Worker foundation listening on port ${port}`);
});

async function shutdown(): Promise<void> {
  server.close();
  await pool.end();
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
