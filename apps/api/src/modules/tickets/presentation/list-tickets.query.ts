import { IsIn, IsOptional } from "class-validator";

export class ListTicketsQuery {
  @IsOptional()
  @IsIn(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"])
  status?: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

  @IsOptional()
  @IsIn(["LOW", "MEDIUM", "HIGH", "URGENT"])
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}
