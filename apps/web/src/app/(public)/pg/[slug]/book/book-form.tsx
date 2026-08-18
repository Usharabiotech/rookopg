'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, Field, Input } from '@/components/ui';
import { rupeesShort, sharingLabel } from '@/lib/format';
import type { SharingOption } from '@/lib/types';
import { startBookingAction, type BookingState } from './actions';

function SubmitButton({ total }: { total: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" fullWidth disabled={pending}>
      {pending ? 'Holding your bed…' : `Pay ${rupeesShort(total)} and book`}
    </Button>
  );
}

export function BookForm({
  slug,
  options,
  initialSharing,
  convenienceFeePaise,
  today,
}: {
  slug: string;
  options: Array<SharingOption & { depositPaise: number }>;
  initialSharing?: string;
  convenienceFeePaise: number;
  today: string;
}) {
  const [state, action] = useActionState<BookingState, FormData>(startBookingAction, {});
  const available = options.filter((option) => option.freeBeds > 0);
  const [sharing, setSharing] = useState(
    initialSharing && available.some((o) => o.sharingType === initialSharing)
      ? initialSharing
      : (available[0]?.sharingType ?? ''),
  );
  const [moveInDate, setMoveInDate] = useState(today);

  const chosen = available.find((option) => option.sharingType === sharing);

  // One key per mount: retrying a failed submit must not hold a second bed.
  const idempotencyKey = useMemo(
    () => `web_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,
    [],
  );

  const rent = chosen?.fromRentPaise ?? 0;
  const deposit = chosen?.depositPaise ?? 0;
  const total = rent + deposit + convenienceFeePaise;

  if (available.length === 0) {
    return (
      <Alert>
        Every bed here is taken at the moment. Try another PG, or check back — beds free up as
        tenants leave.
      </Alert>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="sharingType" value={sharing} />

      {state.error ? <Alert>{state.error}</Alert> : null}

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Which room?</legend>
        <div className="space-y-2">
          {available.map((option) => (
            <label
              key={option.sharingType}
              className={
                'flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 transition-colors ' +
                (sharing === option.sharingType
                  ? 'border-brass-500 bg-brass-100/40'
                  : 'border-[var(--border-strong)] hover:border-brass-300')
              }
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="sharingChoice"
                  value={option.sharingType}
                  checked={sharing === option.sharingType}
                  onChange={() => setSharing(option.sharingType)}
                  className="size-4 accent-[var(--action)]"
                />
                <span>
                  <span className="block text-sm font-semibold">
                    {sharingLabel(option.sharingType)}
                  </span>
                  <span className="block text-xs text-[var(--ok)]">{option.freeBeds} free</span>
                </span>
              </span>
              <span className="figure text-sm font-semibold">
                {rupeesShort(option.fromRentPaise)}
                <span className="ml-1 font-sans text-xs font-normal text-[var(--text-muted)]">
                  /mo
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* The owner is handed a booking from a phone number otherwise. At the
          door they need a name to match against the person in front of them. */}
      <Field label="Your name" htmlFor="fullName" required hint="As the PG should expect you">
        <Input
          id="fullName"
          name="fullName"
          required
          maxLength={120}
          autoComplete="name"
          placeholder="Priya Sharma"
        />
      </Field>

      <Field label="Moving in on" htmlFor="moveInDate" required>
        <Input
          id="moveInDate"
          name="moveInDate"
          type="date"
          required
          min={today}
          value={moveInDate}
          onChange={(event) => setMoveInDate(event.target.value)}
        />
      </Field>

      {/* Every figure shown before payment, because a surprise at the end is
          how a booking becomes a refund. */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-deep)] p-4">
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-[var(--text-muted)]">First month&apos;s rent</dt>
            <dd className="figure">{rupeesShort(rent)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--text-muted)]">Refundable deposit</dt>
            <dd className="figure">{rupeesShort(deposit)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--text-muted)]">Booking fee</dt>
            <dd className="figure">{rupeesShort(convenienceFeePaise)}</dd>
          </div>
          <div className="flex justify-between border-t border-[var(--border)] pt-1.5 font-semibold">
            <dt>Pay now</dt>
            <dd className="figure">{rupeesShort(total)}</dd>
          </div>
        </dl>
      </div>

      <SubmitButton total={total} />

      <p className="text-xs text-[var(--text-muted)]">
        The deposit is returned when you leave, less any deductions the PG owner makes. Rent after
        the first month is paid to the owner directly.
      </p>
    </form>
  );
}
