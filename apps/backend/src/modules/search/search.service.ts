import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Readable } from 'node:stream';
import type { AppConfig } from '../../config/env.config';
import { NotFoundError } from '../../common/errors/domain.error';
import { OBJECT_STORAGE, type ObjectStorage } from '../storage/storage.types';
import { SearchRepository, type PublicProperty, type SearchFilters } from './search.repository';
import type {
  ListingCardDto,
  PublicListingDto,
  PublicRoomDto,
  SearchListingsQueryDto,
  SearchResultsDto,
  SharingOptionDto,
} from './dto/search.dto';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly signedUrlTtl: number;

  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly repository: SearchRepository,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {
    this.signedUrlTtl = config.get('STORAGE_SIGNED_URL_TTL_SECONDS', { infer: true });
  }

  async search(query: SearchListingsQueryDto): Promise<SearchResultsDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const availableOnly = query.availableOnly ?? true;

    const filters: SearchFilters = {
      ...(query.localityId ? { localityId: query.localityId } : {}),
      ...(query.q ? { q: query.q } : {}),
      ...(query.gender ? { gender: query.gender } : {}),
      ...(query.sharing ? { sharing: query.sharing } : {}),
      ...(query.maxRentPaise !== undefined ? { maxRentPaise: query.maxRentPaise } : {}),
      ...(query.amenities ? { amenities: query.amenities } : {}),
    };

    const { properties, total } = await this.repository.search(filters, page, pageSize);
    const free = await this.repository.freeBedsByProperty(properties.map((p) => p.id));

    let results = properties.map((property) => this.toCard(property, free.get(property.id)));

    // "Available" is computed from allocations rather than filtered in SQL,
    // because occupancy is a date-range question the query planner cannot
    // answer cheaply. Filtering here keeps the two views consistent.
    if (availableOnly) {
      results = results.filter((card) => card.freeBeds > 0);
    }

    if (results.length === 0) {
      // Fire and forget: a missed search must never slow down or fail the
      // response a tenant is waiting for.
      void this.repository
        .recordSearchMiss(filters)
        .catch((error: unknown) => this.logger.warn(`Could not record search miss: ${String(error)}`));
    }

    return { results, total, page, pageSize };
  }

  async findBySlug(slug: string): Promise<PublicListingDto> {
    const property = await this.repository.findBySlug(slug);
    if (!property) throw new NotFoundError('Listing');

    const free = await this.repository.freeBedsByProperty([property.id]);
    return this.toDetail(property, free.get(property.id));
  }

  async localities(): Promise<Array<{ id: string; name: string; slug: string; count: number }>> {
    return this.repository.localitiesWithListings();
  }

  /**
   * Serves a listing photo to anyone.
   *
   * The gate is the listing being published — an unlisted or draft property's
   * photos stay private, so taking a listing down actually takes the pictures
   * down with it.
   */
  async publicPhoto(
    mediaId: string,
    variant: 'display' | 'thumb',
  ): Promise<{ redirectTo: string } | { stream: Readable; contentType: string }> {
    const media = await this.repository.isPhotoPublic(mediaId);
    if (!media) throw new NotFoundError('Photo');

    const key = `properties/${media.propertyId}/${mediaId}/${variant}.webp`;

    const url = await this.storage.signedReadUrl(key, this.signedUrlTtl);
    if (url) return { redirectTo: url };

    if (!(await this.storage.exists(key))) throw new NotFoundError('Photo');
    return { stream: await this.storage.getStream(key), contentType: 'image/webp' };
  }

  // --------------------------------------------------------------------------

  private sharingOptions(property: PublicProperty, freeBeds: Set<string> | undefined): SharingOptionDto[] {
    const grouped = new Map<string, SharingOptionDto>();

    for (const room of property.rooms) {
      const existing = grouped.get(room.sharingType);
      const roomFree = room.beds.filter((bed) => freeBeds?.has(bed.id)).length;
      const cheapest = Math.min(
        ...room.beds.map((bed) => bed.rentOverridePaise ?? room.baseRentPaise),
        room.baseRentPaise,
      );

      if (!existing) {
        grouped.set(room.sharingType, {
          sharingType: room.sharingType,
          fromRentPaise: cheapest,
          freeBeds: roomFree,
          hasAc: room.hasAc,
        });
      } else {
        existing.fromRentPaise = Math.min(existing.fromRentPaise, cheapest);
        existing.freeBeds += roomFree;
        existing.hasAc = existing.hasAc || room.hasAc;
      }
    }

    return [...grouped.values()].sort((a, b) => a.fromRentPaise - b.fromRentPaise);
  }

  private toCard(property: PublicProperty, freeBeds: Set<string> | undefined): ListingCardDto {
    const options = this.sharingOptions(property, freeBeds);
    const totalBeds = property.rooms.reduce((sum, room) => sum + room.beds.length, 0);
    const cover = property.media[0];

    return {
      slug: property.listing?.slug ?? '',
      name: property.name,
      localityName: property.locality.name,
      genderPolicy: property.genderPolicy,
      propertyType: property.propertyType,
      ...(property.listing?.headline ? { headline: property.listing.headline } : {}),
      fromRentPaise: options[0]?.fromRentPaise ?? 0,
      freeBeds: freeBeds?.size ?? 0,
      totalBeds,
      ...(cover ? { coverPhotoId: cover.id } : {}),
      amenityCodes: property.amenities.map((link) => link.amenity.code),
      ...(property.mealPlan ? { foodType: property.mealPlan.foodType } : {}),
      sharingOptions: options,
    };
  }

  private toDetail(property: PublicProperty, freeBeds: Set<string> | undefined): PublicListingDto {
    const meals = property.mealPlan
      ? [
          property.mealPlan.breakfast && 'breakfast',
          property.mealPlan.lunch && 'lunch',
          property.mealPlan.dinner && 'dinner',
        ]
          .filter(Boolean)
          .join(', ')
      : '';

    const rooms: PublicRoomDto[] = property.rooms.map((room) => ({
      sharingType: room.sharingType,
      rentPaise: room.baseRentPaise,
      depositPaise: room.depositPaise,
      freeBeds: room.beds.filter((bed) => freeBeds?.has(bed.id)).length,
      totalBeds: room.beds.length,
      hasAc: room.hasAc,
      hasAttachedBath: room.hasAttachedBath,
      gender: room.gender,
    }));

    return {
      ...this.toCard(property, freeBeds),
      propertyId: property.id,
      ...(property.listing?.description ? { description: property.listing.description } : {}),
      addressLine1: property.addressLine1,
      ...(property.landmark ? { landmark: property.landmark } : {}),
      pincode: property.pincode,
      ...(property.latitude ? { latitude: Number(property.latitude) } : {}),
      ...(property.longitude ? { longitude: Number(property.longitude) } : {}),
      photoIds: property.media.map((item) => item.id),
      rooms,
      ...(meals ? { mealsIncluded: meals } : {}),
      ...(property.rules?.gateClosingTime
        ? { gateClosingTime: property.rules.gateClosingTime }
        : {}),
      visitorsAllowed: property.rules?.visitorsAllowed ?? true,
      ...(property.rules?.notes ? { houseRules: property.rules.notes } : {}),
      ...(property.listing?.availabilityConfirmedAt
        ? { availabilityConfirmedAt: property.listing.availabilityConfirmedAt.toISOString() }
        : {}),
    };
  }
}
