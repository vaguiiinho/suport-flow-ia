import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { AUTH_CONFIG, AuthConfig } from "../application/auth-config";
import { RequestLike } from "./http-types";

@Injectable()
export class TrustedOriginGuard implements CanActivate {
  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestLike>();
    const rawOrigin = request.headers.origin;
    const origin = Array.isArray(rawOrigin) ? rawOrigin[0] : rawOrigin;
    if (origin && !this.config.trustedOrigins.includes(origin)) {
      throw new ForbiddenException("Untrusted request origin");
    }
    return true;
  }
}
