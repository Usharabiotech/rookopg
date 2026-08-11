import type { OrgRole, PlatformRole } from '@prisma/client';

export interface ActorMembership {
  orgId: string;
  role: OrgRole;
  /** Empty means the member is scoped to every property in the organisation. */
  propertyIds: string[];
}

/**
 * Resolved per request from the database, never read out of the JWT.
 *
 * Roles in the token would go stale: removing a manager would not take effect
 * until their access token expired. Here, revocation is immediate.
 */
export interface AuthenticatedActor {
  userId: string;
  sessionId: string;
  phone: string;
  memberships: ActorMembership[];
  platformRoles: PlatformRole[];
}

export interface AccessTokenPayload {
  /** User id. */
  sub: string;
  /** Session id, so a single session can be revoked. */
  sid: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresInSeconds: number;
  refreshExpiresAt: Date;
}
