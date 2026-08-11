import { Injectable } from '@nestjs/common';
import { AllocationStatus, type Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface PropertyCounts {
  totalBeds: number;
  availableBeds: number;
  roomCount: number;
}

const DETAIL_INCLUDE = {
  locality: { select: { id: true, name: true } },
  amenities: { select: { amenity: { select: { code: true } } } },
  mealPlan: true,
  rules: true,
  listing: { select: { status: true } },
} satisfies Prisma.PropertyInclude;

export type PropertyWithRelations = Prisma.PropertyGetPayload<{ include: typeof DETAIL_INCLUDE }>;

@Injectable()
export class PropertyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    orgId: string;
    data: Prisma.PropertyCreateInput;
    amenityCodes: string[];
  }): Promise<PropertyWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const property = await tx.property.create({ data: input.data });

      if (input.amenityCodes.length > 0) {
        const amenities = await tx.amenity.findMany({
          where: { code: { in: input.amenityCodes } },
          select: { id: true },
        });
        await tx.propertyAmenity.createMany({
          data: amenities.map((amenity) => ({
            propertyId: property.id,
            amenityId: amenity.id,
          })),
          skipDuplicates: true,
        });
      }

      // A property is not listed until the owner publishes it, but the
      // listing row exists from the start so status is always answerable.
      await tx.listing.create({ data: { propertyId: property.id } });

      return tx.property.findUniqueOrThrow({
        where: { id: property.id },
        include: DETAIL_INCLUDE,
      });
    });
  }

  async findById(propertyId: string): Promise<PropertyWithRelations | null> {
    return this.prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
      include: DETAIL_INCLUDE,
    });
  }

  /**
   * Organisation is always part of the filter, and a scoped manager's
   * property list is folded in as a WHERE clause — an unauthorised row is
   * never loaded, rather than loaded and then discarded.
   */
  async listForOrg(orgId: string, visiblePropertyIds: string[] | null): Promise<PropertyWithRelations[]> {
    return this.prisma.property.findMany({
      where: {
        orgId,
        deletedAt: null,
        ...(visiblePropertyIds ? { id: { in: visiblePropertyIds } } : {}),
      },
      include: DETAIL_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(
    propertyId: string,
    data: Prisma.PropertyUpdateInput,
    amenityCodes?: string[],
  ): Promise<PropertyWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      await tx.property.update({ where: { id: propertyId }, data });

      if (amenityCodes) {
        await tx.propertyAmenity.deleteMany({ where: { propertyId } });
        if (amenityCodes.length > 0) {
          const amenities = await tx.amenity.findMany({
            where: { code: { in: amenityCodes } },
            select: { id: true },
          });
          await tx.propertyAmenity.createMany({
            data: amenities.map((amenity) => ({ propertyId, amenityId: amenity.id })),
            skipDuplicates: true,
          });
        }
      }

      return tx.property.findUniqueOrThrow({
        where: { id: propertyId },
        include: DETAIL_INCLUDE,
      });
    });
  }

  /** Soft delete. Tenancies, invoices and payment history must survive. */
  async softDelete(propertyId: string): Promise<void> {
    await this.prisma.property.update({
      where: { id: propertyId },
      data: { deletedAt: new Date() },
    });
  }

  async countActiveTenancies(propertyId: string): Promise<number> {
    return this.prisma.tenancy.count({
      where: { propertyId, status: { in: ['ACTIVE', 'NOTICE_GIVEN'] } },
    });
  }

  /**
   * Bed counts for a property as of today.
   *
   * "Available" means the bed exists, is active, and carries no active
   * allocation covering today — one query against the same table that
   * guarantees non-overlap, so the number cannot disagree with reality.
   */
  async countsFor(propertyIds: string[]): Promise<Map<string, PropertyCounts>> {
    const result = new Map<string, PropertyCounts>();
    if (propertyIds.length === 0) return result;

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const [bedRows, roomRows, occupiedRows] = await Promise.all([
      this.prisma.bed.groupBy({
        by: ['propertyId'],
        where: { propertyId: { in: propertyIds }, deletedAt: null, status: 'ACTIVE' },
        _count: { _all: true },
      }),
      this.prisma.room.groupBy({
        by: ['propertyId'],
        where: { propertyId: { in: propertyIds }, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.bedAllocation.groupBy({
        by: ['propertyId'],
        where: {
          propertyId: { in: propertyIds },
          status: AllocationStatus.ACTIVE,
          startDate: { lte: today },
          OR: [{ endDate: null }, { endDate: { gt: today } }],
        },
        _count: { _all: true },
      }),
    ]);

    const beds = new Map(bedRows.map((row) => [row.propertyId, row._count._all]));
    const rooms = new Map(roomRows.map((row) => [row.propertyId, row._count._all]));
    const occupied = new Map(occupiedRows.map((row) => [row.propertyId, row._count._all]));

    for (const propertyId of propertyIds) {
      const totalBeds = beds.get(propertyId) ?? 0;
      result.set(propertyId, {
        totalBeds,
        roomCount: rooms.get(propertyId) ?? 0,
        availableBeds: Math.max(0, totalBeds - (occupied.get(propertyId) ?? 0)),
      });
    }

    return result;
  }

  async localityExists(localityId: string): Promise<boolean> {
    const locality = await this.prisma.locality.findFirst({
      where: { id: localityId, active: true },
      select: { id: true },
    });
    return locality !== null;
  }

  async unknownAmenityCodes(codes: string[]): Promise<string[]> {
    if (codes.length === 0) return [];
    const known = await this.prisma.amenity.findMany({
      where: { code: { in: codes } },
      select: { code: true },
    });
    const knownSet = new Set(known.map((amenity) => amenity.code));
    return codes.filter((code) => !knownSet.has(code));
  }
}
