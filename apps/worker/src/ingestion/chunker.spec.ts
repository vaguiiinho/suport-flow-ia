import assert from "node:assert/strict";
import test from "node:test";
import { createChunks, normalizeExtractedText } from "./chunker";

test("normalizes extracted text and keeps page references while chunking", () => {
  const chunks = createChunks(
    [
      { content: "  First\r\n\npage\tcontent.  ", page: 1 },
      { content: "Second page content with enough letters.", page: 2 }
    ],
    { maxCharacters: 200, overlapCharacters: 20 }
  );

  assert.deepEqual(
    chunks.map((chunk) => ({ position: chunk.position, page: chunk.page, content: chunk.content })),
    [
      { position: 0, page: 1, content: "First\n\npage content." },
      { position: 1, page: 2, content: "Second page content with enough letters." }
    ]
  );
  assert.equal(normalizeExtractedText(" a\r\n b "), "a\nb");
});

test("rejects an empty source and invalid chunking configuration", () => {
  assert.throws(() => createChunks([{ content: "   ", page: null }], { maxCharacters: 200, overlapCharacters: 20 }));
  assert.throws(() =>
    createChunks([{ content: "usable source", page: null }], { maxCharacters: 200, overlapCharacters: 200 })
  );
});
