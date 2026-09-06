import { Injectable } from "@nestjs/common";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { SessionTokenPort } from "../domain/session-token.port";

@Injectable()
export class CryptoSessionToken implements SessionTokenPort {
  issue(): string {
    return randomBytes(32).toString("base64url");
  }

  hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  matches(token: string, expectedHash: string): boolean {
    const actual = Buffer.from(this.hash(token), "hex");
    const expected = Buffer.from(expectedHash, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
