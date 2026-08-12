import { Injectable } from '@nestjs/common';
import { ListingStatus, ModerationStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface ListingRow {
  id: string;
  propertyId: string;
  orgId: string;
  status: ListingStatus;
  slug: string | null;
  headline: string | null;
  description: string | null;
  publishedAt: Date | null;
  availabilityConfirmedAt: Date | null;
  propertyName: string;
  localityName: string;
}

export interface ReadinessFacts {
  roomCount: number;
  bedCount: number;
  photoCount: number;
  hasExteriorPhoto: boolean;
  hasRoomPhoto: boolean;
  hasContactPhone: boolean;
  hasCoordinates: boolean;
  amenityCount: number;
  hasMealPlan: boolean;
}

@Injectable()
export class ListingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByProperty(propertyId: string): Promise<ListingRow | null> {
    const row = await this.prisma.listing.findUnique({
      where: { propertyId },
      select: {
        id: true,
        propertyId: true,
        status: true,
        slug: true,
        headline: true,
        description: true,
        publishedAt: true,
        availabilityConfirmedAt: true,
        property: {
          select: { orgId: true, name: true, locality: { select: { name: true } } },
        },
      },
    });
    if (!row) return null;

    const { property, ...rest } = row;
    return {
      ...rest,
      orgId: property.orgId,
      propertyName: property.name,
      localityName: property.locality.name,
    };
  }

  /** Everything the publish check needs, in one round trip. */
  async readinessFacts(propertyId: string): Promise<ReadinessFacts> {
    const [property, rooms, beds, photos] = await Promise.all([
      this.prisma.property.findUniqueOrThrow({
        where: { id: propertyId },
        select: {
          contactPhone: true,
          latitude: true,
          longitude: true,
          mealPlan: { select: { foodType: true } },
          _count: { select: { amenities: true } },
        },
      }),
      this.prisma.room.count({ where: { propertyId, deletedAt: null } }),
      this.prisma.bed.count({ where: { propertyId, deletedAt: null, status: 'ACTIVE' } }),
      this.prisma.propertyMedia.findMany({
        where: { propertyId, moderation: { not: ModerationStatus.REJECTED } },
        select: { tag: true },
      }),
    ]);

    return {
      roomCount: rooms,
      bedCount: beds,
      photoCount: photos.length,
      hasExteriorPhoto: photos.some((p) => p.tag === 'EXTERIOR' || p.tag === 'ENTRANCE'),
      hasRoomPhoto: photos.some((p) => p.tag === 'ROOM'),
      hasContactPhone: Boolean(property.contactPhone),
      hasCoordinates: property.latitude !== null && property.longitude !== null,
      amenityCount: property._count.amenities,
      hasMealPlan: property.mealPlan !== null,
    };
  }

  async publish(input: {
    propertyId: string;
    slug: string;
    headline?: string;
    description?: string;
  }): Promise<ListingRow> {
    await this.prisma.listing.update({
      where: { propertyId: input.propertyId },
      data: {
        status: ListingStatus.PUBLISHED,
        publishedAt: new Date(),
        availabilityConfirmedAt: new Date(),
        ...(input.headline !== undefined ? { headline: input.headline } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
    });

    // The slug is claimed separately, and only when there is not one already:
    // a listing keeps the address it was first published under, whatever the
    // owner renames the PG to later. Changing it would break every link a
    // tenant has shared and discard whatever ranking it had earned.
    await this.prisma.listing.updateMany({
      where: { propertyId: input.propertyId, slug: null },
      data: { slug: input.slug },
    });

    return this.findByProperty(input.propertyId) as Promise<ListingRow>;
  }

  async unpublish(propertyId: string): Promise<ListingRow> {
    await this.prisma.listing.update({
      where: { propertyId },
      data: { status: ListingStatus.UNLISTED },
    });
    return this.findByProperty(propertyId) as Promise<ListingRow>;
  }

  /** Owners re-confirm availability to stay near the top of search. */
  async confirmAvailability(propertyId: string): Promise<void> {
    await this.prisma.listing.update({
      where: { propertyId },
      data: { availabilityConfirmedAt: new Date() },
    });
  }

  async slugTaken(slug: string, exceptPropertyId: string): Promise<boolean> {
    const existing = await this.prisma.listing.findFirst({
      where: { slug, propertyId: { not: exceptPropertyId } },
      select: { id: true },
    });
    return existing !== null;
  }
}
