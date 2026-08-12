import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import type { AuthenticatedActor } from '../auth/auth.types';
import { CheckOutDto, GiveNoticeDto, SeatTenantDto, TenancyDto } from './dto/tenancy.dto';
import { TenancyService } from './tenancy.service';

@ApiTags('tenancies')
@ApiBearerAuth()
@Controller()
export class TenancyController {
  constructor(private readonly service: TenancyService) {}

  @Get('properties/:propertyId/tenancies')
  @ApiOperation({ summary: 'Who is currently living here' })
  @ApiOkResponse({ type: [TenancyDto] })
  async list(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ): Promise<TenancyDto[]> {
    return this.service.listCurrent(actor, propertyId);
  }

  @Post('properties/:propertyId/tenancies')
  @ApiOperation({
    summary: 'Seat a walk-in tenant on a free bed',
    description:
      'Creates the person, the booking, the tenancy and the check-in in one transaction. ' +
      'If the bed is taken in the meantime the whole thing is rolled back and a conflict returned.',
  })
  @ApiOkResponse({ type: TenancyDto })
  async seat(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: SeatTenantDto,
  ): Promise<TenancyDto> {
    return this.service.seatWalkIn(actor, propertyId, dto);
  }

  @Post('tenancies/:tenancyId/notice')
  @ApiOperation({
    summary: 'Record notice to leave',
    description: 'Frees the bed from the leaving date, so it can be filled in advance.',
  })
  @ApiOkResponse({ type: TenancyDto })
  async giveNotice(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('tenancyId', ParseUUIDPipe) tenancyId: string,
    @Body() dto: GiveNoticeDto,
  ): Promise<TenancyDto> {
    return this.service.giveNotice(actor, tenancyId, dto);
  }

  @Post('tenancies/:tenancyId/checkout')
  @ApiOperation({ summary: 'Check a tenant out and free the bed' })
  @ApiOkResponse({ type: TenancyDto })
  async checkOut(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('tenancyId', ParseUUIDPipe) tenancyId: string,
    @Body() dto: CheckOutDto,
  ): Promise<TenancyDto> {
    return this.service.checkOut(actor, tenancyId, dto);
  }
}
