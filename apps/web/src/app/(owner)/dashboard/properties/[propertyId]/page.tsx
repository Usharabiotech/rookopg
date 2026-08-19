import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, isApiError } from '@/lib/api';
import { Badge, Card, EmptyState, LinkButton, PageHeader, Stat } from '@/components/ui';
import { amenityLabel } from '@/lib/amenities';
import { genderLabel, rupeesShort } from '@/lib/format';
import type { Booking, Media, PropertyDetail, Room, Tenancy } from '@/lib/types';
import { BedGrid } from './bed-grid';
import { PhotoGrid } from './photos/photo-grid';
import { PhotoUploader } from './photos/photo-uploader';
import { TenantList } from './tenant-list';

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
  let photos: Media[];
  let tenancies: Tenancy[];
  let bookings: Booking[];

  try {
    [property, rooms, photos, tenancies, bookings] = await Promise.all([
      api<PropertyDetail>(`/properties/${propertyId}`),
      api<Room[]>(`/properties/${propertyId}/rooms`),
      api<Media[]>(`/properties/${propertyId}/media`),
      api<Tenancy[]>(`/properties/${propertyId}/tenancies`),
      api<Booking[]>(`/properties/${propertyId}/bookings`),
    ]);
  } catch (error) {
    // The API answers 404 for another organisation's property too, so this
    // covers "gone" and "not yours" without saying which.
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }

  // Somebody has paid and is waiting on an answer. If the owner ignores it the
  // booking expires on its own, so this is the one number worth interrupting for.
  const waiting = bookings.filter((booking) => booking.status === 'PENDING_APPROVAL').length;

  const cheapest = rooms.length ? Math.min(...rooms.map((room) => room.baseRentPaise)) : 0;
  const taken = property.totalBeds - property.availableBeds;

  return (
    <>
      <Link
        href="/dashboard"
        className="mb-4 inline-flex min-h-11 items-center text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
      >
        ← All properties
      </Link>

      <PageHeader
        eyebrow={property.localityName}
        title={property.name}
        subtitle={`${genderLabel(property.genderPolicy)} · ${property.addressLine1} · ${property.pincode}`}
        action={
          <div className="flex shrink-0 flex-wrap gap-2">
            {waiting > 0 ? (
              <LinkButton href={`/dashboard/properties/${property.id}/bookings`}>
                {waiting} waiting on you
              </LinkButton>
            ) : (
              <LinkButton
                href={`/dashboard/properties/${property.id}/bookings`}
                variant="secondary"
              >
                Bookings
              </LinkButton>
            )}
            {tenancies.length > 0 ? (
              <LinkButton href={`/dashboard/properties/${property.id}/rent`}>Rent</LinkButton>
            ) : null}
            <LinkButton href={`/dashboard/properties/${property.id}/checkin`}>
              Check in
            </LinkButton>
            <LinkButton
              href={`/dashboard/properties/${property.id}/rooms`}
              variant={rooms.length === 0 ? 'primary' : 'secondary'}
            >
              {rooms.length === 0 ? 'Set up rooms' : 'Add rooms'}
            </LinkButton>
            <LinkButton href={`/dashboard/properties/${property.id}/edit`} variant="secondary">
              Edit
            </LinkButton>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_16rem] lg:items-start">
        <div className="order-2 lg:order-1">
          <Card>
            <h2 className="display mb-5 text-lg">Rooms and beds</h2>
            {rooms.length === 0 ? (
              <EmptyState
                title="Nothing set up yet"
                description="Describe the building floor by floor. Every room gets its beds automatically."
                action={<LinkButton href={`/dashboard/properties/${property.id}/rooms`}>Set up rooms</LinkButton>}
              />
            ) : (
              <BedGrid propertyId={property.id} rooms={rooms} tenancies={tenancies} />
            )}
          </Card>
        </div>

        <div className="order-3 lg:order-1 lg:col-start-1">
          <Card>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="display text-lg">Who is living here</h2>
              <p className="text-xs text-[var(--text-muted)]">
                {tenancies.length} {tenancies.length === 1 ? 'tenant' : 'tenants'}
              </p>
            </div>
            <TenantList propertyId={property.id} tenancies={tenancies} />
          </Card>
        </div>

        <div className="order-4 lg:order-1 lg:col-start-1">
          <Card>
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="display text-lg">Photos</h2>
              <p className="text-xs text-[var(--text-muted)]">
                {photos.length} of 60 · tenants decide from these
              </p>
            </div>
            <PhotoGrid propertyId={property.id} photos={photos} />
            <div className="mt-5 border-t border-[var(--border)] pt-5">
              <PhotoUploader propertyId={property.id} />
            </div>
          </Card>
        </div>

        <aside className="order-1 space-y-4 lg:order-2 lg:sticky lg:top-6 lg:row-start-1 lg:col-start-2">
          <Card>
            <div className="flex flex-wrap gap-x-7 gap-y-5 lg:grid lg:grid-cols-2">
              <Stat value={property.availableBeds} label="free now" tone="free" />
              <Stat value={taken} label="taken" tone="taken" />
              <Stat value={property.totalBeds} label="beds" />
              <Stat value={property.roomCount} label="rooms" />
            </div>
            {cheapest > 0 ? (
              <p className="mt-5 border-t border-[var(--border)] pt-4 text-sm text-[var(--text-muted)]">
                From <span className="figure font-semibold text-[var(--text)]">{rupeesShort(cheapest)}</span>{' '}
                per bed
              </p>
            ) : null}
          </Card>

          <Card>
            <p className="eyebrow mb-3">Listing</p>
            <Badge tone={property.listingStatus === 'PUBLISHED' ? 'free' : 'neutral'}>
              {property.listingStatus === 'PUBLISHED' ? 'Live' : 'Not listed yet'}
            </Badge>
            {property.mealPlan ? (
              <>
                <p className="eyebrow mb-2 mt-5">Food</p>
                <p className="text-sm">
                  {property.mealPlan.foodType === 'NONE'
                    ? 'No food provided'
                    : [
                        property.mealPlan.foodType === 'VEG' ? 'Veg' : property.mealPlan.foodType === 'BOTH' ? 'Veg & non-veg' : 'Non-veg',
                        [
                          property.mealPlan.breakfast && 'breakfast',
                          property.mealPlan.lunch && 'lunch',
                          property.mealPlan.dinner && 'dinner',
                        ]
                          .filter(Boolean)
                          .join(', '),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                </p>
              </>
            ) : null}
            {property.amenityCodes.length > 0 ? (
              <>
                <p className="eyebrow mb-2 mt-5">Facilities</p>
                <ul className="flex flex-wrap gap-1.5">
                  {property.amenityCodes.map((code) => (
                    <li key={code}>
                      <Badge>{amenityLabel(code)}</Badge>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </Card>
        </aside>
      </div>
    </>
  );
}
