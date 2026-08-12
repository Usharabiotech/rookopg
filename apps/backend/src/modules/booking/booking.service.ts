import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, OrgRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../../config/env.config';
import {
  ConflictError,
  DomainError,
  DomainErrorCode,
  ForbiddenError,
  NotFoundError,
} from '../../common/errors/domain.error';
import { PrismaService } from '../../common/prisma/prisma.service';
import { IamService } from '../iam/iam.service';
import { SearchRepository } from '../search/search.repository';
import { PAYMENT_GATEWAY, type PaymentGateway, type VerifiedEvent } from '../payments/gateway.types';
import type { AuthenticatedActor } from '../auth/auth.types';
import { commissionApplies, priceBooking } from './booking.pricing';
import { BookingRepository, type BookingWithRelations } from './booking.repository';
import type { BookingDto, CheckoutDto, CreateBookingDto } from './dto/booking.dto';

const OWNER_ROLES: OrgRole[] = [OrgRole.OWNER, OrgRole.MANAGER];

function toDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new ConflictError(`${value} is not a valid date`);
  return date;
}

function today(): Date {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  return now;
}

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);
  private readonly holdMinutes: number;
  private readonly approvalHours: number;
  private readonly commissionBps: number;
  private readonly convenienceFeePaise: number;

  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly repository: BookingRepository,
    private readonly listings: SearchRepository,
    private readonly iam: IamService,
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {
    this.holdMinutes = config.get('BOOKING_HOLD_MINUTES', { infer: true });
    this.approvalHours = config.get('BOOKING_APPROVAL_HOURS', { infer: true });
    this.commissionBps = config.get('PLATFORM_COMMISSION_BPS', { infer: true });
    this.convenienceFeePaise = config.get('PLATFORM_CONVENIENCE_FEE_PAISE', { infer: true });
  }

  /**
   * Holds a bed and starts a payment.
   *
   * The tenant asks for a kind of room, not a numbered bed — nobody browsing
   * cares whether they get 101-B or 104-A. We pick the cheapest free one and
   * claim it under the same row-lock-then-constraint scheme as walk-ins, so
   * two people checking out at once cannot both get it.
   */
  async createBooking(
    actor: AuthenticatedActor,
    dto: CreateBookingDto,
  ): Promise<CheckoutDto> {
    const idempotencyKey = dto.idempotencyKey ?? randomUUID();

    // A retried request returns the original booking rather than holding a
    // second bed for the same person.
    const existing = await this.repository.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      if (existing.tenantUserId !== actor.userId) throw new ForbiddenError();
      return this.toCheckout(existing);
    }

    const property = await this.listings.findBySlug(dto.slug);
    if (!property) throw new NotFoundError('Listing');

    const moveInDate = toDate(dto.moveInDate);
    if (moveInDate < today()) {
      throw new ConflictError('Choose a move-in date from today onwards.');
    }

    const candidates = await this.repository.candidateBeds(
      property.id,
      dto.sharingType,
      moveInDate,
    );
    if (candidates.length === 0) {
      throw new ConflictError('No beds of that type are free from your move-in date.');
    }

    const organisation = property.listing
      ? await this.prisma.organisation.findUniqueOrThrow({
          where: { id: property.orgId },
          select: { freePeriodStartsAt: true, freePeriodMonths: true },
        })
      : null;

    const chargeable = commissionApplies(
      organisation?.freePeriodStartsAt ?? null,
      organisation?.freePeriodMonths ?? 3,
      new Date(),
    );

    const holdExpiresAt = new Date(Date.now() + this.holdMinutes * 60_000);

    // Walk the candidates: losing one to a concurrent booking is expected, so
    // try the next rather than telling the tenant the place is full.
    for (const candidate of candidates) {
      const price = priceBooking({
        monthlyRentPaise: candidate.rentPaise,
        depositPaise: candidate.depositPaise,
        commissionBps: this.commissionBps,
        convenienceFeePaise: this.convenienceFeePaise,
        commissionApplies: chargeable,
      });

      try {
        const { bookingId } = await this.repository.holdBed({
          orgId: property.orgId,
          propertyId: property.id,
          roomId: candidate.roomId,
          bedId: candidate.bedId,
          tenantUserId: actor.userId,
          moveInDate,
          holdExpiresAt,
          rentPaise: price.rentPaise,
          depositPaise: price.depositPaise,
          payableNowPaise: price.rentPaise + price.depositPaise,
          convenienceFeePaise: price.convenienceFeePaise,
          idempotencyKey,
        });

        const order = await this.gateway.createOrder({
          reference: bookingId,
          amountPaise: price.totalPayablePaise,
          ownerSharePaise: price.ownerSharePaise,
          platformFeePaise: price.platformFeePaise,
          customerPhone: actor.phone,
          notes: { property: property.name, room: candidate.roomCode },
        });

        await this.repository.attachOrder(bookingId, order.orderId);

        const booking = await this.repository.findById(bookingId);
        if (!booking) throw new ConflictError('Booking could not be created.');

        return {
          booking: this.toDto(booking),
          orderId: order.orderId,
          amountPaise: order.amountPaise,
          ...(order.publicKey ? { publicKey: order.publicKey } : {}),
          provider: this.gateway.provider,
        };
      } catch (error) {
        if (PrismaService.isBedAlreadyTaken(error)) {
          this.logger.debug(`Bed ${candidate.bedId} taken mid-checkout; trying the next`);
          continue;
        }
        throw error;
      }
    }

    throw new ConflictError('Those beds have just been taken. Try another room type.');
  }

  /**
   * Applies a gateway notification.
   *
   * The client's word is never taken for a payment — only this path, driven
   * by a signature-verified webhook, moves a booking forward.
   */
  async applyWebhook(event: VerifiedEvent, rawPayload: Record<string, unknown>): Promise<string> {
    const booking = event.orderId ? await this.repository.findByOrderId(event.orderId) : null;

    const fresh = await this.repository.recordEventOnce({
      gatewayEventId: event.eventId,
      eventType: event.type,
      signatureVerified: true,
      ...(booking ? { bookingId: booking.id } : {}),
      payload: rawPayload,
    });

    // A retry. Acknowledge without doing the work twice.
    if (!fresh) return 'duplicate';
    if (!booking) {
      await this.repository.markEventProcessed(event.eventId, 'no matching booking');
      return 'unmatched';
    }

    if (event.type === 'payment.failed') {
      if (booking.status === BookingStatus.PENDING_PAYMENT) {
        await this.repository.releaseBooking({
          bookingId: booking.id,
          from: booking.status,
          to: BookingStatus.PAYMENT_FAILED,
          reason: 'Payment failed',
        });
      }
      await this.repository.markEventProcessed(event.eventId, 'payment failed');
      return 'failed';
    }

    if (event.type !== 'payment.captured') {
      await this.repository.markEventProcessed(event.eventId, 'ignored');
      return 'ignored';
    }

    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      await this.repository.markEventProcessed(event.eventId, `already ${booking.status}`);
      return 'already-processed';
    }

    /*
     * Re-check the amount against what we asked for.
     *
     * A tampered client could otherwise pay one rupee for a bed. The order
     * amount is ours, computed server-side; the gateway reports what actually
     * arrived, and the two must agree.
     */
    const expected = booking.payableNowPaise + booking.convenienceFeePaise;
    if (event.amountPaise !== undefined && event.amountPaise !== expected) {
      this.logger.error(
        `Amount mismatch on booking ${booking.id}: expected ${expected}, gateway reported ${event.amountPaise}`,
      );
      await this.repository.markEventProcessed(event.eventId, 'amount mismatch');
      return 'amount-mismatch';
    }

    await this.repository.markPaid({
      bookingId: booking.id,
      orgId: booking.orgId,
      propertyId: booking.propertyId,
      tenantUserId: booking.tenantUserId,
      amountPaise: expected,
      gatewayPaymentId: event.paymentId ?? event.eventId,
      gatewayOrderId: event.orderId ?? '',
      approvalExpiresAt: new Date(Date.now() + this.approvalHours * 3_600_000),
      autoConfirm: booking.property.autoConfirmBookings,
    });

    const outcome = booking.property.autoConfirmBookings
      ? 'booking confirmed'
      : 'booking awaiting owner approval';
    await this.repository.markEventProcessed(event.eventId, outcome);
    return 'paid';
  }

  async listMine(actor: AuthenticatedActor): Promise<BookingDto[]> {
    const bookings = await this.repository.listForTenant(actor.userId);
    return bookings.map((booking) => this.toDto(booking));
  }

  async getMine(actor: AuthenticatedActor, bookingId: string): Promise<BookingDto> {
    const booking = await this.repository.findById(bookingId);
    if (!booking || booking.tenantUserId !== actor.userId) throw new NotFoundError('Booking');
    return this.toDto(booking);
  }

  async cancelMine(actor: AuthenticatedActor, bookingId: string): Promise<BookingDto> {
    const booking = await this.repository.findById(bookingId);
    if (!booking || booking.tenantUserId !== actor.userId) throw new NotFoundError('Booking');

    const cancellable: BookingStatus[] = [
      BookingStatus.PENDING_PAYMENT,
      BookingStatus.PENDING_APPROVAL,
      BookingStatus.CONFIRMED,
    ];
    if (!cancellable.includes(booking.status)) {
      throw new ConflictError('This booking can no longer be cancelled.');
    }

    // TODO: refunds follow the policy in docs/02 question 10, which is still
    // open. Nothing is refunded automatically yet, and that is deliberate —
    // guessing the percentages would be worse than a manual refund.
    await this.repository.releaseBooking({
      bookingId,
      from: booking.status,
      to: BookingStatus.CANCELLED,
      reason: 'Cancelled by the tenant',
      actorId: actor.userId,
    });

    return this.getMine(actor, bookingId);
  }

  // -- Owner side ------------------------------------------------------------

  async listForProperty(
    actor: AuthenticatedActor,
    propertyId: string,
  ): Promise<BookingDto[]> {
    await this.assertOwnerAccess(actor, propertyId);
    const bookings = await this.repository.listForProperty(propertyId, [
      BookingStatus.PENDING_APPROVAL,
      BookingStatus.CONFIRMED,
    ]);
    return bookings.map((booking) => this.toDto(booking));
  }

  async approve(actor: AuthenticatedActor, bookingId: string): Promise<BookingDto> {
    const booking = await this.loadForOwner(actor, bookingId);
    if (booking.status !== BookingStatus.PENDING_APPROVAL) {
      throw new ConflictError('This booking is not waiting for a decision.');
    }
    await this.repository.approve(bookingId, actor.userId);
    return this.toDto((await this.repository.findById(bookingId))!);
  }

  async reject(actor: AuthenticatedActor, bookingId: string, reason?: string): Promise<BookingDto> {
    const booking = await this.loadForOwner(actor, bookingId);
    if (booking.status !== BookingStatus.PENDING_APPROVAL) {
      throw new ConflictError('This booking is not waiting for a decision.');
    }

    await this.repository.releaseBooking({
      bookingId,
      from: booking.status,
      to: BookingStatus.REJECTED,
      reason: reason ?? 'Owner could not take this booking',
      actorId: actor.userId,
    });

    // The tenant is always refunded in full when the owner declines
    // (docs/02 question 10). Automatic refunds arrive with the gateway work.
    this.logger.warn(`Booking ${bookingId} rejected — a full refund is owed to the tenant`);

    return this.toDto((await this.repository.findById(bookingId))!);
  }

  /** Frees beds whose checkout lapsed, and cancels bookings the owner ignored. */
  async expireLapsed(): Promise<{ holdsReleased: number; approvalsExpired: number }> {
    const lapsed = await this.repository.findLapsed();
    let holdsReleased = 0;
    let approvalsExpired = 0;

    for (const booking of lapsed) {
      const isHold = booking.status === BookingStatus.PENDING_PAYMENT;
      await this.repository.releaseBooking({
        bookingId: booking.id,
        from: booking.status,
        to: isHold ? BookingStatus.EXPIRED : BookingStatus.REJECTED,
        reason: isHold ? 'Checkout not completed in time' : 'Owner did not respond in time',
      });
      if (isHold) holdsReleased += 1;
      else approvalsExpired += 1;
    }

    return { holdsReleased, approvalsExpired };
  }

  // --------------------------------------------------------------------------

  private async loadForOwner(
    actor: AuthenticatedActor,
    bookingId: string,
  ): Promise<BookingWithRelations> {
    const booking = await this.repository.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking');
    await this.assertOwnerAccess(actor, booking.propertyId, booking.orgId);
    return booking;
  }

  private async assertOwnerAccess(
    actor: AuthenticatedActor,
    propertyId: string,
    orgId?: string,
  ): Promise<void> {
    const resolvedOrgId =
      orgId ??
      (
        await this.prisma.property.findUniqueOrThrow({
          where: { id: propertyId },
          select: { orgId: true },
        })
      ).orgId;

    try {
      this.iam.assertPropertyAccess(actor, resolvedOrgId, propertyId, OWNER_ROLES);
    } catch (error) {
      if (error instanceof DomainError && error.code === DomainErrorCode.FORBIDDEN) {
        throw new NotFoundError('Booking');
      }
      throw error;
    }
  }

  private toCheckout(booking: BookingWithRelations): CheckoutDto {
    return {
      booking: this.toDto(booking),
      orderId: booking.gatewayOrderId ?? '',
      amountPaise: booking.payableNowPaise + booking.convenienceFeePaise,
      provider: this.gateway.provider,
    };
  }

  private toDto(booking: BookingWithRelations): BookingDto {
    return {
      id: booking.id,
      status: booking.status,
      propertyName: booking.property.name,
      localityName: booking.property.locality.name,
      ...(booking.property.listing?.slug ? { listingSlug: booking.property.listing.slug } : {}),
      roomCode: booking.room.code,
      bedCode: booking.bed.code,
      sharingType: booking.room.sharingType,
      moveInDate: booking.moveInDate.toISOString().slice(0, 10),
      price: {
        rentPaise: booking.agreedRentPaise,
        depositPaise: booking.agreedDepositPaise,
        convenienceFeePaise: booking.convenienceFeePaise,
        totalPayablePaise: booking.payableNowPaise + booking.convenienceFeePaise,
      },
      ...(booking.gatewayOrderId ? { orderId: booking.gatewayOrderId } : {}),
      ...(booking.holdExpiresAt ? { holdExpiresAt: booking.holdExpiresAt.toISOString() } : {}),
      ...(booking.approvalExpiresAt
        ? { approvalExpiresAt: booking.approvalExpiresAt.toISOString() }
        : {}),
      ...(booking.tenant.fullName ? { tenantName: booking.tenant.fullName } : {}),
      tenantPhone: booking.tenant.phone,
      createdAt: booking.createdAt.toISOString(),
    };
  }
}
