import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, hkdfSync, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import type { AppConfig } from '../../config/env.config';

const OTP_DIGITS = 6;
const REFRESH_TOKEN_BYTES = 32;
const CHECKIN_TOKEN_BYTES = 24;

@Injectable()
export class CryptoService {
  /** Purpose-separated key for OTP hashing, derived from the master key. */
  private readonly otpHashKey: Buffer;

  constructor(config: ConfigService<AppConfig, true>) {
    const master = config.get('FIELD_ENCRYPTION_KEY', { infer: true });
    this.otpHashKey = Buffer.from(
      hkdfSync('sha256', Buffer.from(master, 'utf8'), Buffer.alloc(0), 'pgplatform:otp-hash:v1', 32),
    );
  }

  /** Cryptographically strong 6-digit code. Never Math.random. */
  generateOtp(): string {
    const max = 10 ** OTP_DIGITS;
    return randomInt(0, max).toString().padStart(OTP_DIGITS, '0');
  }

  /**
   * OTPs are low entropy, so the hash is keyed. Without the server key a
   * leaked database gives an attacker nothing to brute-force offline.
   * Bound to the phone number so a hash cannot be replayed for another user.
   */
  hashOtp(code: string, phoneE164: string): string {
    return createHmac('sha256', this.otpHashKey).update(`${phoneE164}:${code}`).digest('hex');
  }

  /** High-entropy tokens need no keying — a plain digest is sufficient. */
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  generateRefreshToken(): string {
    return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
  }

  generateCheckinToken(): string {
    return randomBytes(CHECKIN_TOKEN_BYTES).toString('base64url');
  }

  /** Constant-time comparison. A plain === leaks length and content by timing. */
  safeEquals(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}
