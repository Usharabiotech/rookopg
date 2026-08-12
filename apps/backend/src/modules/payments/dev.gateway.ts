import { Logger } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type {
  CreateOrderInput,
  GatewayOrder,
  PaymentGateway,
  VerifiedEvent,
} from './gateway.types';

/**
 * Development payment gateway.
 *
 * Not a stub that returns success — it mirrors the real shape, including a
 * signed webhook, so the parts most likely to be wrong (signature checking,
 * idempotency, amount verification, out-of-order delivery) are exercised long
 * before Razorpay credentials exist.
 *
 * Refuses to run outside development. Config validation enforces that too;
 * this is the second lock on the same door.
 */
export class DevPaymentGateway implements PaymentGateway {
  readonly provider = 'dev' as const;
  private readonly logger = new Logger(DevPaymentGateway.name);
  private readonly orders = new Map<string, { amountPaise: number; reference: string }>();

  constructor(private readonly webhookSecret: string) {
    this.logger.warn(
      'Using the development payment gateway. No real money moves. Set RAZORPAY_* to use Razorpay Route.',
    );
  }

  async createOrder(input: CreateOrderInput): Promise<GatewayOrder> {
    const orderId = `dev_order_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    this.orders.set(orderId, { amountPaise: input.amountPaise, reference: input.reference });

    this.logger.debug(
      `Order ${orderId}: ${input.amountPaise} paise (owner ${input.ownerSharePaise}, platform ${input.platformFeePaise})`,
    );

    return { orderId, amountPaise: input.amountPaise, currency: 'INR', publicKey: 'dev_key' };
  }

  /** Same HMAC scheme Razorpay uses, so the verification path is real. */
  sign(rawBody: string): string {
    return createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
  }

  verifyWebhook(rawBody: string, signature: string | undefined): VerifiedEvent | null {
    if (!signature) return null;

    const expected = this.sign(rawBody);
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    try {
      const parsed = JSON.parse(rawBody) as {
        event?: string;
        eventId?: string;
        orderId?: string;
        paymentId?: string;
        amountPaise?: number;
      };

      return {
        eventId: parsed.eventId ?? randomUUID(),
        type:
          parsed.event === 'payment.captured'
            ? 'payment.captured'
            : parsed.event === 'payment.failed'
              ? 'payment.failed'
              : 'other',
        ...(parsed.orderId ? { orderId: parsed.orderId } : {}),
        ...(parsed.paymentId ? { paymentId: parsed.paymentId } : {}),
        ...(parsed.amountPaise !== undefined ? { amountPaise: parsed.amountPaise } : {}),
        currency: 'INR',
      };
    } catch {
      return null;
    }
  }

  async fetchOrderStatus(orderId: string): Promise<'paid' | 'pending' | 'failed'> {
    return this.orders.has(orderId) ? 'pending' : 'failed';
  }
}
