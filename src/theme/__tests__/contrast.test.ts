import { contrastRatio } from '@/theme/contrast';
import { palettes, type ColorTokens } from '@/theme/colors';

const AA_TEXT = 4.5;
const AA_LARGE_OR_UI = 3;

describe('contrastRatio', () => {
  test('returns 21 for black on white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  });

  test('returns 1 for identical colours', () => {
    expect(contrastRatio('#203B32', '#203B32')).toBeCloseTo(1, 5);
  });

  test('is symmetric', () => {
    expect(contrastRatio('#242923', '#F6F3EC')).toBeCloseTo(contrastRatio('#F6F3EC', '#242923'), 5);
  });

  test('accepts 3-digit hex', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 1);
  });

  test('throws on malformed hex', () => {
    expect(() => contrastRatio('red', '#fff')).toThrow(/hex/i);
  });
});

describe.each(['light', 'dark'] as const)('%s palette meets WCAG AA', (scheme) => {
  const c: ColorTokens = palettes[scheme];

  test.each([
    ['text on background', c.text, c.background],
    ['text on surface', c.text, c.surface],
    ['textSecondary on background', c.textSecondary, c.background],
    ['textSecondary on surface', c.textSecondary, c.surface],
    ['scripture on background', c.scripture, c.background],
    ['onPrimary on primary', c.onPrimary, c.primary],
    ['primaryText on background', c.primaryText, c.background],
    ['danger on surface', c.danger, c.surface],
  ])('%s', (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  test('border is visible against background (non-text 3:1 not required, but > 1.2)', () => {
    expect(contrastRatio(c.border, c.background)).toBeGreaterThan(1.2);
  });

  test('accent is usable as a UI indicator on background', () => {
    expect(contrastRatio(c.recording, c.background)).toBeGreaterThanOrEqual(AA_LARGE_OR_UI);
  });
});
