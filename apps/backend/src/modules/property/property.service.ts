import { Injectable } from '@nestjs/common';
import { FoodType, GenderPolicy, OrgRole, PropertyType } from '@prisma/client';
import { normalisePhone } from '../../common/crypto/phone.util';
import { ConflictError, NotFoundError } from '../../common/errors/domain.error';
import { DomainError, DomainErrorCode } from '../../common/errors/domain.error';
import { IamService } from '../iam/iam.service';
import type { AuthenticatedActor } from '../auth/auth.types';
import { PropertyRepository, type PropertyWithRelations } from './property.repository';
import type {
  CreatePropertyDto,
  PropertyDetailDto,
  PropertySummaryDto,
  UpdatePropertyDto,
} from './dto/property.dto';

/** Both roles may run a property day to day; only these two, though. */
const PROPERTY_WRITERS: OrgRole[] = [OrgRole.OWNER, OrgRole.MANAGER];

@Injectable()
export class PropertyService {
  constructor(
    private readonly repository: PropertyRepository,
    private readonly iam: IamService,
  ) {}

  async create(
    actor: AuthenticatedActor,
    orgId: string,
    dto: CreatePropertyDto,
  ): Promise<PropertyDetailDto> {
    this.iam.assertOrgAccess(actor, orgId, PROPERTY_WRITERS);
    await this.assertReferencesExist(dto.localityId, dto.amenityCodes ?? []);

    const property = await this.repository.create({
      orgId,
      amenityCodes: dto.amenityCodes ?? [],
      data: {
        organisation: { connect: { id: orgId } },
        locality: { connect: { id: dto.localityId } },
        name: dto.name,
        propertyType: (dto.propertyType ?? PropertyType.PG) as PropertyType,
        genderPolicy: dto.genderPolicy as GenderPolicy,
        addressLine1: dto.addressLine1,
        ...(dto.addressLine2 ? { addressLine2: dto.addressLine2 } : {}),
        ...(dto.landmark ? { landmark: dto.landmark } : {}),
        pincode: dto.pincode,
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
        ...(dto.contactPhone ? { contactPhone: normalisePhone(dto.contactPhone) } : {}),
        ...(dto.defaultRentCycleDay !== undefined
          ? { defaultRentCycleDay: dto.defaultRentCycleDay }
          : {}),
        ...(dto.mealPlan
          ? {
              mealPlan: {
                create: {
                  foodType: dto.mealPlan.foodType as FoodType,
                  breakfast: dto.mealPlan.breakfast ?? false,
                  lunch: dto.mealPlan.lunch ?? false,
                  dinner: dto.mealPlan.dinner ?? false,
                  includedInRent: dto.mealPlan.includedInRent ?? true,
                  ...(dto.mealPlan.extraChargePaise !== undefined
                    ? { extraChargePaise: dto.mealPlan.extraChargePaise }
                    : {}),
                  ...(dto.mealPlan.notes ? { notes: dto.mealPlan.notes } : {}),
                },
              },
            }
          : {}),
        ...(dto.rules
          ? {
              rules: {
                create: {
                  ...(dto.rules.gateClosingTime
                    ? { gateClosingTime: dto.rules.gateClosingTime }
                    : {}),
                  visitorsAllowed: dto.rules.visitorsAllowed ?? true,
                  smokingAllowed: dto.rules.smokingAllowed ?? false,
                  alcoholAllowed: dto.rules.alcoholAllowed ?? false,
                  cookingAllowed: dto.rules.cookingAllowed ?? false,
                  ...(dto.rules.notes ? { notes: dto.rules.notes } : {}),
                },
              },
            }
          : {}),
      },
    });

    return this.toDetail(property, { totalBeds: 0, availableBeds: 0, roomCount: 0 });
  }

  async listForOrg(actor: AuthenticatedActor, orgId: string): Promise<PropertySummaryDto[]> {
    this.iam.assertOrgAccess(actor, orgId);
    const visible = this.iam.visiblePropertyIds(actor, orgId);

    const properties = await this.repository.listForOrg(orgId, visible);
    const counts = await this.repository.countsFor(properties.map((property) => property.id));

    return properties.map((property) =>
      this.toSummary(
        property,
        counts.get(property.id) ?? { totalBeds: 0, availableBeds: 0, roomCount: 0 },
      ),
    );
  }

  async getOne(actor: AuthenticatedActor, propertyId: string): Promise<PropertyDetailDto> {
    const property = await this.loadAuthorised(actor, propertyId);
    const counts = await this.repository.countsFor([propertyId]);
    return this.toDetail(
      property,
      counts.get(propertyId) ?? { totalBeds: 0, availableBeds: 0, roomCount: 0 },
    );
  }

