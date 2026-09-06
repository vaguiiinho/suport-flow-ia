import assert from "node:assert/strict";
import test from "node:test";
import { InvalidKnowledgeContentError } from "../domain/knowledge-errors";
import { KnowledgeConfig } from "./knowledge-config";
import { PdfValidator } from "./pdf-validator";

const config: KnowledgeConfig = {
  storageRoot: "unused",
  pdfMaxBytes: 100_000,
  pdfMaxPages: 2,
  articleMaxCharacters: 100
};

function pdfWithText(text: string): Buffer {
  const stream = `BT /F1 12 Tf 72 100 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ];
  let document = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(document));
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(document);
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  document += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(document);
}

async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof InvalidKnowledgeContentError);
    assert.equal(error.code, code);
    return true;
  });
}

test("accepts a parseable PDF with extractable text", async () => {
  const content = pdfWithText("Support guide");
  const result = await new PdfValidator(config).validate(content, "application/pdf");

  assert.equal(result.pageCount, 1);
  assert.match(result.contentHash, /^[a-f0-9]{64}$/);
});

test("rejects empty, oversized, wrong-MIME, bad-signature and textless files", async () => {
  const validator = new PdfValidator({ ...config, pdfMaxBytes: 20 });
  await expectCode(validator.validate(Buffer.alloc(0), "application/pdf"), "PDF_EMPTY");
  await expectCode(validator.validate(pdfWithText("content"), "application/pdf"), "PDF_TOO_LARGE");
  await expectCode(new PdfValidator(config).validate(pdfWithText("content"), "text/plain"), "PDF_MIME_INVALID");
  await expectCode(new PdfValidator(config).validate(Buffer.from("not a pdf"), "application/pdf"), "PDF_SIGNATURE_INVALID");
  await expectCode(new PdfValidator(config).validate(pdfWithText(""), "application/pdf"), "PDF_WITHOUT_EXTRACTABLE_TEXT");
});
