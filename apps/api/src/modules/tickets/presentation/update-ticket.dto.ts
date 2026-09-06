import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateTicketDto {
  @IsOptional()
  @IsIn(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"])
  status?: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

  @IsOptional()
  @IsIn(["LOW", "MEDIUM", "HIGH", "URGENT"])
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string | null;
}
