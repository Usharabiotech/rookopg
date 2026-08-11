import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import type { AuthenticatedActor } from '../auth/auth.types';
import {
  CreatePropertyDto,
  PropertyDetailDto,
  PropertySummaryDto,
  UpdatePropertyDto,
} from './dto/property.dto';
import { PropertyService } from './property.service';

@ApiTags('properties')
@ApiBearerAuth()
@Controller()
export class PropertyController {
  constructor(private readonly service: PropertyService) {}

  @Post('orgs/:orgId/properties')
  @ApiOperation({ summary: 'Add a property to an organisation' })
  @ApiOkResponse({ type: PropertyDetailDto })
  async create(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: CreatePropertyDto,
  ): Promise<PropertyDetailDto> {
    return this.service.create(actor, orgId, dto);
  }

  @Get('orgs/:orgId/properties')
  @ApiOperation({ summary: 'Properties in an organisation, scoped to the caller' })
  @ApiOkResponse({ type: [PropertySummaryDto] })
  async list(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('orgId', ParseUUIDPipe) orgId: string,
  ): Promise<PropertySummaryDto[]> {
    return this.service.listForOrg(actor, orgId);
  }

  @Get('properties/:propertyId')
  @ApiOperation({ summary: 'One property, with amenities, meal plan and rules' })
  @ApiOkResponse({ type: PropertyDetailDto })
  async getOne(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ): Promise<PropertyDetailDto> {
    return this.service.getOne(actor, propertyId);
  }

  @Patch('properties/:propertyId')
  @ApiOperation({ summary: 'Update a property' })
  @ApiOkResponse({ type: PropertyDetailDto })
  async update(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: UpdatePropertyDto,
  ): Promise<PropertyDetailDto> {
    return this.service.update(actor, propertyId, dto);
  }

  @Delete('properties/:propertyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a property (owner only, refused if occupied)' })
  async remove(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ): Promise<void> {
    await this.service.remove(actor, propertyId);
  }
}
