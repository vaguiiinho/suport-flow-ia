import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";
import { KnowledgeVisibility } from "../domain/knowledge-repository.port";

export class UploadPdfDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title!: string;

  @IsIn(["PUBLIC", "INTERNAL"])
  visibility!: KnowledgeVisibility;

  @Transform(({ value }: { value: unknown }) => (value === "" ? undefined : value))
  @IsOptional()
  @IsUUID("4")
  sourceId?: string;
}
