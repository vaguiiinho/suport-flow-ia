import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseFilters,
  UseGuards
} from "@nestjs/common";
import { AttendantSessionGuard } from "../../auth/presentation/attendant-session.guard";
import { CsrfGuard } from "../../auth/presentation/csrf.guard";
import { RequestLike } from "../../auth/presentation/http-types";
import { TrustedOriginGuard } from "../../auth/presentation/trusted-origin.guard";
import { KnowledgeService } from "../../knowledge/application/knowledge.service";
import { InvalidKnowledgeContentError, KnowledgeNotFoundError } from "../../knowledge/domain/knowledge-errors";
import { IngestionJobRecord, IngestionJobWithSource } from "../../knowledge/domain/knowledge-repository.port";
import { KnowledgeExceptionFilter } from "../../knowledge/presentation/knowledge-exception.filter";

function toJobResponse(job: IngestionJobRecord) {
  return {
    id: job.id,
    sourceVersionId: job.sourceId,
    operation: job.operation,
    status: job.status,
    attempts: job.attempts,
    progress: job.progress,
    strategyVersion: job.strategyVersion,
    availableAt: job.availableAt.toISOString(),
    claimedAt: job.claimedAt?.toISOString() ?? null,
    error: job.errorCode ? { code: job.errorCode, message: job.errorMessage } : null,
    completedAt: job.completedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString()
  };
}

const JOB_STATUSES = ["PENDING", "PROCESSING", "SUCCEEDED", "FAILED"] as const;
type JobStatus = (typeof JOB_STATUSES)[number];

function readStatus(status: string | undefined): JobStatus | undefined {
  if (status === undefined || status === "") return undefined;
  if ((JOB_STATUSES as readonly string[]).includes(status)) return status as JobStatus;
  throw new InvalidKnowledgeContentError("STATUS_INVALID", "Status must be PENDING, PROCESSING, SUCCEEDED or FAILED");
}

function readLimit(limit: string | undefined): number | undefined {
  if (limit === undefined || limit === "") return undefined;
  if (!/^\d+$/.test(limit)) throw new InvalidKnowledgeContentError("LIMIT_INVALID", "Limit must be an integer");
  return Number(limit);
}

@Controller("knowledge")
@UseGuards(AttendantSessionGuard)
@UseFilters(KnowledgeExceptionFilter)
export class ReindexController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post(":id/reindex")
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(CsrfGuard, TrustedOriginGuard)
  async reindex(
    @Req() request: RequestLike,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined
  ) {
    if (!idempotencyKey) {
      throw new InvalidKnowledgeContentError("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key is required for reindexing");
    }
    return toJobResponse(await this.knowledgeService.reindex(request.organizationContext!, id, idempotencyKey));
  }
}

@Controller("ingestion-jobs")
@UseGuards(AttendantSessionGuard)
@UseFilters(KnowledgeExceptionFilter)
export class IngestionJobsController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  async list(@Req() request: RequestLike, @Query("status") status?: string, @Query("limit") limit?: string) {
    const jobs = await this.knowledgeService.listIngestionJobs(request.organizationContext!, {
      status: readStatus(status),
      limit: readLimit(limit)
    });
    return jobs.map((job: IngestionJobWithSource) => ({ ...toJobResponse(job), source: job.source }));
  }

  @Get(":id")
  async get(@Req() request: RequestLike, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    const job = await this.knowledgeService.getIngestionJob(request.organizationContext!, id);
    if (!job) throw new KnowledgeNotFoundError("Ingestion job not found");
    return toJobResponse(job);
  }
}
