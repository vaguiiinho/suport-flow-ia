import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { PrismaRetrievalRepository } from "../src/modules/assistant/infrastructure/prisma-retrieval.repository";

test("pgvector retrieval enforces organization, public visibility and active source filters", async (context) => {
  const prisma = new PrismaService();
  await prisma.$connect();
  context.after(async () => prisma.$disconnect());
  const suffix = randomUUID();
  const organizationA = await prisma.organization.create({
    data: { name: "Retrieval A", slug: `retrieval-a-${suffix}` }
  });
  const organizationB = await prisma.organization.create({
    data: { name: "Retrieval B", slug: `retrieval-b-${suffix}` }
  });
  context.after(async () => {
    await prisma.knowledgeSource.deleteMany({
      where: { organizationId: { in: [organizationA.id, organizationB.id] } }
    });
    await prisma.organization.deleteMany({ where: { id: { in: [organizationA.id, organizationB.id] } } });
  });

  async function source(organizationId: string, visibility: "PUBLIC" | "INTERNAL", title: string) {
    return prisma.knowledgeSource.create({
      data: {
        organizationId,
        type: "ARTICLE",
        visibility,
        title,
        content: title,
        contentHash: randomUUID(),
        active: true,
        indexingStatus: "SUCCEEDED"
      }
    });
  }
  async function chunk(sourceId: string, organizationId: string, visibility: "PUBLIC" | "INTERNAL") {
    const created = await prisma.knowledgeChunk.create({
      data: {
        sourceId,
        organizationId,
        sourceVersion: 1,
        visibility,
        strategyVersion: "test-v1",
        embeddingModel: "test-embedding",
        embeddingDimensions: 3,
        position: 0,
        content: "Authorized content",
        active: true
      }
    });
    await prisma.$executeRaw(
      Prisma.sql`UPDATE "KnowledgeChunk" SET "embedding" = ${"[1,0,0]"}::vector WHERE "id" = ${created.id}::uuid`
    );
    return created;
  }

  const publicA = await source(organizationA.id, "PUBLIC", "Public A");
  const internalA = await source(organizationA.id, "INTERNAL", "Internal A");
  const publicB = await source(organizationB.id, "PUBLIC", "Public B");
  const allowed = await chunk(publicA.id, organizationA.id, "PUBLIC");
  await chunk(internalA.id, organizationA.id, "INTERNAL");
  await chunk(publicB.id, organizationB.id, "PUBLIC");

  const repository = new PrismaRetrievalRepository(prisma);
  const found = await repository.searchPublic({
    organizationId: organizationA.id,
    embedding: [1, 0, 0],
    embeddingModel: "test-embedding",
    embeddingDimensions: 3,
    limit: 10
  });
  assert.deepEqual(
    found.map((item) => item.id),
    [allowed.id]
  );
  const revalidated = await repository.revalidatePublic(organizationB.id, [allowed.id]);
  assert.deepEqual(revalidated, []);
});
