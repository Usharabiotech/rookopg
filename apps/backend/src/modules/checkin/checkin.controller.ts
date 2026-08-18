import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import type { AuthenticatedActor } from '../auth/auth.types';
import { CheckinService } from './checkin.service';
import { CheckinResultDto, MovePassDto, RedeemPassDto } from './dto/checkin.dto';

@ApiTags('Check-in')
@Controller()
export class CheckinController {
  constructor(private readonly service: CheckinService) {}

  @Get('bookings/:bookingId/pass')
  @ApiOperation({
    summary: 'The tenant’s move-in pass',
    description:
      'The QR value and the six digits under it, for the tenant’s own booking. Shown from ' +
      'confirmation until the grace period after move-in runs out.',
  })
  @ApiOkResponse({ type: MovePassDto })
  async myPass(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ): Promise<MovePassDto> {
    return this.service.myPass(actor, bookingId);
  }

  @Post('properties/:propertyId/checkin')
  @ApiOperation({
    summary: 'Redeem a move-in pass',
    description:
      'For the owner or a manager of this property. Send the scanned QR value, or the six ' +
      'digits if the camera will not read it. Records the arrival and releases the held ' +
      'money to the owner.',
  })
  @ApiOkResponse({ type: CheckinResultDto })
  async redeem(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: RedeemPassDto,
  ): Promise<CheckinResultDto> {
    return this.service.redeem(actor, propertyId, dto);
  }
}
