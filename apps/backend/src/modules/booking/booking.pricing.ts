/**
 * What the tenant pays and how it splits.
 *
 * Pure and separately tested, because this is the arithmetic that decides how
 * much of an owner's money we keep. Every figure is integer paise.
 *
 * The shape follows docs/02 Part 0:
 *   - the tenant pays the first month's rent plus the deposit up front
 *   - a small convenience fee is added on top, and is ours
 *   - commission is a percentage of the rent only, never the deposit, and is
 *     zero during the owner's free period
 *   - the owner's share settles to them directly via Razorpay Route; we never
 *     hold it
 */

export interface PriceInput {
  monthlyRentPaise: number;
  depositPaise: number;
  /** Basis points. 400 = 4%. */
  commissionBps: number;
  convenienceFeePaise: number;
  /** False while the owner is inside their free period. */
  commissionApplies: boolean;
}

export interface PriceBreakdown {
  rentPaise: number;
  depositPaise: number;
  convenienceFeePaise: number;
  /** What the tenant is charged in total. */
  totalPayablePaise: number;
  commissionPaise: number;
  /** Settles to the owner. Held until check-in. */
  ownerSharePaise: number;
  /** Commission plus the convenience fee. */
  platformFeePaise: number;
}

export function priceBooking(input: PriceInput): PriceBreakdown {
  const rentPaise = Math.max(0, Math.round(input.monthlyRentPaise));
  const depositPaise = Math.max(0, Math.round(input.depositPaise));
  const convenienceFeePaise = Math.max(0, Math.round(input.convenienceFeePaise));

  /*
   * Commission is charged on rent alone.
   *
   * A deposit is the tenant's own money held against damage — taking a cut of
   * it would mean charging for custody of something we never touch, and it
   * would make our revenue jump with a number the owner sets arbitrarily.
   */
  const commissionPaise = input.commissionApplies
    ? Math.round((rentPaise * input.commissionBps) / 10_000)
    : 0;

  const ownerSharePaise = rentPaise + depositPaise - commissionPaise;

  return {
    rentPaise,
    depositPaise,
    convenienceFeePaise,
    // The tenant is charged the full rent and deposit; commission comes out
    // of the owner's side, never as a surcharge on the tenant.
    totalPayablePaise: rentPaise + depositPaise + convenienceFeePaise,
    commissionPaise,
    ownerSharePaise,
    platformFeePaise: commissionPaise + convenienceFeePaise,
  };
}

/**
 * Whether the owner's free period has run out.
 *
 * Counted from their first booking rather than signup, so an owner who joined
 * months before getting any tenants has not burned it waiting.
 */
export function commissionApplies(
  freePeriodStartsAt: Date | null,
  freePeriodMonths: number,
  now: Date,
): boolean {
  if (freePeriodStartsAt === null) return false;

  const endsAt = new Date(freePeriodStartsAt);
  endsAt.setUTCMonth(endsAt.getUTCMonth() + freePeriodMonths);
  return now >= endsAt;
}
