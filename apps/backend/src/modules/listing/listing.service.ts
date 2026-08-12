import { Injectable, Logger } from '@nestjs/common';
import { ListingStatus, OrgRole } from '@prisma/client';
import {
  ConflictError,
  DomainError,
  DomainErrorCode,
  NotFoundError,
} from '../../common/errors/domain.error';
import { IamService } from '../iam/iam.service';
import { PropertyRepository } from '../property/property.repository';
import type { AuthenticatedActor } from '../auth/auth.types';
import { buildListingSlug } from './listing.slug';
import { ListingRepository, type ListingRow, type ReadinessFacts } from './listing.repository';
import type { ListingReadinessDto, ListingStatusDto, PublishListingDto } from './dto/listing.dto';

const LISTING_WRITERS: OrgRole[] = [OrgRole.OWNER, OrgRole.MANAGER];

/**
 * The floor a listing has to clear before tenants can see it.
 *
 * These are not arbitrary. A tenant who arrives at a PG that looks nothing
 * like its listing does not come back, and photos are what replaces the visit
 * (docs/02 Part 0, decision 8) — so a listing with no photograph of a room is
 * not a listing, it is an advertisement for disappointment.
 */
function assessReadiness(facts: ReadinessFacts): ListingReadinessDto {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (facts.roomCount === 0) blockers.push('Add rooms and beds.');
  if (facts.bedCount === 0) blockers.push('No beds are in service.');
  if (facts.photoCount < 3) {
    blockers.push(`Add at least 3 photos — you have ${facts.photoCount}.`);
  }
  if (!facts.hasRoomPhoto) blockers.push('Add a photo of a room.');
  if (!facts.hasExteriorPhoto) blockers.push('Add a photo of the building or entrance.');
  if (!facts.hasContactPhone) blockers.push('Add a contact number.');

  if (!facts.hasCoordinates) warnings.push('Set the map location so tenants can find it.');
  if (facts.amenityCount === 0) warnings.push('Tick the facilities you offer.');
  if (!facts.hasMealPlan) warnings.push('Say what food is provided — tenants filter on it.');
  if (facts.photoCount < 6) warnings.push('Six or more photos get noticeably more enquiries.');

  return { ready: blockers.length === 0, blockers, warnings };
}

@Injectable()
export class ListingService {
  private readonly logger = new Logger(ListingService.name);

  constructor(
    private readonly repository: ListingRepository,
    private readonly properties: PropertyRepository,
    private readonly iam: IamService,
  ) {}

  async status(actor: AuthenticatedActor, propertyId: string): Promise<ListingStatusDto> {
    await this.assertAccess(actor, propertyId);
    const listing = await this.load(propertyId);
    const facts = await this.repository.readinessFacts(propertyId);
    return this.toDto(listing, assessReadiness(facts));
  }

  async publish(
    actor: AuthenticatedActor,
    propertyId: string,
    dto: PublishListingDto,
  ): Promise<ListingStatusDto> {
    await this.assertAccess(actor, propertyId, LISTING_WRITERS);

    const listing = await this.load(propertyId);
    const facts = await this.repository.readinessFacts(propertyId);
    const readiness = assessReadiness(facts);

    if (!readiness.ready) {
      throw new ConflictError('This listing is not ready to go live yet.', {
        blockers: readiness.blockers,
      });
    }

    const slug =
      listing.slug ??
      buildListingSlug({
        propertyName: listing.propertyName,
        localityName: listing.localityName,
        propertyId,
      });

    // Practically impossible given the id suffix, but a collision would hand
    // one owner's traffic to another, so it is worth the single query.
    if (!listing.slug && (await this.repository.slugTaken(slug, propertyId))) {
      throw new ConflictError('Could not create a web address for this listing. Try again.');
    }

    const published = await this.repository.publish({
      propertyId,
      slug,
      ...(dto.headline !== undefined ? { headline: dto.headline } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
    });

    this.logger.log(`Listing published: ${published.slug}`);
    return this.toDto(published, readiness);
  }

  async unpublish(actor: AuthenticatedActor, propertyId: string): Promise<ListingStatusDto> {
    await this.assertAccess(actor, propertyId, LISTING_WRITERS);

    const listing = await this.load(propertyId);
    if (listing.status !== ListingStatus.PUBLISHED) {
      throw new ConflictError('This listing is not live.');
    }

    const updated = await this.repository.unpublish(propertyId);
    const facts = await this.repository.readinessFacts(propertyId);
    return this.toDto(updated, assessReadiness(facts));
  }

  /**
   * "Yes, this is still accurate."
   *
   * Stale availability is the fastest way to lose a tenant's trust, so
   * confirmation freshness feeds search ranking (docs/02 decision 17).
   */
  async confirmAvailability(
    actor: AuthenticatedActor,
    propertyId: string,
  ): Promise<ListingStatusDto> {
    await this.assertAccess(actor, propertyId, LISTING_WRITERS);
    await this.repository.confirmAvailability(propertyId);
    return this.status(actor, propertyId);
  }

  private async load(propertyId: string): Promise<ListingRow> {
    const listing = await this.repository.findByProperty(propertyId);
    if (!listing) throw new NotFoundError('Listing');
    return listing;
  }

  private async assertAccess(
    actor: AuthenticatedActor,
    propertyId: string,
    roles: OrgRole[] = [],
  ): Promise<void> {
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
  }

  private toDto(listing: ListingRow, readiness: ListingReadinessDto): ListingStatusDto {
    return {
      propertyId: listing.propertyId,
      status: listing.status,
      ...(listing.slug ? { slug: listing.slug } : {}),
      ...(listing.headline ? { headline: listing.headline } : {}),
      ...(listing.description ? { description: listing.description } : {}),
      ...(listing.publishedAt ? { publishedAt: listing.publishedAt.toISOString() } : {}),
      ...(listing.availabilityConfirmedAt
        ? { availabilityConfirmedAt: listing.availabilityConfirmedAt.toISOString() }
        : {}),
      readiness,
    };
  }
}
