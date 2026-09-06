import assert from "node:assert/strict";
import test from "node:test";
import { OpenAiEmbeddingProvider } from "./openai-embedding-provider";

test("sends normalized batches to the OpenAI embeddings endpoint and preserves response order", async () => {
  let request: Request | undefined;
  const provider = new OpenAiEmbeddingProvider(
    {
      apiKey: "test-key",
      baseUrl: "https://example.test/v1",
      model: "text-embedding-3-small",
      dimensions: 3,
      timeoutMs: 1000
    },
    async (input, init) => {
      request = new Request(input, init);
      return new Response(
        JSON.stringify({
          data: [
            { index: 1, embedding: [4, 5, 6] },
            { index: 0, embedding: [1, 2, 3] }
          ],
          model: "text-embedding-3-small",
          usage: { prompt_tokens: 7, total_tokens: 7 }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
  );

  const result = await provider.embed(["first", "second"]);
  assert.equal(request?.url, "https://example.test/v1/embeddings");
  assert.equal(request?.headers.get("authorization"), "Bearer test-key");
  assert.deepEqual(JSON.parse((await request?.text()) ?? "{}"), {
    model: "text-embedding-3-small",
    input: ["first", "second"],
    dimensions: 3,
    encoding_format: "float"
  });
  assert.deepEqual(result.embeddings, [
    [1, 2, 3],
    [4, 5, 6]
  ]);
  assert.equal(result.inputTokens, 7);
});

test("fails safely when the provider is not configured or returns unexpected dimensions", async () => {
  const unconfigured = new OpenAiEmbeddingProvider({
    apiKey: undefined,
    baseUrl: "https://example.test/v1",
    model: "text-embedding-3-small",
    dimensions: 3,
    timeoutMs: 1000
  });
  await assert.rejects(() => unconfigured.embed(["content"]), { name: "IngestionError" });

  const invalid = new OpenAiEmbeddingProvider(
    {
      apiKey: "test-key",
      baseUrl: "https://example.test/v1",
      model: "text-embedding-3-small",
      dimensions: 3,
      timeoutMs: 1000
    },
    async () =>
      new Response(JSON.stringify({ data: [{ index: 0, embedding: [1, 2] }], model: "text-embedding-3-small" }), {
        status: 200
      })
  );
  await assert.rejects(() => invalid.embed(["content"]), { name: "IngestionError" });
});
