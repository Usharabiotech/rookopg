import Link from 'next/link';
import { Badge, Stat } from '@/components/ui';
import { genderLabel } from '@/lib/format';
import type { PropertySummary } from '@/lib/types';

/*
  Lives in its own file because the search box renders it.

  A client component cannot be handed a function to call, so the filtering and
  the drawing have to sit on the same side of the boundary — the render-prop
  version typechecked cleanly and then died at runtime with "Functions are not
  valid as a child of Client Components".
*/

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

export function PropertyCard({ property }: { property: PropertySummary }) {
  const notSetUp = property.totalBeds === 0;

  return (
    <li>
      <Link
        href={`/dashboard/properties/${property.id}`}
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
          <p className="mt-5 text-sm font-medium text-[var(--accent-text)]">
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
