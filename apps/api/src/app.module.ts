import { Module } from "@nestjs/common";
import { PrismaModule } from "./infrastructure/prisma/prisma.module";
import { HealthModule } from "./modules/health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { KnowledgeModule } from "./modules/knowledge/knowledge.module";
import { IngestionModule } from "./modules/ingestion/ingestion.module";
import { AssistantModule } from "./modules/assistant/assistant.module";
import { ConversationsModule } from "./modules/conversations/conversations.module";
import { TicketsModule } from "./modules/tickets/tickets.module";

@Module({
  imports: [PrismaModule, HealthModule, AuthModule, KnowledgeModule, IngestionModule, AssistantModule, ConversationsModule, TicketsModule]
})
export class AppModule {}
