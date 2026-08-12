import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { getLocalities, searchListings, type SearchParams } from '@/lib/public-api';
import { EmptyState } from '@/components/ui';
import { ListingCard } from './listing-card';
import { SearchFilters } from './search-filters';

export const metadata: Metadata = {
  title: 'PGs and hostels in Hyderabad',
  description:
    'Find a PG or hostel bed in Hyderabad — Madhapur, Gachibowli, Ameerpet and more. Real photos, real prices, live availability.',
  alternates: { canonical: '/' },
};

type Search = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function HomePage({ searchParams }: { searchParams: Search }) {
  const raw = await searchParams;

  const params: SearchParams = {
    ...(first(raw['localityId']) ? { localityId: first(raw['localityId'])! } : {}),
    ...(first(raw['q']) ? { q: first(raw['q'])! } : {}),
    ...(first(raw['gender']) ? { gender: first(raw['gender'])! } : {}),
    ...(first(raw['sharing']) ? { sharing: first(raw['sharing'])! } : {}),
    ...(first(raw['maxRentPaise']) ? { maxRentPaise: first(raw['maxRentPaise'])! } : {}),
    ...(first(raw['page']) ? { page: first(raw['page'])! } : {}),
  };

  const [{ results, total, page, pageSize }, localities] = await Promise.all([
    searchListings(params),
    getLocalities(),
  ]);

  const filtered = Object.keys(params).some((key) => key !== 'page');
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const pageHref = (target: number): Route => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== 'page') next.set(key, value);
    }
    if (target > 1) next.set('page', String(target));
    const query = next.toString();
    return (query ? `/?${query}` : '/') as Route;
  };

  return (
    <>
      <section className="border-b border-[var(--border)] bg-[var(--bg-deep)]">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
          <h1 className="display max-w-2xl text-3xl leading-tight sm:text-4xl">
            A bed in Hyderabad, without the phone calls.
          </h1>
          <p className="mt-3 max-w-xl text-[var(--text-muted)]">
            Real photos, the actual rent, and how many beds are free right now.
          </p>

          <div className="mt-7">
            <SearchFilters localities={localities} />
          </div>

          {localities.length > 0 ? (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="eyebrow">Popular</span>
              {localities.slice(0, 6).map((locality) => (
                <Link
                  key={locality.id}
                  href={`/?localityId=${locality.id}` as Route}
                  className="pressable rounded-full border border-[var(--border-strong)] px-3 py-1 text-xs font-medium hover:border-brass-300"
                >
                  {locality.name}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="display text-xl">
            {total === 0
              ? 'Nothing matching yet'
              : `${total} ${total === 1 ? 'place' : 'places'} with a free bed`}
          </h2>
          {filtered ? (
            <Link href="/" className="text-sm underline hover:text-brass-600">
              Clear filters
            </Link>
          ) : null}
        </div>

        {results.length === 0 ? (
          <EmptyState
            title="No PGs match that yet"
            description={
              filtered
                ? 'Try widening the area or the budget. We are adding new places in Hyderabad every week.'
                : 'The first listings are being added now. Check back shortly.'
            }
          />
        ) : (
          <ul className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((listing) => (
              <ListingCard key={listing.slug} listing={listing} />
            ))}
          </ul>
        )}

        {pages > 1 ? (
          <nav aria-label="Pages" className="mt-8 flex items-center justify-center gap-2">
            {page > 1 ? (
              <Link
                href={pageHref(page - 1)}
                className="pressable min-h-11 rounded-lg border border-[var(--border-strong)] px-4 text-sm font-medium"
              >
                Previous
              </Link>
            ) : null}
            <span className="figure px-3 text-sm text-[var(--text-muted)]">
              {page} of {pages}
            </span>
            {page < pages ? (
              <Link
                href={pageHref(page + 1)}
                className="pressable min-h-11 rounded-lg border border-[var(--border-strong)] px-4 text-sm font-medium"
              >
                Next
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </>
  );
}
