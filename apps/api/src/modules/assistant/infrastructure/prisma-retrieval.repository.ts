import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { RetrievedChunk } from "../domain/assistant-types";
import { RetrievalRepositoryPort } from "../domain/retrieval-repository.port";

type Row = Omit<RetrievedChunk, "similarity"> & { similarity: number };

function vectorLiteral(embedding: number[]): string {
  if (embedding.length === 0 || embedding.some((item) => !Number.isFinite(item))) throw new Error("Invalid query embedding");
  return `[${embedding.join(",")}]`;
}

@Injectable()
export class PrismaRetrievalRepository implements RetrievalRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async searchPublic(input: {
    organizationId: string;
    embedding: number[];
    embeddingModel: string;
    embeddingDimensions: number;
    limit: number;
  }): Promise<RetrievedChunk[]> {
    const vector = vectorLiteral(input.embedding);
    return this.prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT chunk."id", chunk."sourceId", chunk."sourceVersion", source."title", chunk."content", chunk."position", chunk."page",
             1 - (chunk."embedding" <=> ${vector}::vector) AS "similarity"
      FROM "KnowledgeChunk" AS chunk
      INNER JOIN "KnowledgeSource" AS source ON source."id" = chunk."sourceId"
      WHERE chunk."organizationId" = ${input.organizationId}::uuid
        AND chunk."visibility" = 'PUBLIC'
        AND chunk."active" = true
        AND chunk."embedding" IS NOT NULL
        AND chunk."embeddingModel" = ${input.embeddingModel}
        AND chunk."embeddingDimensions" = ${input.embeddingDimensions}
        AND source."organizationId" = ${input.organizationId}::uuid
        AND source."visibility" = 'PUBLIC'
        AND source."active" = true
        AND source."indexingStatus" = 'SUCCEEDED'
        AND source."deletedAt" IS NULL
      ORDER BY chunk."embedding" <=> ${vector}::vector ASC
      LIMIT ${input.limit}`);
  }

  async revalidatePublic(organizationId: string, chunkIds: string[]): Promise<RetrievedChunk[]> {
    if (chunkIds.length === 0) return [];
    return this.prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT chunk."id", chunk."sourceId", chunk."sourceVersion", source."title", chunk."content", chunk."position", chunk."page", 1::float AS "similarity"
      FROM "KnowledgeChunk" AS chunk
      INNER JOIN "KnowledgeSource" AS source ON source."id" = chunk."sourceId"
      WHERE chunk."organizationId" = ${organizationId}::uuid
        AND chunk."id" IN (${Prisma.join(chunkIds.map((id) => Prisma.sql`${id}::uuid`))})
        AND chunk."visibility" = 'PUBLIC' AND chunk."active" = true
        AND source."organizationId" = ${organizationId}::uuid
        AND source."visibility" = 'PUBLIC' AND source."active" = true
        AND source."indexingStatus" = 'SUCCEEDED' AND source."deletedAt" IS NULL`);
  }
}
