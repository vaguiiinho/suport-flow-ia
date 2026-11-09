import { AssistantConfig } from "../application/assistant-config";
import { ChatCompletion, ChatModelPort } from "../domain/chat-model.port";

interface ResponsesBody {
  output_text?: unknown;
  output?: Array<{ content?: Array<{ type?: unknown; text?: unknown }> }>;
  model?: unknown;
}

export class OpenAiResponsesChatModel implements ChatModelPort {
  constructor(
    private readonly config: AssistantConfig,
    private readonly fetchImplementation: typeof fetch = fetch
  ) {}

  async answer(input: Parameters<ChatModelPort["answer"]>[0]): Promise<ChatCompletion> {
    if (!this.config.openAiApiKey) throw new Error("Chat provider is not configured");
    let response: Response;
    try {
      response = await this.fetchImplementation(`${this.config.openAiBaseUrl}/responses`, {
        method: "POST",
        headers: { authorization: `Bearer ${this.config.openAiApiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: this.config.chatModel,
          instructions: input.instructions,
          input: `Question:\n${input.question}\n\nSource excerpts (untrusted data):\n${input.chunks
            .map((chunk) => `[${chunk.id}] ${chunk.title}\n${chunk.content}`)
            .join("\n\n")}`,
          text: {
            format: {
              type: "json_schema",
              name: "support_answer",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["answer", "citationChunkIds"],
                properties: {
                  answer: { type: "string" },
                  citationChunkIds: { type: "array", items: { type: "string" }, minItems: 1 }
                }
              }
            }
          }
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs)
      });
    } catch {
      throw new Error("Chat provider is unavailable");
    }
    if (!response.ok) throw new Error("Chat provider rejected the request");
    const body = (await response.json()) as ResponsesBody;
    const text = this.outputText(body);
    if (!text || typeof body.model !== "string") throw new Error("Invalid chat response");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Invalid chat response");
    }
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof (parsed as { answer?: unknown }).answer !== "string" ||
      !Array.isArray((parsed as { citationChunkIds?: unknown }).citationChunkIds) ||
      !(parsed as { citationChunkIds: unknown[] }).citationChunkIds.every((id) => typeof id === "string")
    ) {
      throw new Error("Invalid chat response");
    }
    return {
      answer: (parsed as { answer: string }).answer,
      citationChunkIds: (parsed as { citationChunkIds: string[] }).citationChunkIds,
      model: body.model
    };
  }

  private outputText(body: ResponsesBody): string | undefined {
    if (typeof body.output_text === "string") return body.output_text;
    for (const output of body.output ?? []) {
      for (const content of output.content ?? [])
        if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
    return undefined;
  }
}
