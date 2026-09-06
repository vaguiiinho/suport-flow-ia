import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateTicketDto {
  @IsUUID()
  conversationId!: string;

  @IsBoolean()
  confirmed!: boolean;

  @IsString()
  @MinLength(3)
  @MaxLength(160)
  summary!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  description!: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(40)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsIn(["LOW", "MEDIUM", "HIGH", "URGENT"])
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}