  async update(
    actor: AuthenticatedActor,
    propertyId: string,
    dto: UpdatePropertyDto,
  ): Promise<PropertyDetailDto> {
    const existing = await this.loadAuthorised(actor, propertyId, PROPERTY_WRITERS);
    await this.assertReferencesExist(dto.localityId, dto.amenityCodes ?? []);

    const updated = await this.repository.update(
      propertyId,
      {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.propertyType !== undefined
          ? { propertyType: dto.propertyType as PropertyType }
          : {}),
        ...(dto.genderPolicy !== undefined
          ? { genderPolicy: dto.genderPolicy as GenderPolicy }
          : {}),
        ...(dto.addressLine1 !== undefined ? { addressLine1: dto.addressLine1 } : {}),
        ...(dto.addressLine2 !== undefined ? { addressLine2: dto.addressLine2 } : {}),
        ...(dto.landmark !== undefined ? { landmark: dto.landmark } : {}),
        ...(dto.localityId !== undefined
          ? { locality: { connect: { id: dto.localityId } } }
          : {}),
        ...(dto.pincode !== undefined ? { pincode: dto.pincode } : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
        ...(dto.contactPhone !== undefined
          ? { contactPhone: normalisePhone(dto.contactPhone) }
          : {}),
        ...(dto.defaultRentCycleDay !== undefined
          ? { defaultRentCycleDay: dto.defaultRentCycleDay }
          : {}),
      },
      dto.amenityCodes,
    );

    const counts = await this.repository.countsFor([existing.id]);
    return this.toDetail(
      updated,
      counts.get(existing.id) ?? { totalBeds: 0, availableBeds: 0, roomCount: 0 },
    );
  }

  /**
   * Soft delete only, and refused outright while anyone is living there.
   * Unlisting is the operation an owner actually wants in that case.
   */
  async remove(actor: AuthenticatedActor, propertyId: string): Promise<void> {
    await this.loadAuthorised(actor, propertyId, [OrgRole.OWNER]);

    const activeTenancies = await this.repository.countActiveTenancies(propertyId);
    if (activeTenancies > 0) {
      throw new ConflictError(
        `This property has ${activeTenancies} tenant(s) living there. Unlist it instead of deleting it.`,
        { activeTenancies },
      );
    }

    await this.repository.softDelete(propertyId);
  }

  /**
   * Loads a property and proves the actor may touch it, in that order — and
   * returns 404 rather than 403 for another organisation's property, so the
   * response does not confirm that the id exists.
   */
  private async loadAuthorised(
    actor: AuthenticatedActor,
    propertyId: string,
    roles: OrgRole[] = [],
  ): Promise<PropertyWithRelations> {
    const property = await this.repository.findById(propertyId);
    if (!property) throw new NotFoundError('Property');

    try {
      this.iam.assertPropertyAccess(actor, property.orgId, property.id, roles);
    } catch (error) {
      if (error instanceof DomainError && error.code === DomainErrorCode.FORBIDDEN) {
        throw new NotFoundError('Property');
      }
      throw error;
    }

    return property;
  }

  private async assertReferencesExist(
    localityId: string | undefined,
    amenityCodes: string[],
  ): Promise<void> {
    if (localityId && !(await this.repository.localityExists(localityId))) {
      throw new NotFoundError('Locality');
    }
    const unknown = await this.repository.unknownAmenityCodes(amenityCodes);
    if (unknown.length > 0) {
      throw new ConflictError(`Unknown amenity codes: ${unknown.join(', ')}`, { unknown });
    }
  }

  private toSummary(
    property: PropertyWithRelations,
    counts: { totalBeds: number; availableBeds: number; roomCount: number },
  ): PropertySummaryDto {
    return {
      id: property.id,
      orgId: property.orgId,
      name: property.name,
      propertyType: property.propertyType,
      genderPolicy: property.genderPolicy,
      localityName: property.locality.name,
      pincode: property.pincode,
      totalBeds: counts.totalBeds,
      availableBeds: counts.availableBeds,
      roomCount: counts.roomCount,
      listingStatus: property.listing?.status ?? 'DRAFT',
      createdAt: property.createdAt.toISOString(),
    };
  }

  private toDetail(
    property: PropertyWithRelations,
    counts: { totalBeds: number; availableBeds: number; roomCount: number },
  ): PropertyDetailDto {
    return {
      ...this.toSummary(property, counts),
      addressLine1: property.addressLine1,
      ...(property.addressLine2 ? { addressLine2: property.addressLine2 } : {}),
      ...(property.landmark ? { landmark: property.landmark } : {}),
      localityId: property.localityId,
      ...(property.latitude ? { latitude: Number(property.latitude) } : {}),
      ...(property.longitude ? { longitude: Number(property.longitude) } : {}),
      ...(property.contactPhone ? { contactPhone: property.contactPhone } : {}),
      ...(property.defaultRentCycleDay !== null
        ? { defaultRentCycleDay: property.defaultRentCycleDay }
        : {}),
      amenityCodes: property.amenities.map((link) => link.amenity.code),
      ...(property.mealPlan
        ? {
            mealPlan: {
              foodType: property.mealPlan.foodType as never,
              breakfast: property.mealPlan.breakfast,
              lunch: property.mealPlan.lunch,
              dinner: property.mealPlan.dinner,
              includedInRent: property.mealPlan.includedInRent,
              ...(property.mealPlan.extraChargePaise !== null
                ? { extraChargePaise: property.mealPlan.extraChargePaise }
                : {}),
              ...(property.mealPlan.notes ? { notes: property.mealPlan.notes } : {}),
            },
          }
        : {}),
      ...(property.rules
        ? {
            rules: {
              ...(property.rules.gateClosingTime
                ? { gateClosingTime: property.rules.gateClosingTime }
                : {}),
              visitorsAllowed: property.rules.visitorsAllowed,
              smokingAllowed: property.rules.smokingAllowed,
              alcoholAllowed: property.rules.alcoholAllowed,
              cookingAllowed: property.rules.cookingAllowed,
              ...(property.rules.notes ? { notes: property.rules.notes } : {}),
            },
          }
        : {}),
    };
  }
}
