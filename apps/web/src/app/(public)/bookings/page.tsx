import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { api, isApiError } from '@/lib/api';
import { Badge, Card, EmptyState, LinkButton, PageHeader } from '@/components/ui';
import { formatDate, rupeesShort, sharingLabel } from '@/lib/format';
import type { Booking } from '@/lib/types';

export const metadata: Metadata = { title: 'Your bookings', robots: { index: false } };

const TONES: Partial<Record<Booking['status'], 'free' | 'taken' | 'danger' | 'neutral'>> = {
  CONFIRMED: 'free',
  CHECKED_IN: 'free',
  PENDING_PAYMENT: 'taken',
  PENDING_APPROVAL: 'taken',
  CANCELLED: 'danger',
  REJECTED: 'danger',
  PAYMENT_FAILED: 'danger',
};

const LABELS: Partial<Record<Booking['status'], string>> = {
  PENDING_PAYMENT: 'Pay to confirm',
  PENDING_APPROVAL: 'With the owner',
  CONFIRMED: 'Confirmed',
  CHECKED_IN: 'Moved in',
  CANCELLED: 'Cancelled',
  REJECTED: 'Declined',
  PAYMENT_FAILED: 'Payment failed',
  EXPIRED: 'Expired',
};

export default async function BookingsPage() {
  let bookings: Booking[];
  try {
    bookings = await api<Booking[]>('/bookings');
  } catch (error) {
    if (isApiError(error) && error.isUnauthenticated) {
      redirect('/login?next=%2Fbookings' as never);
    }
    throw error;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <PageHeader title="Your bookings" />

      {bookings.length === 0 ? (
        <EmptyState
          title="No bookings yet"
          description="Find a PG you like and book a bed. It takes a couple of minutes."
          action={<LinkButton href="/">Browse PGs</LinkButton>}
        />
      ) : (
        <ul className="stagger space-y-3">
          {bookings.map((booking) => (
            <Card as="li" key={booking.id}>
              <Link href={`/bookings/${booking.id}`} className="block">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="display truncate text-base">{booking.propertyName}</h2>
                    <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                      {booking.localityName} · {sharingLabel(booking.sharingType)} · room{' '}
                      <span className="figure">{booking.roomCode}</span>
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Moving in {formatDate(booking.moveInDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge tone={TONES[booking.status] ?? 'neutral'}>
                      {LABELS[booking.status] ?? booking.status}
                    </Badge>
                    <p className="figure mt-2 text-sm font-semibold">
                      {rupeesShort(booking.price.totalPayablePaise)}
                    </p>
                  </div>
                </div>
              </Link>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
