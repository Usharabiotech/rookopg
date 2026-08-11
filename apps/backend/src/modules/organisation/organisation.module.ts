import { Module } from '@nestjs/common';
import { OrganisationController } from './organisation.controller';
import { OrganisationRepository } from './organisation.repository';
import { OrganisationService } from './organisation.service';

@Module({
  controllers: [OrganisationController],
  providers: [OrganisationService, OrganisationRepository],
  exports: [OrganisationRepository],
})
export class OrganisationModule {}
