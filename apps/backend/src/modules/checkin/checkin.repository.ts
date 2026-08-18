import { Injectable } from '@nestjs/common';
import {
  BookingStatus,
  CheckinKind,
  CheckinMethod,
  SettlementStatus,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

const PASS_SELECT = {
  id: true,
  token: true,
  shortCode: true,
  attempts: true,
  validFrom: true,
  validTo: true,
  usedAt: true,
  revokedAt: true,
  booking: {
    select: {
      id: true,
      orgId: true,
      propertyId: true,
      status: true,
      moveInDate: true,
      settlementStatus: true,
      agreedRentPaise: true,
      agreedDepositPaise: true,
      tenant: { select: { id: true, fullName: true, phone: true } },
      room: { select: { code: true } },
      bed: { select: { code: true } },
      tenancy: { select: { id: true } },
    },
  },
} satisfies Prisma.CheckinTokenSelect;

export type PassWithBooking = Prisma.CheckinTokenGetPayload<{ select: typeof PASS_SELECT }>;

@Injectable()
export class CheckinRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The pass a tenant shows on their own booking page. */
  async passForBooking(bookingId: string): Promise<PassWithBooking | null> {
    return this.prisma.checkinToken.findFirst({
      where: { bookingId, revokedAt: null },
      select: PASS_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Exact match on the scanned value. */
  async findByToken(token: string): Promise<PassWithBooking | null> {
    return this.prisma.checkinToken.findUnique({ where: { token }, select: PASS_SELECT });
  }

  /**
   * The typed-code path, deliberately narrowed to one building.
   *
   * Six digits is a million guesses, which is not much. Scoping the lookup to
   * the property the staff member is standing in means a code only has to be
   * unique among that building's live passes, and a wrong guess cannot reach
   * somebody else's booking at all.
   */
  async findByShortCode(propertyId: string, shortCode: string): Promise<PassWithBooking | null> {
    return this.prisma.checkinToken.findFirst({
      where: { shortCode, revokedAt: null, booking: { propertyId } },
      select: PASS_SELECT,
    });
  }

  async countAttempt(passId: string): Promise<number> {
    const row = await this.prisma.checkinToken.update({
      where: { id: passId },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    return row.attempts;
  }

  /**
   * Records the arrival, and nothing else.
   *
   * The gateway call is deliberately not in here. Releasing money is a network
   * call to Razorpay; holding a transaction open across it risks a timeout,
   * and a rollback after Razorpay has already paid would move money we have no
   * record of. So this commits first and the caller settles after.
   *
   * Claiming the pass is a conditional update, so two people scanning the same
   * QR at the same moment cannot both succeed — the second finds nothing to
   * claim and is told it is already used.
   */
  async recordArrival(input: {
    passId: string;
    bookingId: string;
    propertyId: string;
    tenancyId: string | null;
    actorId: string;
    method: CheckinMethod;
  }): Promise<{ claimed: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.checkinToken.updateMany({
        where: { id: input.passId, usedAt: null, revokedAt: null },
        data: { usedAt: new Date(), usedById: input.actorId },
      });
      if (claimed.count === 0) return { claimed: false };

      await tx.booking.update({
        where: { id: input.bookingId },
        data: { status: BookingStatus.CHECKED_IN },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: input.bookingId,
          fromStatus: BookingStatus.CONFIRMED,
          toStatus: BookingStatus.CHECKED_IN,
          actorId: input.actorId,
          reason:
            input.method === CheckinMethod.QR
              ? 'Move-in pass scanned'
              : 'Move-in code entered by staff',
        },
      });

      await tx.checkinEvent.create({
        data: {
          bookingId: input.bookingId,
          ...(input.tenancyId ? { tenancyId: input.tenancyId } : {}),
          propertyId: input.propertyId,
          kind: CheckinKind.CHECK_IN,
          method: input.method,
          actorId: input.actorId,
        },
      });

      return { claimed: true };
    });
  }

  /** Where the money ended up, once the gateway has answered. */
  async recordSettlement(input: {
    bookingId: string;
    status: SettlementStatus;
    releasedPaise?: number;
    refundedPaise?: number;
    reference?: string;
    error?: string;
  }): Promise<void> {
    await this.prisma.booking.update({
      where: { id: input.bookingId },
      data: {
        settlementStatus: input.status,
        settledAt: input.status === SettlementStatus.FAILED ? null : new Date(),
        ...(input.releasedPaise !== undefined ? { releasedPaise: input.releasedPaise } : {}),
        ...(input.refundedPaise !== undefined ? { refundedPaise: input.refundedPaise } : {}),
        ...(input.reference ? { settlementRef: input.reference.slice(0, 300) } : {}),
        settlementError: input.error ? input.error.slice(0, 400) : null,
      },
    });
  }

  /** The captured payment for a booking, which is what the gateway settles. */
  async gatewayPaymentIdFor(bookingId: string): Promise<string | null> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { gatewayOrderId: true },
    });
    if (!booking?.gatewayOrderId) return null;

    const payment = await this.prisma.payment.findFirst({
      where: { gatewayOrderId: booking.gatewayOrderId },
      select: { gatewayPaymentId: true },
    });
    return payment?.gatewayPaymentId ?? null;
  }

  /**
   * Bookings nobody ever checked into, past the grace period.
   *
   * Also picks up settlements that failed at the gateway, so a Razorpay outage
   * does not permanently strand an owner's rent.
   */
  async findUnsettledPastGrace(cutoff: Date): Promise<
    { id: string; settlementStatus: SettlementStatus; agreedRentPaise: number; agreedDepositPaise: number }[]
  > {
    return this.prisma.booking.findMany({
      where: {
        moveInDate: { lt: cutoff },
        settlementStatus: { in: [SettlementStatus.HELD, SettlementStatus.FAILED] },
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
        gatewayOrderId: { not: null },
      },
      select: {
        id: true,
        settlementStatus: true,
        agreedRentPaise: true,
        agreedDepositPaise: true,
      },
      take: 200,
    });
  }

  async hasCheckedIn(bookingId: string): Promise<boolean> {
    const event = await this.prisma.checkinEvent.findFirst({
      where: { bookingId, kind: CheckinKind.CHECK_IN },
      select: { id: true },
    });
    return event !== null;
  }
}
