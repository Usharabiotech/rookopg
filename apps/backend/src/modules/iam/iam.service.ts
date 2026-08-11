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
        canCreateProperties: true,
        properties: { select: { propertyId: true } },
      },
    });

    return rows.map((row) => ({
      orgId: row.orgId,
      role: row.role,
      canCreateProperties: row.canCreateProperties,
      propertyIds: row.properties.map((property) => property.propertyId),
    }));
  }

  async listMembershipsWithOrgNames(userId: string): Promise<MembershipWithOrgName[]> {
    const rows = await this.prisma.orgMembership.findMany({
      where: { userId, active: true, organisation: { deletedAt: null } },
      select: {
        orgId: true,
        role: true,
        canCreateProperties: true,
        organisation: { select: { name: true } },
        properties: { select: { propertyId: true } },
      },
    });

    return rows.map((row) => ({
      orgId: row.orgId,
      role: row.role,
      canCreateProperties: row.canCreateProperties,
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

  /**
   * Platform staff can read across organisations for support work, but that
   * must not silently promote them into owner-level authority.
   *
   * A SUPPORT agent helping a tenant should never be able to delete a PG.
   * Only SUPER_ADMIN satisfies a role-restricted operation, and that path is
   * meant to be rare and audited.
   */
  private platformStaffMayAct(actor: AuthenticatedActor, roleRestricted: boolean): boolean {
    if (!this.isPlatformStaff(actor)) return false;
    if (!roleRestricted) return true;
    return actor.platformRoles.includes(PlatformRole.SUPER_ADMIN);
  }

  /** Throws unless the actor belongs to the organisation with a sufficient role. */
  assertOrgAccess(actor: AuthenticatedActor, orgId: string, allowed: OrgRole[] = []): void {
    if (this.platformStaffMayAct(actor, allowed.length > 0)) return;

    const membership = this.findMembership(actor, orgId);
    if (!membership) {
      throw new ForbiddenError();
    }
    if (allowed.length > 0 && !allowed.includes(membership.role)) {
      throw new ForbiddenError();
    }
  }

  /**
   * Adding a building to the business is an owner's decision, so a manager
   * needs it granted explicitly.
   *
   * Without this, a property-scoped manager could create a property and then
   * immediately lose sight of it, because the new property is not in their
   * scope — confusing, and not something they should be doing unasked.
   */
  assertCanCreateProperty(actor: AuthenticatedActor, orgId: string): void {
    if (this.platformStaffMayAct(actor, true)) return;

    const membership = this.findMembership(actor, orgId);
    if (!membership) throw new ForbiddenError();
    if (membership.role === OrgRole.OWNER) return;
    if (!membership.canCreateProperties) {
      throw new ForbiddenError(
        'Your account cannot add properties. Ask the owner to enable it for you.',
      );
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
    if (this.platformStaffMayAct(actor, allowed.length > 0)) return;

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
