import type { Metadata } from 'next';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Badge, Card, EmptyState, LinkButton, PageHeader, Stat } from '@/components/ui';
import { genderLabel, occupancyLabel } from '@/lib/format';
import type { AuthUser, PropertySummary } from '@/lib/types';
import { CreateOrganisationForm } from './create-organisation-form';

export const metadata: Metadata = { title: 'Properties' };

function OccupancyBar({ available, total }: { available: number; total: number }) {
  const occupied = Math.max(0, total - available);
  const percent = total === 0 ? 0 : Math.round((occupied / total) * 100);

  return (
    <div className="mt-3">
      <div
        className="h-1.5 overflow-hidden rounded-full bg-sand-200 dark:bg-ink-800"
        role="img"
        aria-label={`${percent}% occupied`}
      >
        <div className="h-full rounded-full bg-teal-600" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function PropertyCard({ property }: { property: PropertySummary }) {
  const notSetUp = property.totalBeds === 0;

  return (
    <Card as="li" className="transition-colors hover:border-teal-500/50">
      <Link href={`/properties/${property.id}`} className="block">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-semibold">{property.name}</h2>
            <p className="mt-0.5 truncate text-sm text-[var(--text-muted)]">
              {property.localityName} · {genderLabel(property.genderPolicy)}
            </p>
          </div>
          <Badge tone={property.listingStatus === 'PUBLISHED' ? 'success' : 'neutral'}>
            {property.listingStatus === 'PUBLISHED' ? 'Live' : 'Draft'}
          </Badge>
        </div>

        {notSetUp ? (
          <p className="mt-3 text-sm font-medium text-clay-600">
            No rooms yet — tap to set up the building
          </p>
        ) : (
          <>
            <div className="mt-4 flex gap-6">
              <Stat value={property.totalBeds} label="beds" />
              <Stat value={property.availableBeds} label="free" />
              <Stat value={property.roomCount} label="rooms" />
            </div>
            <OccupancyBar available={property.availableBeds} total={property.totalBeds} />
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              {occupancyLabel(property.availableBeds, property.totalBeds)}
            </p>
          </>
        )}
      </Link>
    </Card>
  );
}

export default async function PropertiesPage() {
  const user = await api<AuthUser>('/auth/me');
  const membership = user.memberships[0];

  // A brand-new account has no organisation yet — the first thing to do is
  // name the business.
  if (!membership) {
    return (
      <>
        <PageHeader
          title="Set up your business"
          subtitle="Tell us the name of your PG business. You can add buildings next."
        />
        <Card className="max-w-md">
          <CreateOrganisationForm />
        </Card>
      </>
    );
  }

  const properties = await api<PropertySummary[]>(`/orgs/${membership.orgId}/properties`);
  const totalBeds = properties.reduce((sum, property) => sum + property.totalBeds, 0);
  const freeBeds = properties.reduce((sum, property) => sum + property.availableBeds, 0);

  return (
    <>
      <PageHeader
        title="Properties"
        subtitle={
          properties.length > 0
            ? `${properties.length} ${properties.length === 1 ? 'building' : 'buildings'} · ${freeBeds} of ${totalBeds} beds free`
            : undefined
        }
        action={
          membership.canCreateProperties ? (
            <LinkButton href="/properties/new" className="shrink-0">
              Add a PG
            </LinkButton>
          ) : null
        }
      />

      {properties.length === 0 ? (
        <EmptyState
          title="No properties yet"
          description={
            membership.canCreateProperties
              ? 'Add your first PG or hostel, then set up its rooms and beds.'
              : 'Ask the owner to add a property or give you permission to add one.'
          }
          action={
            membership.canCreateProperties ? (
              <LinkButton href="/properties/new">Add a PG</LinkButton>
            ) : null
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </ul>
      )}
    </>
  );
}
