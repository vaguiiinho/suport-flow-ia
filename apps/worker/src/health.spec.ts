import assert from "node:assert/strict";
import test from "node:test";
import { createHealthResponse } from "./health";

test("reports worker and database readiness", () => {
  assert.deepEqual(createHealthResponse(true, new Date("2026-08-30T12:00:00.000Z")), {
    service: "worker",
    status: "ok",
    timestamp: "2026-08-30T12:00:00.000Z",
    dependencies: {
      database: "ok"
    }
  });
});
