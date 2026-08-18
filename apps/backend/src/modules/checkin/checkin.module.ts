import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { CheckinController } from './checkin.controller';
import { CheckinRepository } from './checkin.repository';
import { CheckinService } from './checkin.service';
import { NoShowJob } from './no-show.job';

@Module({
  imports: [PaymentsModule],
  controllers: [CheckinController],
  providers: [CheckinService, CheckinRepository, NoShowJob],
  exports: [CheckinRepository],
})
export class CheckinModule {}
