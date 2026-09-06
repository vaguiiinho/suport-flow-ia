import { LocalFileReader } from "../infrastructure/local-file-reader";
import { IngestionError } from "./errors";
import { IngestionSource, TextFragment } from "./types";
import { normalizeExtractedText } from "./chunker";

export class TextExtractor {
  constructor(private readonly files: LocalFileReader) {}

  async extract(source: IngestionSource): Promise<TextFragment[]> {
    if (source.type === "ARTICLE") {
      if (!source.content)
        throw new IngestionError("ARTICLE_CONTENT_MISSING", "The article content is unavailable", false);
      return [{ content: normalizeExtractedText(source.content), page: null }];
    }
    if (!source.storageKey)
      throw new IngestionError("PDF_STORAGE_KEY_MISSING", "The PDF storage reference is unavailable", false);
    const content = await this.files.readPdf(source.organizationId, source.storageKey);
    if (!content.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
      throw new IngestionError("PDF_SIGNATURE_INVALID", "The stored PDF is invalid", false);
    }

    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(content),
      verbosity: pdfjs.VerbosityLevel.ERRORS,
      stopAtErrors: true,
      useSystemFonts: false,
      useWasm: false,
      enableXfa: false
    });
    try {
      const document = await loadingTask.promise;
      try {
        if ((await document.getPermissions()) !== null) {
          throw new IngestionError("PDF_ENCRYPTED", "Encrypted PDFs are not accepted", false);
        }
        const fragments: TextFragment[] = [];
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
          const page = await document.getPage(pageNumber);
          try {
            const text = await page.getTextContent();
            const content = text.items
              .reduce<string[]>((strings, item) => {
                if ("str" in item && typeof item.str === "string") strings.push(item.str);
                return strings;
              }, [])
              .join(" ");
            fragments.push({ content: normalizeExtractedText(content), page: pageNumber });
          } finally {
            page.cleanup();
          }
        }
        return fragments;
      } finally {
        await document.cleanup();
      }
    } catch (error) {
      if (error instanceof IngestionError) throw error;
      if (error instanceof Error && error.name === "PasswordException") {
        throw new IngestionError("PDF_ENCRYPTED", "Encrypted PDFs are not accepted", false);
      }
      throw new IngestionError("PDF_INVALID", "The stored PDF could not be safely parsed", false);
    } finally {
      await loadingTask.destroy();
    }
  }
}
