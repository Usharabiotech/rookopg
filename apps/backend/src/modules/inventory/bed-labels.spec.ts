import { SharingType } from '@prisma/client';
import { bedLabel, bedLabels, defaultCapacityFor, roomCode } from './bed-labels';

describe('bedLabel', () => {
  it.each([
    [0, 'A'],
    [1, 'B'],
    [25, 'Z'],
    [26, 'AA'],
    [27, 'AB'],
    [51, 'AZ'],
    [52, 'BA'],
  ])('labels index %i as %s', (index, expected) => {
    expect(bedLabel(index)).toBe(expected);
  });

  it('never repeats a label within a large dormitory', () => {
    const labels = bedLabels(40);
    expect(new Set(labels).size).toBe(40);
  });
});

describe('bedLabels', () => {
  it('labels a triple room A, B, C', () => {
    expect(bedLabels(3)).toEqual(['A', 'B', 'C']);
  });

  it('returns nothing for a room with no beds', () => {
    expect(bedLabels(0)).toEqual([]);
  });
});

describe('defaultCapacityFor', () => {
  it.each([
    [SharingType.SINGLE, 1],
    [SharingType.DOUBLE, 2],
    [SharingType.TRIPLE, 3],
    [SharingType.QUAD, 4],
  ])('implies %s holds %i beds', (sharing, expected) => {
    expect(defaultCapacityFor(sharing)).toBe(expected);
  });

  it('refuses to guess a dormitory size', () => {
    // A dormitory can be 6 beds or 30. The owner has to say.
    expect(defaultCapacityFor(SharingType.DORMITORY)).toBeNull();
  });
});

describe('roomCode', () => {
  it.each([
    [1, 1, '101'],
    [1, 6, '106'],
    [2, 1, '201'],
    [3, 12, '312'],
    [10, 4, '1004'],
  ])('numbers floor %i room %i as %s', (floor, index, expected) => {
    expect(roomCode(floor, index)).toBe(expected);
  });

  it('prefixes the ground floor with G', () => {
    expect(roomCode(0, 1)).toBe('G01');
    expect(roomCode(0, 12)).toBe('G12');
  });

  it('produces unique codes across a whole building', () => {
    const codes: string[] = [];
    for (let floor = 0; floor <= 4; floor += 1) {
      for (let room = 1; room <= 8; room += 1) {
        codes.push(roomCode(floor, room));
      }
    }
    expect(new Set(codes).size).toBe(codes.length);
  });
});
