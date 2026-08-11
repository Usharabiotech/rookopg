import { Injectable } from '@nestjs/common';
import { OrgRole, type OrgStatus, type VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface OrganisationRecord {
  id: string;
  name: string;
  legalName: string | null;
  status: OrgStatus;
  verificationStatus: VerificationStatus;
  freePeriodMonths: number;
  freePeriodStartsAt: Date | null;
  createdAt: Date;
  propertyCount: number;
}

const ORG_SELECT = {
  id: true,
  name: true,
  legalName: true,
  status: true,
  verificationStatus: true,
  freePeriodMonths: true,
  freePeriodStartsAt: true,
  createdAt: true,
  _count: { select: { properties: { where: { deletedAt: null } } } },
} as const;

type RawOrg = {
  id: string;
  name: string;
  legalName: string | null;
  status: OrgStatus;
  verificationStatus: VerificationStatus;
  freePeriodMonths: number;
  freePeriodStartsAt: Date | null;
  createdAt: Date;
  _count: { properties: number };
};

function toRecord(row: RawOrg): OrganisationRecord {
  const { _count, ...rest } = row;
  return { ...rest, propertyCount: _count.properties };
}

@Injectable()
export class OrganisationRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creating an organisation and making the creator its owner must be one
   * atomic act. A half-created organisation with no owner is unreachable and
   * would need manual repair.
   */
  async createWithOwner(input: {
    name: string;
    legalName?: string;
    ownerUserId: string;
  }): Promise<OrganisationRecord> {
    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organisation.create({
        data: {
          name: input.name,
          ...(input.legalName ? { legalName: input.legalName } : {}),
          memberships: {
            create: { userId: input.ownerUserId, role: OrgRole.OWNER },
          },
        },
        select: ORG_SELECT,
      });
      return toRecord(org);
    });
  }

  async findById(orgId: string): Promise<OrganisationRecord | null> {
    const row = await this.prisma.organisation.findFirst({
      where: { id: orgId, deletedAt: null },
      select: ORG_SELECT,
    });
    return row ? toRecord(row) : null;
  }

  async listForUser(userId: string): Promise<OrganisationRecord[]> {
    const rows = await this.prisma.organisation.findMany({
      where: {
        deletedAt: null,
        memberships: { some: { userId, active: true } },
      },
      select: ORG_SELECT,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toRecord);
  }

  async update(
    orgId: string,
    data: { name?: string; legalName?: string },
  ): Promise<OrganisationRecord> {
    const row = await this.prisma.organisation.update({
      where: { id: orgId },
      data,
      select: ORG_SELECT,
    });
    return toRecord(row);
  }

  async nameExistsForUser(userId: string, name: string): Promise<boolean> {
    const existing = await this.prisma.organisation.findFirst({
      where: {
        deletedAt: null,
        name: { equals: name, mode: 'insensitive' },
        memberships: { some: { userId, active: true } },
      },
      select: { id: true },
    });
    return existing !== null;
  }
}
