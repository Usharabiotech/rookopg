import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, CheckinMethod, OrgRole, SettlementStatus } from '@prisma/client';
import type { AuthenticatedActor } from '../auth/auth.types';
import {
  ConflictError,
  DomainError,
  DomainErrorCode,
  NotFoundError,
} from '../../common/errors/domain.error';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AppConfig } from '../../config/env.config';
import { IamService } from '../iam/iam.service';
import { PAYMENT_GATEWAY, type PaymentGateway } from '../payments/gateway.types';
import { CheckinRepository, type PassWithBooking } from './checkin.repository';
import type { CheckinResultDto, MovePassDto, RedeemPassDto } from './dto/checkin.dto';

const STAFF_ROLES: OrgRole[] = [OrgRole.OWNER, OrgRole.MANAGER];

/** Enough wrong six-digit guesses to be a mistake; more is someone trying. */
const MAX_CODE_ATTEMPTS = 10;

/**
 * How long typed codes are refused after too many misses.
 *
 * Ten tries then a fifteen-minute wait turns a million-code search into
 * roughly three years of continuous guessing, while a warden who fat-fingers
 * a digit twice notices nothing.
 */
const CODE_LOCKOUT_MINUTES = 15;

@Injectable()
export class CheckinService {
  private readonly logger = new Logger(CheckinService.name);
  private readonly graceDays: number;

  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly repository: CheckinRepository,
    private readonly iam: IamService,
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {
    this.graceDays = config.get('CHECKIN_GRACE_DAYS', { infer: true });
  }

  // -- Tenant side -----------------------------------------------------------

