import { Inject, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { InvalidKnowledgeContentError } from "../domain/knowledge-errors";
import { KNOWLEDGE_CONFIG, KnowledgeConfig } from "./knowledge-config";

export interface ValidatedPdf {
  contentHash: string;
  pageCount: number;
}

@Injectable()
export class PdfValidator {
  constructor(@Inject(KNOWLEDGE_CONFIG) private readonly config: KnowledgeConfig) {}

  async validate(content: Buffer, mimeType: string): Promise<ValidatedPdf> {
    if (content.length === 0) {
      throw new InvalidKnowledgeContentError("PDF_EMPTY", "The PDF is empty");
    }
    if (content.length > this.config.pdfMaxBytes) {
      throw new InvalidKnowledgeContentError("PDF_TOO_LARGE", "The PDF exceeds the configured size limit");
    }
    if (mimeType.toLowerCase() !== "application/pdf") {
      throw new InvalidKnowledgeContentError("PDF_MIME_INVALID", "The uploaded file must use application/pdf");
    }
    if (!content.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
      throw new InvalidKnowledgeContentError("PDF_SIGNATURE_INVALID", "The file does not have a valid PDF signature");
    }

    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(content),
      disableWorker: true,
      isEvalSupported: false,
      stopAtErrors: true,
      useSystemFonts: false
    });

    try {
      const document = await loadingTask.promise;
      try {
        if (document.numPages < 1) {
          throw new InvalidKnowledgeContentError("PDF_EMPTY", "The PDF contains no pages");
        }
        if (document.numPages > this.config.pdfMaxPages) {
          throw new InvalidKnowledgeContentError("PDF_TOO_MANY_PAGES", "The PDF exceeds the configured page limit");
        }

        let hasExtractableText = false;
        for (let pageNumber = 1; pageNumber <= document.numPages && !hasExtractableText; pageNumber += 1) {
          const page = await document.getPage(pageNumber);
          const text = await page.getTextContent();
          hasExtractableText = text.items.some((item) => "str" in item && item.str.trim().length > 0);
          page.cleanup();
        }
        if (!hasExtractableText) {
          throw new InvalidKnowledgeContentError(
            "PDF_WITHOUT_EXTRACTABLE_TEXT",
            "The PDF does not contain extractable text"
          );
        }

        return {
          contentHash: createHash("sha256").update(content).digest("hex"),
          pageCount: document.numPages
        };
      } finally {
        await document.destroy();
      }
    } catch (error) {
      if (error instanceof InvalidKnowledgeContentError) throw error;
      if (error instanceof Error && error.name === "PasswordException") {
        throw new InvalidKnowledgeContentError("PDF_ENCRYPTED", "Encrypted PDFs are not accepted");
      }
      throw new InvalidKnowledgeContentError("PDF_INVALID", "The PDF could not be safely parsed");
    } finally {
      await loadingTask.destroy();
    }
  }
}
