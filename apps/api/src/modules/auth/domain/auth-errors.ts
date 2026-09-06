export class InvalidCredentialsError extends Error {}

export class LoginRateLimitedError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Login temporarily blocked");
  }
}

export class InvalidSessionError extends Error {}

export class InvalidCsrfTokenError extends Error {}

export class AuthConfigurationError extends Error {}
