import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AttendantSessionGuard } from "../../auth/presentation/attendant-session.guard";
import { CsrfGuard } from "../../auth/presentation/csrf.guard";
import { RequestLike } from "../../auth/presentation/http-types";
import { TrustedOriginGuard } from "../../auth/presentation/trusted-origin.guard";
import { IndexedKnowledgeSourceVersion, KnowledgeService } from "../application/knowledge.service";
import { InvalidKnowledgeContentError } from "../domain/knowledge-errors";
import { KnowledgeSourceVersion, KnowledgeType } from "../domain/knowledge-repository.port";
import { CreateArticleDto, UpdateArticleDto } from "./article.dto";
import { KnowledgeExceptionFilter } from "./knowledge-exception.filter";
import { UploadPdfDto } from "./upload-pdf.dto";

@Controller("knowledge")
@UseGuards(AttendantSessionGuard)
@UseFilters(KnowledgeExceptionFilter)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get("sources")
  async list(@Req() request: RequestLike, @Query("type") type?: string) {
    const normalizedType = this.readType(type);
    return Promise.all(
      (await this.knowledgeService.list(request.organizationContext!, normalizedType)).map((source) =>
        this.toResponse(source)
      )
    );
  }

  @Get("sources/:id")
  async get(@Req() request: RequestLike, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.toResponse(await this.knowledgeService.get(request.organizationContext!, id));
  }

  @Get("sources/:id/history")
  async history(@Req() request: RequestLike, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return Promise.all(
      (await this.knowledgeService.history(request.organizationContext!, id)).map((source) => this.toResponse(source))
    );
  }

  @Get("articles")
  async listArticles(@Req() request: RequestLike) {
    return Promise.all(
      (await this.knowledgeService.list(request.organizationContext!, "ARTICLE")).map((source) =>
        this.toResponse(source)
      )
    );
  }

  @Post("articles")
  @UseGuards(CsrfGuard, TrustedOriginGuard)
  async createArticle(@Req() request: RequestLike, @Body() body: CreateArticleDto) {
    return this.toResponse(await this.knowledgeService.createArticle(request.organizationContext!, body));
  }

  @Get("articles/:id")
  async getArticle(@Req() request: RequestLike, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.toResponse(await this.knowledgeService.getArticle(request.organizationContext!, id));
  }

  @Patch("articles/:id")
  @UseGuards(CsrfGuard, TrustedOriginGuard)
  async updateArticle(
    @Req() request: RequestLike,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: UpdateArticleDto
  ) {
    return this.toResponse(await this.knowledgeService.updateArticle(request.organizationContext!, id, body));
  }

  @Delete("articles/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(CsrfGuard, TrustedOriginGuard)
  async removeArticle(
    @Req() request: RequestLike,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string
  ): Promise<void> {
    await this.knowledgeService.remove(request.organizationContext!, id, "ARTICLE");
  }

  @Post("pdfs")
  @UseGuards(CsrfGuard, TrustedOriginGuard)
  @UseInterceptors(FileInterceptor("file"))
  async uploadPdf(@Req() request: RequestLike, @Body() body: UploadPdfDto, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new InvalidKnowledgeContentError("PDF_REQUIRED", "A PDF file is required");
    return this.toResponse(
      await this.knowledgeService.uploadPdf(request.organizationContext!, {
        title: body.title,
        visibility: body.visibility,
        familyId: body.sourceId,
        mimeType: file.mimetype,
        content: file.buffer
      })
    );
  }

  @Delete("pdfs/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(CsrfGuard, TrustedOriginGuard)
  async removePdf(
    @Req() request: RequestLike,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string
  ): Promise<void> {
    await this.knowledgeService.remove(request.organizationContext!, id, "PDF");
  }

  private readType(type: string | undefined): KnowledgeType | undefined {
    if (type === undefined) return undefined;
    if (type === "ARTICLE" || type === "PDF") return type;
    throw new InvalidKnowledgeContentError("TYPE_INVALID", "Type must be ARTICLE or PDF");
  }

  private toResponse(source: KnowledgeSourceVersion | IndexedKnowledgeSourceVersion) {
    return {
      id: source.familyId,
      versionId: source.id,
      type: source.type,
      title: source.title,
      visibility: source.visibility,
      content: source.type === "ARTICLE" ? source.content : undefined,
      mimeType: source.mimeType,
      pageCount: source.pageCount,
      version: source.version,
      indexingStatus: source.indexingStatus,
      active: source.active,
      ingestionJob: "ingestionJob" in source ? this.toJobResponse(source.ingestionJob) : undefined,
      createdAt: source.createdAt.toISOString(),
      updatedAt: source.updatedAt.toISOString()
    };
  }

  private toJobResponse(job: IndexedKnowledgeSourceVersion["ingestionJob"]) {
    return {
      id: job.id,
      operation: job.operation,
      status: job.status,
      attempts: job.attempts,
      progress: job.progress,
      strategyVersion: job.strategyVersion,
      createdAt: job.createdAt.toISOString()
    };
  }
}
