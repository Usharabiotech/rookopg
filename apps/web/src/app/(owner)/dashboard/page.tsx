import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { Card, EmptyState, LinkButton, PageHeader } from '@/components/ui';
import { PropertySearch } from './property-search';
import type { AuthUser, PropertySummary } from '@/lib/types';
import { CreateOrganisationForm } from './create-organisation-form';

export const metadata: Metadata = { title: 'Properties' };



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

  const unsorted = await api<PropertySummary[]>(`/orgs/${membership.orgId}/properties`);

  /*
   * Order by what needs the owner, not by whatever the database returned.
   *
   * A building with no rooms cannot take a single booking, so it goes first
   * however long it has sat there. Live listings next, because those are the
   * ones earning. Drafts last. Alphabetical within each, so a building keeps
   * roughly the same place in the list from one visit to the next.
   */
  const properties = [...unsorted].sort((a, b) => {
    const rank = (p: PropertySummary) =>
      p.roomCount === 0 ? 0 : p.listingStatus === 'PUBLISHED' ? 1 : 2;
    return rank(a) - rank(b) || a.name.localeCompare(b.name);
  });
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
            <LinkButton href="/dashboard/properties/new" className="shrink-0">
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
              <LinkButton href="/dashboard/properties/new">Add a PG</LinkButton>
            ) : null
          }
        />
      ) : (
        <PropertySearch properties={properties} />
      )}
    </>
  );
}
