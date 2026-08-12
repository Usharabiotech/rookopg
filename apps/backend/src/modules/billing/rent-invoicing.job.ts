import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BillingService } from './billing.service';

/**
 * Nightly invoice run.
 *
 * Idempotent by construction — periods are derived deterministically and the
 * unique index rejects anything already billed — so a crash, a redeploy or a
 * double fire cannot bill a tenant twice.
 *
 * TODO before this runs on more than one instance: take a leader lock. Two
 * containers running this at 01:00 is currently safe only because the
 * database refuses the duplicates, which is a guarantee worth keeping but not
 * one to lean on for wasted work.
 */
@Injectable()
export class RentInvoicingJob {
  private readonly logger = new Logger(RentInvoicingJob.name);

  constructor(private readonly billing: BillingService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM, { name: 'rent-invoicing', timeZone: 'Asia/Kolkata' })
  async run(): Promise<void> {
    const startedAt = Date.now();
    try {
      const result = await this.billing.generateEverywhere();
      this.logger.log(
        `Rent invoicing: ${result.created} invoice(s) across ${result.properties} propert(ies) in ${Date.now() - startedAt}ms`,
      );
    } catch (error) {
      this.logger.error('Rent invoicing run failed', error as Error);
    }
  }
}
