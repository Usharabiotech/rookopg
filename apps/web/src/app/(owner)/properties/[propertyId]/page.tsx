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
    // The API answers 404 for another organisation's property too, so this
    // covers "gone" and "not yours" without saying which.
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }

  const cheapest = rooms.length ? Math.min(...rooms.map((room) => room.baseRentPaise)) : 0;
  const taken = property.totalBeds - property.availableBeds;

  return (
    <>
      <Link
        href="/"
        className="mb-4 inline-flex min-h-11 items-center text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
      >
        ← All properties
      </Link>

      <PageHeader
        eyebrow={property.localityName}
        title={property.name}
        subtitle={`${genderLabel(property.genderPolicy)} · ${property.addressLine1} · ${property.pincode}`}
        action={
          <LinkButton
            href={`/properties/${property.id}/rooms`}
            variant={rooms.length === 0 ? 'primary' : 'secondary'}
            className="shrink-0"
          >
            {rooms.length === 0 ? 'Set up rooms' : 'Add rooms'}
          </LinkButton>
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
                action={<LinkButton href={`/properties/${property.id}/rooms`}>Set up rooms</LinkButton>}
              />
            ) : (
              <BedGrid rooms={rooms} />
            )}
          </Card>
        </div>

        {/* Summary rail: the numbers stay visible while the board scrolls. */}
        <aside className="order-1 space-y-4 lg:order-2 lg:sticky lg:top-6">
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
                      <Badge>{code.replace(/_/g, ' ').toLowerCase()}</Badge>
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
