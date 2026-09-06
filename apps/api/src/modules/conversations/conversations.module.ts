import { Module } from "@nestjs/common";
import { AssistantModule } from "../assistant/assistant.module";
import { AuthModule } from "../auth/auth.module";
import { CONVERSATION_CONFIG, readConversationConfig } from "./application/conversation-config";
import { ConversationService } from "./application/conversation.service";
import { CONVERSATION_REPOSITORY } from "./domain/conversation-repository.port";
import { PrismaConversationRepository } from "./infrastructure/prisma-conversation.repository";
import { ConversationController } from "./presentation/conversation.controller";

@Module({
  imports: [AuthModule, AssistantModule],
  controllers: [ConversationController],
  providers: [
    ConversationService,
    { provide: CONVERSATION_CONFIG, useFactory: () => readConversationConfig(process.env) },
    { provide: CONVERSATION_REPOSITORY, useClass: PrismaConversationRepository }
  ]
})
export class ConversationsModule {}
