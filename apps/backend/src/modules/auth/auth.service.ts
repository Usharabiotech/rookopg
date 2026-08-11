import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '@prisma/client';
import type { AppConfig } from '../../config/env.config';
import { CryptoService } from '../../common/crypto/crypto.service';
import { maskPhone, normalisePhone } from '../../common/crypto/phone.util';
import {
  DomainErrorCode,
  RateLimitedError,
  UnauthorisedError,
} from '../../common/errors/domain.error';
import { IamService } from '../iam/iam.service';
import { AuthRepository } from './auth.repository';
import { TokenService } from './token.service';
import type { AuthSessionDto, AuthUserDto, RequestOtpResponseDto } from './dto/auth.dto';

interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly otpTtlSeconds: number;
  private readonly otpMaxAttempts: number;
  private readonly otpMaxRequests: number;
  private readonly otpRequestWindowSeconds: number;
  private readonly isProduction: boolean;

  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly repository: AuthRepository,
    private readonly crypto: CryptoService,
    private readonly tokens: TokenService,
    private readonly iam: IamService,
  ) {
    this.otpTtlSeconds = config.get('OTP_TTL_SECONDS', { infer: true });
    this.otpMaxAttempts = config.get('OTP_MAX_ATTEMPTS', { infer: true });
    this.otpMaxRequests = config.get('OTP_MAX_REQUESTS_PER_WINDOW', { infer: true });
    this.otpRequestWindowSeconds = config.get('OTP_REQUEST_WINDOW_SECONDS', { infer: true });
    this.isProduction = config.get('NODE_ENV', { infer: true }) === 'production';
  }

  /**
   * Sends a login code.
   *
   * Deliberately returns the same shape whether or not the number has an
   * account — otherwise this endpoint tells an attacker who is registered.
   */
  async requestOtp(rawPhone: string, _context: RequestContext): Promise<RequestOtpResponseDto> {
    const phone = normalisePhone(rawPhone);

    const windowStart = new Date(Date.now() - this.otpRequestWindowSeconds * 1000);
    const recentRequests = await this.repository.countOtpRequestsSince(phone, windowStart);
    if (recentRequests >= this.otpMaxRequests) {
      throw new RateLimitedError(
        DomainErrorCode.OTP_RATE_LIMITED,
        'Too many codes requested. Try again later.',
        this.otpRequestWindowSeconds,
      );
    }

    const code = this.crypto.generateOtp();
    const challenge = await this.repository.createOtpChallenge({
      phone,
      codeHash: this.crypto.hashOtp(code, phone),
      expiresAt: new Date(Date.now() + this.otpTtlSeconds * 1000),
    });

    // TODO(milestone 2): dispatch via SMS once DLT registration completes.
    if (!this.isProduction) {
      this.logger.warn(`DEV OTP for ${maskPhone(phone)}: ${code}`);
    }

    return {
      challengeId: challenge.id,
      expiresInSeconds: this.otpTtlSeconds,
      ...(this.isProduction ? {} : { devCode: code }),
    };
  }

  async verifyOtp(
    challengeId: string,
    code: string,
    context: RequestContext,
  ): Promise<AuthSessionDto> {
    const challenge = await this.repository.findOtpChallenge(challengeId);

    // Same error for "no such challenge" and "wrong code" — do not confirm
    // that a challenge id exists.
    if (!challenge || challenge.consumedAt !== null) {
      throw new UnauthorisedError(DomainErrorCode.OTP_INVALID, 'Invalid or expired code');
    }

    if (challenge.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorisedError(DomainErrorCode.OTP_EXPIRED, 'This code has expired');
    }

    if (challenge.attempts >= this.otpMaxAttempts) {
      throw new UnauthorisedError(
        DomainErrorCode.OTP_TOO_MANY_ATTEMPTS,
        'Too many incorrect attempts. Request a new code.',
      );
    }

    const expectedHash = this.crypto.hashOtp(code, challenge.phone);
    if (!this.crypto.safeEquals(expectedHash, challenge.codeHash)) {
      const attempts = await this.repository.incrementOtpAttempts(challenge.id);
      if (attempts >= this.otpMaxAttempts) {
        await this.repository.consumeOtpChallenge(challenge.id);
      }
      throw new UnauthorisedError(DomainErrorCode.OTP_INVALID, 'Invalid or expired code');
    }

    await this.repository.consumeOtpChallenge(challenge.id);
    await this.repository.consumeOtherChallengesForPhone(challenge.phone, challenge.id);

    const user = await this.repository.findOrCreateUser(challenge.phone);

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorisedError(DomainErrorCode.ACCOUNT_SUSPENDED, 'This account is suspended');
    }

    // A number a manager entered during an offline booking exists as
    // UNCLAIMED. Verifying the OTP claims that same account — it must never
    // become a second person.
    if (user.status === UserStatus.UNCLAIMED) {
      await this.repository.claimUser(user.id);
    }

    const issued = await this.tokens.issue({
      userId: user.id,
      ipAddress: context.ipAddress,
      deviceLabel: context.userAgent?.slice(0, 120),
    });

    return {
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
      accessExpiresInSeconds: issued.accessExpiresInSeconds,
      user: await this.buildAuthUser(user.id, user.phone, user.fullName),
    };
  }

  /**
   * Rotates a refresh token.
   *
   * Presenting a token that was already rotated means it was stolen — the
   * legitimate holder would have the newest one. Every session in the family
   * is revoked, so the thief and the victim are both logged out and the
   * victim notices.
   */
  async refresh(refreshToken: string, context: RequestContext): Promise<AuthSessionDto> {
    const tokenHash = this.tokens.hashRefreshToken(refreshToken);
    const session = await this.repository.findSessionByTokenHash(tokenHash);

    if (!session) {
      throw new UnauthorisedError(DomainErrorCode.REFRESH_TOKEN_INVALID, 'Please sign in again');
    }

    if (session.revokedAt !== null) {
      const revoked = await this.repository.revokeFamily(session.familyId);
      this.logger.error(
        `Refresh token reuse detected for user ${session.userId}; revoked ${revoked} session(s) in family ${session.familyId}`,
      );
      throw new UnauthorisedError(
        DomainErrorCode.REFRESH_TOKEN_REUSED,
        'Your session was ended for security reasons. Please sign in again.',
      );
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorisedError(DomainErrorCode.REFRESH_TOKEN_INVALID, 'Please sign in again');
    }

    await this.repository.revokeSession(session.id);

    const issued = await this.tokens.issue({
      userId: session.userId,
      familyId: session.familyId,
      ipAddress: context.ipAddress,
      deviceLabel: context.userAgent?.slice(0, 120),
    });

    const user = await this.iam.getUserForAuth(session.userId);
    if (!user || user.status === UserStatus.SUSPENDED) {
      throw new UnauthorisedError(DomainErrorCode.ACCOUNT_SUSPENDED, 'This account is suspended');
    }

    return {
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
      accessExpiresInSeconds: issued.accessExpiresInSeconds,
      user: await this.buildAuthUser(user.id, user.phone, user.fullName),
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const session = await this.repository.findSessionByTokenHash(
      this.tokens.hashRefreshToken(refreshToken),
    );
    // Silent success — logging out an unknown token is not an error, and
    // reporting it would confirm whether the token was real.
    if (session && session.revokedAt === null) {
      await this.repository.revokeSession(session.id);
    }
  }

  async buildAuthUser(
    userId: string,
    phone: string,
    fullName: string | null,
  ): Promise<AuthUserDto> {
    const [memberships, platformRoles] = await Promise.all([
      this.iam.listMembershipsWithOrgNames(userId),
      this.iam.listPlatformRoles(userId),
    ]);

    return {
      id: userId,
      phone,
      ...(fullName ? { fullName } : {}),
      memberships: memberships.map((membership) => ({
        orgId: membership.orgId,
        orgName: membership.orgName,
        role: membership.role,
        propertyIds: membership.propertyIds,
      })),
      platformRoles,
    };
  }
}
