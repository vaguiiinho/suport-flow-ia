import { RetrievedChunk } from "./assistant-types";

export const CHAT_MODEL = Symbol("CHAT_MODEL");

export interface ChatCompletion {
  answer: string;
  citationChunkIds: string[];
  model: string;
}

export interface ChatModelPort {
  answer(input: { instructions: string; question: string; chunks: RetrievedChunk[] }): Promise<ChatCompletion>;
}
