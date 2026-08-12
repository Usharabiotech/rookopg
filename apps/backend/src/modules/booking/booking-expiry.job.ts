import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BookingService } from './booking.service';

/**
 * Releases beds nobody completed checkout for, and cancels bookings the owner
 * never answered.
 *
 * Runs every minute because a bed held by an abandoned checkout is a bed the
 * next tenant is told they cannot have. Allocation attempts also sweep lapsed
 * holds inline, so this is the safety net rather than the only mechanism.
 */
@Injectable()
export class BookingExpiryJob {
  private readonly logger = new Logger(BookingExpiryJob.name);

  constructor(private readonly bookings: BookingService) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'booking-expiry' })
  async run(): Promise<void> {
    try {
      const result = await this.bookings.expireLapsed();
      if (result.holdsReleased > 0 || result.approvalsExpired > 0) {
        this.logger.log(
          `Released ${result.holdsReleased} lapsed hold(s), expired ${result.approvalsExpired} unanswered booking(s)`,
        );
      }
    } catch (error) {
      this.logger.error('Booking expiry run failed', error as Error);
    }
  }
}
