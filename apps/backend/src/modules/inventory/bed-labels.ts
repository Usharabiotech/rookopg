import { SharingType } from '@prisma/client';

/**
 * Beds within a room are labelled A, B, C … then AA, AB for the rare
 * dormitory with more than 26. Owners read these aloud to tenants, so short
 * and speakable beats a uuid.
 */
export function bedLabel(index: number): string {
  let n = index;
  let label = '';
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

export function bedLabels(count: number): string[] {
  return Array.from({ length: count }, (_, index) => bedLabel(index));
}

const CAPACITY_BY_SHARING: Record<SharingType, number | null> = {
  [SharingType.SINGLE]: 1,
  [SharingType.DOUBLE]: 2,
  [SharingType.TRIPLE]: 3,
  [SharingType.QUAD]: 4,
  // A dormitory has no implied size — the owner must say.
  [SharingType.DORMITORY]: null,
};

export function defaultCapacityFor(sharingType: SharingType): number | null {
  return CAPACITY_BY_SHARING[sharingType];
}

/**
 * Rooms are numbered by floor: floor 2, third room -> "203".
 * Floor 0 is treated as the ground floor and numbered 01, 02 …
 */
export function roomCode(floor: number, index: number): string {
  const number = index.toString().padStart(2, '0');
  return floor === 0 ? `G${number}` : `${floor}${number}`;
}
