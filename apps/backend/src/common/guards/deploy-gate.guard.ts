import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import type { AppConfig } from '../../config/env.config';

export const DEPLOY_GATE_HEADER = 'x-deploy-gate';

/**
 * Shuts a non-production deployment to everyone without the shared token.
 *
 * A test deployment has to run outside production mode, because in production
 * the login code is not returned in the response and nothing sends it yet — so
 * nobody could sign in at all, including us. Outside production the code *is*
 * returned, which means anyone who finds this URL can sign in as any phone
 * number they like, and the development payment gateway will confirm their
 * booking without taking money.
 *
 * So the whole API sits behind one shared token until Razorpay and WhatsApp
 * are live. Set DEPLOY_GATE_TOKEN to switch it on; leave it unset and this
 * guard does nothing, which is what local development wants.
 *
 * Answers 404 rather than 401. A 401 confirms there is something here worth
 * getting into, and this is exactly the deployment least able to withstand
 * somebody deciding it is worth the effort.
 */
@Injectable()
export class DeployGateGuard implements CanActivate {
  private readonly token: string;

  constructor(config: ConfigService<AppConfig, true>) {
    this.token = config.get('DEPLOY_GATE_TOKEN', { infer: true }) ?? '';
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.token) return true;

    const request = context.switchToHttp().getRequest<Request>();

    // The health check has to answer before the platform will route traffic,
    // and it reveals nothing but that a server is running.
    if (request.path.endsWith('/health')) return true;

    const presented = request.header(DEPLOY_GATE_HEADER) ?? '';
    if (!this.matches(presented)) throw new NotFoundException();
    return true;
  }

  /** Constant time, so the token cannot be recovered a character at a time. */
  private matches(presented: string): boolean {
    const a = Buffer.from(presented, 'utf8');
    const b = Buffer.from(this.token, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
