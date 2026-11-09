import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { KnowledgeConflictError } from "../domain/knowledge-errors";
import {
  CreateIngestionJobInput,
  CreateKnowledgeVersionInput,
  CreateKnowledgeVersionOptions,
  IngestionJobRecord,
  IngestionJobWithSource,
  KnowledgeRepositoryPort,
  KnowledgeSourceVersion,
  KnowledgeType,
  ListIngestionJobsFilter
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

    return operation.catch((error: unknown) => this.handleError(error));
  }

  createVersionWithJob(
    input: CreateKnowledgeVersionInput,
    job: CreateIngestionJobInput,
    options: CreateKnowledgeVersionOptions = { deactivateActiveVersion: false }
  ) {
    if (job.organizationId !== input.organizationId || job.sourceId !== input.id) {
      throw new KnowledgeConflictError("The ingestion job must belong to the new knowledge version");
    }
    return this.prisma
      .$transaction(async (transaction) => {
        if (options.deactivateActiveVersion) {
          await transaction.knowledgeSource.updateMany({
            where: {
              organizationId: input.organizationId,
              familyId: input.familyId,
              active: true,
              deletedAt: null
            },
            data: { active: false }
          });
        }
        const source = await transaction.knowledgeSource.create({ data: input });
        const createdJob = await transaction.ingestionJob.create({ data: job });
        return { source, job: createdJob };
      })
      .catch((error: unknown) => this.handleError(error));
  }

  async createReindexJob(input: CreateIngestionJobInput): Promise<IngestionJobRecord> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const idempotent = await transaction.ingestionJob.findUnique({
          where: {
            organizationId_idempotencyKey: {
              organizationId: input.organizationId,
              idempotencyKey: input.idempotencyKey
            }
          }
        });
        if (idempotent) return idempotent;
        const active = await transaction.ingestionJob.findFirst({
          where: {
            organizationId: input.organizationId,
            sourceId: input.sourceId,
            strategyVersion: input.strategyVersion,
            status: { in: ["PENDING", "PROCESSING"] }
          },
          orderBy: { createdAt: "desc" }
        });
        if (active) return active;
        return transaction.ingestionJob.create({ data: input });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const active = await this.prisma.ingestionJob.findFirst({
          where: {
            organizationId: input.organizationId,
            sourceId: input.sourceId,
            strategyVersion: input.strategyVersion,
            status: { in: ["PENDING", "PROCESSING"] }
          },
          orderBy: { createdAt: "desc" }
        });
        if (active) return active;
      }
      return this.handleError(error);
    }
  }

  findIngestionJob(organizationId: string, jobId: string): Promise<IngestionJobRecord | null> {
    return this.prisma.ingestionJob.findFirst({ where: { id: jobId, organizationId } });
  }

  async listIngestionJobs(organizationId: string, filter: ListIngestionJobsFilter): Promise<IngestionJobWithSource[]> {
    const jobs = await this.prisma.ingestionJob.findMany({
      where: { organizationId, ...(filter.status ? { status: filter.status } : {}), source: { organizationId } },
      orderBy: { updatedAt: "desc" },
      take: filter.limit,
      include: { source: { select: { familyId: true, title: true, type: true, version: true, deletedAt: true } } }
    });
    return jobs.map(({ source, ...job }) => ({
      ...job,
      source: {
        familyId: source.familyId,
        title: source.title,
        type: source.type,
        version: source.version,
        deleted: source.deletedAt !== null
      }
    }));
  }

  async softDeleteFamily(organizationId: string, familyId: string, deletedAt: Date): Promise<KnowledgeSourceVersion[]> {
    return this.prisma.$transaction(async (transaction) => {
      const versions = await transaction.knowledgeSource.findMany({
        where: { organizationId, familyId, deletedAt: null }
      });
      if (versions.length === 0) return [];
      await transaction.ingestionJob.updateMany({
        where: {
          organizationId,
          sourceId: { in: versions.map((version) => version.id) },
          status: { in: ["PENDING", "PROCESSING"] }
        },
        data: {
          status: "FAILED",
          errorCode: "SOURCE_DELETED",
          errorMessage: "The source was deleted before ingestion completed",
          completedAt: deletedAt
        }
      });
      await transaction.knowledgeSource.updateMany({
        where: { organizationId, familyId, deletedAt: null },
        data: { deletedAt, active: false }
      });
      return versions;
    });
  }

  private handleError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new KnowledgeConflictError("A concurrent update created this version first");
    }
    throw error;
  }
}
