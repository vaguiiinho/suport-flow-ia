import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { KnowledgeModule } from "../knowledge/knowledge.module";
import { IngestionJobsController, ReindexController } from "./presentation/ingestion.controller";

@Module({
  imports: [AuthModule, KnowledgeModule],
  controllers: [ReindexController, IngestionJobsController]
})
export class IngestionModule {}
