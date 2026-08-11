import { parseDurationSeconds } from './token.service';

describe('parseDurationSeconds', () => {
  it.each([
    ['30s', 30],
    ['15m', 900],
    ['24h', 86_400],
    ['30d', 2_592_000],
    ['1h', 3600],
  ])('parses %s', (input, expected) => {
    expect(parseDurationSeconds(input)).toBe(expected);
  });

  it.each(['', '15', 'm', '15x', '-5m', '1.5h', 'abc'])('rejects %s', (input) => {
    expect(() => parseDurationSeconds(input)).toThrow();
  });
});
