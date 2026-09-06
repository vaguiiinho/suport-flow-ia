import { IngestionFailure } from "./types";

export class IngestionError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean
  ) {
    super(message);
    this.name = "IngestionError";
  }
}

export function sanitizeIngestionError(error: unknown): IngestionFailure {
  if (error instanceof IngestionError) {
    return { code: error.code, message: error.message, retryable: error.retryable };
  }
  return {
    code: "INGESTION_UNEXPECTED",
    message: "The source could not be processed safely",
    retryable: true
  };
}
