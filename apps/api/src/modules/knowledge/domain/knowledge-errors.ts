export class KnowledgeNotFoundError extends Error {}

export class InvalidKnowledgeContentError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export class KnowledgeConflictError extends Error {}
