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
import { AddMemberDto, OrgMemberDto, UpdateMemberDto } from './dto/staff.dto';
import { StaffService } from './staff.service';

@ApiTags('staff')
@ApiBearerAuth()
@Controller('orgs/:orgId/members')
export class StaffController {
  constructor(private readonly service: StaffService) {}

  @Get()
  @ApiOperation({ summary: 'People in this organisation' })
  @ApiOkResponse({ type: [OrgMemberDto] })
  async list(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('orgId', ParseUUIDPipe) orgId: string,
  ): Promise<OrgMemberDto[]> {
    return this.service.list(actor, orgId);
  }

  @Post()
  @ApiOperation({
    summary: 'Add a manager by phone number (owner only)',
    description:
      'They do not need an account yet. Signing in with that number later claims the invitation.',
  })
  @ApiOkResponse({ type: OrgMemberDto })
  async add(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: AddMemberDto,
  ): Promise<OrgMemberDto> {
    return this.service.add(actor, orgId, dto);
  }

  @Patch(':membershipId')
  @ApiOperation({ summary: 'Change a member’s role, property scope or permissions (owner only)' })
  @ApiOkResponse({ type: OrgMemberDto })
  async update(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Body() dto: UpdateMemberDto,
  ): Promise<OrgMemberDto> {
    return this.service.update(actor, orgId, membershipId, dto);
  }

  @Delete(':membershipId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member; their sessions end immediately (owner only)' })
  async remove(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
  ): Promise<void> {
    await this.service.remove(actor, orgId, membershipId);
  }
}
