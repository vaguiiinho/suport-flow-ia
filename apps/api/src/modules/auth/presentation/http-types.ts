import { AttendantSessionRecord } from "../domain/auth-repository.port";
import { OrganizationContext } from "../../../shared/organization/organization-context";

export interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
  attendantSession?: AttendantSessionRecord;
  organizationContext?: OrganizationContext;
}

export interface ResponseLike {
  cookie(
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: "strict";
      path: string;
      maxAge: number;
    }
  ): void;
  clearCookie(name: string, options: { httpOnly: boolean; secure: boolean; sameSite: "strict"; path: string }): void;
}

export function readCookie(request: RequestLike, name: string): string | undefined {
  const header = request.headers.cookie;
  const raw = Array.isArray(header) ? header.join(";") : header;
  if (!raw) return undefined;
  for (const part of raw.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function readNetworkIdentity(request: RequestLike): string {
  return request.ip || request.socket?.remoteAddress || "unknown";
}
