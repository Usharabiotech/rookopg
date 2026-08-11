import { Injectable } from '@nestjs/common';
import { OrgRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface MemberRecord {
  membershipId: string;
  userId: string;
  phone: string;
  fullName: string | null;
  userStatus: UserStatus;
  role: OrgRole;
  active: boolean;
  canCreateProperties: boolean;
  propertyIds: string[];
  createdAt: Date;
}

const MEMBER_SELECT = {
  id: true,
  role: true,
  active: true,
  canCreateProperties: true,
  createdAt: true,
  user: { select: { id: true, phone: true, fullName: true, status: true } },
  properties: { select: { propertyId: true } },
} as const;

type RawMember = {
  id: string;
  role: OrgRole;
  active: boolean;
  canCreateProperties: boolean;
  createdAt: Date;
  user: { id: string; phone: string; fullName: string | null; status: UserStatus };
  properties: Array<{ propertyId: string }>;
};

function toRecord(row: RawMember): MemberRecord {
  return {
    membershipId: row.id,
    userId: row.user.id,
    phone: row.user.phone,
    fullName: row.user.fullName,
    userStatus: row.user.status,
    role: row.role,
    active: row.active,
    canCreateProperties: row.canCreateProperties,
    propertyIds: row.properties.map((property) => property.propertyId),
    createdAt: row.createdAt,
  };
}

@Injectable()
export class StaffRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: string): Promise<MemberRecord[]> {
    const rows = await this.prisma.orgMembership.findMany({
      where: { orgId },
      select: MEMBER_SELECT,
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(toRecord);
  }

  async findById(orgId: string, membershipId: string): Promise<MemberRecord | null> {
    const row = await this.prisma.orgMembership.findFirst({
      where: { id: membershipId, orgId },
      select: MEMBER_SELECT,
    });
    return row ? toRecord(row) : null;
  }

  async findByUser(orgId: string, userId: string): Promise<MemberRecord | null> {
    const row = await this.prisma.orgMembership.findFirst({
      where: { orgId, userId },
      select: MEMBER_SELECT,
    });
    return row ? toRecord(row) : null;
  }

  async countActiveOwners(orgId: string): Promise<number> {
    return this.prisma.orgMembership.count({
      where: { orgId, role: OrgRole.OWNER, active: true },
    });
  }

  /** Properties in this org, so a scope cannot be set to someone else's. */
  async ownedPropertyIds(orgId: string, propertyIds: string[]): Promise<string[]> {
    if (propertyIds.length === 0) return [];
    const rows = await this.prisma.property.findMany({
      where: { orgId, deletedAt: null, id: { in: propertyIds } },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  /**
   * Adds a member by phone number.
   *
   * The person may not have an account yet — a PG owner adding their manager
   * knows a phone number, nothing more. An UNCLAIMED user is created, and
   * signing in with that number later claims it rather than making a second
   * person.
   */
  async addMember(input: {
    orgId: string;
    phone: string;
    fullName?: string;
    role: OrgRole;
    canCreateProperties: boolean;
    propertyIds: string[];
  }): Promise<MemberRecord> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { phone: input.phone },
        create: {
          phone: input.phone,
          status: UserStatus.UNCLAIMED,
          ...(input.fullName ? { fullName: input.fullName } : {}),
        },
        // Fill in a name if we did not have one, but never overwrite theirs.
        update: input.fullName ? { fullName: { set: input.fullName } } : {},
        select: { id: true, fullName: true },
      });

      const membership = await tx.orgMembership.upsert({
        where: { orgId_userId: { orgId: input.orgId, userId: user.id } },
        create: {
          orgId: input.orgId,
          userId: user.id,
          role: input.role,
          canCreateProperties: input.canCreateProperties,
        },
        update: {
          role: input.role,
          canCreateProperties: input.canCreateProperties,
          active: true,
        },
        select: { id: true },
      });

      await tx.orgMembershipProperty.deleteMany({ where: { membershipId: membership.id } });
      if (input.propertyIds.length > 0) {
        await tx.orgMembershipProperty.createMany({
          data: input.propertyIds.map((propertyId) => ({
            membershipId: membership.id,
            propertyId,
          })),
        });
      }

      const row = await tx.orgMembership.findUniqueOrThrow({
        where: { id: membership.id },
        select: MEMBER_SELECT,
      });
      return toRecord(row);
    });
  }

  async updateMember(
    membershipId: string,
    data: { role?: OrgRole; canCreateProperties?: boolean },
    propertyIds?: string[],
  ): Promise<MemberRecord> {
    return this.prisma.$transaction(async (tx) => {
      await tx.orgMembership.update({ where: { id: membershipId }, data });

      if (propertyIds) {
        await tx.orgMembershipProperty.deleteMany({ where: { membershipId } });
        if (propertyIds.length > 0) {
          await tx.orgMembershipProperty.createMany({
            data: propertyIds.map((propertyId) => ({ membershipId, propertyId })),
          });
        }
      }

      const row = await tx.orgMembership.findUniqueOrThrow({
        where: { id: membershipId },
        select: MEMBER_SELECT,
      });
      return toRecord(row);
    });
  }

  /**
   * Deactivate rather than delete, and drop their sessions in the same
   * transaction so access ends now rather than when their token expires.
   */
  async deactivate(membershipId: string, userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.orgMembership.update({
        where: { id: membershipId },
        data: { active: false },
      }),
      this.prisma.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }
}
