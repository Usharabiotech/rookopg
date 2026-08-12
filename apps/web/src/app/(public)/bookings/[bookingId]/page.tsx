import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, isApiError } from '@/lib/api';
import { Alert, Badge, Button, Card, PageHeader } from '@/components/ui';
import { formatDate, rupeesShort, sharingLabel } from '@/lib/format';
import type { Booking } from '@/lib/types';
import { cancelBookingAction, simulateDevPaymentAction } from '../../pg/[slug]/book/actions';

export const metadata: Metadata = { title: 'Your booking', robots: { index: false } };

type Params = Promise<{ bookingId: string }>;

const STATUS_COPY: Record<
  Booking['status'],
  { label: string; tone: 'free' | 'taken' | 'danger' | 'neutral'; detail: string }
> = {
  DRAFT: { label: 'Not started', tone: 'neutral', detail: '' },
  HELD: { label: 'Bed held', tone: 'taken', detail: 'Finish paying to keep it.' },
  PENDING_PAYMENT: {
    label: 'Waiting for payment',
    tone: 'taken',
    detail: 'The bed is held for you until the time below.',
  },
  PAYMENT_FAILED: {
    label: 'Payment failed',
    tone: 'danger',
    detail: 'Nothing was charged. Start again if you still want the bed.',
  },
  PENDING_APPROVAL: {
    label: 'With the PG owner',
    tone: 'taken',
    detail: 'Paid. The owner is confirming your bed — you will hear shortly.',
  },
  CONFIRMED: {
    label: 'Confirmed',
    tone: 'free',
    detail: 'The bed is yours. Show your booking at the PG on your move-in day.',
  },
  CHECKED_IN: { label: 'Moved in', tone: 'free', detail: 'You are staying here.' },
  CANCELLED: { label: 'Cancelled', tone: 'danger', detail: 'This booking was cancelled.' },
  REJECTED: {
    label: 'Declined',
    tone: 'danger',
    detail: 'The owner could not take this booking. You are due a full refund.',
  },
  EXPIRED: {
    label: 'Expired',
    tone: 'neutral',
    detail: 'The hold ran out before payment. Nothing was charged.',
  },
  NO_SHOW: { label: 'Not taken up', tone: 'danger', detail: '' },
};

export default async function BookingPage({ params }: { params: Params }) {
  const { bookingId } = await params;

  let booking: Booking;
  try {
    booking = await api<Booking>(`/bookings/${bookingId}`);
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }

  const status = STATUS_COPY[booking.status];
  const awaitingPayment = booking.status === 'PENDING_PAYMENT';
  const cancellable = ['PENDING_PAYMENT', 'PENDING_APPROVAL', 'CONFIRMED'].includes(booking.status);

  return (
    <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
      <Link
        href="/bookings"
        className="mb-4 inline-flex min-h-11 items-center text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        ← Your bookings
      </Link>

      <PageHeader
        eyebrow={booking.localityName}
        title={booking.propertyName}
        subtitle={`${sharingLabel(booking.sharingType)} · room ${booking.roomCode}, bed ${booking.bedCode}`}
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge tone={status.tone}>{status.label}</Badge>
          <p className="text-sm text-[var(--text-muted)]">
            Moving in {formatDate(booking.moveInDate)}
          </p>
        </div>
        {status.detail ? <p className="mt-3 text-sm">{status.detail}</p> : null}

        {awaitingPayment && booking.holdExpiresAt ? (
          <p className="mt-3 text-xs text-brass-600">
            Held until{' '}
            {new Date(booking.holdExpiresAt).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        ) : null}
      </Card>

      <Card className="mb-4">
        <p className="eyebrow mb-3">What you pay</p>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-[var(--text-muted)]">First month&apos;s rent</dt>
            <dd className="figure">{rupeesShort(booking.price.rentPaise)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--text-muted)]">Refundable deposit</dt>
            <dd className="figure">{rupeesShort(booking.price.depositPaise)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--text-muted)]">Booking fee</dt>
            <dd className="figure">{rupeesShort(booking.price.convenienceFeePaise)}</dd>
          </div>
          <div className="flex justify-between border-t border-[var(--border)] pt-1.5 font-semibold">
            <dt>Total</dt>
            <dd className="figure">{rupeesShort(booking.price.totalPayablePaise)}</dd>
          </div>
        </dl>
      </Card>

      {awaitingPayment ? (
        <Card className="mb-4">
          {/*
            Development only. In production this is where the gateway's own
            checkout opens; here it posts the same signed webhook, so the path
            being exercised is the real one rather than a status flip.
          */}
          <Alert tone="info">
            Development mode — no real payment gateway is connected. The button below sends the
            same signed confirmation a gateway would.
          </Alert>
          <form action={simulateDevPaymentAction} className="mt-4">
            <input type="hidden" name="bookingId" value={booking.id} />
            <input type="hidden" name="orderId" value={booking.orderId ?? ''} />
            <input
              type="hidden"
              name="amountPaise"
              value={booking.price.totalPayablePaise}
            />
            <Button type="submit" fullWidth>
              Pay {rupeesShort(booking.price.totalPayablePaise)}
            </Button>
          </form>
        </Card>
      ) : null}

      {cancellable ? (
        <form action={cancelBookingAction}>
          <input type="hidden" name="bookingId" value={booking.id} />
          <Button type="submit" variant="ghost" fullWidth className="text-rust-500">
            Cancel this booking
          </Button>
        </form>
      ) : null}
    </div>
  );
}
