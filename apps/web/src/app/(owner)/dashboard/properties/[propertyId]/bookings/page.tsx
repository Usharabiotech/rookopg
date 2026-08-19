import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, isApiError } from '@/lib/api';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import { rupeesShort, sharingLabel } from '@/lib/format';
import type { Booking, PropertyDetail } from '@/lib/types';
import { DecisionForm } from './decision-form';

export const metadata: Metadata = { title: 'Bookings' };

type Params = Promise<{ propertyId: string }>;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * How long the owner has left to answer.
 *
 * This is the whole reason the screen is urgent: ignore a booking and it
 * expires on its own, the tenant is refunded, and the bed sat blocked for
 * nothing. Saying "4 hours left" does the job that a date never would.
 */
function timeLeft(iso: string): { label: string; urgent: boolean; gone: boolean } {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (minutes <= 0) return { label: 'Time is up', urgent: true, gone: true };
  if (minutes < 60) return { label: `${minutes} min left to answer`, urgent: true, gone: false };
  const hours = Math.round(minutes / 60);
  return {
    label: `${hours} ${hours === 1 ? 'hour' : 'hours'} left to answer`,
    urgent: hours <= 3,
    gone: false,
  };
}

function Waiting({ booking, propertyId }: { booking: Booking; propertyId: string }) {
  const deadline = booking.approvalExpiresAt ? timeLeft(booking.approvalExpiresAt) : null;
  const tenant = booking.tenantName ?? 'This tenant';

  return (
    <Card as="li" className={deadline?.urgent ? 'border-rust-500/40' : ''}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">
            {tenant}
            <span className="figure ml-2 text-xs font-normal text-[var(--text-muted)]">
              {booking.roomCode}·{booking.bedCode}
            </span>
          </p>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            {sharingLabel(booking.sharingType)} · moving in {formatDate(booking.moveInDate)}
          </p>
          {booking.tenantPhone ? (
            <p className="figure mt-1 text-xs text-[var(--text-muted)]">{booking.tenantPhone}</p>
          ) : null}
        </div>

        <div className="text-right">
          <p className="figure text-lg font-semibold">{rupeesShort(booking.price.rentPaise)}</p>
          <p className="text-xs text-[var(--text-muted)]">rent, already paid</p>
        </div>
      </div>

      {deadline ? (
        <p
          className={
            'mt-3 text-xs font-medium ' +
            (deadline.urgent ? 'text-[var(--danger-text)]' : 'text-[var(--text-muted)]')
          }
        >
          {deadline.label}
          {deadline.gone ? ' — this may already have expired' : ''}
        </p>
      ) : null}

      <DecisionForm bookingId={booking.id} propertyId={propertyId} tenantName={tenant} />
    </Card>
  );
}

function Accepted({ booking }: { booking: Booking }) {
  return (
    <Card as="li">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">
            {booking.tenantName ?? 'Tenant'}
            <span className="figure ml-2 text-xs font-normal text-[var(--text-muted)]">
              {booking.roomCode}·{booking.bedCode}
            </span>
          </p>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            Moving in {formatDate(booking.moveInDate)}
          </p>
        </div>
        <Badge tone="free">Accepted</Badge>
      </div>
    </Card>
  );
}

export default async function BookingsPage({ params }: { params: Params }) {
  const { propertyId } = await params;

  let property: PropertyDetail;
  let bookings: Booking[];
  try {
    [property, bookings] = await Promise.all([
      api<PropertyDetail>(`/properties/${propertyId}`),
      api<Booking[]>(`/properties/${propertyId}/bookings`),
    ]);
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }

  const waiting = bookings.filter((booking) => booking.status === 'PENDING_APPROVAL');
  const accepted = bookings.filter((booking) => booking.status === 'CONFIRMED');

  return (
    <>
      <Link
        href={`/dashboard/properties/${propertyId}`}
        className="mb-4 inline-flex min-h-11 items-center text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
      >
        ← {property.name}
      </Link>

      <PageHeader
        eyebrow="Bookings"
        title={waiting.length > 0 ? 'Waiting on you' : 'Bookings'}
        subtitle={
          waiting.length > 0
            ? `${waiting.length} ${waiting.length === 1 ? 'person has' : 'people have'} paid and are waiting for your answer.`
            : 'Nobody is waiting on a decision.'
        }
      />

      {waiting.length > 0 ? (
        <ul className="stagger mb-8 grid gap-4">
          {waiting.map((booking) => (
            <Waiting key={booking.id} booking={booking} propertyId={propertyId} />
          ))}
        </ul>
      ) : (
        <EmptyState
          title="Nothing to decide"
          description="When somebody books and pays, they appear here for you to accept. Their money is held until they arrive, so there is no rush beyond the clock on each booking."
        />
      )}

      {accepted.length > 0 ? (
        <section>
          <h2 className="display mb-4 text-lg">Accepted, not yet moved in</h2>
          <ul className="grid gap-4">
            {accepted.map((booking) => (
              <Accepted key={booking.id} booking={booking} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
