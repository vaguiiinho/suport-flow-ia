import { Module } from "@nestjs/common";
import { PrismaModule } from "./infrastructure/prisma/prisma.module";
import { HealthModule } from "./modules/health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { KnowledgeModule } from "./modules/knowledge/knowledge.module";
import { IngestionModule } from "./modules/ingestion/ingestion.module";

@Module({
  imports: [PrismaModule, HealthModule, AuthModule, KnowledgeModule, IngestionModule]
})
export class AppModule {}
