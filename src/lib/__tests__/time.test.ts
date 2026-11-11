import { dayPeriod, formatDuration, parseDuration, toLocalDateString } from '@/lib/time';

describe('formatDuration', () => {
  test.each([
    [0, '00:00'],
    [272_000, '04:32'],
    [1_910_000, '31:50'],
    [3_727_000, '1:02:07'],
    [-5, '00:00'],
  ])('%d ms -> %s', (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });
});

describe('parseDuration', () => {
  test.each([
    ['04:32', 272_000],
    ['1:02:07', 3_727_000],
    [' 17:15 ', 1_035_000],
  ])('%s -> %d', (text, expected) => {
    expect(parseDuration(text)).toBe(expected);
  });

  test.each(['', 'abc', '4:5', '04:61', '1:61:00'])('rejects %p', (text) => {
    expect(parseDuration(text)).toBeNull();
  });

  test('round-trips with formatDuration', () => {
    expect(parseDuration(formatDuration(3_727_000))).toBe(3_727_000);
  });
});

describe('toLocalDateString', () => {
  test('pads month and day', () => {
    expect(toLocalDateString(new Date(2026, 0, 5, 10))).toBe('2026-01-05');
  });
});

describe('dayPeriod', () => {
  test.each([
    [6, 'morning'],
    [13, 'afternoon'],
    [21, 'evening'],
  ] as const)('%d:00 is %s', (hour, expected) => {
    expect(dayPeriod(new Date(2026, 10, 10, hour))).toBe(expected);
  });
});
