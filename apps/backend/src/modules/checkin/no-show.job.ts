import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SettlementStatus } from '@prisma/client';
import type { AppConfig } from '../../config/env.config';
import { PAYMENT_GATEWAY, type PaymentGateway } from '../payments/gateway.types';
import { CheckinRepository } from './checkin.repository';

/**
 * Settles bookings nobody ever checked into, and retries payouts the gateway
 * refused.
 *
 * Without this, money strands. A tenant who books and never turns up leaves
 * their payment sitting at the gateway for ever: the owner is not paid because
 * nobody scanned, and the tenant is not refunded because nobody asked. Neither
 * side can resolve it on their own.
 *
 * The split is the one Neeraj chose. The owner keeps the rent, because they
 * held a bed empty for someone who did not come and lost the month. The
 * deposit goes back, because it secures damage to a room that was never used.
 *
 * Idempotent by construction: the gateway calls carry a key derived from the
 * booking, and a settled booking no longer matches the query.
 */
@Injectable()
export class NoShowJob {
  private readonly logger = new Logger(NoShowJob.name);
  private readonly graceDays: number;

  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly repository: CheckinRepository,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {
    this.graceDays = config.get('CHECKIN_GRACE_DAYS', { infer: true });
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'no-show-settlement', timeZone: 'Asia/Kolkata' })
  async run(): Promise<void> {
    try {
      const result = await this.sweep();
      if (result.settled > 0 || result.failed > 0) {
        this.logger.log(
          `No-show sweep: ${result.settled} settled, ${result.retried} retried, ${result.failed} still failing`,
        );
      }
    } catch (error) {
      // A scheduled job that throws takes the scheduler down with it.
      this.logger.error(`No-show sweep failed: ${String(error)}`);
    }
  }

  async sweep(): Promise<{ settled: number; retried: number; failed: number }> {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - this.graceDays);

    const candidates = await this.repository.findUnsettledPastGrace(cutoff);
    let settled = 0;
    let retried = 0;
    let failed = 0;

    for (const booking of candidates) {
      const paymentId = await this.repository.gatewayPaymentIdFor(booking.id);
      if (!paymentId) continue;

      const arrived = await this.repository.hasCheckedIn(booking.id);
      if (booking.settlementStatus === SettlementStatus.FAILED) retried += 1;

      try {
        if (arrived) {
          // Checked in, but the payout did not go through at the time.
          const released = await this.gateway.releaseOwnerShare({
            paymentId,
            idempotencyKey: `release:${booking.id}`,
            reason: 'Retry after failed release',
          });
          await this.repository.recordSettlement({
            bookingId: booking.id,
            status: SettlementStatus.RELEASED,
            releasedPaise: released.releasedPaise,
            reference: released.releasedTransferIds.join(','),
          });
        } else {
          // Nobody came. Rent stays with the owner, deposit goes back.
          const outcome = await this.gateway.refundToTenant({
            paymentId,
            idempotencyKey: `no-show:${booking.id}`,
            refundToTenantPaise: booking.agreedDepositPaise,
            releaseToOwnerPaise: booking.agreedRentPaise,
            reason: 'Tenant did not arrive',
          });
          await this.repository.recordSettlement({
            bookingId: booking.id,
            status: SettlementStatus.SPLIT,
            releasedPaise: outcome.releasedPaise,
            refundedPaise: outcome.refundedPaise,
            ...(outcome.refundId ? { reference: outcome.refundId } : {}),
          });
        }
        settled += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Settlement failed for booking ${booking.id}: ${message}`);
        await this.repository.recordSettlement({
          bookingId: booking.id,
          status: SettlementStatus.FAILED,
          error: message,
        });
      }
    }

    return { settled, retried, failed };
  }
}
