export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export interface CreateOrderInput {
  /** Our booking id — echoed back on the webhook so we can match it. */
  reference: string;
  amountPaise: number;
  /** What the owner receives, before our fee. */
  ownerSharePaise: number;
  /** Our cut: commission plus the tenant convenience fee. */
  platformFeePaise: number;
  /** Razorpay Route linked account for the owner, when they have one. */
  ownerAccountId?: string;
  customerPhone: string;
  notes?: Record<string, string>;
}

export interface GatewayOrder {
  orderId: string;
  amountPaise: number;
  currency: string;
  /** Public key the browser checkout needs. Never the secret. */
  publicKey?: string;
}

export interface VerifiedEvent {
  /** Gateway's own id for this notification. Our idempotency key. */
  eventId: string;
  type: 'payment.captured' | 'payment.failed' | 'other';
  orderId?: string;
  paymentId?: string;
  amountPaise?: number;
  currency?: string;
}

export interface SettleInput {
  /** The captured payment whose held transfer we are acting on. */
  paymentId: string;
  /**
   * Ours, not the gateway's. Both settle operations are retried by the
   * scheduler, so each one carries a key we can recognise on a second pass —
   * see the note on idempotency in PaymentGateway.
   */
  idempotencyKey: string;
  reason?: string;
}

export interface ReleaseOutcome {
  /** Transfers taken off hold. Empty when a retry found nothing left to do. */
  releasedTransferIds: string[];
  releasedPaise: number;
  /** True when the work had already been done before this call. */
  alreadySettled: boolean;
}

export interface RefundInput extends SettleInput {
  /**
   * What the tenant gets back, which is not always everything. A no-show
   * returns the deposit and leaves the rent with the owner, so the held
   * transfer is reversed in part and the rest released.
   */
  refundToTenantPaise: number;
  /** Left with the owner. Released rather than reversed. */
  releaseToOwnerPaise: number;
}

export interface RefundOutcome {
  refundId: string | null;
  refundedPaise: number;
  releasedPaise: number;
  alreadySettled: boolean;
}

/**
 * Everything the application needs from a payment provider, and nothing about
 * which provider it is.
 *
 * Razorpay Route is the deployment plan (docs/02 Part 0): the tenant pays
 * once, the owner's share settles straight to their account and our fee to
 * ours, so the platform never holds funds and stays outside RBI aggregator
 * licensing. A development gateway implements the same interface so the whole
 * booking flow can be exercised before any account exists.
 *
 * The owner's share is created on hold and stays that way until the tenant
 * actually turns up at the building. That is the tenant's protection against
 * an owner whose availability was stale: the bed is gone, but the money has
 * not moved yet. Critically the hold lives at the gateway, never with us —
 * money landing in our own account first would make us a payment aggregator
 * under RBI rules, which is a licensing regime this business cannot meet.
 *
 * Both settle operations must be safe to call twice. The scheduler retries
 * them, and a release that double-pays or a refund that double-returns is the
 * worst class of bug this system can have, so implementations report
 * alreadySettled rather than acting again.
 */
export interface PaymentGateway {
  readonly provider: 'dev' | 'razorpay';

  createOrder(input: CreateOrderInput): Promise<GatewayOrder>;

  /**
   * Hands the owner their share, once the tenant has checked in.
   *
   * Idempotent: a second call for a payment already released reports
   * alreadySettled instead of moving money again.
   */
  releaseOwnerShare(input: SettleInput): Promise<ReleaseOutcome>;

  /**
   * Returns money to the tenant, and optionally lets the owner keep the rest.
   *
   * Held money is reversed before it is refunded — the gateway cannot refund
   * what it has already paid out, so the order of those two matters.
   */
  refundToTenant(input: RefundInput): Promise<RefundOutcome>;

  /**
   * Checks the signature and returns what happened, or null if the signature
   * does not verify.
   *
   * Returning null rather than throwing keeps "someone posted us a forgery"
   * distinct from "our own code broke", which matters when deciding whether
   * to alert.
   */
  verifyWebhook(rawBody: string, signature: string | undefined): VerifiedEvent | null;

  /** Confirms with the gateway directly, for when a webhook never arrives. */
  fetchOrderStatus(orderId: string): Promise<'paid' | 'pending' | 'failed'>;
}
