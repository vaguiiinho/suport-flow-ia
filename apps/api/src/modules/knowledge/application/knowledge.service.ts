import { Inject, Injectable } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { OrganizationContext } from "../../../shared/organization/organization-context";
import { FILE_STORAGE, FileStoragePort } from "../domain/file-storage.port";
import { KnowledgeNotFoundError, InvalidKnowledgeContentError } from "../domain/knowledge-errors";
import {
  KNOWLEDGE_REPOSITORY,
  KnowledgeRepositoryPort,
  KnowledgeSourceVersion,
  KnowledgeType,
  KnowledgeVisibility
} from "../domain/knowledge-repository.port";
import { KNOWLEDGE_CONFIG, KnowledgeConfig } from "./knowledge-config";
import { PdfValidator } from "./pdf-validator";

export interface ArticleInput {
  title: string;
  content: string;
  visibility: KnowledgeVisibility;
}

export type UpdateArticleInput = Partial<ArticleInput>;

export interface PdfInput {
  title: string;
  visibility: KnowledgeVisibility;
  familyId?: string;
  mimeType: string;
  content: Buffer;
}

@Injectable()
export class KnowledgeService {
  constructor(
    @Inject(KNOWLEDGE_REPOSITORY) private readonly repository: KnowledgeRepositoryPort,
    @Inject(FILE_STORAGE) private readonly storage: FileStoragePort,
    @Inject(KNOWLEDGE_CONFIG) private readonly config: KnowledgeConfig,
    private readonly pdfValidator: PdfValidator
  ) {}

  list(context: OrganizationContext, type?: KnowledgeType): Promise<KnowledgeSourceVersion[]> {
    return this.repository.listLatest(context.organizationId, type);
  }

  async get(context: OrganizationContext, familyId: string): Promise<KnowledgeSourceVersion> {
    const source = await this.repository.findLatest(context.organizationId, familyId);
    if (!source) throw new KnowledgeNotFoundError("Knowledge source not found");
    return source;
  }

  async history(context: OrganizationContext, familyId: string): Promise<KnowledgeSourceVersion[]> {
    const versions = await this.repository.findVersions(context.organizationId, familyId);
    if (versions.length === 0) throw new KnowledgeNotFoundError("Knowledge source not found");
    return versions;
  }

  async createArticle(context: OrganizationContext, input: ArticleInput): Promise<KnowledgeSourceVersion> {
    const title = this.validateTitle(input.title);
    const content = this.normalizeArticle(input.content);
    const visibility = this.validateVisibility(input.visibility);
    return this.repository.createVersion({
      id: randomUUID(),
      familyId: randomUUID(),
      organizationId: context.organizationId,
      type: "ARTICLE",
      title,
      content,
      visibility,
      contentHash: this.hash(content),
      version: 1
    });
  }

  async updateArticle(
    context: OrganizationContext,
    familyId: string,
    input: UpdateArticleInput
  ): Promise<KnowledgeSourceVersion> {
    const current = await this.requireType(context.organizationId, familyId, "ARTICLE");
    const title = this.validateTitle(input.title ?? current.title);
    const content = this.normalizeArticle(input.content ?? current.content ?? "");
    const visibility = this.validateVisibility(input.visibility ?? current.visibility);
    const contentHash = this.hash(content);
    if (current.title === title && current.visibility === visibility && current.contentHash === contentHash) {
      return current;
    }
    return this.repository.createVersion({
      id: randomUUID(),
      familyId,
      organizationId: context.organizationId,
      type: "ARTICLE",
      title,
      content,
      visibility,
      contentHash,
      version: current.version + 1
    });
  }

  async uploadPdf(context: OrganizationContext, input: PdfInput): Promise<KnowledgeSourceVersion> {
    const current = input.familyId
      ? await this.requireType(context.organizationId, input.familyId, "PDF")
      : null;
    const title = this.validateTitle(input.title);
    const visibility = this.validateVisibility(input.visibility);
    const validated = await this.pdfValidator.validate(input.content, input.mimeType);
    if (
      current &&
      current.title === title &&
      current.visibility === visibility &&
      current.contentHash === validated.contentHash
    ) {
      return current;
    }

    const familyId = current?.familyId ?? randomUUID();
    const versionId = randomUUID();
    const version = (current?.version ?? 0) + 1;
    const storageKey = [
      "organizations",
      context.organizationId,
      "knowledge",
      familyId,
      "versions",
      `${versionId}.pdf`
    ].join("/");

    await this.storage.put(storageKey, input.content);
    try {
      return await this.repository.createVersion({
        id: versionId,
        familyId,
        organizationId: context.organizationId,
        type: "PDF",
        title,
        visibility,
        storageKey,
        mimeType: "application/pdf",
        pageCount: validated.pageCount,
        contentHash: validated.contentHash,
        version
      });
    } catch (error) {
      await this.storage.remove(storageKey);
      throw error;
    }
  }

  async remove(context: OrganizationContext, familyId: string, type?: KnowledgeType): Promise<void> {
    if (type) await this.requireType(context.organizationId, familyId, type);
    const versions = await this.repository.softDeleteFamily(context.organizationId, familyId, new Date());
    if (versions.length === 0) throw new KnowledgeNotFoundError("Knowledge source not found");
    await Promise.allSettled(
      versions.filter((version) => version.storageKey).map((version) => this.storage.remove(version.storageKey!))
    );
  }

  private async requireType(
    organizationId: string,
    familyId: string,
    type: KnowledgeType
  ): Promise<KnowledgeSourceVersion> {
    const source = await this.repository.findLatest(organizationId, familyId);
    if (!source || source.type !== type) throw new KnowledgeNotFoundError("Knowledge source not found");
    return source;
  }

  private normalizeArticle(content: string): string {
    const normalized = content.replace(/\r\n?/g, "\n").trim();
    if (!normalized) throw new InvalidKnowledgeContentError("ARTICLE_EMPTY", "Article content is required");
    if (normalized.length > this.config.articleMaxCharacters) {
      throw new InvalidKnowledgeContentError("ARTICLE_TOO_LARGE", "Article content exceeds the configured limit");
    }
    return normalized;
  }

  private validateTitle(title: string): string {
    const normalized = title.trim();
    if (normalized.length < 3 || normalized.length > 160) {
      throw new InvalidKnowledgeContentError("TITLE_INVALID", "Title must contain between 3 and 160 characters");
    }
    return normalized;
  }

  private validateVisibility(visibility: KnowledgeVisibility): KnowledgeVisibility {
    if (visibility !== "PUBLIC" && visibility !== "INTERNAL") {
      throw new InvalidKnowledgeContentError("VISIBILITY_INVALID", "Visibility must be PUBLIC or INTERNAL");
    }
    return visibility;
  }

  private hash(content: string): string {
    return createHash("sha256").update(content, "utf8").digest("hex");
  }
}
