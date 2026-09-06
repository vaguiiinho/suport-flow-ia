import assert from "node:assert/strict";
import test from "node:test";
import nextConfig from "../next.config.mjs";

test("enables strict React and standalone output", () => {
  assert.equal(nextConfig.reactStrictMode, true);
  assert.equal(nextConfig.output, "standalone");
});
