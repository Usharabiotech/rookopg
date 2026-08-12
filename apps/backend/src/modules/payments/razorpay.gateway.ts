import { Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  CreateOrderInput,
  GatewayOrder,
  PaymentGateway,
  VerifiedEvent,
} from './gateway.types';

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
}
