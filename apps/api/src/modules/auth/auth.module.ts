import { Module } from "@nestjs/common";
import { AUTH_CONFIG, readAuthConfig } from "./application/auth-config";
import { AuthService } from "./application/auth.service";
import { AUTH_REPOSITORY } from "./domain/auth-repository.port";
import { PASSWORD_HASHER } from "./domain/password-hasher.port";
import { SESSION_TOKEN } from "./domain/session-token.port";
import { CryptoPasswordHasher } from "./infrastructure/crypto-password-hasher";
import { CryptoSessionToken } from "./infrastructure/crypto-session-token";
import { PrismaAuthRepository } from "./infrastructure/prisma-auth.repository";
import { AnonymousSessionGuard } from "./presentation/anonymous-session.guard";
import { AnonymousSessionController } from "./presentation/anonymous-session.controller";
import { AttendantSessionGuard } from "./presentation/attendant-session.guard";
import { AuthController } from "./presentation/auth.controller";
import { CsrfGuard } from "./presentation/csrf.guard";
import { TrustedOriginGuard } from "./presentation/trusted-origin.guard";

@Module({
  controllers: [AuthController, AnonymousSessionController],
  providers: [
    AuthService,
    AttendantSessionGuard,
    AnonymousSessionGuard,
    CsrfGuard,
    TrustedOriginGuard,
    { provide: AUTH_CONFIG, useFactory: () => readAuthConfig(process.env) },
    { provide: AUTH_REPOSITORY, useClass: PrismaAuthRepository },
    { provide: PASSWORD_HASHER, useClass: CryptoPasswordHasher },
    { provide: SESSION_TOKEN, useClass: CryptoSessionToken }
  ],
  exports: [AUTH_CONFIG, AuthService, AttendantSessionGuard, AnonymousSessionGuard, CsrfGuard, TrustedOriginGuard]
})
export class AuthModule {}
