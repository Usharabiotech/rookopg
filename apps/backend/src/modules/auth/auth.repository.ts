import { Injectable } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface OtpChallengeRecord {
  id: string;
  phone: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
}

export interface SessionRecord {
  id: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface UserRecord {
  id: string;
  phone: string;
  fullName: string | null;
  status: UserStatus;
}

/**
 * The only layer that touches Prisma. Returns narrow shapes rather than
 * entities, so no column the caller did not ask for can leak upward.
 */
@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByPhone(phone: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({
      where: { phone },
      select: { id: true, phone: true, fullName: true, status: true },
    });
  }

  /**
   * A phone number that has never been seen becomes an ACTIVE user on first
   * successful login. A number a PG manager already entered during an offline
   * booking exists as UNCLAIMED — verifying the OTP claims that account rather
   * than creating a duplicate person.
   */
  async findOrCreateUser(phone: string): Promise<UserRecord> {
    return this.prisma.user.upsert({
      where: { phone },
      create: { phone, status: UserStatus.ACTIVE },
      update: {},
      select: { id: true, phone: true, fullName: true, status: true },
    });
  }

  async claimUser(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.ACTIVE },
    });
  }

  async countOtpRequestsSince(phone: string, since: Date): Promise<number> {
    return this.prisma.otpChallenge.count({
      where: { phone, createdAt: { gte: since } },
    });
  }

  async createOtpChallenge(input: {
    phone: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<{ id: string }> {
    return this.prisma.otpChallenge.create({
      data: input,
      select: { id: true },
    });
  }

  async findOtpChallenge(id: string): Promise<OtpChallengeRecord | null> {
    return this.prisma.otpChallenge.findUnique({
      where: { id },
      select: {
        id: true,
        phone: true,
        codeHash: true,
        attempts: true,
        expiresAt: true,
        consumedAt: true,
      },
    });
  }

  async incrementOtpAttempts(id: string): Promise<number> {
    const updated = await this.prisma.otpChallenge.update({
      where: { id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    return updated.attempts;
  }

  async consumeOtpChallenge(id: string): Promise<void> {
    await this.prisma.otpChallenge.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  }

  /** Invalidate any outstanding challenges for a number once one succeeds. */
  async consumeOtherChallengesForPhone(phone: string, exceptId: string): Promise<void> {
    await this.prisma.otpChallenge.updateMany({
      where: { phone, consumedAt: null, id: { not: exceptId } },
      data: { consumedAt: new Date() },
    });
  }

  async createSession(input: {
    userId: string;
    refreshTokenHash: string;
    familyId: string;
    expiresAt: Date;
    deviceLabel?: string;
    ipAddress?: string;
  }): Promise<{ id: string }> {
    return this.prisma.authSession.create({
      data: input,
      select: { id: true },
    });
  }

  async findSessionByTokenHash(refreshTokenHash: string): Promise<SessionRecord | null> {
    return this.prisma.authSession.findUnique({
      where: { refreshTokenHash },
      select: { id: true, userId: true, familyId: true, expiresAt: true, revokedAt: true },
    });
  }

  async revokeSession(id: string): Promise<void> {
    await this.prisma.authSession.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revoke only if still live, reporting whether this call was the one that
   * did it.
   *
   * Two requests presenting the same refresh token at once would both pass a
   * read-then-write check and both mint a session — quietly defeating reuse
   * detection. The conditional updateMany makes exactly one of them the
   * winner.
   */
  async tryRevokeLiveSession(id: string): Promise<boolean> {
    const result = await this.prisma.authSession.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count === 1;
  }

  /**
   * Reuse of an already-rotated refresh token means the token was stolen.
   * Kill every session in the family, not just the one presented.
   */
  async revokeFamily(familyId: string): Promise<number> {
    const result = await this.prisma.authSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  async isSessionLive(sessionId: string): Promise<boolean> {
    const session = await this.prisma.authSession.findFirst({
      where: { id: sessionId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    return session !== null;
  }
}
