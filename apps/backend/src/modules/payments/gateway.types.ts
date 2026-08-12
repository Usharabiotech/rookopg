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

/**
 * Everything the application needs from a payment provider, and nothing about
 * which provider it is.
 *
 * Razorpay Route is the deployment plan (docs/02 Part 0): the tenant pays
 * once, the owner's share settles straight to their account and our fee to
 * ours, so the platform never holds funds and stays outside RBI aggregator
 * licensing. A development gateway implements the same interface so the whole
 * booking flow can be exercised before any account exists.
 */
export interface PaymentGateway {
  readonly provider: 'dev' | 'razorpay';

  createOrder(input: CreateOrderInput): Promise<GatewayOrder>;

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
