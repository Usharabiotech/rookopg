'use client';

import { useActionState } from 'react';
import { Alert, Button } from '@/components/ui';
import { approveBookingAction, rejectBookingAction, type DecisionState } from './actions';

/**
 * Accept or decline, as two ordinary forms.
 *
 * Client only to surface a failure and to disable the buttons mid-flight — a
 * double-tapped accept is a second call against a booking that has already
 * moved on. Without JavaScript both still submit and still work; the page just
 * reloads instead of updating in place.
 */
export function DecisionForm({
  bookingId,
  propertyId,
  tenantName,
}: {
  bookingId: string;
  propertyId: string;
  tenantName: string;
}) {
  const [approveState, approve, approving] = useActionState<DecisionState, FormData>(
    approveBookingAction,
    {},
  );
  const [rejectState, reject, rejecting] = useActionState<DecisionState, FormData>(
    rejectBookingAction,
    {},
  );
  const busy = approving || rejecting;
  const error = approveState.error ?? rejectState.error;

  return (
    <div className="mt-4 border-t border-[var(--border)] pt-4">
      {error ? (
        <div className="mb-3">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <form action={approve}>
          <input type="hidden" name="bookingId" value={bookingId} />
          <input type="hidden" name="propertyId" value={propertyId} />
          <Button type="submit" disabled={busy}>
            {approving ? 'Accepting…' : 'Accept'}
          </Button>
        </form>

        {/*
          A native disclosure, so declining costs a deliberate extra tap and
          needs no JavaScript to open. Accepting is the common case and stays
          one press; refusing somebody who has already paid should not be.
        */}
        <details className="group">
          <summary className="pressable inline-flex min-h-11 cursor-pointer list-none items-center rounded-lg border border-[var(--border-strong)] px-4 text-sm font-medium hover:bg-[var(--bg-deep)]">
            Decline
          </summary>

          <form action={reject} className="mt-3 max-w-md">
            <input type="hidden" name="bookingId" value={bookingId} />
            <input type="hidden" name="propertyId" value={propertyId} />

            <label htmlFor={`reason-${bookingId}`} className="block text-sm font-medium">
              Why can you not take {tenantName}?
            </label>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              They are refunded in full, and they will be told what you say here.
            </p>
            <textarea
              id={`reason-${bookingId}`}
              name="reason"
              rows={2}
              maxLength={400}
              required
              placeholder="That bed was taken by a walk-in yesterday"
              className="mt-2 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
            <Button type="submit" variant="danger" className="mt-3" disabled={busy}>
              {rejecting ? 'Declining…' : 'Decline and refund'}
            </Button>
          </form>
        </details>
      </div>
    </div>
  );
}
