import { commissionApplies, priceBooking } from './booking.pricing';

const base = {
  monthlyRentPaise: 700_000, // Rs 7,000
  depositPaise: 1_000_000, // Rs 10,000
  commissionBps: 400, // 4%
  convenienceFeePaise: 2_500, // Rs 25
  commissionApplies: true,
};

describe('priceBooking', () => {
  it('charges rent plus deposit plus the convenience fee', () => {
    const price = priceBooking(base);
    // 7,000 + 10,000 + 25
    expect(price.totalPayablePaise).toBe(1_702_500);
  });

  it('takes commission from the rent only, never the deposit', () => {
    const price = priceBooking(base);
    // 4% of 7,000 = 280. Not 4% of 17,000.
    expect(price.commissionPaise).toBe(28_000);
  });

  it('leaves the owner rent plus deposit, less commission', () => {
    const price = priceBooking(base);
    // 7,000 + 10,000 - 280
    expect(price.ownerSharePaise).toBe(1_672_000);
  });

  it('keeps the convenience fee out of the owner share', () => {
    const price = priceBooking(base);
    expect(price.platformFeePaise).toBe(28_000 + 2_500);
    // Every paisa the tenant pays is accounted for on one side or the other.
    expect(price.ownerSharePaise + price.platformFeePaise).toBe(price.totalPayablePaise);
  });

  it('charges no commission during the free period', () => {
    const price = priceBooking({ ...base, commissionApplies: false });
    expect(price.commissionPaise).toBe(0);
    expect(price.ownerSharePaise).toBe(1_700_000);
    // The tenant pays exactly the same either way — the free period is the
    // owner's benefit, not a discount to the tenant.
    expect(price.totalPayablePaise).toBe(1_702_500);
    expect(price.platformFeePaise).toBe(2_500);
  });

  it('handles a PG that takes no deposit', () => {
    const price = priceBooking({ ...base, depositPaise: 0 });
    expect(price.totalPayablePaise).toBe(702_500);
    expect(price.ownerSharePaise).toBe(672_000);
  });

  it('never produces fractional paise', () => {
    // 4% of 8,333 is 333.32 rupees — must land on a whole paisa.
    const price = priceBooking({ ...base, monthlyRentPaise: 833_333 });
    expect(Number.isInteger(price.commissionPaise)).toBe(true);
    expect(Number.isInteger(price.ownerSharePaise)).toBe(true);
    expect(price.ownerSharePaise + price.platformFeePaise).toBe(price.totalPayablePaise);
  });

  it('refuses to turn a negative rent into a negative charge', () => {
    const price = priceBooking({ ...base, monthlyRentPaise: -1, depositPaise: -1 });
    expect(price.rentPaise).toBe(0);
    expect(price.depositPaise).toBe(0);
    expect(price.totalPayablePaise).toBe(2_500);
  });

  it.each([300, 400, 500])('splits correctly at %i bps', (bps) => {
    const price = priceBooking({ ...base, commissionBps: bps });
    expect(price.commissionPaise).toBe(Math.round((700_000 * bps) / 10_000));
    expect(price.ownerSharePaise + price.platformFeePaise).toBe(price.totalPayablePaise);
  });
});

describe('commissionApplies', () => {
  const jan = new Date('2026-01-15T00:00:00Z');

  it('is free until the period has run', () => {
    expect(commissionApplies(jan, 3, new Date('2026-02-01T00:00:00Z'))).toBe(false);
    expect(commissionApplies(jan, 3, new Date('2026-04-14T00:00:00Z'))).toBe(false);
  });

  it('starts charging once it has', () => {
    expect(commissionApplies(jan, 3, new Date('2026-04-15T00:00:00Z'))).toBe(true);
    expect(commissionApplies(jan, 3, new Date('2026-09-01T00:00:00Z'))).toBe(true);
  });

  // Counted from the first booking, not from signup: an owner who joined in
  // January and got their first tenant in June should still get three months.
  it('has not started for an owner with no bookings yet', () => {
    expect(commissionApplies(null, 3, new Date('2027-01-01T00:00:00Z'))).toBe(false);
  });

  it('handles a free period ending in a shorter month', () => {
    const nov30 = new Date('2026-11-30T00:00:00Z');
    expect(commissionApplies(nov30, 3, new Date('2027-02-27T00:00:00Z'))).toBe(false);
    expect(commissionApplies(nov30, 3, new Date('2027-03-02T00:00:00Z'))).toBe(true);
  });
});
