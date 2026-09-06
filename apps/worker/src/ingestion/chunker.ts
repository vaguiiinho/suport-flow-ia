import { IngestionError } from "./errors";
import { IngestionChunk, TextFragment } from "./types";

export interface ChunkingConfig {
  maxCharacters: number;
  overlapCharacters: number;
}

export function normalizeExtractedText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitText(content: string, config: ChunkingConfig): string[] {
  const chunks: string[] = [];
  let offset = 0;
  while (offset < content.length) {
    let end = Math.min(content.length, offset + config.maxCharacters);
    if (end < content.length) {
      const boundary = Math.max(content.lastIndexOf("\n", end), content.lastIndexOf(" ", end));
      if (boundary > offset + Math.floor(config.maxCharacters / 2)) end = boundary;
    }
    const chunk = content.slice(offset, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= content.length) break;
    offset = Math.max(end - config.overlapCharacters, offset + 1);
  }
  return chunks;
}

export function createChunks(fragments: TextFragment[], config: ChunkingConfig): IngestionChunk[] {
  if (!Number.isInteger(config.maxCharacters) || config.maxCharacters < 200) {
    throw new IngestionError("CHUNKING_CONFIG_INVALID", "Chunk size must be at least 200 characters", false);
  }
  if (
    !Number.isInteger(config.overlapCharacters) ||
    config.overlapCharacters < 0 ||
    config.overlapCharacters >= config.maxCharacters
  ) {
    throw new IngestionError("CHUNKING_CONFIG_INVALID", "Chunk overlap must be smaller than the chunk size", false);
  }

  const chunks: IngestionChunk[] = [];
  for (const fragment of fragments) {
    const normalized = normalizeExtractedText(fragment.content);
    if (!/[\p{L}\p{N}]/u.test(normalized)) continue;
    for (const content of splitText(normalized, config)) {
      chunks.push({ content, page: fragment.page, position: chunks.length });
    }
  }
  if (chunks.length === 0) {
    throw new IngestionError("SOURCE_WITHOUT_EXTRACTABLE_TEXT", "The source contains no extractable text", false);
  }
  return chunks;
}
