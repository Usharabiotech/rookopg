import { OrgRole, PlatformRole } from '@prisma/client';
import { ForbiddenError } from '../../common/errors/domain.error';
import { IamService } from './iam.service';
import type { ActorMembership, AuthenticatedActor } from '../auth/auth.types';

const ORG_A = 'org-a';
const ORG_B = 'org-b';
const PROP_1 = 'prop-1';
const PROP_2 = 'prop-2';

function membership(overrides: Partial<ActorMembership> = {}): ActorMembership {
  return {
    orgId: ORG_A,
    role: OrgRole.MANAGER,
    propertyIds: [],
    canCreateProperties: false,
    ...overrides,
  };
}

function actor(overrides: Partial<AuthenticatedActor> = {}): AuthenticatedActor {
  return {
    userId: 'user-1',
    sessionId: 'session-1',
    phone: '+919876543210',
    memberships: [],
    platformRoles: [],
    ...overrides,
  };
}

describe('IamService authorisation', () => {
  // No Prisma needed: these are pure decisions over the resolved actor.
  const iam = new IamService(null as never);

  describe('cross-organisation isolation', () => {
    const ownerOfA = actor({
      memberships: [membership({ role: OrgRole.OWNER })],
    });

    it('allows an owner into their own organisation', () => {
      expect(() => iam.assertOrgAccess(ownerOfA, ORG_A)).not.toThrow();
    });

    it("refuses an owner access to another organisation", () => {
      expect(() => iam.assertOrgAccess(ownerOfA, ORG_B)).toThrow(ForbiddenError);
    });

    it('refuses a user with no memberships at all', () => {
      expect(() => iam.assertOrgAccess(actor(), ORG_A)).toThrow(ForbiddenError);
    });
  });

  describe('role requirements', () => {
    const manager = actor({
      memberships: [membership()],
    });

    it('lets a manager through where a manager is allowed', () => {
      expect(() => iam.assertOrgAccess(manager, ORG_A, [OrgRole.OWNER, OrgRole.MANAGER])).not.toThrow();
    });

    it('blocks a manager from owner-only actions', () => {
      expect(() => iam.assertOrgAccess(manager, ORG_A, [OrgRole.OWNER])).toThrow(ForbiddenError);
    });
  });

  describe('property scoping', () => {
    const scopedManager = actor({
      memberships: [membership({ propertyIds: [PROP_1] })],
    });
    const unscopedManager = actor({
      memberships: [membership()],
    });
    const owner = actor({
      memberships: [membership({ role: OrgRole.OWNER })],
    });

    it('allows a scoped manager into their property', () => {
      expect(() => iam.assertPropertyAccess(scopedManager, ORG_A, PROP_1)).not.toThrow();
    });

    it('blocks a scoped manager from a property they do not run', () => {
      expect(() => iam.assertPropertyAccess(scopedManager, ORG_A, PROP_2)).toThrow(ForbiddenError);
    });

    it('treats an empty scope as every property', () => {
      expect(() => iam.assertPropertyAccess(unscopedManager, ORG_A, PROP_2)).not.toThrow();
    });

    it('never scopes an owner', () => {
      expect(() => iam.assertPropertyAccess(owner, ORG_A, PROP_2)).not.toThrow();
    });

    it('returns the scope as a query filter for a scoped manager', () => {
      expect(iam.visiblePropertyIds(scopedManager, ORG_A)).toEqual([PROP_1]);
    });

    it('returns null (no filter) for an owner', () => {
      expect(iam.visiblePropertyIds(owner, ORG_A)).toBeNull();
    });

    it('throws rather than returning an empty filter for an outsider', () => {
      expect(() => iam.visiblePropertyIds(actor(), ORG_A)).toThrow(ForbiddenError);
    });
  });

  describe('permission to add a property', () => {
    const owner = actor({ memberships: [membership({ role: OrgRole.OWNER })] });
    const plainManager = actor({ memberships: [membership()] });
    const trustedManager = actor({ memberships: [membership({ canCreateProperties: true })] });

    it('always allows an owner, without needing the flag', () => {
      expect(() => iam.assertCanCreateProperty(owner, ORG_A)).not.toThrow();
    });

    it('refuses a manager by default', () => {
      expect(() => iam.assertCanCreateProperty(plainManager, ORG_A)).toThrow(ForbiddenError);
    });

    it('allows a manager the owner has granted it', () => {
      expect(() => iam.assertCanCreateProperty(trustedManager, ORG_A)).not.toThrow();
    });

    it('does not let the grant leak into another organisation', () => {
      expect(() => iam.assertCanCreateProperty(trustedManager, ORG_B)).toThrow(ForbiddenError);
    });

    it('refuses an outsider', () => {
      expect(() => iam.assertCanCreateProperty(actor(), ORG_A)).toThrow(ForbiddenError);
    });

    it('tells the manager what to do about it', () => {
      expect(() => iam.assertCanCreateProperty(plainManager, ORG_A)).toThrow(
        /ask the owner to enable it/i,
      );
    });
  });

  describe('platform staff', () => {
    const support = actor({ platformRoles: [PlatformRole.SUPPORT] });
    const superAdmin = actor({ platformRoles: [PlatformRole.SUPER_ADMIN] });

    it('may read any organisation, for support work', () => {
      expect(() => iam.assertOrgAccess(support, ORG_B)).not.toThrow();
      expect(() => iam.assertPropertyAccess(support, ORG_B, PROP_2)).not.toThrow();
    });

    // Cross-organisation read access must not quietly promote a support agent
    // into an owner. Deleting a PG is owner-only.
    it('does NOT satisfy an owner-only operation', () => {
      expect(() => iam.assertOrgAccess(support, ORG_B, [OrgRole.OWNER])).toThrow(ForbiddenError);
      expect(() => iam.assertPropertyAccess(support, ORG_B, PROP_2, [OrgRole.OWNER])).toThrow(
        ForbiddenError,
      );
    });

    it('does not satisfy a manager-level operation either', () => {
      expect(() =>
        iam.assertOrgAccess(support, ORG_B, [OrgRole.OWNER, OrgRole.MANAGER]),
      ).toThrow(ForbiddenError);
    });

    it('allows SUPER_ADMIN through role-restricted operations', () => {
      expect(() => iam.assertOrgAccess(superAdmin, ORG_B, [OrgRole.OWNER])).not.toThrow();
    });
  });
});
