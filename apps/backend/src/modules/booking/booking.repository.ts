import { Injectable } from '@nestjs/common';
import {
  AllocationKind,
  AllocationStatus,
  BookingSource,
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
  UserStatus,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

const BOOKING_INCLUDE = {
  property: {
    select: {
      id: true,
      name: true,
      orgId: true,
      autoConfirmBookings: true,
      locality: { select: { name: true } },
      listing: { select: { slug: true } },
      organisation: {
        select: { freePeriodStartsAt: true, freePeriodMonths: true, razorpayAccountId: true },
      },
    },
  },
  room: { select: { code: true, sharingType: true, depositPaise: true } },
  bed: { select: { code: true } },
  tenant: { select: { id: true, fullName: true, phone: true } },
} satisfies Prisma.BookingInclude;

export type BookingWithRelations = Prisma.BookingGetPayload<{ include: typeof BOOKING_INCLUDE }>;

export interface CandidateBed {
  bedId: string;
  roomId: string;
  roomCode: string;
  rentPaise: number;
  depositPaise: number;
}

@Injectable()
export class BookingRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Beds of the requested sharing type with nothing claiming them from the
   * move-in date onwards.
   *
   * A shortlist, not a guarantee — the actual claim is made under a row lock
   * against the exclusion constraint, because between this query and that
   * insert somebody else may have taken one.
   */
  async candidateBeds(
    propertyId: string,
    sharingType: string,
    fromDate: Date,
  ): Promise<CandidateBed[]> {
    const rooms = await this.prisma.room.findMany({
      where: {
        propertyId,
        deletedAt: null,
        status: 'ACTIVE',
        sharingType: sharingType as never,
      },
      select: {
        id: true,
        code: true,
        baseRentPaise: true,
        depositPaise: true,
        beds: {
          where: {
            deletedAt: null,
            status: 'ACTIVE',
            allocations: {
              none: {
                status: AllocationStatus.ACTIVE,
                OR: [{ endDate: null }, { endDate: { gt: fromDate } }],
              },
            },
          },
          select: { id: true, rentOverridePaise: true },
        },
      },
      orderBy: { baseRentPaise: 'asc' },
    });

    return rooms.flatMap((room) =>
      room.beds.map((bed) => ({
        bedId: bed.id,
        roomId: room.id,
        roomCode: room.code,
        rentPaise: bed.rentOverridePaise ?? room.baseRentPaise,
        depositPaise: room.depositPaise,
      })),
    );
  }

  /**
   * Claims one bed and opens a booking against it.
   *
   * Same shape as seating a walk-in: queue on the bed row first so contenders
   * form one orderly line, then let the exclusion constraint arbitrate. The
   * caller tries the next candidate when this throws.
   */
  async holdBed(input: {
    orgId: string;
    propertyId: string;
    roomId: string;
    bedId: string;
    tenantUserId: string;
    moveInDate: Date;
    holdExpiresAt: Date;
    rentPaise: number;
    depositPaise: number;
    payableNowPaise: number;
    convenienceFeePaise: number;
    idempotencyKey: string;
  }): Promise<{ bookingId: string }> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM beds WHERE id = ${input.bedId}::uuid FOR UPDATE`;

        // Sweep any lapsed hold on this bed so an abandoned checkout does not
        // keep a bed off the market for the full window.
        await tx.bedAllocation.updateMany({
          where: {
            bedId: input.bedId,
            kind: AllocationKind.HOLD,
            status: AllocationStatus.ACTIVE,
            expiresAt: { lte: new Date() },
          },
          data: {
            status: AllocationStatus.RELEASED,
            releasedAt: new Date(),
            releaseReason: 'Hold expired',
          },
        });

        const allocation = await tx.bedAllocation.create({
          data: {
            bedId: input.bedId,
            propertyId: input.propertyId,
            startDate: input.moveInDate,
            endDate: null,
            kind: AllocationKind.HOLD,
            status: AllocationStatus.ACTIVE,
            expiresAt: input.holdExpiresAt,
          },
          select: { id: true },
        });

        const booking = await tx.booking.create({
          data: {
            orgId: input.orgId,
            propertyId: input.propertyId,
            roomId: input.roomId,
            bedId: input.bedId,
            tenantUserId: input.tenantUserId,
            source: BookingSource.ONLINE,
            status: BookingStatus.PENDING_PAYMENT,
            moveInDate: input.moveInDate,
            agreedRentPaise: input.rentPaise,
            agreedDepositPaise: input.depositPaise,
            payableNowPaise: input.payableNowPaise,
            convenienceFeePaise: input.convenienceFeePaise,
            holdExpiresAt: input.holdExpiresAt,
            idempotencyKey: input.idempotencyKey,
          },
          select: { id: true },
        });

        await tx.bedAllocation.update({
          where: { id: allocation.id },
          data: { bookingId: booking.id },
        });

        await tx.bookingStatusHistory.create({
          data: {
            bookingId: booking.id,
            toStatus: BookingStatus.PENDING_PAYMENT,
            reason: 'Bed held during checkout',
          },
        });

        return { bookingId: booking.id };
      },
      { timeout: 15_000, maxWait: 10_000 },
    );
  }

  async attachOrder(bookingId: string, orderId: string): Promise<void> {
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { gatewayOrderId: orderId },
    });
  }

  async findById(bookingId: string): Promise<BookingWithRelations | null> {
    return this.prisma.booking.findUnique({ where: { id: bookingId }, include: BOOKING_INCLUDE });
  }

  async findByOrderId(orderId: string): Promise<BookingWithRelations | null> {
    return this.prisma.booking.findFirst({
      where: { gatewayOrderId: orderId },
      include: BOOKING_INCLUDE,
    });
  }

  async findByIdempotencyKey(key: string): Promise<BookingWithRelations | null> {
    return this.prisma.booking.findFirst({
      where: { idempotencyKey: key },
      include: BOOKING_INCLUDE,
    });
  }

  async listForTenant(tenantUserId: string): Promise<BookingWithRelations[]> {
    return this.prisma.booking.findMany({
      where: { tenantUserId },
      include: BOOKING_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async listForProperty(
    propertyId: string,
    statuses: BookingStatus[],
  ): Promise<BookingWithRelations[]> {
    return this.prisma.booking.findMany({
      where: { propertyId, status: { in: statuses } },
      include: BOOKING_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Records a captured payment and moves the booking to awaiting approval.
   *
   * The hold becomes a firm booking claim with no expiry, so the bed stays
   * off the market while the owner decides.
   */
  async markPaid(input: {
    bookingId: string;
    orgId: string;
    propertyId: string;
    tenantUserId: string;
    amountPaise: number;
    gatewayPaymentId: string;
    gatewayOrderId: string;
    approvalExpiresAt: Date;
    /// When the property confirms automatically, payment is the last step.
    autoConfirm: boolean;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      /*
       * The same payment can reach us under a second event id — a gateway
       * redelivery, or a captured event following an authorised one. The
       * unique gatewayPaymentId is the backstop; recognising it and carrying
       * on is the difference between an idempotent handler and a 500 that
       * makes the gateway retry forever.
       */
      const already = await tx.payment.findFirst({
        where: { gatewayPaymentId: input.gatewayPaymentId },
        select: { id: true },
      });

      if (!already) {
        await tx.payment.create({
          data: {
            orgId: input.orgId,
            propertyId: input.propertyId,
            tenantUserId: input.tenantUserId,
            method: PaymentMethod.RAZORPAY_UPI,
            status: PaymentStatus.CAPTURED,
            amountPaise: input.amountPaise,
            gatewayOrderId: input.gatewayOrderId,
            gatewayPaymentId: input.gatewayPaymentId,
            receivedAt: new Date(),
          },
        });
      }

      await tx.bedAllocation.updateMany({
        where: { bookingId: input.bookingId, status: AllocationStatus.ACTIVE },
        data: { kind: AllocationKind.BOOKING, expiresAt: null },
      });

      const nextStatus = input.autoConfirm
        ? BookingStatus.CONFIRMED
        : BookingStatus.PENDING_APPROVAL;

      await tx.booking.update({
        where: { id: input.bookingId },
        data: {
          status: nextStatus,
          paidAt: new Date(),
          holdExpiresAt: null,
          // Only meaningful while the owner still has to answer.
          approvalExpiresAt: input.autoConfirm ? null : input.approvalExpiresAt,
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: input.bookingId,
          fromStatus: BookingStatus.PENDING_PAYMENT,
          toStatus: nextStatus,
          reason: input.autoConfirm
            ? 'Payment received; property confirms automatically'
            : 'Payment received',
        },
      });
    });
  }

  /** Ends a booking and frees the bed. Used by rejection, cancellation and expiry. */
  async releaseBooking(input: {
    bookingId: string;
    from: BookingStatus;
    to: BookingStatus;
    reason: string;
    actorId?: string;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.bedAllocation.updateMany({
        where: { bookingId: input.bookingId, status: AllocationStatus.ACTIVE },
        data: {
          status: AllocationStatus.RELEASED,
          releasedAt: new Date(),
          releaseReason: input.reason,
        },
      });

      await tx.booking.update({
        where: { id: input.bookingId },
        data: {
          status: input.to,
          holdExpiresAt: null,
          ...(input.to === BookingStatus.CANCELLED || input.to === BookingStatus.REJECTED
            ? { cancelledAt: new Date(), cancellationReason: input.reason }
            : {}),
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: input.bookingId,
          fromStatus: input.from,
          toStatus: input.to,
          reason: input.reason,
          ...(input.actorId ? { actorId: input.actorId } : {}),
        },
      });
    });
  }

  async approve(bookingId: string, actorId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CONFIRMED,
          ownerRespondedAt: new Date(),
          approvalExpiresAt: null,
        },
      });
      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          fromStatus: BookingStatus.PENDING_APPROVAL,
          toStatus: BookingStatus.CONFIRMED,
          actorId,
          reason: 'Owner accepted the booking',
        },
      });
    });
  }

  /**
   * Records a gateway notification, or reports that we have seen it before.
   *
   * The unique index on gatewayEventId is the idempotency guarantee: two
   * instances processing the same retry at once cannot both proceed.
   */
  async recordEventOnce(input: {
    gatewayEventId: string;
    eventType: string;
    bookingId?: string;
    signatureVerified: boolean;
    payload?: Record<string, unknown>;
  }): Promise<boolean> {
    try {
      await this.prisma.paymentEvent.create({
        data: {
          gatewayEventId: input.gatewayEventId,
          eventType: input.eventType,
          signatureVerified: input.signatureVerified,
          ...(input.bookingId ? { bookingId: input.bookingId } : {}),
          ...(input.payload ? { payload: input.payload as Prisma.InputJsonValue } : {}),
        },
      });
      return true;
    } catch {
      // Unique violation: a duplicate delivery, which is normal.
      return false;
    }
  }

  async markEventProcessed(gatewayEventId: string, result: string): Promise<void> {
    await this.prisma.paymentEvent.updateMany({
      where: { gatewayEventId },
      data: { processedAt: new Date(), processingResult: result.slice(0, 300) },
    });
  }

  /** Bookings whose checkout hold or approval window has run out. */
  async findLapsed(): Promise<Array<{ id: string; status: BookingStatus }>> {
    const now = new Date();
    return this.prisma.booking.findMany({
      where: {
        OR: [
          { status: BookingStatus.PENDING_PAYMENT, holdExpiresAt: { lte: now } },
          { status: BookingStatus.PENDING_APPROVAL, approvalExpiresAt: { lte: now } },
        ],
      },
      select: { id: true, status: true },
      take: 200,
    });
  }

  async ensureTenant(userId: string): Promise<{ id: string; phone: string } | null> {
    return this.prisma.user.findFirst({
      where: { id: userId, status: { not: UserStatus.SUSPENDED } },
      select: { id: true, phone: true },
    });
  }
}
