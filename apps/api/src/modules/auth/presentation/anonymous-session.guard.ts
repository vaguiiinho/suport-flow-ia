import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../application/auth.service";
import { InvalidSessionError } from "../domain/auth-errors";
import { ANONYMOUS_SESSION_COOKIE } from "./auth.constants";
import { readCookie, RequestLike } from "./http-types";

@Injectable()
export class AnonymousSessionGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestLike>();
    try {
      request.organizationContext = await this.authService.resolveAnonymousSession(
        readCookie(request, ANONYMOUS_SESSION_COOKIE)
      );
      return true;
    } catch (error) {
      if (error instanceof InvalidSessionError) {
        throw new UnauthorizedException("Anonymous session required");
      }
      throw error;
    }
  }
}
