'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui';
import type { PropertySummary } from '@/lib/types';
import { PropertyCard } from './property-card';

/**
 * A filter over buildings the owner already has on screen.
 *
 * Appears only once the list is long enough to be worth searching. Below that
 * a search box is furniture: an owner with three buildings can see all three.
 *
 * Filtering happens here rather than on the server because the whole list is
 * already loaded — a round trip per keystroke would be slower and no more
 * correct.
 */
const SEARCH_FROM = 8;

export function PropertySearch({ properties }: { properties: PropertySummary[] }) {
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return properties;
    return properties.filter((property) =>
      // Name and area, because those are what an owner has in their head.
      `${property.name} ${property.localityName}`.toLowerCase().includes(needle),
    );
  }, [properties, query]);

  const grid = (list: PropertySummary[]) => (
    <ul className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {list.map((property) => (
        <PropertyCard key={property.id} property={property} />
      ))}
    </ul>
  );

  if (properties.length < SEARCH_FROM) return grid(properties);

  return (
    <>
      <div className="mb-5">
        <label htmlFor="property-search" className="sr-only">
          Find a building
        </label>
        <Input
          id="property-search"
          type="search"
          placeholder="Find a building by name or area"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query && visible.length !== properties.length ? (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            {visible.length} of {properties.length}
          </p>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--text-muted)]">
          Nothing matches “{query}”.
        </p>
      ) : (
        grid(visible)
      )}
    </>
  );
}
