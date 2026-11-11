import { buildTimeline, clampPosition, locate, nextRate, PLAYBACK_RATES, toGlobalMs } from '../timeline';

const parts = [
  { id: 'a', durationMs: 600_000, uri: 'file:///a.m4a' },
  { id: 'b', durationMs: 300_000, uri: 'file:///b.m4a' },
  { id: 'c', durationMs: 120_000, uri: 'file:///c.m4a' },
];

describe('buildTimeline', () => {
  test('assigns offsets in play order and totals the duration', () => {
    const timeline = buildTimeline(parts);
    expect(timeline.parts.map((p) => p.offsetMs)).toEqual([0, 600_000, 900_000]);
    expect(timeline.totalMs).toBe(1_020_000);
  });

  test('skips parts without a playable file', () => {
    const timeline = buildTimeline([parts[0], { id: 'gone', durationMs: 50_000, uri: null }, parts[1]]);
    expect(timeline.parts.map((p) => p.id)).toEqual(['a', 'b']);
    expect(timeline.totalMs).toBe(900_000);
  });
});

describe('locate', () => {
  const timeline = buildTimeline(parts);

  test('maps a sermon position to a part and a local position', () => {
    expect(locate(timeline, 0)).toEqual({ index: 0, localMs: 0 });
    expect(locate(timeline, 650_000)).toEqual({ index: 1, localMs: 50_000 });
    expect(locate(timeline, 900_000)).toEqual({ index: 2, localMs: 0 });
  });

  test('clamps out-of-range positions', () => {
    expect(locate(timeline, -5)).toEqual({ index: 0, localMs: 0 });
    expect(locate(timeline, 5_000_000)).toEqual({ index: 2, localMs: 120_000 });
  });

  test('returns null for an empty timeline', () => {
    expect(locate(buildTimeline([]), 10)).toBeNull();
  });
});

describe('toGlobalMs', () => {
  test('converts a bookmark position inside a part to the sermon timeline', () => {
    const timeline = buildTimeline(parts);
    expect(toGlobalMs(timeline, 'b', 15_000)).toBe(615_000);
    expect(toGlobalMs(timeline, 'missing', 15_000)).toBeNull();
    expect(toGlobalMs(timeline, null, 15_000)).toBe(15_000);
  });
});

describe('clampPosition and nextRate', () => {
  test('keeps positions within the timeline', () => {
    expect(clampPosition(-1, 100)).toBe(0);
    expect(clampPosition(150, 100)).toBe(100);
  });

  test('cycles through playback speeds from 0.75× to 2×', () => {
    expect(PLAYBACK_RATES[0]).toBe(0.75);
    expect(PLAYBACK_RATES.at(-1)).toBe(2);
    expect(nextRate(1)).toBe(1.25);
    expect(nextRate(2)).toBe(0.75);
    expect(nextRate(1.1)).toBe(1);
  });
});
