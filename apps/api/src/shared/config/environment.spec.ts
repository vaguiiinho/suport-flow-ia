import assert from "node:assert/strict";
import test from "node:test";
import { readCorsOrigins, readPort } from "./environment";

test("reads a valid port and uses a fallback", () => {
  assert.equal(readPort("4100", 3001), 4100);
  assert.equal(readPort(undefined, 3001), 3001);
});

test("rejects an invalid port", () => {
  assert.throws(() => readPort("70000", 3001), /PORT must be/);
});

test("normalizes configured CORS origins", () => {
  assert.deepEqual(readCorsOrigins("https://one.example, https://two.example"), [
    "https://one.example",
    "https://two.example"
  ]);
});
