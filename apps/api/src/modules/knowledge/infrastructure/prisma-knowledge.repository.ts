import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { KnowledgeConflictError } from "../domain/knowledge-errors";
import {
  CreateKnowledgeVersionInput,
  CreateKnowledgeVersionOptions,
  KnowledgeRepositoryPort,
  KnowledgeSourceVersion,
  KnowledgeType
} from "../domain/knowledge-repository.port";

@Injectable()
export class PrismaKnowledgeRepository implements KnowledgeRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  listLatest(organizationId: string, type?: KnowledgeType): Promise<KnowledgeSourceVersion[]> {
    return this.prisma.knowledgeSource.findMany({
      where: { organizationId, deletedAt: null, ...(type ? { type } : {}) },
      orderBy: [{ familyId: "asc" }, { version: "desc" }],
      distinct: ["familyId"]
    });
  }

  findLatest(organizationId: string, familyId: string): Promise<KnowledgeSourceVersion | null> {
    return this.prisma.knowledgeSource.findFirst({
      where: { organizationId, familyId, deletedAt: null },
      orderBy: { version: "desc" }
    });
  }

  findVersions(organizationId: string, familyId: string): Promise<KnowledgeSourceVersion[]> {
    return this.prisma.knowledgeSource.findMany({
      where: { organizationId, familyId, deletedAt: null },
      orderBy: { version: "desc" }
    });
  }

  createVersion(
    input: CreateKnowledgeVersionInput,
    options: CreateKnowledgeVersionOptions = { deactivateActiveVersion: false }
  ): Promise<KnowledgeSourceVersion> {
    const operation = options.deactivateActiveVersion
      ? this.prisma.$transaction(async (transaction) => {
          await transaction.knowledgeSource.updateMany({
            where: {
              organizationId: input.organizationId,
              familyId: input.familyId,
              active: true,
              deletedAt: null
            },
            data: { active: false }
          });
          return transaction.knowledgeSource.create({ data: input });
        })
      : this.prisma.knowledgeSource.create({ data: input });

    return operation.catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new KnowledgeConflictError("A concurrent update created this version first");
      }
      throw error;
    });
  }

  async softDeleteFamily(
    organizationId: string,
    familyId: string,
    deletedAt: Date
  ): Promise<KnowledgeSourceVersion[]> {
    return this.prisma.$transaction(async (transaction) => {
      const versions = await transaction.knowledgeSource.findMany({
        where: { organizationId, familyId, deletedAt: null }
      });
      if (versions.length === 0) return [];
      await transaction.knowledgeSource.updateMany({
        where: { organizationId, familyId, deletedAt: null },
        data: { deletedAt, active: false }
      });
      return versions;
    });
  }
}
