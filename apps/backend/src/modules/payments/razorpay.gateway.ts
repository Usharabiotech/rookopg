import { Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  CreateOrderInput,
  GatewayOrder,
  PaymentGateway,
  RefundInput,
  RefundOutcome,
  ReleaseOutcome,
  SettleInput,
  VerifiedEvent,
} from './gateway.types';

interface RouteTransfer {
  id: string;
  amount: number;
  on_hold: boolean;
  amount_reversed?: number;
}

const RAZORPAY_API = 'https://api.razorpay.com/v1';

export interface RazorpayOptions {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  /** Commission in basis points. 400 = 4%. */
  commissionBps: number;
}

/**
 * Razorpay Route.
 *
 * The tenant pays once and Razorpay splits at source: the owner's share
 * settles to their linked account, our fee to ours. The platform never holds
 * funds, which is what keeps this outside RBI payment-aggregator licensing
 * (docs/02 Part 0).
 *
 * Transfers are created with on_hold set, and released when the tenant checks
 * in — so a refund before move-in costs nothing to unwind, and the owner has
 * a reason to record check-ins accurately.
 *
 * NOT YET EXERCISED AGAINST A REAL ACCOUNT. The development gateway is the
 * one that has been run end to end. This path gets verified when credentials
 * exist; until then treat it as unproven.
 *
 * The settlement calls below are the least proven part of it. Route's exact
 * request shapes for releasing a hold and reversing a transfer are written
 * from the documented API, not from a response we have seen, and the maximum
 * period Razorpay will hold a transfer still needs confirming with them — if
 * it is shorter than the gap between booking and move-in, the auto-release
 * backstop has to run before their deadline rather than ours.
 */
export class RazorpayGateway implements PaymentGateway {
  readonly provider = 'razorpay' as const;
  private readonly logger = new Logger(RazorpayGateway.name);
  private readonly authHeader: string;

  constructor(private readonly options: RazorpayOptions) {
    this.authHeader = `Basic ${Buffer.from(`${options.keyId}:${options.keySecret}`).toString('base64')}`;
  }

