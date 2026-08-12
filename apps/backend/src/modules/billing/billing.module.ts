import { Module } from '@nestjs/common';
import { PropertyModule } from '../property/property.module';
import { BillingController } from './billing.controller';
import { BillingRepository } from './billing.repository';
import { BillingService } from './billing.service';
import { RentInvoicingJob } from './rent-invoicing.job';

@Module({
  imports: [PropertyModule],
  controllers: [BillingController],
  providers: [BillingService, BillingRepository, RentInvoicingJob],
  exports: [BillingService],
})
export class BillingModule {}
