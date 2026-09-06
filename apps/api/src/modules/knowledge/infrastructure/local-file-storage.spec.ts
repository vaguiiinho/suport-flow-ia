import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { KnowledgeConfig } from "../application/knowledge-config";
import { LocalFileStorage } from "./local-file-storage";

test("stores generated keys under the configured root and blocks path traversal", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "support-flow-storage-"));
  context.after(async () => rm(root, { recursive: true, force: true }));
  const config: KnowledgeConfig = {
    storageRoot: root,
    pdfMaxBytes: 1024,
    pdfMaxPages: 10,
    articleMaxCharacters: 100
  };
  const storage = new LocalFileStorage(config);
  const organizationId = randomUUID();
  const familyId = randomUUID();
  const versionId = randomUUID();
  const key = `organizations/${organizationId}/knowledge/${familyId}/versions/${versionId}.pdf`;

  assert.equal(await storage.putPdf({ organizationId, familyId, versionId }, Buffer.from("safe content")), key);
  assert.equal((await storage.read(organizationId, key)).toString(), "safe content");
  assert.equal((await readFile(join(root, key))).toString(), "safe content");

  await assert.rejects(() =>
    storage.putPdf({ organizationId: "../escaped", familyId, versionId }, Buffer.from("unsafe"))
  );
  await assert.rejects(() => storage.read(organizationId, "/absolute.pdf"));
  await assert.rejects(() => storage.remove(organizationId, "safe/../../escaped.pdf"));
  await assert.rejects(() => storage.read(randomUUID(), key));

  await storage.remove(organizationId, key);
  await assert.rejects(() => storage.read(organizationId, key));
});

test("rejects a symbolic-link escape before writing the PDF", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "support-flow-storage-root-"));
  const outside = await mkdtemp(join(tmpdir(), "support-flow-storage-outside-"));
  context.after(async () => {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  });
  const config: KnowledgeConfig = {
    storageRoot: root,
    pdfMaxBytes: 1024,
    pdfMaxPages: 10,
    articleMaxCharacters: 100
  };
  const storage = new LocalFileStorage(config);
  const organizationId = randomUUID();
  await symlink(outside, join(root, "organizations"));

  await assert.rejects(() =>
    storage.putPdf({ organizationId, familyId: randomUUID(), versionId: randomUUID() }, Buffer.from("unsafe"))
  );
  await assert.rejects(() => readFile(join(outside, organizationId, "knowledge")));
});
