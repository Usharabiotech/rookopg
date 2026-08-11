import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../../common/decorators/auth.decorators';
import { DomainErrorCode, UnauthorisedError } from '../../../common/errors/domain.error';
import { IamService } from '../../iam/iam.service';
import { AuthRepository } from '../auth.repository';
import { TokenService } from '../token.service';
import type { AuthenticatedActor } from '../auth.types';

/**
 * Authenticates every request unless the route is explicitly @Public().
 *
 * Memberships are resolved from the database on each request rather than read
 * out of the token, so removing a staff member ends their access immediately
 * instead of when their access token happens to expire.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly repository: AuthRepository,
    private readonly iam: IamService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { actor?: AuthenticatedActor }>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorisedError(
        DomainErrorCode.AUTHENTICATION_REQUIRED,
        'Authentication required',
      );
    }

    let payload;
    try {
      payload = await this.tokens.verifyAccessToken(token);
    } catch {
      throw new UnauthorisedError(DomainErrorCode.ACCESS_TOKEN_INVALID, 'Session expired');
    }

    // A revoked session must stop working at once, even if the access token
    // has not yet expired.
    const live = await this.repository.isSessionLive(payload.sid);
    if (!live) {
      throw new UnauthorisedError(DomainErrorCode.ACCESS_TOKEN_INVALID, 'Session ended');
    }

    const user = await this.iam.getUserForAuth(payload.sub);
    if (!user || user.status === 'SUSPENDED') {
      throw new UnauthorisedError(DomainErrorCode.ACCOUNT_SUSPENDED, 'This account is suspended');
    }

    const [memberships, platformRoles] = await Promise.all([
      this.iam.listMemberships(user.id),
      this.iam.listPlatformRoles(user.id),
    ]);

    request.actor = {
      userId: user.id,
      sessionId: payload.sid,
      phone: user.phone,
      memberships,
      platformRoles,
    };

    return true;
  }

  private extractBearerToken(request: Request): string | undefined {
    const header = request.header('authorization');
    if (!header) return undefined;
    const [scheme, value] = header.split(' ');
    if (!scheme || scheme.toLowerCase() !== 'bearer' || !value) return undefined;
    return value.trim();
  }
}
