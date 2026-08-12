import { Module } from '@nestjs/common';
import { PropertyModule } from '../property/property.module';
import { ListingController } from './listing.controller';
import { ListingRepository } from './listing.repository';
import { ListingService } from './listing.service';

@Module({
  imports: [PropertyModule],
  controllers: [ListingController],
  providers: [ListingService, ListingRepository],
  exports: [ListingRepository],
})
export class ListingModule {}
