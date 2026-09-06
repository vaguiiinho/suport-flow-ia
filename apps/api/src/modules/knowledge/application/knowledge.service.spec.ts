import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import { OrganizationContext } from "../../../shared/organization/organization-context";
import { FileStoragePort } from "../domain/file-storage.port";
import {
  CreateKnowledgeVersionInput,
  CreateKnowledgeVersionOptions,
  KnowledgeRepositoryPort,
  KnowledgeSourceVersion,
  KnowledgeType
} from "../domain/knowledge-repository.port";
import { KnowledgeConfig } from "./knowledge-config";
import { KnowledgeService } from "./knowledge.service";
import { PdfValidator } from "./pdf-validator";

const organizationId = randomUUID();
const context: OrganizationContext = {
  organizationId,
  actor: { kind: "ATTENDANT", userId: randomUUID(), sessionId: randomUUID() }
};
const config: KnowledgeConfig = {
  storageRoot: "unused",
  pdfMaxBytes: 1024,
  pdfMaxPages: 10,
  articleMaxCharacters: 100
};

function source(overrides: Partial<KnowledgeSourceVersion> = {}): KnowledgeSourceVersion {
  const now = new Date();
  return {
    id: randomUUID(),
    familyId: randomUUID(),
    organizationId,
    type: "ARTICLE",
    visibility: "PUBLIC",
    title: "Password reset",
    content: "Reset your password.",
    storageKey: null,
    mimeType: null,
    pageCount: null,
    contentHash: createHash("sha256").update("Reset your password.").digest("hex"),
    version: 1,
    indexingStatus: "SUCCEEDED",
    active: true,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

class MemoryRepository implements KnowledgeRepositoryPort {
  readonly versions: KnowledgeSourceVersion[] = [];
  lastCreateOptions: CreateKnowledgeVersionOptions | undefined;
  failCreate = false;

  listLatest(requestedOrganizationId: string, type?: KnowledgeType): Promise<KnowledgeSourceVersion[]> {
    const byFamily = new Map<string, KnowledgeSourceVersion>();
    for (const item of this.versions) {
      if (item.organizationId !== requestedOrganizationId || item.deletedAt || (type && item.type !== type)) continue;
      const current = byFamily.get(item.familyId);
      if (!current || item.version > current.version) byFamily.set(item.familyId, item);
    }
    return Promise.resolve([...byFamily.values()]);
  }

  async findLatest(requestedOrganizationId: string, familyId: string): Promise<KnowledgeSourceVersion | null> {
    return (
      (await this.findVersions(requestedOrganizationId, familyId)).sort((a, b) => b.version - a.version)[0] ?? null
    );
  }

  findVersions(requestedOrganizationId: string, familyId: string): Promise<KnowledgeSourceVersion[]> {
    return Promise.resolve(
      this.versions.filter(
        (item) => item.organizationId === requestedOrganizationId && item.familyId === familyId && !item.deletedAt
      )
    );
  }

  createVersion(
    input: CreateKnowledgeVersionInput,
    options?: CreateKnowledgeVersionOptions
  ): Promise<KnowledgeSourceVersion> {
    if (this.failCreate) return Promise.reject(new Error("database unavailable"));
    this.lastCreateOptions = options;
    if (options?.deactivateActiveVersion) {
      for (const item of this.versions) {
        if (item.organizationId === input.organizationId && item.familyId === input.familyId) item.active = false;
      }
    }
    const created = source({
      ...input,
      content: input.content ?? null,
      storageKey: input.storageKey ?? null,
      mimeType: input.mimeType ?? null,
      pageCount: input.pageCount ?? null,
      indexingStatus: "PENDING",
      active: false
    });
    this.versions.push(created);
    return Promise.resolve(created);
  }

  async softDeleteFamily(
    requestedOrganizationId: string,
    familyId: string,
    deletedAt: Date
  ): Promise<KnowledgeSourceVersion[]> {
    const matches = await this.findVersions(requestedOrganizationId, familyId);
    for (const item of matches) item.deletedAt = deletedAt;
    return matches;
  }
}

class MemoryStorage implements FileStoragePort {
  readonly files = new Map<string, Buffer>();

  async putPdf(
    target: { organizationId: string; familyId: string; versionId: string },
    content: Buffer
  ): Promise<string> {
    const key = `organizations/${target.organizationId}/knowledge/${target.familyId}/versions/${target.versionId}.pdf`;
    this.files.set(key, content);
    return key;
  }

  read(_organizationId: string, key: string): Promise<Buffer> {
    const content = this.files.get(key);
    if (!content) return Promise.reject(new Error("not found"));
    return Promise.resolve(content);
  }

  async remove(_organizationId: string, key: string): Promise<void> {
    this.files.delete(key);
  }
}

function createService(repository: MemoryRepository, storage = new MemoryStorage()): KnowledgeService {
  const pdfValidator = {
    validate: async (content: Buffer) => ({
      contentHash: createHash("sha256").update(content).digest("hex"),
      pageCount: 1
    })
  } as unknown as PdfValidator;
  return new KnowledgeService(repository, storage, config, pdfValidator);
}

test("article versions normalize content and leave the active version untouched", async () => {
  const repository = new MemoryRepository();
  const service = createService(repository);
  const first = await service.createArticle(context, {
    title: "  Password reset  ",
    content: "Reset your password.\r\n",
    visibility: "PUBLIC"
  });
  first.indexingStatus = "SUCCEEDED";
  first.active = true;

  const second = await service.updateArticle(context, first.familyId, {
    content: "Use the recovery link."
  });

  assert.equal(first.active, true);
  assert.equal(second.active, false);
  assert.equal(second.indexingStatus, "PENDING");
  assert.equal(second.version, 2);
  assert.equal(second.familyId, first.familyId);
  assert.equal(second.organizationId, organizationId);
  assert.equal(first.title, "Password reset");
});

test("article update is idempotent when title, visibility and hash do not change", async () => {
  const repository = new MemoryRepository();
  const existing = source();
  repository.versions.push(existing);
  const service = createService(repository);

  const result = await service.updateArticle(context, existing.familyId, {
    content: `  ${existing.content}\n`
  });

  assert.equal(result, existing);
  assert.equal(repository.versions.length, 1);
});

test("making a public source internal immediately revokes the active public version", async () => {
  const repository = new MemoryRepository();
  const existing = source({ visibility: "PUBLIC", active: true });
  repository.versions.push(existing);
  const service = createService(repository);

  const pending = await service.updateArticle(context, existing.familyId, { visibility: "INTERNAL" });

  assert.equal(repository.lastCreateOptions?.deactivateActiveVersion, true);
  assert.equal(existing.active, false);
  assert.equal(pending.visibility, "INTERNAL");
  assert.equal(pending.active, false);
});

test("PDF storage uses generated organization-scoped keys and rolls back on persistence failure", async () => {
  const repository = new MemoryRepository();
  const storage = new MemoryStorage();
  const service = createService(repository, storage);
  repository.failCreate = true;

  await assert.rejects(() =>
    service.uploadPdf(context, {
      title: "Support guide",
      visibility: "INTERNAL",
      mimeType: "application/pdf",
      content: Buffer.from("%PDF-content")
    })
  );

  assert.equal(storage.files.size, 0);
});

test("knowledge lookups do not disclose a family from another organization", async () => {
  const repository = new MemoryRepository();
  const otherSource = source({ organizationId: randomUUID() });
  repository.versions.push(otherSource);
  const service = createService(repository);

  await assert.rejects(() => service.get(context, otherSource.familyId), { name: "Error" });
});
