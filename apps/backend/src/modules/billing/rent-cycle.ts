/**
 * Rent cycle arithmetic.
 *
 * Pure functions, no database, because this is where quiet money bugs live.
 * A tenant billed on the 31st in February, or a part-month at move-in that is
 * off by a day, is wrong on every invoice from then on and nobody notices for
 * months.
 *
 * All dates are calendar days at midnight UTC. Rent is integer paise.
 */

const MS_PER_DAY = 86_400_000;

export function toUtcDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day));
}

export function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

/**
 * Adds months, clamping the day to the target month's length.
 *
 * 31 January plus one month is the 28th (or 29th) of February, not the 3rd of
 * March. JavaScript's Date rolls over by default, which would silently shift a
 * tenant's billing day forward every short month.
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const monthIndex = date.getUTCMonth() + months;
  const day = date.getUTCDate();

  const targetYear = year + Math.floor(monthIndex / 12);
  const targetMonth = ((monthIndex % 12) + 12) % 12;

  return toUtcDate(targetYear, targetMonth, Math.min(day, daysInMonth(targetYear, targetMonth)));
}

/**
 * The billing day in a given month, clamped the same way.
 *
 * An owner who bills everyone on the 31st gets the 28th in February rather
 * than an invoice that never falls due.
 */
export function anchorDayIn(year: number, monthIndex: number, anchorDay: number): Date {
  return toUtcDate(year, monthIndex, Math.min(anchorDay, daysInMonth(year, monthIndex)));
}

export interface RentPeriod {
  /** Inclusive first day covered. */
  periodStart: Date;
  /** Exclusive last day — the next period's first day. */
  periodEnd: Date;
  /** When the money is owed. Rent here is charged in advance. */
  dueDate: Date;
  amountPaise: number;
  /** True when the period is shorter than a whole cycle. */
  isProRata: boolean;
  days: number;
}

/**
 * A part-month charged by the day.
 *
 * The denominator is the length of the month the period starts in, so a tenant
 * moving in on 17 March pays 15/31 of a month rather than 15/30. Using a flat
 * 30 would quietly overcharge in every 31-day month.
 */
export function proRataPaise(monthlyRentPaise: number, days: number, inMonthDays: number): number {
  if (days <= 0) return 0;
  if (days >= inMonthDays) return monthlyRentPaise;
  return Math.round((monthlyRentPaise * days) / inMonthDays);
}

export interface CycleOptions {
  startDate: Date;
  /** Day of month rent falls due. Null anchors to the move-in day. */
  cycleAnchorDay: number | null;
  monthlyRentPaise: number;
  /** Stop generating at this date — usually today plus a little. */
  upTo: Date;
  /** Vacate date, if known. Nothing is charged beyond it. */
  endDate?: Date | null;
}

/**
 * Every rent period a tenancy owes, from move-in up to a cutoff.
 *
 * Two shapes, per docs/02 decision 9:
 *
 *  - Anchored to move-in (the default): whole months from the move-in day, so
 *    17 March to 17 April, and no part-month ever arises.
 *  - Fixed billing day: a part-month from move-in to the next billing day,
 *    then whole months. This is what larger hostels want, because chasing 80
 *    people on 80 different days is unmanageable.
 *
 * Deterministic and idempotent: the same tenancy always yields the same
 * periods, which is what lets invoice generation be re-run safely.
 */
export function rentPeriods(options: CycleOptions): RentPeriod[] {
  const { startDate, cycleAnchorDay, monthlyRentPaise, upTo, endDate } = options;

  const start = startOfDay(startDate);
  const cutoff = startOfDay(upTo);
  const finish = endDate ? startOfDay(endDate) : null;

  if (finish && finish <= start) return [];

  /*
   * Everything runs off a single anchor day, including the "bill them on
   * their move-in date" case — that is just an anchor equal to the day they
   * arrived.
   *
   * Deriving each period from the anchor rather than chaining month
   * arithmetic is what stops the billing day drifting. Adding a month to
   * 31 January gives 28 February, and adding a month to *that* gives
   * 28 March: one short February would move a tenant's rent day permanently.
   * Anchoring recovers the 31st as soon as the month is long enough.
   */
  const anchor = cycleAnchorDay ?? start.getUTCDate();

  const nextAnchorAfter = (from: Date): Date => {
    const sameMonth = anchorDayIn(from.getUTCFullYear(), from.getUTCMonth(), anchor);
    return sameMonth > from
      ? sameMonth
      : anchorDayIn(from.getUTCFullYear(), from.getUTCMonth() + 1, anchor);
  };

  // Did they arrive exactly on a billing day? If not, the first period is a
  // part-month and every one after it is whole.
  const startsOnAnchor =
    anchorDayIn(start.getUTCFullYear(), start.getUTCMonth(), anchor).getTime() === start.getTime();

  const periods: RentPeriod[] = [];
  let periodStart = start;
  let index = 0;

  while (periodStart <= cutoff && index < 600) {
    const naturalEnd = nextAnchorAfter(periodStart);

    // Nothing is charged past the day they leave.
    const periodEnd = finish && finish < naturalEnd ? finish : naturalEnd;
    if (periodEnd <= periodStart) break;

    const truncatedByDeparture = periodEnd.getTime() !== naturalEnd.getTime();
    const isFullCycle = !truncatedByDeparture && (index > 0 || startsOnAnchor);

    const days = daysBetween(periodStart, periodEnd);
    const inMonthDays = daysInMonth(periodStart.getUTCFullYear(), periodStart.getUTCMonth());

    periods.push({
      periodStart,
      periodEnd,
      // Charged in advance: the money is due the day the period begins.
      dueDate: periodStart,
      amountPaise: isFullCycle
        ? monthlyRentPaise
        : proRataPaise(monthlyRentPaise, days, inMonthDays),
      isProRata: !isFullCycle,
      days,
    });

    if (finish && periodEnd >= finish) break;
    periodStart = periodEnd;
    index += 1;
  }

  return periods;
}

/**
 * A stable key for a period, so generating invoices twice cannot bill twice.
 *
 * Paired with a unique index on (tenancy, kind, cycleKey), this is what makes
 * the nightly job safe to re-run — and jobs do get re-run, after a crash or a
 * redeploy.
 */
export function cycleKeyFor(periodStart: Date): string {
  return periodStart.toISOString().slice(0, 10);
}
