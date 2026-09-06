import { Injectable } from "@nestjs/common";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { PasswordHasherPort } from "../domain/password-hasher.port";

const KEY_LENGTH = 64;
const COST = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

function deriveKey(
  password: string,
  salt: Buffer,
  options: { N: number; r: number; p: number; maxmem: number }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, KEY_LENGTH, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

@Injectable()
export class CryptoPasswordHasher implements PasswordHasherPort {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derivedKey = await deriveKey(password, salt, COST);
    return ["scrypt", COST.N, COST.r, COST.p, salt.toString("base64url"), derivedKey.toString("base64url")].join("$");
  }

  async verify(password: string, encodedHash: string): Promise<boolean> {
    const [algorithm, rawN, rawR, rawP, rawSalt, rawHash] = encodedHash.split("$");
    if (algorithm !== "scrypt" || !rawN || !rawR || !rawP || !rawSalt || !rawHash) return false;

    const expected = Buffer.from(rawHash, "base64url");
    if (expected.length !== KEY_LENGTH) return false;

    try {
      const derived = await deriveKey(password, Buffer.from(rawSalt, "base64url"), {
        N: Number(rawN),
        r: Number(rawR),
        p: Number(rawP),
        maxmem: COST.maxmem
      });
      return timingSafeEqual(derived, expected);
    } catch {
      return false;
    }
  }
}
