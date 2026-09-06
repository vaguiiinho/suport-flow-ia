import type { ServiceHealth } from "@support-flow/shared";

export function createHealthResponse(databaseReady: boolean, timestamp = new Date()): ServiceHealth {
  return {
    service: "worker",
    status: databaseReady ? "ok" : "error",
    timestamp: timestamp.toISOString(),
    dependencies: {
      database: databaseReady ? "ok" : "error"
    }
  };
}
