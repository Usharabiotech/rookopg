import { describeCodes, duplicateCodes, parseFirstRoomNumber, resolveSets, roomCode } from './room-codes';
import type { RoomSet } from './room-codes';

let key = 0;
function set(overrides: Partial<RoomSet> = {}): RoomSet {
  key += 1;
  return {
    key,
    floor: 1,
    roomCount: '3',
    sharing: 'TRIPLE',
    capacity: '',
    gender: 'MEN',
    saleMode: 'PER_BED',
    rent: '7000',
    deposit: '',
    hasAc: false,
    hasBath: false,
    startOverride: '',
    ...overrides,
  };
}

describe('parseFirstRoomNumber', () => {
  // The field is labelled "First room number", so a person types the number
  // painted on the door. Typing 101 must not produce room 1101.
  it.each([
    ['101', 1],
    ['104', 4],
    ['112', 12],
    ['201', 1],
    ['1205', 5],
    ['4', 4],
    ['12', 12],
  ])('reads %s as position %i', (input, expected) => {
    expect(parseFirstRoomNumber(input)).toBe(expected);
  });

  it.each(['', '   ', 'abc', '0', '100', '200'])('rejects %s', (input) => {
    expect(parseFirstRoomNumber(input)).toBeNull();
  });
});

describe('resolveSets', () => {
  it('numbers a single set from the first room', () => {
    const [first] = resolveSets([set()]);
    expect(first?.codes).toEqual(['101', '102', '103']);
  });

  it('continues numbering for a second set on the same floor', () => {
    // Three 2-sharing and three 3-sharing on one floor is an ordinary PG.
    const [a, b] = resolveSets([
      set({ roomCount: '3', sharing: 'DOUBLE' }),
      set({ roomCount: '3', sharing: 'TRIPLE' }),
    ]);
    expect(a?.codes).toEqual(['101', '102', '103']);
    expect(b?.codes).toEqual(['104', '105', '106']);
  });

  it('restarts numbering on a new floor rather than carrying on', () => {
    const [, , third] = resolveSets([
      set({ floor: 1, roomCount: '3' }),
      set({ floor: 1, roomCount: '3' }),
      set({ floor: 2, roomCount: '2' }),
    ]);
    expect(third?.codes).toEqual(['201', '202']);
  });

  it('honours a typed first room number', () => {
    const [first] = resolveSets([set({ roomCount: '2', startOverride: '107' })]);
    expect(first?.codes).toEqual(['107', '108']);
  });

  it('ignores an unparseable override instead of producing nonsense', () => {
    const [first] = resolveSets([set({ roomCount: '2', startOverride: 'abc' })]);
    expect(first?.codes).toEqual(['101', '102']);
  });

  it('prefixes the ground floor with G', () => {
    const [first] = resolveSets([set({ floor: 0, roomCount: '2' })]);
    expect(first?.codes).toEqual(['G01', 'G02']);
  });

  it('counts beds from the sharing type', () => {
    const [double, dorm] = resolveSets([
      set({ sharing: 'DOUBLE', roomCount: '3' }),
      set({ sharing: 'DORMITORY', capacity: '8', roomCount: '1' }),
    ]);
    expect(double?.bedsPerRoom).toBe(2);
    expect(dorm?.bedsPerRoom).toBe(8);
  });
});

describe('duplicateCodes', () => {
  it('finds a clash when two sets are forced onto the same numbers', () => {
    const resolved = resolveSets([
      set({ roomCount: '3' }),
      set({ roomCount: '2', startOverride: '102' }),
    ]);
    expect(duplicateCodes(resolved)).toEqual(['102', '103']);
  });

  it('reports nothing when sets sit side by side', () => {
    expect(duplicateCodes(resolveSets([set(), set()]))).toEqual([]);
  });
});

describe('roomCode and describeCodes', () => {
  it('builds a code from floor and position', () => {
    expect(roomCode(1, 1)).toBe('101');
    expect(roomCode(2, 11)).toBe('211');
    expect(roomCode(0, 3)).toBe('G03');
  });

  it('describes a range', () => {
    expect(describeCodes(['101', '102', '103'])).toBe('101–103');
    expect(describeCodes(['101'])).toBe('101');
    expect(describeCodes([])).toBe('—');
  });
});
