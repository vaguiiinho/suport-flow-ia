import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { AuthModule } from "../auth/auth.module";
import { KNOWLEDGE_CONFIG, readKnowledgeConfig } from "./application/knowledge-config";
import { KnowledgeService } from "./application/knowledge.service";
import { PdfValidator } from "./application/pdf-validator";
import { FILE_STORAGE } from "./domain/file-storage.port";
import { KNOWLEDGE_REPOSITORY } from "./domain/knowledge-repository.port";
import { LocalFileStorage } from "./infrastructure/local-file-storage";
import { PrismaKnowledgeRepository } from "./infrastructure/prisma-knowledge.repository";
import { KnowledgeController } from "./presentation/knowledge.controller";

@Module({
  imports: [
    AuthModule,
    MulterModule.registerAsync({
      useFactory: () => ({
        storage: memoryStorage(),
        limits: {
          fileSize: readKnowledgeConfig(process.env).pdfMaxBytes,
          files: 1,
          fields: 3,
          parts: 4,
          fieldNameSize: 50,
          fieldSize: 1024
        }
      })
    })
  ],
  controllers: [KnowledgeController],
  providers: [
    KnowledgeService,
    PdfValidator,
    { provide: KNOWLEDGE_CONFIG, useFactory: () => readKnowledgeConfig(process.env) },
    { provide: KNOWLEDGE_REPOSITORY, useClass: PrismaKnowledgeRepository },
    { provide: FILE_STORAGE, useClass: LocalFileStorage }
  ]
})
export class KnowledgeModule {}