  async createOrder(input: CreateOrderInput): Promise<GatewayOrder> {
    const body: Record<string, unknown> = {
      amount: input.amountPaise,
      currency: 'INR',
      receipt: input.reference,
      notes: { bookingId: input.reference, ...input.notes },
    };

    // Split at source. Without a linked account the money would land with us,
    // which is precisely the arrangement we are avoiding — so refuse rather
    // than quietly take custody of an owner's rent.
    if (input.ownerAccountId) {
      body['transfers'] = [
        {
          account: input.ownerAccountId,
          amount: input.ownerSharePaise,
          currency: 'INR',
          // Released at check-in, not at payment.
          on_hold: true,
          notes: { bookingId: input.reference },
        },
      ];
    } else {
      throw new Error(
        'Owner has no Razorpay linked account; refusing to collect money the platform would have to hold.',
      );
    }

    const response = await fetch(`${RAZORPAY_API}/orders`, {
      method: 'POST',
      headers: { Authorization: this.authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text();
      this.logger.error(`Razorpay order failed (${response.status}): ${detail.slice(0, 300)}`);
      throw new Error('Could not start the payment. Try again.');
    }

    const order = (await response.json()) as { id: string; amount: number; currency: string };
    return {
      orderId: order.id,
      amountPaise: order.amount,
      currency: order.currency,
      // The key id is public by design; the secret never leaves the server.
      publicKey: this.options.keyId,
    };
  }

  verifyWebhook(rawBody: string, signature: string | undefined): VerifiedEvent | null {
    if (!signature) return null;

    const expected = createHmac('sha256', this.options.webhookSecret).update(rawBody).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    try {
      const parsed = JSON.parse(rawBody) as {
        event?: string;
        payload?: {
          payment?: {
            entity?: { id?: string; order_id?: string; amount?: number; currency?: string };
          };
        };
      };

      const payment = parsed.payload?.payment?.entity;
      return {
        // Razorpay sends x-razorpay-event-id; the payment id is a stable
        // fallback for a captured event.
        eventId: `${parsed.event}:${payment?.id ?? ''}`,
        type:
          parsed.event === 'payment.captured'
            ? 'payment.captured'
            : parsed.event === 'payment.failed'
              ? 'payment.failed'
              : 'other',
        ...(payment?.order_id ? { orderId: payment.order_id } : {}),
        ...(payment?.id ? { paymentId: payment.id } : {}),
        ...(payment?.amount !== undefined ? { amountPaise: payment.amount } : {}),
        ...(payment?.currency ? { currency: payment.currency } : {}),
      };
    } catch {
      return null;
    }
  }

  async fetchOrderStatus(orderId: string): Promise<'paid' | 'pending' | 'failed'> {
    const response = await fetch(`${RAZORPAY_API}/orders/${orderId}`, {
      headers: { Authorization: this.authHeader },
    });
    if (!response.ok) return 'failed';

    const order = (await response.json()) as { status?: string };
    if (order.status === 'paid') return 'paid';
    return order.status === 'attempted' || order.status === 'created' ? 'pending' : 'failed';
  }

  // -- Settlement --------------------------------------------------------------

  private async call<T>(path: string, init?: RequestInit & { body?: string }): Promise<T> {
    const response = await fetch(`${RAZORPAY_API}${path}`, {
      ...init,
      headers: { Authorization: this.authHeader, 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const detail = await response.text();
      this.logger.error(`Razorpay ${path} failed (${response.status}): ${detail.slice(0, 300)}`);
      // Deliberately not swallowed. A failed settlement must leave the booking
      // unsettled so the scheduler tries again, never silently marked done.
      throw new Error(`Razorpay call failed: ${path}`);
    }
    return (await response.json()) as T;
  }

  private async heldTransfers(paymentId: string): Promise<RouteTransfer[]> {
    const result = await this.call<{ items?: RouteTransfer[] }>(
      `/payments/${paymentId}/transfers`,
    );
    return (result.items ?? []).filter((transfer) => transfer.on_hold);
  }

  async releaseOwnerShare(input: SettleInput): Promise<ReleaseOutcome> {
    const held = await this.heldTransfers(input.paymentId);
    if (held.length === 0) {
      // Already off hold, so a retry rather than a problem.
      return { releasedTransferIds: [], releasedPaise: 0, alreadySettled: true };
    }

    const released: string[] = [];
    let releasedPaise = 0;
    for (const transfer of held) {
      await this.call(`/transfers/${transfer.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ on_hold: false }),
      });
      released.push(transfer.id);
      releasedPaise += transfer.amount - (transfer.amount_reversed ?? 0);
    }

    this.logger.log(`Released ${releasedPaise} paise for payment ${input.paymentId}`);
    return { releasedTransferIds: released, releasedPaise, alreadySettled: false };
  }

  async refundToTenant(input: RefundInput): Promise<RefundOutcome> {
    // Idempotency by lookup rather than by header: our key travels in notes,
    // so a retry can recognise its own earlier refund. Doing this with a
    // gateway header would mean trusting a behaviour we have not verified.
    const existing = await this.call<{ items?: { id: string; amount: number; notes?: Record<string, string> }[] }>(
      `/payments/${input.paymentId}/refunds`,
    );
    const mine = (existing.items ?? []).find(
      (refund) => refund.notes?.['idempotencyKey'] === input.idempotencyKey,
    );
    if (mine) {
      return {
        refundId: mine.id,
        refundedPaise: mine.amount,
        releasedPaise: 0,
        alreadySettled: true,
      };
    }

    // Reverse before refunding. Money already sitting with the owner cannot be
    // refunded to the tenant, so the reversal has to pull it back first.
    const held = await this.heldTransfers(input.paymentId);
    if (input.refundToTenantPaise > 0) {
      let toReverse = input.refundToTenantPaise;
      for (const transfer of held) {
        if (toReverse <= 0) break;
        const available = transfer.amount - (transfer.amount_reversed ?? 0);
        const amount = Math.min(available, toReverse);
        if (amount <= 0) continue;
        await this.call(`/transfers/${transfer.id}/reversals`, {
          method: 'POST',
          body: JSON.stringify({ amount }),
        });
        toReverse -= amount;
      }
      if (toReverse > 0) {
        throw new Error(
          `Could not reverse enough to refund ${input.refundToTenantPaise} paise for ${input.paymentId}`,
        );
      }
    }

    const refund = await this.call<{ id: string; amount: number }>(
      `/payments/${input.paymentId}/refund`,
      {
        method: 'POST',
        body: JSON.stringify({
          amount: input.refundToTenantPaise,
          speed: 'normal',
          notes: {
            idempotencyKey: input.idempotencyKey,
            ...(input.reason ? { reason: input.reason } : {}),
          },
        }),
      },
    );

    // Whatever the owner keeps stops being held once the split is settled.
    let releasedPaise = 0;
    if (input.releaseToOwnerPaise > 0) {
      const outcome = await this.releaseOwnerShare(input);
      releasedPaise = outcome.releasedPaise;
    }

    this.logger.log(
      `Refunded ${refund.amount} paise to the tenant for ${input.paymentId}, released ${releasedPaise}`,
    );
    return {
      refundId: refund.id,
      refundedPaise: refund.amount,
      releasedPaise,
      alreadySettled: false,
    };
  }
}
