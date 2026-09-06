export const KNOWLEDGE_CONFIG = Symbol("KNOWLEDGE_CONFIG");

export interface KnowledgeConfig {
  storageRoot: string;
  pdfMaxBytes: number;
  pdfMaxPages: number;
  articleMaxCharacters: number;
}

function positiveInteger(name: string, raw: string | undefined, fallback: number): number {
  const value = raw?.trim() ? Number(raw) : fallback;
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  return value;
}

export function readKnowledgeConfig(environment: NodeJS.ProcessEnv): KnowledgeConfig {
  return {
    storageRoot: environment.FILE_STORAGE_ROOT?.trim() || "./uploads",
    pdfMaxBytes: positiveInteger("PDF_MAX_BYTES", environment.PDF_MAX_BYTES, 10 * 1024 * 1024),
    pdfMaxPages: positiveInteger("PDF_MAX_PAGES", environment.PDF_MAX_PAGES, 100),
    articleMaxCharacters: positiveInteger("ARTICLE_MAX_CHARACTERS", environment.ARTICLE_MAX_CHARACTERS, 100_000)
  };
}
