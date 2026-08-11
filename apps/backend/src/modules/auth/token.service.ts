import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../../config/env.config';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AuthRepository } from './auth.repository';
import type { AccessTokenPayload, IssuedTokens } from './auth.types';

const DURATION_PATTERN = /^(\d+)\s*([smhd])$/i;
const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86_400 };

export function parseDurationSeconds(value: string): number {
  const match = DURATION_PATTERN.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration "${value}". Use forms like 15m, 24h, 30d.`);
  }
  const amount = Number(match[1]);
  const unit = (match[2] ?? 's').toLowerCase();
  const multiplier = UNIT_SECONDS[unit];
  if (multiplier === undefined) {
    throw new Error(`Invalid duration unit in "${value}"`);
  }
  return amount * multiplier;
}

@Injectable()
export class TokenService {
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;
  private readonly accessSecret: string;

  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly jwt: JwtService,
    private readonly crypto: CryptoService,
    private readonly repository: AuthRepository,
  ) {
    this.accessSecret = config.get('JWT_ACCESS_SECRET', { infer: true });
    this.accessTtlSeconds = parseDurationSeconds(config.get('JWT_ACCESS_TTL', { infer: true }));
    this.refreshTtlSeconds = parseDurationSeconds(config.get('JWT_REFRESH_TTL', { infer: true }));
  }

  /**
   * Issues a new session. `familyId` continues an existing rotation chain;
   * omit it to start a fresh one (a new login).
   */
  async issue(input: {
    userId: string;
    familyId?: string;
    deviceLabel?: string;
    ipAddress?: string;
  }): Promise<IssuedTokens> {
    const familyId = input.familyId ?? randomUUID();
    const refreshToken = this.crypto.generateRefreshToken();
    const refreshExpiresAt = new Date(Date.now() + this.refreshTtlSeconds * 1000);

    const session = await this.repository.createSession({
      userId: input.userId,
      refreshTokenHash: this.crypto.hashToken(refreshToken),
      familyId,
      expiresAt: refreshExpiresAt,
      deviceLabel: input.deviceLabel,
      ipAddress: input.ipAddress,
    });

    const payload: AccessTokenPayload = { sub: input.userId, sid: session.id };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessTtlSeconds,
    });

    return {
      accessToken,
      refreshToken,
      accessExpiresInSeconds: this.accessTtlSeconds,
      refreshExpiresAt,
    };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    return this.jwt.verifyAsync<AccessTokenPayload>(token, { secret: this.accessSecret });
  }

  hashRefreshToken(token: string): string {
    return this.crypto.hashToken(token);
  }
}
