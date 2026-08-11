import { Injectable } from '@nestjs/common';
import { BedStatus, OrgRole, RoomGender, SaleMode, SharingType } from '@prisma/client';
import {
  ConflictError,
  DomainError,
  DomainErrorCode,
  NotFoundError,
} from '../../common/errors/domain.error';
import { IamService } from '../iam/iam.service';
import { PropertyRepository } from '../property/property.repository';
import type { AuthenticatedActor } from '../auth/auth.types';
import { bedLabels, defaultCapacityFor, roomCode } from './bed-labels';
import { InventoryRepository, type BedOccupancy, type RoomWithBeds } from './inventory.repository';
import type {
  BedDto,
  BulkCreateResultDto,
  BulkCreateRoomsDto,
  CreateRoomDto,
  RoomDto,
  UpdateBedDto,
  UpdateRoomDto,
} from './dto/inventory.dto';

const INVENTORY_WRITERS: OrgRole[] = [OrgRole.OWNER, OrgRole.MANAGER];
/** Guard against a runaway bulk request creating thousands of rows. */
const MAX_ROOMS_PER_BULK = 200;

interface RoomPlan {
  data: {
    code: string;
    floor?: number;
    sharingType: SharingType;
    sharingCapacity: number;
    saleMode: SaleMode;
    gender: RoomGender;
    baseRentPaise: number;
    depositPaise: number;
    hasAc: boolean;
    hasAttachedBath: boolean;
    hasBalcony: boolean;
  };
  bedCodes: string[];
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly repository: InventoryRepository,
    private readonly properties: PropertyRepository,
    private readonly iam: IamService,
  ) {}

  async listRooms(actor: AuthenticatedActor, propertyId: string): Promise<RoomDto[]> {
    await this.assertPropertyAccess(actor, propertyId);
    const rooms = await this.repository.listRooms(propertyId);
    return this.decorate(rooms);
  }

  async createRoom(
    actor: AuthenticatedActor,
    propertyId: string,
    dto: CreateRoomDto,
  ): Promise<RoomDto> {
    const { orgId } = await this.assertPropertyAccess(actor, propertyId, INVENTORY_WRITERS);

    const plan = this.planRoom({ ...dto, code: dto.code });
    await this.assertCodesFree(propertyId, [plan.data.code]);

    const [created] = await this.repository.createRoomsWithBeds(propertyId, orgId, [plan]);
    if (!created) throw new ConflictError('Room could not be created');

    const [dtoOut] = await this.decorate([created]);
    if (!dtoOut) throw new ConflictError('Room could not be created');
    return dtoOut;
  }

  /**
   * Create whole floors at once.
   *
   * Setting up a 60-bed PG room by room is the point at which an owner gives
   * up and goes back to a notebook, and a notebook means the availability
   * data everything else depends on is fiction.
   */
  async bulkCreateRooms(
    actor: AuthenticatedActor,
    propertyId: string,
    dto: BulkCreateRoomsDto,
  ): Promise<BulkCreateResultDto> {
    const { orgId } = await this.assertPropertyAccess(actor, propertyId, INVENTORY_WRITERS);

    const plans: RoomPlan[] = [];
    for (const floor of dto.floors) {
      const start = floor.startNumber ?? 1;
      for (let offset = 0; offset < floor.roomCount; offset += 1) {
        plans.push(
          this.planRoom({
            ...floor,
            code: roomCode(floor.floor, start + offset),
            floor: floor.floor,
          }),
        );
      }
    }

    if (plans.length === 0) {
      throw new ConflictError('No rooms to create');
    }
    if (plans.length > MAX_ROOMS_PER_BULK) {
      throw new ConflictError(
        `That would create ${plans.length} rooms. The limit is ${MAX_ROOMS_PER_BULK} per request.`,
        { requested: plans.length, limit: MAX_ROOMS_PER_BULK },
      );
    }

    // Duplicates inside the request itself, before touching the database.
    const codes = plans.map((plan) => plan.data.code);
    const duplicated = codes.filter((code, index) => codes.indexOf(code) !== index);
    if (duplicated.length > 0) {
      throw new ConflictError(
        `These room numbers appear twice in the request: ${[...new Set(duplicated)].join(', ')}`,
      );
    }
    await this.assertCodesFree(propertyId, codes);

    const created = await this.repository.createRoomsWithBeds(propertyId, orgId, plans);
    const rooms = await this.decorate(created);

    return {
      roomsCreated: rooms.length,
      bedsCreated: rooms.reduce((total, room) => total + room.beds.length, 0),
      rooms,
    };
  }

  async updateRoom(
    actor: AuthenticatedActor,
    roomId: string,
    dto: UpdateRoomDto,
  ): Promise<RoomDto> {
    const room = await this.repository.findRoom(roomId);
    if (!room) throw new NotFoundError('Room');
    await this.assertPropertyAccess(actor, room.propertyId, INVENTORY_WRITERS);

    if (dto.code && dto.code !== room.code) {
      await this.assertCodesFree(room.propertyId, [dto.code]);
    }

    const updated = await this.repository.updateRoom(roomId, {
      ...(dto.code !== undefined ? { code: dto.code } : {}),
      ...(dto.floor !== undefined ? { floor: dto.floor } : {}),
      ...(dto.gender !== undefined ? { gender: dto.gender as RoomGender } : {}),
      ...(dto.baseRentPaise !== undefined ? { baseRentPaise: dto.baseRentPaise } : {}),
      ...(dto.depositPaise !== undefined ? { depositPaise: dto.depositPaise } : {}),
      ...(dto.saleMode !== undefined ? { saleMode: dto.saleMode as SaleMode } : {}),
      ...(dto.hasAc !== undefined ? { hasAc: dto.hasAc } : {}),
      ...(dto.hasAttachedBath !== undefined ? { hasAttachedBath: dto.hasAttachedBath } : {}),
      ...(dto.hasBalcony !== undefined ? { hasBalcony: dto.hasBalcony } : {}),
    });

    const [out] = await this.decorate([updated]);
    if (!out) throw new NotFoundError('Room');
    return out;
  }

  /** Refused while any bed in the room still carries a claim. */
  async removeRoom(actor: AuthenticatedActor, roomId: string): Promise<void> {
    const room = await this.repository.findRoom(roomId);
    if (!room) throw new NotFoundError('Room');
    await this.assertPropertyAccess(actor, room.propertyId, INVENTORY_WRITERS);

    const claims = await this.repository.countActiveAllocations(room.beds.map((bed) => bed.id));
    if (claims > 0) {
      throw new ConflictError(
        `Room ${room.code} has ${claims} active booking or tenancy. Move or end those first.`,
        { activeAllocations: claims },
      );
    }

    await this.repository.softDeleteRoom(roomId);
  }

  async updateBed(actor: AuthenticatedActor, bedId: string, dto: UpdateBedDto): Promise<BedDto> {
    const bed = await this.repository.findBed(bedId);
    if (!bed) throw new NotFoundError('Bed');
    await this.assertPropertyAccess(actor, bed.propertyId, INVENTORY_WRITERS);

    // Taking an occupied bed out of service would leave a tenant in a bed
    // the system says does not exist.
    if (dto.status && dto.status !== BedStatus.ACTIVE) {
      const claims = await this.repository.countActiveAllocations([bedId]);
      if (claims > 0) {
        throw new ConflictError(
          'This bed has an active booking or tenancy and cannot be taken out of service.',
          { activeAllocations: claims },
        );
      }
    }

    await this.repository.updateBed(bedId, {
      ...(dto.status !== undefined ? { status: dto.status as BedStatus } : {}),
      ...(dto.rentOverridePaise !== undefined
        ? { rentOverridePaise: dto.rentOverridePaise }
        : {}),
    });

    const room = await this.repository.findRoom(bed.roomId);
    if (!room) throw new NotFoundError('Room');
    const [decorated] = await this.decorate([room]);
    const out = decorated?.beds.find((candidate) => candidate.id === bedId);
    if (!out) throw new NotFoundError('Bed');
    return out;
  }

  // --------------------------------------------------------------------------

  private planRoom(input: {
    code: string;
    floor?: number;
    sharingType: string;
    sharingCapacity?: number;
    gender: string;
    baseRentPaise: number;
    depositPaise?: number;
    saleMode?: string;
    hasAc?: boolean;
    hasAttachedBath?: boolean;
    hasBalcony?: boolean;
  }): RoomPlan {
    const sharingType = input.sharingType as SharingType;
    const implied = defaultCapacityFor(sharingType);
    const capacity = input.sharingCapacity ?? implied;

    if (capacity === null || capacity === undefined) {
      throw new ConflictError('sharingCapacity is required for a DORMITORY room');
    }
    if (implied !== null && input.sharingCapacity !== undefined && input.sharingCapacity !== implied) {
      throw new ConflictError(
        `A ${sharingType} room holds ${implied} beds, not ${input.sharingCapacity}. Use DORMITORY for other sizes.`,
      );
    }

    return {
      data: {
        code: input.code,
        ...(input.floor !== undefined ? { floor: input.floor } : {}),
        sharingType,
        sharingCapacity: capacity,
        saleMode: (input.saleMode ?? SaleMode.PER_BED) as SaleMode,
        gender: input.gender as RoomGender,
        baseRentPaise: input.baseRentPaise,
        depositPaise: input.depositPaise ?? 0,
        hasAc: input.hasAc ?? false,
        hasAttachedBath: input.hasAttachedBath ?? false,
        hasBalcony: input.hasBalcony ?? false,
      },
      bedCodes: bedLabels(capacity),
    };
  }

  private async assertCodesFree(propertyId: string, codes: string[]): Promise<void> {
    const taken = await this.repository.existingRoomCodes(propertyId, codes);
    if (taken.length > 0) {
      throw new ConflictError(
        `These room numbers already exist: ${taken.join(', ')}`,
        { existing: taken },
      );
    }
  }

  private async assertPropertyAccess(
    actor: AuthenticatedActor,
    propertyId: string,
    roles: OrgRole[] = [],
  ): Promise<{ orgId: string }> {
    const property = await this.properties.findById(propertyId);
    if (!property) throw new NotFoundError('Property');

    try {
      this.iam.assertPropertyAccess(actor, property.orgId, property.id, roles);
    } catch (error) {
      if (error instanceof DomainError && error.code === DomainErrorCode.FORBIDDEN) {
        throw new NotFoundError('Property');
      }
      throw error;
    }

    return { orgId: property.orgId };
  }

  private async decorate(rooms: RoomWithBeds[]): Promise<RoomDto[]> {
    const bedIds = rooms.flatMap((room) => room.beds.map((bed) => bed.id));
    const occupancy = await this.repository.occupancyFor(bedIds);

    return rooms.map((room) => ({
      id: room.id,
      propertyId: room.propertyId,
      code: room.code,
      ...(room.floor !== null ? { floor: room.floor } : {}),
      sharingType: room.sharingType,
      sharingCapacity: room.sharingCapacity,
      saleMode: room.saleMode,
      gender: room.gender,
      baseRentPaise: room.baseRentPaise,
      depositPaise: room.depositPaise,
      hasAc: room.hasAc,
      hasAttachedBath: room.hasAttachedBath,
      hasBalcony: room.hasBalcony,
      status: room.status,
      beds: room.beds.map((bed) => this.toBedDto(bed, room.baseRentPaise, occupancy.get(bed.id))),
    }));
  }

  private toBedDto(
    bed: { id: string; code: string; status: BedStatus; rentOverridePaise: number | null },
    roomRentPaise: number,
    occupancy: BedOccupancy | undefined,
  ): BedDto {
    return {
      id: bed.id,
      code: bed.code,
      status: bed.status,
      rentPaise: bed.rentOverridePaise ?? roomRentPaise,
      occupied: occupancy?.occupied ?? false,
      ...(occupancy?.availableFrom
        ? { availableFrom: occupancy.availableFrom.toISOString().slice(0, 10) }
        : {}),
    };
  }
}
