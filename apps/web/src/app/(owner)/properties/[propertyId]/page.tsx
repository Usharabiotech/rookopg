import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, isApiError } from '@/lib/api';
import { Badge, Card, EmptyState, LinkButton, PageHeader, Stat } from '@/components/ui';
import { genderLabel, rupeesShort } from '@/lib/format';
import type { PropertyDetail, Room } from '@/lib/types';
import { BedGrid } from './bed-grid';

type Params = Promise<{ propertyId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { propertyId } = await params;
  try {
    const property = await api<PropertyDetail>(`/properties/${propertyId}`);
    return { title: property.name };
  } catch {
    return { title: 'Property' };
  }
}

export default async function PropertyPage({ params }: { params: Params }) {
  const { propertyId } = await params;

  let property: PropertyDetail;
  let rooms: Room[];

  try {
    [property, rooms] = await Promise.all([
      api<PropertyDetail>(`/properties/${propertyId}`),
      api<Room[]>(`/properties/${propertyId}/rooms`),
    ]);
  } catch (error) {
    // The API returns 404 for another organisation's property too, so this
    // covers both "gone" and "not yours" without leaking which.
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }

  const cheapest = rooms.length
    ? Math.min(...rooms.map((room) => room.baseRentPaise))
    : 0;

  return (
    <>
      <Link
        href="/"
        className="mb-3 inline-flex min-h-11 items-center text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        ← All properties
      </Link>

      <PageHeader
        title={property.name}
        subtitle={`${property.localityName} · ${genderLabel(property.genderPolicy)} · ${property.pincode}`}
        action={
          <LinkButton href={`/properties/${property.id}/rooms`} variant="secondary">
            {rooms.length === 0 ? 'Set up rooms' : 'Add rooms'}
          </LinkButton>
        }
      />

      <Card className="mb-5">
        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <Stat value={property.totalBeds} label="beds" />
          <Stat value={property.availableBeds} label="free now" />
          <Stat value={property.roomCount} label="rooms" />
          {cheapest > 0 ? <Stat value={rupeesShort(cheapest)} label="from" /> : null}
          <div className="ml-auto self-center">
            <Badge tone={property.listingStatus === 'PUBLISHED' ? 'success' : 'neutral'}>
              {property.listingStatus === 'PUBLISHED' ? 'Live' : 'Not listed yet'}
            </Badge>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-semibold">Rooms and beds</h2>
        {rooms.length === 0 ? (
          <EmptyState
            title="No rooms yet"
            description="Set up the building floor by floor — every room gets its beds automatically."
            action={
              <LinkButton href={`/properties/${property.id}/rooms`}>Set up rooms</LinkButton>
            }
          />
        ) : (
          <BedGrid rooms={rooms} />
        )}
      </Card>

      {property.amenityCodes.length > 0 ? (
        <Card className="mt-5">
          <h2 className="mb-3 font-semibold">Facilities</h2>
          <ul className="flex flex-wrap gap-2">
            {property.amenityCodes.map((code) => (
              <li key={code}>
                <Badge>{code.replace(/_/g, ' ').toLowerCase()}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
