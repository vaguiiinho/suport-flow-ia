import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
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
import { IngestionJobRecord } from "../../knowledge/domain/knowledge-repository.port";
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

  @Get(":id")
  async get(@Req() request: RequestLike, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    const job = await this.knowledgeService.getIngestionJob(request.organizationContext!, id);
    if (!job) throw new KnowledgeNotFoundError("Ingestion job not found");
    return toJobResponse(job);
  }
}
