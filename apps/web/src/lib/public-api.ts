import { gateHeaders } from './api';
import 'server-only';
import type { ListingCard, LocalityCount, PublicListing, SearchResults } from './types';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3001/api/v1';

/**
 * The unauthenticated half of the API.
 *
 * Kept apart from lib/api.ts on purpose: nothing here reads a cookie or a
 * token, so a public page cannot accidentally leak a session into a cached
 * response.
 */
async function publicGet<T>(path: string, revalidate: number): Promise<T | null> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: 'application/json', ...gateHeaders() },
    next: { revalidate },
  });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

export interface SearchParams {
  localityId?: string;
  q?: string;
  gender?: string;
  sharing?: string;
  maxRentPaise?: string;
  amenities?: string;
  page?: string;
}

export async function searchListings(params: SearchParams): Promise<SearchResults> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }

  // Short cache: listings change when an owner fills a bed, and showing a bed
  // that has gone is the fastest way to lose a tenant's trust.
  const results = await publicGet<SearchResults>(`/public/listings?${query}`, 60);
  return results ?? { results: [], total: 0, page: 1, pageSize: 20 };
}

export async function getListing(slug: string): Promise<PublicListing | null> {
  return publicGet<PublicListing>(`/public/listings/${encodeURIComponent(slug)}`, 60);
}

export async function getLocalities(): Promise<LocalityCount[]> {
  // Localities barely move; an hour is plenty.
  return (await publicGet<LocalityCount[]>('/public/localities', 3600)) ?? [];
}

export type { ListingCard };
