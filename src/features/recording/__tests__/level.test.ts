import { appendLevel, meteringToLevel, WAVEFORM_BARS } from '../level';

describe('meteringToLevel', () => {
  test('maps dBFS to 0..1 with a 60 dB floor', () => {
    expect(meteringToLevel(0)).toBe(1);
    expect(meteringToLevel(-30)).toBeCloseTo(0.5);
    expect(meteringToLevel(-60)).toBe(0);
    expect(meteringToLevel(-160)).toBe(0);
    expect(meteringToLevel(6)).toBe(1);
  });

  test('returns null when metering is unavailable', () => {
    expect(meteringToLevel(undefined)).toBeNull();
    expect(meteringToLevel(Number.NaN)).toBeNull();
  });
});

describe('appendLevel', () => {
  test('keeps the most recent bars without mutating the input', () => {
    const full = new Array(WAVEFORM_BARS).fill(0.1);
    const next = appendLevel(full, 0.9);
    expect(next).toHaveLength(WAVEFORM_BARS);
    expect(next.at(-1)).toBe(0.9);
    expect(full.at(-1)).toBe(0.1);
  });
});
