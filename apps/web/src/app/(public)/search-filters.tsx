'use client';

import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import type { LocalityCount } from '@/lib/types';

const GENDERS: Array<[string, string]> = [
  ['', 'Anyone'],
  ['MEN', 'Men'],
  ['WOMEN', 'Women'],
  ['CO_LIVING', 'Co-living'],
];

const SHARING: Array<[string, string]> = [
  ['', 'Any room'],
  ['SINGLE', 'Single'],
  ['DOUBLE', '2-sharing'],
  ['TRIPLE', '3-sharing'],
  ['QUAD', '4-sharing'],
];

const BUDGETS: Array<[string, string]> = [
  ['', 'Any budget'],
  ['500000', 'Under ₹5,000'],
  ['700000', 'Under ₹7,000'],
  ['900000', 'Under ₹9,000'],
  ['1200000', 'Under ₹12,000'],
];

/**
 * Filters live in the URL, not in component state.
 *
 * A tenant sends a friend "PGs in Madhapur under 7k" and the link has to
 * carry the search. It also means the back button behaves, and every filtered
 * view is something a search engine can index.
 */
export function SearchFilters({ localities }: { localities: LocalityCount[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    // Any change to the filters puts you back on page one; staying on page 4
    // of a different result set is nonsense.
    next.delete('page');

    startTransition(() => {
      router.push(`${pathname}?${next.toString()}` as Route, { scroll: false });
    });
  };

  const select = (key: string, options: Array<[string, string]>, label: string) => (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        value={params.get(key) ?? ''}
        onChange={(event) => set(key, event.target.value)}
        disabled={pending}
        aria-label={label}
        className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm"
      >
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );

  const localityOptions: Array<[string, string]> = [
    ['', 'Anywhere in Hyderabad'],
    ...localities.map(
      (locality) => [locality.id, `${locality.name} (${locality.count})`] as [string, string],
    ),
  ];

  return (
    <div
      className={
        'grid gap-2 sm:grid-cols-2 lg:grid-cols-4 ' + (pending ? 'opacity-60' : '')
      }
      aria-busy={pending}
    >
      {select('localityId', localityOptions, 'Area')}
      {select('gender', GENDERS, 'Who it is for')}
      {select('sharing', SHARING, 'Room type')}
      {select('maxRentPaise', BUDGETS, 'Budget')}
    </div>
  );
}
