import Link from 'next/link';
import { amenityShortLabel, cardAmenities } from '@/lib/amenities';
import { genderLabel, rupeesShort, sharingLabel } from '@/lib/format';
import type { ListingCard as Listing } from '@/lib/types';

const FOOD_LABELS: Record<string, string> = {
  VEG: 'Veg food',
  NON_VEG: 'Non-veg food',
  BOTH: 'Veg & non-veg',
  NONE: 'No food',
};

export function ListingCard({ listing }: { listing: Listing }) {
  // Only a handful, and only the ones a tenant actually chooses on.
  const shown = cardAmenities(listing.amenityCodes);

  return (
    <li>
      <Link
        href={`/pg/${listing.slug}`}
        className="lift flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)] hover:border-brass-300"
      >
        <div className="relative aspect-4/3 bg-[var(--bg-deep)]">
          {listing.coverPhotoId ? (
            // Served straight from the public API — no session involved, so
            // this can be cached by a CDN.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/public-photo/${listing.coverPhotoId}?variant=thumb`}
              alt={`${listing.name} in ${listing.localityName}`}
              loading="lazy"
              decoding="async"
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-xs text-[var(--text-muted)]">
              No photo yet
            </div>
          )}

          <span className="absolute left-2 top-2 rounded-md bg-ink-950/80 px-2 py-0.5 text-xs font-medium text-white">
            {genderLabel(listing.genderPolicy)}
          </span>
          {listing.freeBeds > 0 ? (
            <span className="figure absolute right-2 top-2 rounded-md bg-moss-600 px-2 py-0.5 text-xs font-semibold text-white">
              {listing.freeBeds} free
            </span>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col p-4">
          <h3 className="display truncate text-base leading-snug">{listing.name}</h3>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">{listing.localityName}</p>

          {listing.headline ? (
            <p className="mt-2 line-clamp-2 text-sm text-[var(--text-muted)]">{listing.headline}</p>
          ) : null}

          <ul className="mt-3 flex flex-wrap gap-1.5">
            {listing.foodType && listing.foodType !== 'NONE' ? (
              <li className="rounded-md bg-[var(--bg-deep)] px-2 py-0.5 text-xs">
                {FOOD_LABELS[listing.foodType]}
              </li>
            ) : null}
            {shown.map((code) => (
              <li key={code} className="rounded-md bg-[var(--bg-deep)] px-2 py-0.5 text-xs">
                {amenityShortLabel(code)}
              </li>
            ))}
          </ul>

          <div className="mt-auto flex items-end justify-between gap-2 pt-4">
            <p className="text-xs text-[var(--text-muted)]">
              {listing.sharingOptions
                .slice(0, 2)
                .map((option) => sharingLabel(option.sharingType))
                .join(' · ')}
            </p>
            <p className="text-right">
              <span className="figure text-lg font-semibold">
                {rupeesShort(listing.fromRentPaise)}
              </span>
              <span className="block text-xs text-[var(--text-muted)]">per month</span>
            </p>
          </div>
        </div>
      </Link>
    </li>
  );
}
