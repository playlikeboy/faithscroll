import { defaultSermonTitle, formatSermonDate, isValidSermonDate, partLabel } from '../format';

describe('formatSermonDate', () => {
  test('formats a calendar date as "8 Nov 2026"', () => {
    expect(formatSermonDate('2026-11-08')).toBe('8 Nov 2026');
  });

  test('returns null for missing or malformed dates', () => {
    expect(formatSermonDate(null)).toBeNull();
    expect(formatSermonDate('8/11/2026')).toBeNull();
    expect(formatSermonDate('2026-13-01')).toBeNull();
  });
});

describe('defaultSermonTitle', () => {
  test('uses the sermon date', () => {
    expect(defaultSermonTitle('2026-11-08')).toBe('Sermon · 8 Nov 2026');
  });

  test('falls back to today when the date is missing', () => {
    expect(defaultSermonTitle(null)).toMatch(/^Sermon · \d{1,2} [A-Z][a-z]{2} \d{4}$/);
  });
});

describe('isValidSermonDate', () => {
  test('accepts real calendar dates only', () => {
    expect(isValidSermonDate('2026-02-28')).toBe(true);
    expect(isValidSermonDate('2026-02-30')).toBe(false);
    expect(isValidSermonDate('26-02-01')).toBe(false);
  });
});

describe('partLabel', () => {
  test('prefers the custom title and falls back to the part number', () => {
    expect(partLabel({ title: 'Worship' }, 0)).toBe('Worship');
    expect(partLabel({ title: null }, 1)).toBe('Part 2');
    expect(partLabel({ title: '   ' }, 2)).toBe('Part 3');
  });
});
