import {
  addMonthsClamped,
  anchorDayIn,
  cycleKeyFor,
  daysBetween,
  daysInMonth,
  proRataPaise,
  rentPeriods,
  toUtcDate,
} from './rent-cycle';

const d = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const iso = (date: Date): string => date.toISOString().slice(0, 10);

describe('addMonthsClamped', () => {
  it.each([
    ['2026-01-15', 1, '2026-02-15'],
    ['2026-03-17', 1, '2026-04-17'],
    ['2026-12-05', 1, '2027-01-05'],
  ])('adds a month to %s', (from, months, expected) => {
    expect(iso(addMonthsClamped(d(from), months))).toBe(expected);
  });

  // The bug this exists to prevent: JavaScript rolls 31 Jan + 1 month into
  // 3 March, which would walk a tenant's billing day forward every short
  // month until it no longer resembles the day they moved in.
  it.each([
    ['2026-01-31', '2026-02-28'],
    ['2026-01-30', '2026-02-28'],
    ['2026-03-31', '2026-04-30'],
    ['2026-05-31', '2026-06-30'],
  ])('clamps %s to the end of a shorter month', (from, expected) => {
    expect(iso(addMonthsClamped(d(from), 1))).toBe(expected);
  });

  it('handles February in a leap year', () => {
    expect(iso(addMonthsClamped(d('2028-01-31'), 1))).toBe('2028-02-29');
  });

  it('does not drift when applied repeatedly from a 31st', () => {
    // Clamping is not reversible — once pulled back to the 28th it stays
    // there. Anchoring is what preserves "the 31st", which is why
    // anchorDayIn exists separately.
    let date = d('2026-01-31');
    const days: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      date = addMonthsClamped(date, 1);
      days.push(date.getUTCDate());
    }
    expect(days).toEqual([28, 28, 28, 28]);
  });
});

describe('anchorDayIn', () => {
  it('keeps a 31st anchor on the last day of shorter months', () => {
    expect(iso(anchorDayIn(2026, 1, 31))).toBe('2026-02-28');
    expect(iso(anchorDayIn(2028, 1, 31))).toBe('2028-02-29');
    expect(iso(anchorDayIn(2026, 3, 31))).toBe('2026-04-30');
    expect(iso(anchorDayIn(2026, 4, 31))).toBe('2026-05-31');
  });

  it('preserves the anchor rather than drifting, month after month', () => {
    const days = [0, 1, 2, 3, 4].map((m) => anchorDayIn(2026, m, 31).getUTCDate());
    expect(days).toEqual([31, 28, 31, 30, 31]);
  });
});

describe('daysInMonth and daysBetween', () => {
  it('knows February', () => {
    expect(daysInMonth(2026, 1)).toBe(28);
    expect(daysInMonth(2028, 1)).toBe(29);
  });

  it('counts days across a month boundary', () => {
    expect(daysBetween(d('2026-03-17'), d('2026-04-01'))).toBe(15);
    expect(daysBetween(d('2026-03-01'), d('2026-04-01'))).toBe(31);
  });

  it('counts across a leap day', () => {
    expect(daysBetween(d('2028-02-01'), d('2028-03-01'))).toBe(29);
  });
});

describe('proRataPaise', () => {
  it('charges by the day against the month it falls in', () => {
    // Rs 9,000 for 15 of March's 31 days.
    expect(proRataPaise(900_000, 15, 31)).toBe(435_484);
  });

  it('charges a full month when the period covers it', () => {
    expect(proRataPaise(900_000, 31, 31)).toBe(900_000);
    expect(proRataPaise(900_000, 40, 31)).toBe(900_000);
  });

  it('charges nothing for no days', () => {
    expect(proRataPaise(900_000, 0, 31)).toBe(0);
  });

  it('uses the real month length, not a flat 30', () => {
    // Half of a 31-day month is less than half of a 30-day one. Using 30
    // everywhere would overcharge in seven months of the year.
    expect(proRataPaise(620_000, 15, 31)).toBe(300_000);
    expect(proRataPaise(600_000, 15, 30)).toBe(300_000);
  });
});

