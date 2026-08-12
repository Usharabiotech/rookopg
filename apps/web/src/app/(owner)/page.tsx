import type { Metadata } from 'next';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Badge, Card, EmptyState, LinkButton, PageHeader, Stat } from '@/components/ui';
import { genderLabel } from '@/lib/format';
import type { AuthUser, PropertySummary } from '@/lib/types';
import { CreateOrganisationForm } from './create-organisation-form';

export const metadata: Metadata = { title: 'Properties' };

function OccupancyBar({ available, total }: { available: number; total: number }) {
  const taken = Math.max(0, total - available);
  const percent = total === 0 ? 0 : Math.round((taken / total) * 100);

  return (
    <div
      className="mt-4 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-[var(--bg-deep)]"
      role="img"
      aria-label={`${percent}% occupied`}
    >
      <div className="h-full rounded-full bg-brass-500" style={{ width: `${percent}%` }} />
    </div>
  );
}

function PropertyCard({ property }: { property: PropertySummary }) {
  const notSetUp = property.totalBeds === 0;

  return (
    <li>
      <Link
        href={`/properties/${property.id}`}
        className="lift block h-full rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] hover:border-brass-300"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="display truncate text-lg leading-snug">{property.name}</h2>
            <p className="mt-0.5 truncate text-sm text-[var(--text-muted)]">
              {property.localityName} · {genderLabel(property.genderPolicy)}
            </p>
          </div>
          <Badge tone={property.listingStatus === 'PUBLISHED' ? 'free' : 'neutral'}>
            {property.listingStatus === 'PUBLISHED' ? 'Live' : 'Draft'}
          </Badge>
        </div>

        {notSetUp ? (
          <p className="mt-5 text-sm font-medium text-brass-600">
            No rooms yet — open it to set up the building
          </p>
        ) : (
          <>
            <div className="mt-5 flex gap-7">
              <Stat value={property.availableBeds} label="free" tone="free" />
              <Stat value={property.totalBeds - property.availableBeds} label="taken" tone="taken" />
              <Stat value={property.roomCount} label="rooms" />
            </div>
            <OccupancyBar available={property.availableBeds} total={property.totalBeds} />
          </>
        )}
      </Link>
    </li>
  );
}

/** First run: name the business. Two columns on desktop so the page is not
 *  one small card adrift in a wide window. */
function FirstRun() {
  const steps = [
    { n: '1', title: 'Name the business', body: 'The name tenants and your staff will see.' },
    { n: '2', title: 'Add a building', body: 'Address, who can stay, food and facilities.' },
    { n: '3', title: 'Lay out the rooms', body: 'Describe each floor once — beds are created for you.' },
  ];

  return (
    <div className="mx-auto grid max-w-4xl items-start gap-8 py-4 lg:grid-cols-[1fr_18rem] lg:gap-14 lg:py-10">
      <div className="rise">
        <p className="eyebrow">Getting started</p>
        <h1 className="display mt-2 text-3xl leading-tight sm:text-4xl">Set up your business</h1>
        <p className="mt-2 max-w-md text-[var(--text-muted)]">
          Start with the name. You can add your buildings straight after.
        </p>

        <Card className="mt-7">
          <CreateOrganisationForm />
        </Card>
      </div>

      {/* Ordered because it genuinely is a sequence — each step needs the one
          before it to exist. */}
      <ol className="rise space-y-5 rounded-[var(--radius-card)] border border-dashed border-[var(--border-strong)] p-5">
        <li className="eyebrow">What happens next</li>
        {steps.map((step) => (
          <li key={step.n} className="flex gap-3">
            <span className="figure mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-[var(--border-strong)] text-xs font-semibold text-[var(--text-muted)]">
              {step.n}
            </span>
            <span>
              <span className="block text-sm font-semibold">{step.title}</span>
              <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{step.body}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default async function PropertiesPage() {
  const user = await api<AuthUser>('/auth/me');
  const membership = user.memberships[0];

  if (!membership) return <FirstRun />;

  const properties = await api<PropertySummary[]>(`/orgs/${membership.orgId}/properties`);
  const totalBeds = properties.reduce((sum, p) => sum + p.totalBeds, 0);
  const freeBeds = properties.reduce((sum, p) => sum + p.availableBeds, 0);

  return (
    <>
      <PageHeader
        eyebrow={`${properties.length} ${properties.length === 1 ? 'building' : 'buildings'}`}
        title="Properties"
        {...(totalBeds > 0
          ? { subtitle: `${freeBeds} of ${totalBeds} beds free across your buildings.` }
          : {})}
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
          title="No buildings yet"
          description={
            membership.canCreateProperties
              ? 'Add your first PG or hostel, then lay out its rooms and beds.'
              : 'Ask the owner to add a building, or to let you add one.'
          }
          action={
            membership.canCreateProperties ? (
              <LinkButton href="/properties/new">Add a PG</LinkButton>
            ) : null
          }
        />
      ) : (
        <ul className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </ul>
      )}
    </>
  );
}
