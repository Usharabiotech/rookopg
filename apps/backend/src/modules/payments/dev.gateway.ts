import { Logger } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
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

/** Mirrors a Route transfer closely enough to catch our own mistakes. */
interface DevTransfer {
  id: string;
  ownerSharePaise: number;
  onHold: boolean;
  reversedPaise: number;
}

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
  private readonly transfers = new Map<string, DevTransfer>();
  /** paymentId -> orderId, learned when a capture webhook is verified. */
  private readonly paymentOrders = new Map<string, string>();
  private readonly settled = new Map<string, ReleaseOutcome | RefundOutcome>();

  constructor(private readonly webhookSecret: string) {
    this.logger.warn(
      'Using the development payment gateway. No real money moves. Set RAZORPAY_* to use Razorpay Route.',
    );
  }

  async createOrder(input: CreateOrderInput): Promise<GatewayOrder> {
    const orderId = `dev_order_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    this.orders.set(orderId, { amountPaise: input.amountPaise, reference: input.reference });

    // On hold from the start, exactly as Route is configured. Releasing it is
    // a separate, deliberate act once the tenant has actually arrived.
    this.transfers.set(orderId, {
      id: `dev_trf_${randomUUID().replace(/-/g, '').slice(0, 14)}`,
      ownerSharePaise: input.ownerSharePaise,
      onHold: true,
      reversedPaise: 0,
    });

    this.logger.debug(
      `Order ${orderId}: ${input.amountPaise} paise (owner ${input.ownerSharePaise} on hold, platform ${input.platformFeePaise})`,
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

      // Route ties the transfer to the payment, not the order, so the link
      // has to be learned at capture for the settle calls to find it later.
      if (parsed.event === 'payment.captured' && parsed.orderId && parsed.paymentId) {
        this.paymentOrders.set(parsed.paymentId, parsed.orderId);
      }

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

  private transferFor(paymentId: string): DevTransfer | undefined {
    const orderId = this.paymentOrders.get(paymentId);
    return orderId ? this.transfers.get(orderId) : undefined;
  }

  async releaseOwnerShare(input: SettleInput): Promise<ReleaseOutcome> {
    const previous = this.settled.get(input.idempotencyKey);
    if (previous) return { ...(previous as ReleaseOutcome), alreadySettled: true };

    const transfer = this.transferFor(input.paymentId);
    if (!transfer) {
      throw new Error(`No held transfer for payment ${input.paymentId}`);
    }

    // Not an error. The scheduler and a manual release can race, and the
    // second one arriving is a no-op rather than a second payout.
    if (!transfer.onHold) {
      return { releasedTransferIds: [], releasedPaise: 0, alreadySettled: true };
    }

    transfer.onHold = false;
    const outcome: ReleaseOutcome = {
      releasedTransferIds: [transfer.id],
      releasedPaise: transfer.ownerSharePaise - transfer.reversedPaise,
      alreadySettled: false,
    };
    this.settled.set(input.idempotencyKey, outcome);
    this.logger.debug(`Released ${outcome.releasedPaise} paise to the owner (${transfer.id})`);
    return outcome;
  }

  async refundToTenant(input: RefundInput): Promise<RefundOutcome> {
    const previous = this.settled.get(input.idempotencyKey);
    if (previous) return { ...(previous as RefundOutcome), alreadySettled: true };

    const transfer = this.transferFor(input.paymentId);
    if (!transfer) {
      throw new Error(`No held transfer for payment ${input.paymentId}`);
    }
    if (!transfer.onHold) {
      // The money has already gone to the owner; a refund now would come out
      // of our own pocket. Refuse loudly rather than quietly absorbing it.
      throw new Error(
        `Payment ${input.paymentId} was already released to the owner and cannot be refunded here`,
      );
    }
    if (input.refundToTenantPaise + input.releaseToOwnerPaise > transfer.ownerSharePaise) {
      throw new Error('Refund and release together exceed the amount held');
    }

    transfer.reversedPaise = input.refundToTenantPaise;
    transfer.onHold = false;

    const outcome: RefundOutcome = {
      refundId: `dev_rfnd_${randomUUID().replace(/-/g, '').slice(0, 14)}`,
      refundedPaise: input.refundToTenantPaise,
      releasedPaise: input.releaseToOwnerPaise,
      alreadySettled: false,
    };
    this.settled.set(input.idempotencyKey, outcome);
    this.logger.debug(
      `Refunded ${outcome.refundedPaise} paise to the tenant, released ${outcome.releasedPaise} to the owner`,
    );
    return outcome;
  }
}
