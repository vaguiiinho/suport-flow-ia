import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { AuthService } from "../application/auth.service";
import { InvalidCsrfTokenError } from "../domain/auth-errors";
import { RequestLike } from "./http-types";

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestLike>();
    const rawHeader = request.headers["x-csrf-token"];
    const csrfToken = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    if (!request.attendantSession) throw new ForbiddenException("CSRF validation unavailable");
    try {
      this.authService.validateCsrfToken(request.attendantSession, csrfToken);
      return true;
    } catch (error) {
      if (error instanceof InvalidCsrfTokenError) {
        throw new ForbiddenException("Invalid CSRF token");
      }
      throw error;
    }
  }
}
