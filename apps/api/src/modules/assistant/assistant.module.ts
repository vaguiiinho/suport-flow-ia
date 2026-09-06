import { Module } from "@nestjs/common";
import { ASSISTANT_CONFIG, readAssistantConfig } from "./application/assistant-config";
import { AssistantService } from "./application/assistant.service";
import { CHAT_MODEL } from "./domain/chat-model.port";
import { QUERY_EMBEDDING_PROVIDER } from "./domain/embedding-provider.port";
import { RETRIEVAL_REPOSITORY } from "./domain/retrieval-repository.port";
import { OpenAiQueryEmbeddingProvider } from "./infrastructure/openai-query-embedding-provider";
import { OpenAiResponsesChatModel } from "./infrastructure/openai-responses-chat-model";
import { PrismaRetrievalRepository } from "./infrastructure/prisma-retrieval.repository";

@Module({
  providers: [
    AssistantService,
    { provide: ASSISTANT_CONFIG, useFactory: () => readAssistantConfig(process.env) },
    {
      provide: QUERY_EMBEDDING_PROVIDER,
      useFactory: (config) => new OpenAiQueryEmbeddingProvider(config),
      inject: [ASSISTANT_CONFIG]
    },
    {
      provide: CHAT_MODEL,
      useFactory: (config) => new OpenAiResponsesChatModel(config),
      inject: [ASSISTANT_CONFIG]
    },
    { provide: RETRIEVAL_REPOSITORY, useClass: PrismaRetrievalRepository }
  ],
  exports: [AssistantService]
})
export class AssistantModule {}
