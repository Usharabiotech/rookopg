/**
 * Money is integer paise everywhere in this system. It becomes rupees only at
 * the moment it is shown to a person.
 */
export function rupees(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

/** Compact form for dense screens: ₹7,000 rather than ₹7,000.00 */
export function rupeesShort(paise: number): string {
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(paise / 100)}`;
}

export function rupeesToPaise(rupeeAmount: string | number): number {
  const value = typeof rupeeAmount === 'string' ? Number(rupeeAmount.replace(/[^\d.]/g, '')) : rupeeAmount;
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

const SHARING_LABELS: Record<string, string> = {
  SINGLE: 'Single',
  DOUBLE: '2-sharing',
  TRIPLE: '3-sharing',
  QUAD: '4-sharing',
  DORMITORY: 'Dormitory',
};

export function sharingLabel(sharingType: string): string {
  return SHARING_LABELS[sharingType] ?? sharingType;
}

const GENDER_LABELS: Record<string, string> = {
  MEN: "Men's",
  WOMEN: "Women's",
  CO_LIVING: 'Co-living',
  ANY: 'Any',
};

export function genderLabel(policy: string): string {
  return GENDER_LABELS[policy] ?? policy;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

/** "12 of 32 beds free" reads better than a bare percentage. */
export function occupancyLabel(available: number, total: number): string {
  if (total === 0) return 'No beds set up yet';
  if (available === 0) return 'Full';
  return `${available} of ${total} free`;
}
