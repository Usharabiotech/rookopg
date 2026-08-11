import { Injectable } from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { ConflictError, NotFoundError } from '../../common/errors/domain.error';
import { IamService } from '../iam/iam.service';
import type { AuthenticatedActor } from '../auth/auth.types';
import { OrganisationRepository, type OrganisationRecord } from './organisation.repository';
import type { CreateOrganisationDto, OrganisationDto, UpdateOrganisationDto } from './dto/organisation.dto';

@Injectable()
export class OrganisationService {
  constructor(
    private readonly repository: OrganisationRepository,
    private readonly iam: IamService,
  ) {}

  async create(actor: AuthenticatedActor, dto: CreateOrganisationDto): Promise<OrganisationDto> {
    // A field rep signing the same PG twice in one afternoon is a real
    // scenario. Catch it rather than creating a duplicate business.
    if (await this.repository.nameExistsForUser(actor.userId, dto.name)) {
      throw new ConflictError(`You already have an organisation named "${dto.name}"`);
    }

    const org = await this.repository.createWithOwner({
      name: dto.name,
      ...(dto.legalName ? { legalName: dto.legalName } : {}),
      ownerUserId: actor.userId,
    });

    return this.toDto(org, OrgRole.OWNER);
  }

  async listMine(actor: AuthenticatedActor): Promise<OrganisationDto[]> {
    const orgs = await this.repository.listForUser(actor.userId);
    return orgs.map((org) => {
      const membership = this.iam.findMembership(actor, org.id);
      return this.toDto(org, membership?.role ?? OrgRole.MANAGER);
    });
  }

  async getOne(actor: AuthenticatedActor, orgId: string): Promise<OrganisationDto> {
    this.iam.assertOrgAccess(actor, orgId);

    const org = await this.repository.findById(orgId);
    if (!org) throw new NotFoundError('Organisation');

    const membership = this.iam.findMembership(actor, orgId);
    return this.toDto(org, membership?.role ?? OrgRole.MANAGER);
  }

  /** Only an owner may rename the business. */
  async update(
    actor: AuthenticatedActor,
    orgId: string,
    dto: UpdateOrganisationDto,
  ): Promise<OrganisationDto> {
    this.iam.assertOrgAccess(actor, orgId, [OrgRole.OWNER]);

    const existing = await this.repository.findById(orgId);
    if (!existing) throw new NotFoundError('Organisation');

    const updated = await this.repository.update(orgId, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.legalName !== undefined ? { legalName: dto.legalName } : {}),
    });

    return this.toDto(updated, OrgRole.OWNER);
  }

  private toDto(org: OrganisationRecord, myRole: OrgRole): OrganisationDto {
    return {
      id: org.id,
      name: org.name,
      ...(org.legalName ? { legalName: org.legalName } : {}),
      status: org.status,
      verificationStatus: org.verificationStatus,
      freePeriodMonths: org.freePeriodMonths,
      ...(org.freePeriodStartsAt
        ? { freePeriodStartsAt: org.freePeriodStartsAt.toISOString() }
        : {}),
      myRole,
      propertyCount: org.propertyCount,
      createdAt: org.createdAt.toISOString(),
    };
  }
}
