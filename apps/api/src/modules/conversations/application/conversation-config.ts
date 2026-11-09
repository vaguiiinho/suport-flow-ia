export const CONVERSATION_CONFIG = Symbol("CONVERSATION_CONFIG");

export interface ConversationConfig {
  messageMaxCharacters: number;
  messageRateLimit: number;
  messageRateWindowSeconds: number;
}

function positiveInteger(raw: string | undefined, fallback: number, name: string): number {
  const value = Number(raw ?? fallback);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  return value;
}

export function readConversationConfig(environment: NodeJS.ProcessEnv): ConversationConfig {
  return {
    messageMaxCharacters: positiveInteger(
      environment.CONVERSATION_MESSAGE_MAX_CHARACTERS,
      4000,
      "CONVERSATION_MESSAGE_MAX_CHARACTERS"
    ),
    messageRateLimit: positiveInteger(
      environment.CONVERSATION_MESSAGE_RATE_LIMIT,
      12,
      "CONVERSATION_MESSAGE_RATE_LIMIT"
    ),
    messageRateWindowSeconds: positiveInteger(
      environment.CONVERSATION_MESSAGE_RATE_WINDOW_SECONDS,
      60,
      "CONVERSATION_MESSAGE_RATE_WINDOW_SECONDS"
    )
  };
}