  /**
   * The pass for the tenant's own booking.
   *
   * Only ever the signed-in tenant's own — this is the credential that
   * releases their money, so handing it to anyone else would hand them the
   * ability to collect on a no-show.
   */
  async myPass(actor: AuthenticatedActor, bookingId: string): Promise<MovePassDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        tenantUserId: true,
        status: true,
        property: { select: { name: true } },
        room: { select: { code: true } },
        bed: { select: { code: true } },
      },
    });

    if (!booking || booking.tenantUserId !== actor.userId) throw new NotFoundError('Booking');

    if (booking.status !== BookingStatus.CONFIRMED && booking.status !== BookingStatus.CHECKED_IN) {
      throw new ConflictError('This booking does not have a move-in pass yet.');
    }

    const pass = await this.repository.passForBooking(bookingId);
    if (!pass) throw new NotFoundError('Move-in pass');

    return {
      token: pass.token,
      shortCode: pass.shortCode,
      validFrom: pass.validFrom.toISOString(),
      validTo: pass.validTo.toISOString(),
      used: pass.usedAt !== null,
      propertyName: booking.property.name,
      roomCode: booking.room.code,
      bedCode: booking.bed.code,
    };
  }

  // -- Staff side ------------------------------------------------------------

  /**
   * Redeems a move-in pass and pays the owner.
   *
   * Two steps on purpose. The arrival is recorded and committed first, then
   * the money is released. If the gateway is down the check-in still stands —
   * the tenant is in their room, which is the fact of the matter — and the
   * sweep retries the payment. The reverse order would risk paying an owner
   * for a check-in that then failed to save.
   */
  async redeem(
    actor: AuthenticatedActor,
    propertyId: string,
    dto: RedeemPassDto,
  ): Promise<CheckinResultDto> {
    await this.assertStaffAt(actor, propertyId);

    if (!dto.token && !dto.shortCode) {
      throw new ConflictError('Scan the QR or type the six-digit code.');
    }

    // Typing codes is the guessable path, so it is the one that gets locked.
    // Scanning is unaffected: a 192-bit token is not going to be guessed.
    if (dto.shortCode) {
      const lockedUntil = await this.repository.codeLockedUntil(propertyId);
      if (lockedUntil) {
        throw new ConflictError(
          'Too many wrong codes at this property. Scan the QR, or try again shortly.',
        );
      }
    }

    const pass = dto.token
      ? await this.repository.findByToken(dto.token)
      : await this.repository.findByShortCode(propertyId, dto.shortCode!);

    // A pass for another building is not "wrong code" — it is a real pass in
    // the wrong place, and saying so is the difference between a warden
    // realising their mistake and them retyping it five times.
    if (!pass || pass.booking.propertyId !== propertyId) {
      // A miss has to be counted here, before the early return. Counting it
      // on the pass could not work: a wrong guess has no pass to count on, so
      // only correct guesses were ever counted and six digits sat open to
      // enumeration by the one person who profits from a false check-in.
      if (dto.shortCode) {
        const { lockedUntil } = await this.repository.recordCodeFailure(
          propertyId,
          MAX_CODE_ATTEMPTS,
          CODE_LOCKOUT_MINUTES,
        );
        if (lockedUntil) {
          this.logger.warn(
            `Check-in codes locked at property ${propertyId} until ${lockedUntil.toISOString()} — ` +
              `${MAX_CODE_ATTEMPTS} wrong codes`,
          );
        }
      }
      throw new NotFoundError('Move-in pass');
    }

    if (dto.shortCode) {
      await this.repository.clearCodeFailures(propertyId);
      const attempts = await this.repository.countAttempt(pass.id);
      if (attempts > MAX_CODE_ATTEMPTS) {
        this.logger.warn(`Check-in code for booking ${pass.booking.id} tried ${attempts} times`);
        throw new ConflictError('Too many attempts on this code. Scan the QR instead.');
      }
    }

    this.assertRedeemable(pass);

    const arrival = await this.repository.recordArrival({
      passId: pass.id,
      bookingId: pass.booking.id,
      propertyId,
      tenancyId: pass.booking.tenancy?.id ?? null,
      actorId: actor.userId,
      method: dto.token ? CheckinMethod.QR : CheckinMethod.MANUAL,
    });

    // Lost the race to a simultaneous scan. The other one did the work.
    if (!arrival.claimed) {
      throw new ConflictError('This pass has already been used.');
    }

    const settlement = await this.settle(pass.booking.id);

    return {
      bookingId: pass.booking.id,
      tenantName: pass.booking.tenant.fullName ?? 'Tenant',
      roomCode: pass.booking.room.code,
      bedCode: pass.booking.bed.code,
      moveInDate: pass.booking.moveInDate.toISOString().slice(0, 10),
      settlementStatus: settlement.status,
      releasedPaise: settlement.releasedPaise,
      ...(settlement.pending ? { settlementPending: settlement.pending } : {}),
    };
  }

  // -- Money -----------------------------------------------------------------

  /**
   * Hands the owner their share, and records where it got to.
   *
   * Never throws at the caller. A failed payout must not undo a check-in that
   * really happened; it is written down as FAILED and the sweep picks it up.
   */
  private async settle(
    bookingId: string,
  ): Promise<{ status: string; releasedPaise: number; pending?: string }> {
    const paymentId = await this.repository.gatewayPaymentIdFor(bookingId);

    // Offline and walk-in bookings never had money pass through us.
    if (!paymentId) {
      return { status: SettlementStatus.RELEASED, releasedPaise: 0 };
    }

    try {
      const released = await this.gateway.releaseOwnerShare({
        paymentId,
        idempotencyKey: `release:${bookingId}`,
        reason: 'Tenant checked in',
      });

      await this.repository.recordSettlement({
        bookingId,
        status: SettlementStatus.RELEASED,
        releasedPaise: released.releasedPaise,
        reference: released.releasedTransferIds.join(','),
      });

      return { status: SettlementStatus.RELEASED, releasedPaise: released.releasedPaise };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Release failed for booking ${bookingId}: ${message}`);

      await this.repository.recordSettlement({
        bookingId,
        status: SettlementStatus.FAILED,
        error: message,
      });

      return {
        status: SettlementStatus.FAILED,
        releasedPaise: 0,
        pending: 'The tenant is checked in. Paying the owner is being retried.',
      };
    }
  }

  // -- Guards ----------------------------------------------------------------

  private assertRedeemable(pass: PassWithBooking): void {
    if (pass.revokedAt) throw new ConflictError('This pass is no longer valid.');
    if (pass.usedAt) throw new ConflictError('This pass has already been used.');

    if (pass.booking.status === BookingStatus.CANCELLED) {
      throw new ConflictError('This booking was cancelled.');
    }
    if (pass.booking.status === BookingStatus.CHECKED_IN) {
      throw new ConflictError('This tenant is already checked in.');
    }
    if (pass.booking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictError('This booking is not confirmed yet.');
    }

    const now = new Date();
    if (now < pass.validFrom) throw new ConflictError('This pass is not active yet.');
    if (now > pass.validTo) {
      throw new ConflictError(
        `This pass expired ${this.graceDays} days after the move-in date. Contact support.`,
      );
    }

  }

  /**
   * The person scanning must run this building.
   *
   * Organisation membership is not enough: a manager is given specific
   * properties, and a warden at one PG has no business checking someone into
   * another. Answers 404 rather than 403 so a stranger cannot use the error to
   * confirm a property id exists.
   */
  private async assertStaffAt(actor: AuthenticatedActor, propertyId: string): Promise<void> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { orgId: true },
    });
    if (!property) throw new NotFoundError('Property');

    try {
      this.iam.assertPropertyAccess(actor, property.orgId, propertyId, STAFF_ROLES);
    } catch (error) {
      if (error instanceof DomainError && error.code === DomainErrorCode.FORBIDDEN) {
        throw new NotFoundError('Property');
      }
      throw error;
    }
  }
}
