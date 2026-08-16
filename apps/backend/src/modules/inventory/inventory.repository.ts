import { Injectable } from '@nestjs/common';
import { AllocationStatus, type Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

const ROOM_INCLUDE = {
  beds: {
    where: { deletedAt: null },
    orderBy: { code: 'asc' },
  },
} satisfies Prisma.RoomInclude;

export type RoomWithBeds = Prisma.RoomGetPayload<{ include: typeof ROOM_INCLUDE }>;

export interface BedOccupancy {
  /** Somebody is in it today. */
  occupied: boolean;
  /** When an occupied bed next frees up. */
  availableFrom: Date | null;
  /**
   * Free today, but already claimed from this date on.
   *
   * A bed booked for next month is not a bed you can let, and the board used
   * to draw it as free: the query only looked at claims that had already
   * started. The owner would tap it, try to seat a walk-in, and get an
   * overlap error out of the database with nothing to explain it.
   */
  reservedFrom: Date | null;
}

@Injectable()
export class InventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listRooms(propertyId: string): Promise<RoomWithBeds[]> {
    return this.prisma.room.findMany({
      where: { propertyId, deletedAt: null },
      include: ROOM_INCLUDE,
      orderBy: [{ floor: 'asc' }, { code: 'asc' }],
    });
  }

  async findRoom(roomId: string): Promise<RoomWithBeds | null> {
    return this.prisma.room.findFirst({
      where: { id: roomId, deletedAt: null },
      include: ROOM_INCLUDE,
    });
  }

  async findBed(
    bedId: string,
  ): Promise<{ id: string; roomId: string; propertyId: string; orgId: string } | null> {
    const bed = await this.prisma.bed.findFirst({
      where: { id: bedId, deletedAt: null },
      select: {
        id: true,
        roomId: true,
        propertyId: true,
        property: { select: { orgId: true } },
      },
    });
    if (!bed) return null;
    return {
      id: bed.id,
      roomId: bed.roomId,
      propertyId: bed.propertyId,
      orgId: bed.property.orgId,
    };
  }

  async existingRoomCodes(propertyId: string, codes: string[]): Promise<string[]> {
    if (codes.length === 0) return [];
    const rows = await this.prisma.room.findMany({
      where: { propertyId, code: { in: codes }, deletedAt: null },
      select: { code: true },
    });
    return rows.map((row) => row.code);
  }

  /**
   * Creates rooms and their beds together.
   *
   * A room without beds is not inventory, it is a data-entry accident, so the
   * two are never created apart.
   */
  async createRoomsWithBeds(
    propertyId: string,
    orgId: string,
    rooms: Array<{
      data: Omit<Prisma.RoomCreateManyInput, 'propertyId' | 'orgId'>;
      bedCodes: string[];
    }>,
  ): Promise<RoomWithBeds[]> {
    return this.prisma.$transaction(async (tx) => {
      const createdIds: string[] = [];

      for (const room of rooms) {
        const created = await tx.room.create({
          data: { ...room.data, propertyId, orgId },
          select: { id: true },
        });
        await tx.bed.createMany({
          data: room.bedCodes.map((code) => ({
            roomId: created.id,
            propertyId,
            code,
          })),
        });
        createdIds.push(created.id);
      }

      return tx.room.findMany({
        where: { id: { in: createdIds } },
        include: ROOM_INCLUDE,
        orderBy: [{ floor: 'asc' }, { code: 'asc' }],
      });
    });
  }

  async updateRoom(roomId: string, data: Prisma.RoomUpdateInput): Promise<RoomWithBeds> {
    await this.prisma.room.update({ where: { id: roomId }, data });
    return this.prisma.room.findUniqueOrThrow({ where: { id: roomId }, include: ROOM_INCLUDE });
  }

  async updateBed(bedId: string, data: Prisma.BedUpdateInput): Promise<void> {
    await this.prisma.bed.update({ where: { id: bedId }, data });
  }

  async softDeleteRoom(roomId: string): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.bed.updateMany({ where: { roomId, deletedAt: null }, data: { deletedAt: now } }),
      this.prisma.room.update({ where: { id: roomId }, data: { deletedAt: now } }),
    ]);
  }

  /**
   * Which of these beds are claimed today, and when each frees up.
   *
   * Read from bed_allocations — the same table the exclusion constraint
   * guards — so what the owner sees cannot drift from what booking enforces.
   */
  async occupancyFor(bedIds: string[]): Promise<Map<string, BedOccupancy>> {
    const result = new Map<string, BedOccupancy>();
    if (bedIds.length === 0) return result;

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Every live claim from today onward, not only the ones already running.
    const allocations = await this.prisma.bedAllocation.findMany({
      where: {
        bedId: { in: bedIds },
        status: AllocationStatus.ACTIVE,
        OR: [{ endDate: null }, { endDate: { gt: today } }],
      },
      select: { bedId: true, startDate: true, endDate: true },
      orderBy: { startDate: 'asc' },
    });

    for (const bedId of bedIds) {
      result.set(bedId, { occupied: false, availableFrom: null, reservedFrom: null });
    }

    for (const allocation of allocations) {
      const current = result.get(allocation.bedId);
      if (!current) continue;

      if (allocation.startDate <= today) {
        current.occupied = true;
        current.availableFrom = allocation.endDate;
      } else if (current.reservedFrom === null) {
        // Ordered by start date, so the first future claim is the nearest one.
        current.reservedFrom = allocation.startDate;
      }
    }

    return result;
  }

  /** Any active claim at all, today or in the future. Blocks deletion. */
  async countActiveAllocations(bedIds: string[]): Promise<number> {
    if (bedIds.length === 0) return 0;
    return this.prisma.bedAllocation.count({
      where: { bedId: { in: bedIds }, status: AllocationStatus.ACTIVE },
    });
  }
}
