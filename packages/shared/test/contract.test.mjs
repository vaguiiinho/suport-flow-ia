import assert from "node:assert/strict";
import test from "node:test";

test("shared package keeps a framework-agnostic manifest", async () => {
  const manifest = await import("../package.json", { with: { type: "json" } });
  assert.equal(manifest.default.dependencies, undefined);
});
