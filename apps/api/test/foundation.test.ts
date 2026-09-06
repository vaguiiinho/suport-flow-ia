import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";

test("Prisma client is generated for the PostgreSQL foundation", () => {
  assert.equal(typeof PrismaClient, "function");
});
