import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import type { AuthenticatedActor } from '../auth/auth.types';
import { ListingStatusDto, PublishListingDto } from './dto/listing.dto';
import { ListingService } from './listing.service';

@ApiTags('listings')
@ApiBearerAuth()
@Controller('properties/:propertyId/listing')
export class ListingController {
  constructor(private readonly service: ListingService) {}

  @Get()
  @ApiOperation({ summary: 'Listing status and what is still needed to go live' })
  @ApiOkResponse({ type: ListingStatusDto })
  async status(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ): Promise<ListingStatusDto> {
    return this.service.status(actor, propertyId);
  }

  @Post('publish')
  @ApiOperation({
    summary: 'Put the listing live',
    description: 'Refused until it has rooms, beds, a contact number and photos of a room and the building.',
  })
  @ApiOkResponse({ type: ListingStatusDto })
  async publish(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: PublishListingDto,
  ): Promise<ListingStatusDto> {
    return this.service.publish(actor, propertyId, dto);
  }

  @Post('unpublish')
  @ApiOperation({ summary: 'Take the listing down. Tenancies and records are untouched.' })
  @ApiOkResponse({ type: ListingStatusDto })
  async unpublish(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ): Promise<ListingStatusDto> {
    return this.service.unpublish(actor, propertyId);
  }

  @Post('confirm-availability')
  @ApiOperation({ summary: 'Confirm the beds shown are still accurate' })
  @ApiOkResponse({ type: ListingStatusDto })
  async confirm(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ): Promise<ListingStatusDto> {
    return this.service.confirmAvailability(actor, propertyId);
  }
}
