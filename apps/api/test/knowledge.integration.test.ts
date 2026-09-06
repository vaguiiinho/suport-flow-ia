import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { KnowledgeConflictError } from "../src/modules/knowledge/domain/knowledge-errors";
import { PrismaKnowledgeRepository } from "../src/modules/knowledge/infrastructure/prisma-knowledge.repository";

test("knowledge versions are isolated by organization and preserve the active version on conflict", async (context) => {
  const prisma = new PrismaService();
  await prisma.$connect();
  context.after(async () => prisma.$disconnect());

  const suffix = randomUUID();
  const organizationA = await prisma.organization.create({
    data: { name: "Knowledge A", slug: `knowledge-a-${suffix}` }
  });
  const organizationB = await prisma.organization.create({
    data: { name: "Knowledge B", slug: `knowledge-b-${suffix}` }
  });
  context.after(async () => {
    await prisma.knowledgeSource.deleteMany({
      where: { organizationId: { in: [organizationA.id, organizationB.id] } }
    });
    await prisma.organization.deleteMany({ where: { id: { in: [organizationA.id, organizationB.id] } } });
  });

  const familyId = randomUUID();
  const active = await prisma.knowledgeSource.create({
    data: {
      familyId,
      organizationId: organizationA.id,
      type: "ARTICLE",
      visibility: "PUBLIC",
      title: "Active article",
      content: "Version one",
      contentHash: "hash-a-v1",
      version: 1,
      indexingStatus: "SUCCEEDED",
      active: true
    }
  });
  await prisma.knowledgeSource.create({
    data: {
      familyId,
      organizationId: organizationB.id,
      type: "ARTICLE",
      visibility: "INTERNAL",
      title: "Other organization",
      content: "Private content",
      contentHash: "hash-b-v1",
      version: 1
    }
  });

  const repository = new PrismaKnowledgeRepository(prisma);
  const pendingInput = {
    id: randomUUID(),
    familyId,
    organizationId: organizationA.id,
    type: "ARTICLE" as const,
    visibility: "PUBLIC" as const,
    title: "Pending article",
    content: "Version two",
    contentHash: "hash-a-v2",
    version: 2
  };
  await repository.createVersion(pendingInput);
  await prisma.knowledgeSource.update({
    where: { id: pendingInput.id },
    data: { indexingStatus: "FAILED" }
  });
  assert.equal((await prisma.knowledgeSource.findUniqueOrThrow({ where: { id: active.id } })).active, true);

  await assert.rejects(
    () => repository.createVersion({ ...pendingInput, id: randomUUID() }, { deactivateActiveVersion: true }),
    KnowledgeConflictError
  );
  assert.equal((await prisma.knowledgeSource.findUniqueOrThrow({ where: { id: active.id } })).active, true);

  const restricted = await repository.createVersion(
    {
      ...pendingInput,
      id: randomUUID(),
      visibility: "INTERNAL",
      content: "Version three",
      contentHash: "hash-a-v3",
      version: 3
    },
    { deactivateActiveVersion: true }
  );
  assert.equal(restricted.active, false);
  assert.equal((await prisma.knowledgeSource.findUniqueOrThrow({ where: { id: active.id } })).active, false);

  const versionsA = await repository.findVersions(organizationA.id, familyId);
  const versionsB = await repository.findVersions(organizationB.id, familyId);
  assert.deepEqual(
    versionsA.map((version) => version.version),
    [3, 2, 1]
  );
  assert.deepEqual(
    versionsB.map((version) => version.title),
    ["Other organization"]
  );

  await repository.softDeleteFamily(organizationA.id, familyId, new Date());
  assert.equal(await repository.findLatest(organizationA.id, familyId), null);
  assert.equal((await repository.findLatest(organizationB.id, familyId))?.title, "Other organization");
});

test("database constraints allow only succeeded active versions and one active version per family", async (context) => {
  const prisma = new PrismaService();
  await prisma.$connect();
  context.after(async () => prisma.$disconnect());
  const suffix = randomUUID();
  const organization = await prisma.organization.create({
    data: { name: "Knowledge constraints", slug: `knowledge-constraints-${suffix}` }
  });
  context.after(async () => {
    await prisma.knowledgeSource.deleteMany({ where: { organizationId: organization.id } });
    await prisma.organization.delete({ where: { id: organization.id } });
  });
  const familyId = randomUUID();
  const base = {
    familyId,
    organizationId: organization.id,
    type: "ARTICLE" as const,
    visibility: "PUBLIC" as const,
    title: "Constraint article",
    content: "Content",
    contentHash: "constraint-hash"
  };

  await assert.rejects(() =>
    prisma.knowledgeSource.create({ data: { ...base, version: 1, active: true, indexingStatus: "PENDING" } })
  );
  await prisma.knowledgeSource.create({
    data: { ...base, version: 1, active: true, indexingStatus: "SUCCEEDED" }
  });
  await assert.rejects(() =>
    prisma.knowledgeSource.create({
      data: {
        ...base,
        contentHash: "constraint-hash-2",
        version: 2,
        active: true,
        indexingStatus: "SUCCEEDED"
      }
    })
  );
});

test("persists a new source version and its ingestion job in one transaction", async (context) => {
  const prisma = new PrismaService();
  await prisma.$connect();
  context.after(async () => prisma.$disconnect());
  const suffix = randomUUID();
  const organization = await prisma.organization.create({
    data: { name: "Ingestion transaction", slug: `ingestion-transaction-${suffix}` }
  });
  context.after(async () => {
    await prisma.knowledgeSource.deleteMany({ where: { organizationId: organization.id } });
    await prisma.organization.delete({ where: { id: organization.id } });
  });
  const sourceId = randomUUID();
  const repository = new PrismaKnowledgeRepository(prisma);
  const created = await repository.createVersionWithJob(
    {
      id: sourceId,
      familyId: randomUUID(),
      organizationId: organization.id,
      type: "ARTICLE",
      visibility: "PUBLIC",
      title: "Transactional article",
      content: "Content scheduled for ingestion",
      contentHash: "transactional-hash",
      version: 1
    },
    {
      id: randomUUID(),
      organizationId: organization.id,
      sourceId,
      operation: "INDEX",
      idempotencyKey: `index-${sourceId}`,
      strategyVersion: "support-flow-ingestion-v1"
    }
  );

  assert.equal(created.source.id, sourceId);
  assert.equal(created.job.sourceId, sourceId);
  assert.equal(created.job.status, "PENDING");
  assert.equal(await prisma.ingestionJob.count({ where: { organizationId: organization.id, sourceId } }), 1);
});