describe('rentPeriods anchored to the move-in day', () => {
  const base = {
    startDate: d('2026-03-17'),
    cycleAnchorDay: null,
    monthlyRentPaise: 700_000,
    upTo: d('2026-06-01'),
  };

  it('bills whole months from the move-in day, with no part-month', () => {
    const periods = rentPeriods(base);
    expect(periods.map((p) => iso(p.periodStart))).toEqual([
      '2026-03-17',
      '2026-04-17',
      '2026-05-17',
    ]);
    expect(periods.every((p) => p.amountPaise === 700_000)).toBe(true);
    expect(periods.some((p) => p.isProRata)).toBe(false);
  });

  it('charges in advance, on the first day of each period', () => {
    const [first] = rentPeriods(base);
    expect(iso(first!.dueDate)).toBe('2026-03-17');
  });

  /*
   * The billing day must not drift.
   *
   * Chaining "add one month" from 31 January gives 28 February and then
   * 28 March — one short February would move a tenant's rent day for the rest
   * of their stay, on every invoice, and nobody would notice for months.
   * March must come back to the 31st.
   */
  it('recovers a 31st move-in after a short month instead of drifting', () => {
    const periods = rentPeriods({
      ...base,
      startDate: d('2026-01-31'),
      upTo: d('2026-06-15'),
    });
    expect(periods.map((p) => iso(p.periodStart))).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ]);
  });

  it('charges a full month for every period, including the short February', () => {
    const periods = rentPeriods({
      ...base,
      startDate: d('2026-01-31'),
      upTo: d('2026-04-15'),
    });
    // 31 Jan to 28 Feb is 28 days but a whole cycle, not a part-month.
    expect(periods.map((p) => p.amountPaise)).toEqual([700_000, 700_000, 700_000]);
    expect(periods.some((p) => p.isProRata)).toBe(false);
  });

  it('recovers a 30th move-in through February too', () => {
    const periods = rentPeriods({
      ...base,
      startDate: d('2026-01-30'),
      upTo: d('2026-04-15'),
    });
    expect(periods.map((p) => iso(p.periodStart))).toEqual([
      '2026-01-30',
      '2026-02-28',
      '2026-03-30',
    ]);
  });
});

describe('rentPeriods with a fixed billing day', () => {
  const base = {
    startDate: d('2026-03-17'),
    cycleAnchorDay: 1,
    monthlyRentPaise: 900_000,
    upTo: d('2026-06-15'),
  };

  it('charges a part-month first, then whole months', () => {
    const periods = rentPeriods(base);
    expect(periods.map((p) => [iso(p.periodStart), iso(p.periodEnd), p.amountPaise])).toEqual([
      ['2026-03-17', '2026-04-01', 435_484],
      ['2026-04-01', '2026-05-01', 900_000],
      ['2026-05-01', '2026-06-01', 900_000],
      ['2026-06-01', '2026-07-01', 900_000],
    ]);
  });

  it('marks only the part-month as pro-rata', () => {
    const periods = rentPeriods(base);
    expect(periods.map((p) => p.isProRata)).toEqual([true, false, false, false]);
  });

  it('charges no part-month when they move in on the billing day', () => {
    const periods = rentPeriods({ ...base, startDate: d('2026-04-01'), upTo: d('2026-05-15') });
    expect(periods.map((p) => p.isProRata)).toEqual([false, false]);
    expect(periods[0]?.amountPaise).toBe(900_000);
  });

  it('survives February on a 31st billing day', () => {
    const periods = rentPeriods({
      ...base,
      startDate: d('2026-01-31'),
      cycleAnchorDay: 31,
      upTo: d('2026-05-01'),
    });
    expect(periods.map((p) => iso(p.periodStart))).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });
});

describe('rentPeriods when the tenant leaves', () => {
  it('stops at the vacate date and pro-rates the last month', () => {
    const periods = rentPeriods({
      startDate: d('2026-03-01'),
      cycleAnchorDay: null,
      monthlyRentPaise: 620_000,
      upTo: d('2026-12-01'),
      endDate: d('2026-05-16'),
    });

    expect(periods.map((p) => [iso(p.periodStart), iso(p.periodEnd)])).toEqual([
      ['2026-03-01', '2026-04-01'],
      ['2026-04-01', '2026-05-01'],
      ['2026-05-01', '2026-05-16'],
    ]);
    expect(periods[2]?.isProRata).toBe(true);
    expect(periods[2]?.amountPaise).toBe(300_000);
  });

  it('charges nothing when they leave on the day they arrive', () => {
    expect(
      rentPeriods({
        startDate: d('2026-03-01'),
        cycleAnchorDay: null,
        monthlyRentPaise: 700_000,
        upTo: d('2026-06-01'),
        endDate: d('2026-03-01'),
      }),
    ).toEqual([]);
  });

  it('charges nothing for a tenancy that has not started', () => {
    expect(
      rentPeriods({
        startDate: d('2026-09-01'),
        cycleAnchorDay: null,
        monthlyRentPaise: 700_000,
        upTo: d('2026-08-12'),
      }),
    ).toEqual([]);
  });
});

describe('cycleKeyFor', () => {
  it('is stable for the same period', () => {
    expect(cycleKeyFor(d('2026-03-17'))).toBe('2026-03-17');
    expect(cycleKeyFor(toUtcDate(2026, 2, 17))).toBe('2026-03-17');
  });

  // Idempotency depends on this: the job runs again after a crash and must
  // produce the same keys, so the unique index rejects the duplicates.
  it('gives every period in a run a distinct key', () => {
    const periods = rentPeriods({
      startDate: d('2026-01-31'),
      cycleAnchorDay: null,
      monthlyRentPaise: 700_000,
      upTo: d('2027-01-31'),
    });
    const keys = periods.map((p) => cycleKeyFor(p.periodStart));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
