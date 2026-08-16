import { DevPaymentGateway } from './dev.gateway';

/**
 * The escrow is the tenant's only protection against an owner whose
 * availability was stale, so these tests are mostly about the two ways it can
 * betray them: paying the owner twice, or refunding money that has already
 * left. Both are unrecoverable once real money is involved.
 */
describe('DevPaymentGateway settlement', () => {
  const SECRET = 'test-webhook-secret';
  const OWNER_SHARE = 900_000; // 9,000 rupees
  const TOTAL = 950_000;

  /** Takes a booking as far as a captured payment, the way the real flow does. */
  async function capturedBooking(gateway: DevPaymentGateway, reference = 'booking-1') {
    const order = await gateway.createOrder({
      reference,
      amountPaise: TOTAL,
      ownerSharePaise: OWNER_SHARE,
      platformFeePaise: TOTAL - OWNER_SHARE,
      ownerAccountId: 'acc_owner',
      customerPhone: '9800000001',
    });

    const paymentId = `pay_${reference}`;
    const body = JSON.stringify({
      event: 'payment.captured',
      eventId: `evt_${reference}`,
      orderId: order.orderId,
      paymentId,
      amountPaise: TOTAL,
    });
    const verified = gateway.verifyWebhook(body, gateway.sign(body));
    expect(verified?.type).toBe('payment.captured');

    return { orderId: order.orderId, paymentId };
  }

  let gateway: DevPaymentGateway;
  beforeEach(() => {
    gateway = new DevPaymentGateway(SECRET);
  });

  it('holds the owner share until it is explicitly released', async () => {
    const { paymentId } = await capturedBooking(gateway);

    // Nothing has been released merely because the tenant paid.
    const released = await gateway.releaseOwnerShare({
      paymentId,
      idempotencyKey: 'release-1',
    });

    expect(released.alreadySettled).toBe(false);
    expect(released.releasedPaise).toBe(OWNER_SHARE);
    expect(released.releasedTransferIds).toHaveLength(1);
  });

  it('does not pay the owner twice when the release is retried', async () => {
    const { paymentId } = await capturedBooking(gateway);

    const first = await gateway.releaseOwnerShare({ paymentId, idempotencyKey: 'release-1' });
    const retry = await gateway.releaseOwnerShare({ paymentId, idempotencyKey: 'release-1' });

    expect(first.releasedPaise).toBe(OWNER_SHARE);
    expect(retry.alreadySettled).toBe(true);
    expect(retry.releasedPaise).toBe(OWNER_SHARE);
  });

  it('treats a release under a different key as already settled, not a second payout', async () => {
    // The scheduler and a manual release can genuinely collide with different
    // keys. The transfer state, not the key, is what must decide this.
    const { paymentId } = await capturedBooking(gateway);

    await gateway.releaseOwnerShare({ paymentId, idempotencyKey: 'scheduler' });
    const manual = await gateway.releaseOwnerShare({ paymentId, idempotencyKey: 'manual' });

    expect(manual.alreadySettled).toBe(true);
    expect(manual.releasedPaise).toBe(0);
    expect(manual.releasedTransferIds).toEqual([]);
  });

  it('refunds the tenant in full while the money is still held', async () => {
    const { paymentId } = await capturedBooking(gateway);

    const refund = await gateway.refundToTenant({
      paymentId,
      idempotencyKey: 'refund-1',
      refundToTenantPaise: OWNER_SHARE,
      releaseToOwnerPaise: 0,
      reason: 'Owner declined',
    });

    expect(refund.refundedPaise).toBe(OWNER_SHARE);
    expect(refund.releasedPaise).toBe(0);
    expect(refund.refundId).toMatch(/^dev_rfnd_/);
  });

  it('splits a no-show: the owner keeps the rent, the tenant gets the deposit back', async () => {
    const { paymentId } = await capturedBooking(gateway);
    const RENT = 700_000;
    const DEPOSIT = 200_000;

    const refund = await gateway.refundToTenant({
      paymentId,
      idempotencyKey: 'no-show-1',
      refundToTenantPaise: DEPOSIT,
      releaseToOwnerPaise: RENT,
      reason: 'Tenant never arrived',
    });

    expect(refund.refundedPaise).toBe(DEPOSIT);
    expect(refund.releasedPaise).toBe(RENT);
  });

  it('does not refund twice when the refund is retried', async () => {
    const { paymentId } = await capturedBooking(gateway);

    const first = await gateway.refundToTenant({
      paymentId,
      idempotencyKey: 'refund-1',
      refundToTenantPaise: OWNER_SHARE,
      releaseToOwnerPaise: 0,
    });
    const retry = await gateway.refundToTenant({
      paymentId,
      idempotencyKey: 'refund-1',
      refundToTenantPaise: OWNER_SHARE,
      releaseToOwnerPaise: 0,
    });

    expect(first.alreadySettled).toBe(false);
    expect(retry.alreadySettled).toBe(true);
    expect(retry.refundId).toBe(first.refundId);
  });

  it('refuses to refund money that has already gone to the owner', async () => {
    // This is the case that would come out of our own pocket, so it has to
    // fail loudly rather than appear to succeed.
    const { paymentId } = await capturedBooking(gateway);
    await gateway.releaseOwnerShare({ paymentId, idempotencyKey: 'release-1' });

    await expect(
      gateway.refundToTenant({
        paymentId,
        idempotencyKey: 'refund-after-release',
        refundToTenantPaise: OWNER_SHARE,
        releaseToOwnerPaise: 0,
      }),
    ).rejects.toThrow(/already released/i);
  });

  it('refuses to hand back more than was held', async () => {
    const { paymentId } = await capturedBooking(gateway);

    await expect(
      gateway.refundToTenant({
        paymentId,
        idempotencyKey: 'over-refund',
        refundToTenantPaise: OWNER_SHARE,
        releaseToOwnerPaise: 1,
      }),
    ).rejects.toThrow(/exceed the amount held/i);
  });

  it('will not settle a payment it never saw captured', async () => {
    await expect(
      gateway.releaseOwnerShare({ paymentId: 'pay_unknown', idempotencyKey: 'k' }),
    ).rejects.toThrow(/No held transfer/i);
  });

  it('settles two bookings independently', async () => {
    const a = await capturedBooking(gateway, 'booking-a');
    const b = await capturedBooking(gateway, 'booking-b');

    await gateway.releaseOwnerShare({ paymentId: a.paymentId, idempotencyKey: 'release-a' });

    // B is untouched, so it can still be refunded.
    const refund = await gateway.refundToTenant({
      paymentId: b.paymentId,
      idempotencyKey: 'refund-b',
      refundToTenantPaise: OWNER_SHARE,
      releaseToOwnerPaise: 0,
    });
    expect(refund.refundedPaise).toBe(OWNER_SHARE);
  });
});
