import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../application/auth.service";
import { InvalidSessionError } from "../domain/auth-errors";
import { ATTENDANT_SESSION_COOKIE } from "./auth.constants";
import { readCookie, RequestLike } from "./http-types";

@Injectable()
export class AttendantSessionGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestLike>();
    try {
      const resolved = await this.authService.resolveAttendantSession(readCookie(request, ATTENDANT_SESSION_COOKIE));
      request.attendantSession = resolved.session;
      request.organizationContext = resolved.context;
      return true;
    } catch (error) {
      if (error instanceof InvalidSessionError) {
        throw new UnauthorizedException("Authentication required");
      }
      throw error;
    }
  }
}
