import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { OrgRole } from '@prisma/client';
import type { AuthenticatedActor } from '../../modules/auth/auth.types';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const ORG_ROLES_KEY = 'auth:orgRoles';

/** Opt a route out of authentication. Everything is protected by default. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Route-level role gate. Necessary but never sufficient — the service must
 * still verify the actor owns the specific object being touched.
 */
export const OrgRoles = (...roles: OrgRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ORG_ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedActor => {
    const request = ctx.switchToHttp().getRequest<{ actor?: AuthenticatedActor }>();
    if (!request.actor) {
      throw new Error('CurrentUser used on a route without JwtAuthGuard');
    }
    return request.actor;
  },
);
