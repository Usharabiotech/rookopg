import { Injectable } from '@nestjs/common';
import { AllocationStatus, ListingStatus, ModerationStatus, type Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

const PUBLIC_INCLUDE = {
  locality: { select: { id: true, name: true, slug: true } },
  amenities: { select: { amenity: { select: { code: true } } } },
  mealPlan: true,
  rules: true,
  listing: true,
  media: {
    where: { moderation: { not: ModerationStatus.REJECTED } },
    select: { id: true, tag: true, sortOrder: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  },
  rooms: {
    where: { deletedAt: null, status: 'ACTIVE' },
    select: {
      id: true,
      sharingType: true,
      gender: true,
      baseRentPaise: true,
      depositPaise: true,
      hasAc: true,
      hasAttachedBath: true,
      beds: {
        where: { deletedAt: null, status: 'ACTIVE' },
        select: { id: true, rentOverridePaise: true },
      },
    },
  },
} satisfies Prisma.PropertyInclude;

export type PublicProperty = Prisma.PropertyGetPayload<{ include: typeof PUBLIC_INCLUDE }>;

export interface SearchFilters {
  localityId?: string;
  q?: string;
  gender?: string;
  sharing?: string[];
  maxRentPaise?: number;
  amenities?: string[];
}

@Injectable()
export class SearchRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Only published listings on live properties are ever visible here.
   *
   * This is the one place in the system that answers without a session, so
   * the filter is written as a hard WHERE rather than anything a caller can
   * influence.
   */
  private baseWhere(filters: SearchFilters): Prisma.PropertyWhereInput {
    return {
      deletedAt: null,
      listing: { is: { status: ListingStatus.PUBLISHED } },
      ...(filters.localityId ? { localityId: filters.localityId } : {}),
      ...(filters.gender ? { genderPolicy: filters.gender as never } : {}),
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: 'insensitive' } },
              { locality: { name: { contains: filters.q, mode: 'insensitive' } } },
              { landmark: { contains: filters.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(filters.amenities && filters.amenities.length > 0
        ? {
            AND: filters.amenities.map((code) => ({
              amenities: { some: { amenity: { code } } },
            })),
          }
        : {}),
      ...(filters.sharing && filters.sharing.length > 0
        ? {
            rooms: {
              some: {
                deletedAt: null,
                status: 'ACTIVE',
                sharingType: { in: filters.sharing as never },
                ...(filters.maxRentPaise !== undefined
                  ? { baseRentPaise: { lte: filters.maxRentPaise } }
                  : {}),
              },
            },
          }
        : filters.maxRentPaise !== undefined
          ? {
              rooms: {
                some: {
                  deletedAt: null,
                  status: 'ACTIVE',
                  baseRentPaise: { lte: filters.maxRentPaise },
                },
              },
            }
          : {}),
    };
  }

  async search(
    filters: SearchFilters,
    page: number,
    pageSize: number,
  ): Promise<{ properties: PublicProperty[]; total: number }> {
    const where = this.baseWhere(filters);

    const [properties, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        include: PUBLIC_INCLUDE,
        // Freshest confirmation first: a listing whose owner keeps saying
        // "still accurate" is worth more to a tenant than a stale one.
        orderBy: [
          { listing: { availabilityConfirmedAt: 'desc' } },
          { listing: { publishedAt: 'desc' } },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.property.count({ where }),
    ]);

    return { properties, total };
  }

  async findBySlug(slug: string): Promise<PublicProperty | null> {
    return this.prisma.property.findFirst({
      where: {
        deletedAt: null,
        listing: { is: { slug, status: ListingStatus.PUBLISHED } },
      },
      include: PUBLIC_INCLUDE,
    });
  }

  /**
   * Beds a tenant could actually take from a given date, per property.
   *
   * "Free" here means bookable, not merely empty tonight. A bed held for a
   * move-in three weeks away is gone as far as a new tenant is concerned, so
   * counting it as available would advertise a bed that booking then refuses
   * — the precise failure this product exists to avoid.
   *
   * The predicate matches the one bookings use to pick a bed, and both read
   * bed_allocations, the table the exclusion constraint guards. What a tenant
   * is shown therefore cannot disagree with what booking would allow.
   */
  async freeBedsByProperty(
    propertyIds: string[],
    fromDate?: Date,
  ): Promise<Map<string, Set<string>>> {
    const free = new Map<string, Set<string>>();
    if (propertyIds.length === 0) return free;

    const from = fromDate ? new Date(fromDate) : new Date();
    from.setUTCHours(0, 0, 0, 0);

    const [beds, taken] = await Promise.all([
      this.prisma.bed.findMany({
        where: { propertyId: { in: propertyIds }, deletedAt: null, status: 'ACTIVE' },
        select: { id: true, propertyId: true },
      }),
      this.prisma.bedAllocation.findMany({
        where: {
          propertyId: { in: propertyIds },
          status: AllocationStatus.ACTIVE,
          // Overlaps [from, ∞): open-ended, or ending after the move-in date.
          // A bed freeing up on 15 September is available from 1 October.
          OR: [{ endDate: null }, { endDate: { gt: from } }],
        },
        select: { bedId: true },
      }),
    ]);

    const takenIds = new Set(taken.map((allocation) => allocation.bedId));
    for (const bed of beds) {
      if (takenIds.has(bed.id)) continue;
      const set = free.get(bed.propertyId) ?? new Set<string>();
      set.add(bed.id);
      free.set(bed.propertyId, set);
    }
    return free;
  }

  /** True when this photo belongs to a property whose listing is live. */
  async isPhotoPublic(mediaId: string): Promise<{ propertyId: string } | null> {
    const media = await this.prisma.propertyMedia.findFirst({
      where: {
        id: mediaId,
        moderation: { not: ModerationStatus.REJECTED },
        property: { deletedAt: null, listing: { is: { status: ListingStatus.PUBLISHED } } },
      },
      select: { propertyId: true },
    });
    return media;
  }

  /** Localities that actually have something to show, for the home page. */
  async localitiesWithListings(): Promise<Array<{ id: string; name: string; slug: string; count: number }>> {
    const rows = await this.prisma.property.groupBy({
      by: ['localityId'],
      where: { deletedAt: null, listing: { is: { status: ListingStatus.PUBLISHED } } },
      _count: { _all: true },
    });
    if (rows.length === 0) return [];

    const localities = await this.prisma.locality.findMany({
      where: { id: { in: rows.map((row) => row.localityId) } },
      select: { id: true, name: true, slug: true },
    });

    const counts = new Map(rows.map((row) => [row.localityId, row._count._all]));
    return localities
      .map((locality) => ({ ...locality, count: counts.get(locality.id) ?? 0 }))
      .sort((a, b) => b.count - a.count);
  }

  async recordSearchMiss(filters: SearchFilters): Promise<void> {
    // Zero-result searches say exactly where supply is needed — the most
    // valuable signal this product collects early on (docs/01 M-14).
    await this.prisma.searchMiss.create({
      data: {
        ...(filters.localityId ? { localityId: filters.localityId } : {}),
        filters: filters as unknown as Prisma.InputJsonValue,
        resultCount: 0,
      },
    });
  }
}
