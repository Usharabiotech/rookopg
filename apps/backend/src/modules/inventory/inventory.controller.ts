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
  BedDto,
  BulkCreateResultDto,
  BulkCreateRoomsDto,
  CreateRoomDto,
  RoomDto,
  UpdateBedDto,
  UpdateRoomDto,
} from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth()
@Controller()
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Get('properties/:propertyId/rooms')
  @ApiOperation({ summary: 'Rooms and beds, with live occupancy' })
  @ApiOkResponse({ type: [RoomDto] })
  async listRooms(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
  ): Promise<RoomDto[]> {
    return this.service.listRooms(actor, propertyId);
  }

  @Post('properties/:propertyId/rooms')
  @ApiOperation({ summary: 'Add one room; its beds are created automatically' })
  @ApiOkResponse({ type: RoomDto })
  async createRoom(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: CreateRoomDto,
  ): Promise<RoomDto> {
    return this.service.createRoom(actor, propertyId, dto);
  }

  @Post('properties/:propertyId/rooms/bulk')
  @ApiOperation({
    summary: 'Create whole floors at once — the field-team setup endpoint',
    description:
      'Rooms are numbered floor*100 + n, so floor 2 with 6 rooms gives 201-206. ' +
      'Every room gets its beds automatically.',
  })
  @ApiOkResponse({ type: BulkCreateResultDto })
  async bulkCreateRooms(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Body() dto: BulkCreateRoomsDto,
  ): Promise<BulkCreateResultDto> {
    return this.service.bulkCreateRooms(actor, propertyId, dto);
  }

  @Patch('rooms/:roomId')
  @ApiOperation({ summary: 'Update a room' })
  @ApiOkResponse({ type: RoomDto })
  async updateRoom(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: UpdateRoomDto,
  ): Promise<RoomDto> {
    return this.service.updateRoom(actor, roomId, dto);
  }

  @Delete('rooms/:roomId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a room (refused if any bed is claimed)' })
  async removeRoom(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('roomId', ParseUUIDPipe) roomId: string,
  ): Promise<void> {
    await this.service.removeRoom(actor, roomId);
  }

  @Patch('beds/:bedId')
  @ApiOperation({ summary: 'Block a bed for maintenance, or override its rent' })
  @ApiOkResponse({ type: BedDto })
  async updateBed(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('bedId', ParseUUIDPipe) bedId: string,
    @Body() dto: UpdateBedDto,
  ): Promise<BedDto> {
    return this.service.updateBed(actor, bedId, dto);
  }
}
