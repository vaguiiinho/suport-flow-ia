import { AuthConfigurationError } from "../domain/auth-errors";

export const AUTH_CONFIG = Symbol("AUTH_CONFIG");

export interface AuthConfig {
  defaultOrganizationSlug: string;
  securityPepper: string;
  attendantSessionTtlSeconds: number;
  anonymousSessionTtlSeconds: number;
  loginMaxAttempts: number;
  loginWindowSeconds: number;
  cookieSecure: boolean;
  trustedOrigins: string[];
}

function positiveInteger(name: string, raw: string | undefined, fallback: number): number {
  const value = raw?.trim() ? Number(raw) : fallback;
  if (!Number.isInteger(value) || value < 1) {
    throw new AuthConfigurationError(`${name} must be a positive integer`);
  }
  return value;
}

export function readAuthConfig(environment: NodeJS.ProcessEnv): AuthConfig {
  const securityPepper = environment.AUTH_SECURITY_PEPPER?.trim();
  if (!securityPepper || securityPepper.length < 32) {
    throw new AuthConfigurationError("AUTH_SECURITY_PEPPER must contain at least 32 characters");
  }

  const trustedOrigins = (environment.WEB_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    defaultOrganizationSlug: environment.DEFAULT_ORGANIZATION_SLUG?.trim() || "support-flow",
    securityPepper,
    attendantSessionTtlSeconds: positiveInteger(
      "AUTH_SESSION_TTL_SECONDS",
      environment.AUTH_SESSION_TTL_SECONDS,
      28_800
    ),
    anonymousSessionTtlSeconds: positiveInteger(
      "ANONYMOUS_SESSION_TTL_SECONDS",
      environment.ANONYMOUS_SESSION_TTL_SECONDS,
      604_800
    ),
    loginMaxAttempts: positiveInteger("AUTH_LOGIN_MAX_ATTEMPTS", environment.AUTH_LOGIN_MAX_ATTEMPTS, 5),
    loginWindowSeconds: positiveInteger("AUTH_LOGIN_WINDOW_SECONDS", environment.AUTH_LOGIN_WINDOW_SECONDS, 900),
    cookieSecure: environment.COOKIE_SECURE === "true",
    trustedOrigins
  };
}
