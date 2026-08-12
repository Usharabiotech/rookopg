import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { SearchModule } from '../search/search.module';
import { BookingController } from './booking.controller';
import { BookingRepository } from './booking.repository';
import { BookingService } from './booking.service';
import { BookingExpiryJob } from './booking-expiry.job';

@Module({
  imports: [PaymentsModule, SearchModule],
  controllers: [BookingController],
  providers: [BookingService, BookingRepository, BookingExpiryJob],
})
export class BookingModule {}
