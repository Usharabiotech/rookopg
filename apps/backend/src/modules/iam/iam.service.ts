import { Injectable } from '@nestjs/common';
import { OrgRole, PlatformRole, UserStatus } from '@prisma/client';
import { ForbiddenError } from '../../common/errors/domain.error';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { ActorMembership, AuthenticatedActor } from '../auth/auth.types';

export interface MembershipWithOrgName extends ActorMembership {
  orgName: string;
}

/**
 * Identity and access resolution.
 *
 * Authorisation in this product has one dominant failure mode: one PG owner
 * seeing another's tenants. Everything here exists to make that a query
 * condition rather than an afterthought.
 */
@Injectable()
export class IamService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserForAuth(
    userId: string,
  ): Promise<{ id: string; phone: string; fullName: string | null; status: UserStatus } | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, fullName: true, status: true },
    });
  }

  async listMemberships(userId: string): Promise<ActorMembership[]> {
    const rows = await this.prisma.orgMembership.findMany({
      where: { userId, active: true, organisation: { deletedAt: null } },
      select: {
        orgId: true,
        role: true,
        properties: { select: { propertyId: true } },
      },
    });

    return rows.map((row) => ({
      orgId: row.orgId,
      role: row.role,
      propertyIds: row.properties.map((property) => property.propertyId),
    }));
  }

  async listMembershipsWithOrgNames(userId: string): Promise<MembershipWithOrgName[]> {
    const rows = await this.prisma.orgMembership.findMany({
      where: { userId, active: true, organisation: { deletedAt: null } },
      select: {
        orgId: true,
        role: true,
        organisation: { select: { name: true } },
        properties: { select: { propertyId: true } },
      },
    });

    return rows.map((row) => ({
      orgId: row.orgId,
      role: row.role,
      orgName: row.organisation.name,
      propertyIds: row.properties.map((property) => property.propertyId),
    }));
  }

  async listPlatformRoles(userId: string): Promise<PlatformRole[]> {
    const rows = await this.prisma.platformMembership.findMany({
      where: { userId, active: true },
      select: { role: true },
    });
    return rows.map((row) => row.role);
  }

  // --------------------------------------------------------------------------
  // Scope checks. Services call these before touching organisation data.
  // --------------------------------------------------------------------------

  findMembership(actor: AuthenticatedActor, orgId: string): ActorMembership | undefined {
    return actor.memberships.find((membership) => membership.orgId === orgId);
  }

  isPlatformStaff(actor: AuthenticatedActor): boolean {
    return actor.platformRoles.length > 0;
  }

  /** Throws unless the actor belongs to the organisation with a sufficient role. */
  assertOrgAccess(actor: AuthenticatedActor, orgId: string, allowed: OrgRole[] = []): void {
    if (this.isPlatformStaff(actor)) return;

    const membership = this.findMembership(actor, orgId);
    if (!membership) {
      throw new ForbiddenError();
    }
    if (allowed.length > 0 && !allowed.includes(membership.role)) {
      throw new ForbiddenError();
    }
  }

  /**
   * Managers can be scoped to specific properties. An empty scope means every
   * property in the organisation; owners are never scoped.
   */
  assertPropertyAccess(
    actor: AuthenticatedActor,
    orgId: string,
    propertyId: string,
    allowed: OrgRole[] = [],
  ): void {
    if (this.isPlatformStaff(actor)) return;

    this.assertOrgAccess(actor, orgId, allowed);

    const membership = this.findMembership(actor, orgId);
    if (!membership) throw new ForbiddenError();
    if (membership.role === OrgRole.OWNER) return;
    if (membership.propertyIds.length === 0) return;
    if (!membership.propertyIds.includes(propertyId)) {
      throw new ForbiddenError();
    }
  }

  /**
   * The property ids a manager may see, or null for "all in the organisation".
   * Callers fold this straight into a WHERE clause so unauthorised rows are
   * never loaded in the first place.
   */
  visiblePropertyIds(actor: AuthenticatedActor, orgId: string): string[] | null {
    if (this.isPlatformStaff(actor)) return null;
    const membership = this.findMembership(actor, orgId);
    if (!membership) throw new ForbiddenError();
    if (membership.role === OrgRole.OWNER) return null;
    return membership.propertyIds.length > 0 ? membership.propertyIds : null;
  }
}
