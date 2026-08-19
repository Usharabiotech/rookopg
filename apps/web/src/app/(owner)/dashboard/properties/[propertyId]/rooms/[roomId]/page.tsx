import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, isApiError } from '@/lib/api';
import { PageHeader } from '@/components/ui';
import { sharingLabel } from '@/lib/format';
import type { PropertyDetail, Room } from '@/lib/types';
import { RoomForm } from './room-form';

export const metadata: Metadata = { title: 'Edit room' };

type Params = Promise<{ propertyId: string; roomId: string }>;

export default async function EditRoomPage({ params }: { params: Params }) {
  const { propertyId, roomId } = await params;

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

  // Rooms come with the property, so there is no separate room endpoint to call.
  const room = rooms.find((candidate) => candidate.id === roomId);
  if (!room) notFound();

  const occupiedBeds = room.beds.filter((bed) => bed.occupied).length;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/dashboard/properties/${propertyId}`}
        className="mb-4 inline-flex min-h-11 items-center text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
      >
        ← {property.name}
      </Link>

      <PageHeader
        eyebrow={`Room ${room.code}`}
        title="Edit room"
        subtitle={`${sharingLabel(room.sharingType)} · ${room.beds.length} ${room.beds.length === 1 ? 'bed' : 'beds'}`}
      />

      <RoomForm
        room={room}
        propertyId={propertyId}
        occupiedBeds={occupiedBeds}
        mixedGender={property.genderPolicy === 'CO_LIVING'}
      />
    </div>
  );
}
