import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import { AUTH_CONFIG, AuthConfig } from "../application/auth-config";
import { AuthService } from "../application/auth.service";
import { AuthConfigurationError, InvalidCredentialsError, LoginRateLimitedError } from "../domain/auth-errors";
import { Inject } from "@nestjs/common";
import { ATTENDANT_SESSION_COOKIE, COOKIE_PATH } from "./auth.constants";
import { AttendantSessionGuard } from "./attendant-session.guard";
import { CsrfGuard } from "./csrf.guard";
import { LoginDto } from "./login.dto";
import { readNetworkIdentity, RequestLike, ResponseLike } from "./http-types";
import { TrustedOriginGuard } from "./trusted-origin.guard";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig
  ) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @UseGuards(TrustedOriginGuard)
  async login(@Body() body: LoginDto, @Req() request: RequestLike, @Res({ passthrough: true }) response: ResponseLike) {
    try {
      const result = await this.authService.login(body.email, body.password, readNetworkIdentity(request));
      this.setSessionCookie(response, result.sessionToken, result.expiresAt);
      return {
        user: result.user,
        csrfToken: result.csrfToken,
        expiresAt: result.expiresAt.toISOString()
      };
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        throw new UnauthorizedException("Invalid email or password");
      }
      if (error instanceof LoginRateLimitedError) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: "Too many login attempts",
            retryAfterSeconds: error.retryAfterSeconds
          },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
      if (error instanceof AuthConfigurationError) {
        throw new ServiceUnavailableException("Authentication is unavailable");
      }
      throw error;
    }
  }

  @Get("session")
  @UseGuards(AttendantSessionGuard)
  session(@Req() request: RequestLike) {
    const session = request.attendantSession!;
    return {
      user: { id: session.userId, email: session.user.email, role: session.user.role },
      expiresAt: session.expiresAt.toISOString()
    };
  }

  @Get("csrf")
  @UseGuards(AttendantSessionGuard)
  async csrf(@Req() request: RequestLike) {
    return { csrfToken: await this.authService.rotateCsrfToken(request.attendantSession!.id) };
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AttendantSessionGuard, CsrfGuard, TrustedOriginGuard)
  async logout(@Req() request: RequestLike, @Res({ passthrough: true }) response: ResponseLike): Promise<void> {
    await this.authService.logout(request.attendantSession!, readNetworkIdentity(request));
    response.clearCookie(ATTENDANT_SESSION_COOKIE, this.cookieOptions());
  }

  private setSessionCookie(response: ResponseLike, token: string, expiresAt: Date): void {
    response.cookie(ATTENDANT_SESSION_COOKIE, token, {
      ...this.cookieOptions(),
      maxAge: Math.max(0, expiresAt.getTime() - Date.now())
    });
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: "strict" as const,
      path: COOKIE_PATH
    };
  }
}
