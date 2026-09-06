import { Controller, Get, HttpCode, HttpStatus, Inject, Post, Req, Res, UseGuards } from "@nestjs/common";
import { AUTH_CONFIG, AuthConfig } from "../application/auth-config";
import { AuthService } from "../application/auth.service";
import { ANONYMOUS_SESSION_COOKIE, COOKIE_PATH } from "./auth.constants";
import { AnonymousSessionGuard } from "./anonymous-session.guard";
import { RequestLike, ResponseLike } from "./http-types";
import { TrustedOriginGuard } from "./trusted-origin.guard";

@Controller("anonymous-sessions")
export class AnonymousSessionController {
  constructor(
    private readonly authService: AuthService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(TrustedOriginGuard)
  async create(@Res({ passthrough: true }) response: ResponseLike) {
    const result = await this.authService.createAnonymousSession();
    response.cookie(ANONYMOUS_SESSION_COOKIE, result.sessionToken, {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: "strict",
      path: COOKIE_PATH,
      maxAge: Math.max(0, result.expiresAt.getTime() - Date.now())
    });
    return { conversationId: result.conversationId, expiresAt: result.expiresAt.toISOString() };
  }

  @Get("current")
  @UseGuards(AnonymousSessionGuard)
  current(@Req() request: RequestLike) {
    const actor = request.organizationContext!.actor;
    if (actor.kind !== "ANONYMOUS") return { conversationId: null };
    return { conversationId: actor.conversationId };
  }
}
