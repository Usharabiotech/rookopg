import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, isApiError } from '@/lib/api';
import { Alert, Card, PageHeader } from '@/components/ui';
import { sharingLabel } from '@/lib/format';
import type { PropertyDetail, Room } from '@/lib/types';
import { SeatForm } from './seat-form';

export const metadata: Metadata = { title: 'Move a tenant in' };

type Params = Promise<{ propertyId: string; bedId: string }>;

export default async function SeatTenantPage({ params }: { params: Params }) {
  const { propertyId, bedId } = await params;

  let property: PropertyDetail;
  let rooms: Room[];
  try {
    [property, rooms] = await Promise.all([
      api<PropertyDetail>(`/properties/${propertyId}`),
      api<Room[]>(`/properties/${propertyId}/rooms`),
    ]);
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }

  const room = rooms.find((candidate) => candidate.beds.some((bed) => bed.id === bedId));
  const bed = room?.beds.find((candidate) => candidate.id === bedId);
  if (!room || !bed) notFound();

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-lg">
      {/* Inline template rather than a variable: typed routes can only
          verify the literal form. */}
      <Link
        href={`/properties/${propertyId}`}
        className="mb-4 inline-flex min-h-11 items-center text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
      >
        ← {property.name}
      </Link>

      <PageHeader
        eyebrow={`Room ${room.code} · bed ${bed.code} · ${sharingLabel(room.sharingType)}`}
        title="Move a tenant in"
      />

      {bed.occupied ? (
        <Alert>
          Someone is already in this bed. Go back and pick another, or check the current tenant out
          first.
        </Alert>
      ) : (
        <Card>
          <SeatForm
            propertyId={propertyId}
            bedId={bed.id}
            roomCode={room.code}
            bedCode={bed.code}
            defaultRentRupees={String(Math.round(bed.rentPaise / 100))}
            defaultDepositRupees={String(Math.round(room.depositPaise / 100))}
            today={today}
          />
        </Card>
      )}
    </div>
  );
}
