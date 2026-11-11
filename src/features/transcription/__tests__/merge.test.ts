import { mergeTranscriptParts, partOffsets } from '../merge';
import type { TranscriptPartResult } from '@/services/ai/contracts';

const recordings = [
  { id: 'a', durationMs: 60_000 },
  { id: 'b', durationMs: 30_000 },
];

const partA: TranscriptPartResult = {
  recordingId: 'a',
  language: 'en',
  text: 'Welcome. Turn to Matthew 18.',
  segments: [
    { start: 0, end: 4.2, text: ' Welcome. ' },
    { start: 4.2, end: 61.5, text: 'Turn to Matthew 18.' },
  ],
  approximate: false,
};

const partB: TranscriptPartResult = {
  recordingId: 'b',
  language: null,
  text: 'Let us pray.',
  segments: [
    { start: 1, end: 3, text: 'Let us pray.' },
    { start: 3, end: 4, text: '   ' },
  ],
  approximate: true,
};

describe('partOffsets', () => {
  test('offset of a part is the sum of earlier parts’ durations', () => {
    expect(partOffsets(recordings)).toEqual(new Map([['a', 0], ['b', 60_000]]));
  });
});

describe('mergeTranscriptParts', () => {
  test('shifts segments by part offsets, clamps to part length and drops blank text', () => {
    const merged = mergeTranscriptParts([partB, partA], recordings);

    expect(merged.segments).toEqual([
      { startMs: 0, endMs: 4_200, text: 'Welcome.' },
      { startMs: 4_200, endMs: 60_000, text: 'Turn to Matthew 18.' },
      { startMs: 61_000, endMs: 63_000, text: 'Let us pray.' },
    ]);
    expect(merged.text).toBe('Welcome. Turn to Matthew 18.\n\nLet us pray.');
    expect(merged.language).toBe('en');
    expect(merged.approximate).toBe(true);
    expect(merged.missingParts).toEqual([]);
  });

  test('reports parts that have no result and keeps later offsets correct', () => {
    const merged = mergeTranscriptParts([partB], recordings);
    expect(merged.missingParts).toEqual(['a']);
    expect(merged.segments[0].startMs).toBe(61_000);
  });

  test('turns a part with text but no segments into one segment spanning the part', () => {
    const merged = mergeTranscriptParts([{ ...partA, segments: [] }], [recordings[0]]);
    expect(merged.segments).toEqual([{ startMs: 0, endMs: 60_000, text: 'Welcome. Turn to Matthew 18.' }]);
  });

  test('ignores results for recordings that are not part of the sermon', () => {
    const merged = mergeTranscriptParts([{ ...partA, recordingId: 'zzz' }], recordings);
    expect(merged.segments).toEqual([]);
    expect(merged.missingParts).toEqual(['a', 'b']);
  });

  test('keeps end >= start when a part has an unknown duration', () => {
    const merged = mergeTranscriptParts([{ ...partA, segments: [{ start: 5, end: 2, text: 'x' }] }], [{ id: 'a', durationMs: 0 }]);
    expect(merged.segments).toEqual([{ startMs: 5_000, endMs: 5_000, text: 'x' }]);
  });
});
