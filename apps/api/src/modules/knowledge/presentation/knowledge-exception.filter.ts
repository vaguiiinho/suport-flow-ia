import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from "@nestjs/common";
import { Response } from "express";
import { MulterError } from "multer";
import {
  InvalidKnowledgeContentError,
  KnowledgeConflictError,
  KnowledgeNotFoundError
} from "../domain/knowledge-errors";

@Catch(KnowledgeNotFoundError, InvalidKnowledgeContentError, KnowledgeConflictError, MulterError)
export class KnowledgeExceptionFilter implements ExceptionFilter {
  catch(
    exception: KnowledgeNotFoundError | InvalidKnowledgeContentError | KnowledgeConflictError | MulterError,
    host: ArgumentsHost
  ): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof KnowledgeNotFoundError) {
      response.status(HttpStatus.NOT_FOUND).json({
        statusCode: HttpStatus.NOT_FOUND,
        code: "KNOWLEDGE_NOT_FOUND",
        message: "Knowledge source not found"
      });
      return;
    }
    if (exception instanceof KnowledgeConflictError) {
      response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        code: "KNOWLEDGE_VERSION_CONFLICT",
        message: "The knowledge source was updated concurrently"
      });
      return;
    }
    if (exception instanceof MulterError) {
      const fileTooLarge = exception.code === "LIMIT_FILE_SIZE";
      const status = fileTooLarge ? HttpStatus.PAYLOAD_TOO_LARGE : HttpStatus.UNPROCESSABLE_ENTITY;
      response.status(status).json({
        statusCode: status,
        code: fileTooLarge ? "PDF_TOO_LARGE" : "PDF_MULTIPART_INVALID",
        message: fileTooLarge ? "The PDF exceeds the configured size limit" : "The PDF upload is invalid"
      });
      return;
    }
    response.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      code: exception.code,
      message: exception.message
    });
  }
}
