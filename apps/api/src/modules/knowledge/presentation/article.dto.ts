import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { KnowledgeVisibility } from "../domain/knowledge-repository.port";

export class CreateArticleDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title!: string;

  @IsString()
  @MinLength(1)
  content!: string;

  @IsIn(["PUBLIC", "INTERNAL"])
  visibility!: KnowledgeVisibility;
}

export class UpdateArticleDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  content?: string;

  @IsOptional()
  @IsIn(["PUBLIC", "INTERNAL"])
  visibility?: KnowledgeVisibility;
}
