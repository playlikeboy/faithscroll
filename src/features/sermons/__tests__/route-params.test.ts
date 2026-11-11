import { parseIdParam, parsePositionParam } from '../route-params';

describe('parsePositionParam', () => {
  test('accepts whole milliseconds only', () => {
    expect(parsePositionParam('65000')).toBe(65_000);
    expect(parsePositionParam(['1200', '5'])).toBe(1_200);
    expect(parsePositionParam(undefined)).toBeNull();
    expect(parsePositionParam('-5')).toBeNull();
    expect(parsePositionParam('12.5')).toBeNull();
    expect(parsePositionParam('abc')).toBeNull();
  });
});

describe('parseIdParam', () => {
  test('returns a single bounded id', () => {
    expect(parseIdParam('abc')).toBe('abc');
    expect(parseIdParam(['a', 'b'])).toBe('a');
    expect(parseIdParam('')).toBeNull();
    expect(parseIdParam('x'.repeat(200))).toBeNull();
  });
});
