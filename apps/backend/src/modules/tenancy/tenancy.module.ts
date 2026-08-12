import { Module } from '@nestjs/common';
import { PropertyModule } from '../property/property.module';
import { TenancyController } from './tenancy.controller';
import { TenancyRepository } from './tenancy.repository';
import { TenancyService } from './tenancy.service';

@Module({
  imports: [PropertyModule],
  controllers: [TenancyController],
  providers: [TenancyService, TenancyRepository],
  exports: [TenancyRepository],
})
export class TenancyModule {}
