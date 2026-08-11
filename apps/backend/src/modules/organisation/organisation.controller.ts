import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import type { AuthenticatedActor } from '../auth/auth.types';
import {
  CreateOrganisationDto,
  OrganisationDto,
  UpdateOrganisationDto,
} from './dto/organisation.dto';
import { OrganisationService } from './organisation.service';

@ApiTags('organisations')
@ApiBearerAuth()
@Controller('orgs')
export class OrganisationController {
  constructor(private readonly service: OrganisationService) {}

  @Post()
  @ApiOperation({ summary: 'Create an organisation; the caller becomes its owner' })
  @ApiOkResponse({ type: OrganisationDto })
  async create(
    @CurrentUser() actor: AuthenticatedActor,
    @Body() dto: CreateOrganisationDto,
  ): Promise<OrganisationDto> {
    return this.service.create(actor, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Organisations the caller belongs to' })
  @ApiOkResponse({ type: [OrganisationDto] })
  async listMine(@CurrentUser() actor: AuthenticatedActor): Promise<OrganisationDto[]> {
    return this.service.listMine(actor);
  }

  @Get(':orgId')
  @ApiOperation({ summary: 'One organisation' })
  @ApiOkResponse({ type: OrganisationDto })
  async getOne(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('orgId', ParseUUIDPipe) orgId: string,
  ): Promise<OrganisationDto> {
    return this.service.getOne(actor, orgId);
  }

  @Patch(':orgId')
  @ApiOperation({ summary: 'Update an organisation (owner only)' })
  @ApiOkResponse({ type: OrganisationDto })
  async update(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: UpdateOrganisationDto,
  ): Promise<OrganisationDto> {
    return this.service.update(actor, orgId, dto);
  }
}
