/**
 * Mirrors the backend's room numbering so the form can show exactly what it
 * is about to create. Kept in step with apps/backend/src/modules/inventory/
 * bed-labels.ts — if one changes, change both.
 */
export function roomCode(floor: number, index: number): string {
  const number = index.toString().padStart(2, '0');
  return floor === 0 ? `G${number}` : `${floor}${number}`;
}

export const BEDS_PER_SHARING: Record<string, number | null> = {
  SINGLE: 1,
  DOUBLE: 2,
  TRIPLE: 3,
  QUAD: 4,
  // A dormitory has no implied size — the owner has to say.
  DORMITORY: null,
};

export interface RoomSet {
  key: number;
  floor: number;
  roomCount: string;
  sharing: string;
  capacity: string;
  /** Per set, not per property. A co-living building puts men on one floor
   *  and women on another, and some rooms are open to both. */
  gender: string;
  /** PER_BED sells each bed separately; WHOLE_ROOM rents the room as one
   *  unit, which is how a couple or a family takes a private room. */
  saleMode: string;
  rent: string;
  deposit: string;
  hasAc: boolean;
  hasBath: boolean;
  /** Blank means "carry on from the last set on this floor". */
  startOverride: string;
}

export interface ResolvedSet {
  set: RoomSet;
  startNumber: number;
  bedsPerRoom: number;
  codes: string[];
}

/**
 * Turns what a person types into the position of the room on its floor.
 *
 * People think in room numbers, not offsets: on floor 1 they will write 104
 * for the fourth room. Internally a set starts at a position (4), because
 * that is what the room code is built from. Accepts either — "104" and "4"
 * both mean the fourth room — so the field can be labelled honestly.
 */
export function parseFirstRoomNumber(input: string): number | null {
  const digits = input.replace(/\D/g, '');
  if (digits === '') return null;

  const value = Number(digits);
  if (!Number.isFinite(value) || value <= 0) return null;

  // Three or more digits carries the floor prefix: 104 -> 4, 1205 -> 5.
  const position = digits.length >= 3 ? value % 100 : value;
  return position >= 1 && position <= 99 ? position : null;
}

/**
 * Works out where each set starts.
 *
 * A floor commonly mixes sharing types — three 2-sharing rooms and three
 * 3-sharing rooms is an ordinary Hyderabad PG. Each set continues the
 * numbering of the previous set on the same floor, so 101-103 is followed by
 * 104-106. Numbering is tracked per floor, so starting floor 2 begins at 201
 * rather than carrying on from where floor 1 finished.
 */
export function resolveSets(sets: RoomSet[]): ResolvedSet[] {
  const nextOnFloor = new Map<number, number>();

  return sets.map((set) => {
    const rooms = Number(set.roomCount) || 0;
    const carriedOn = nextOnFloor.get(set.floor) ?? 1;
    const typed = parseFirstRoomNumber(set.startOverride);
    const startNumber = typed ?? carriedOn;

    nextOnFloor.set(set.floor, startNumber + rooms);

    const implied = BEDS_PER_SHARING[set.sharing];
    const bedsPerRoom = implied ?? (Number(set.capacity) || 0);

    return {
      set,
      startNumber,
      bedsPerRoom,
      // Whether the start was typed or carried on, the code is always built
      // the same way — so what the heading previews is what gets created.
      codes: Array.from({ length: rooms }, (_, i) => roomCode(set.floor, startNumber + i)),
    };
  });
}

/** "101–103", or "101, 103, 105" if they are not contiguous. */
export function describeCodes(codes: string[]): string {
  if (codes.length === 0) return '—';
  if (codes.length === 1) return codes[0] as string;
  return `${codes[0]}–${codes[codes.length - 1]}`;
}

export function duplicateCodes(resolved: ResolvedSet[]): string[] {
  const seen = new Set<string>();
  const clashes = new Set<string>();
  for (const item of resolved) {
    for (const code of item.codes) {
      if (seen.has(code)) clashes.add(code);
      seen.add(code);
    }
  }
  return [...clashes];
}
