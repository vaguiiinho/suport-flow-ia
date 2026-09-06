export const SESSION_TOKEN = Symbol("SESSION_TOKEN");

export interface SessionTokenPort {
  issue(): string;
  hash(token: string): string;
  matches(token: string, expectedHash: string): boolean;
}
