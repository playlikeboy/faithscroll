import { bytesReader, inspectMp4 } from '../mp4-inspect';

function box(type: string, payload: number[] = [], sizeOverride?: number): number[] {
  const size = sizeOverride ?? 8 + payload.length;
  return [(size >>> 24) & 255, (size >>> 16) & 255, (size >>> 8) & 255, size & 255, ...[...type].map((c) => c.charCodeAt(0)), ...payload];
}

function u32(value: number): number[] {
  return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
}

function mvhdV0(timescale: number, duration: number): number[] {
  return box('mvhd', [0, 0, 0, 0, ...u32(0), ...u32(0), ...u32(timescale), ...u32(duration), ...new Array(80).fill(0)]);
}

function mvhdV1(timescale: number, duration: number): number[] {
  return box('mvhd', [1, 0, 0, 0, ...u32(0), ...u32(0), ...u32(0), ...u32(0), ...u32(timescale), ...u32(0), ...u32(duration), ...new Array(80).fill(0)]);
}

const ftyp = box('ftyp', [...'M4A '].map((c) => c.charCodeAt(0)).concat([0, 0, 0, 0]));
const mdat = box('mdat', new Array(64).fill(7));

describe('inspectMp4', () => {
  test('finds the moov box and reads the duration from mvhd (version 0)', () => {
    const file = Uint8Array.from([...ftyp, ...mdat, ...box('moov', mvhdV0(44_100, 44_100 * 125))]);
    expect(inspectMp4(bytesReader(file))).toEqual({ playable: true, durationMs: 125_000 });
  });

  test('reads 64-bit mvhd (version 1)', () => {
    const file = Uint8Array.from([...ftyp, ...box('moov', mvhdV1(1000, 61_500)), ...mdat]);
    expect(inspectMp4(bytesReader(file))).toEqual({ playable: true, durationMs: 61_500 });
  });

  test('an unfinished recording without moov is not playable', () => {
    const unfinished = Uint8Array.from([...ftyp, ...box('mdat', new Array(32).fill(1), 0)]);
    expect(inspectMp4(bytesReader(unfinished))).toEqual({ playable: false, durationMs: null });
  });

  test('a truncated box is not playable', () => {
    const truncated = Uint8Array.from([...ftyp, ...box('mdat', new Array(10).fill(1), 5000)]);
    expect(inspectMp4(bytesReader(truncated))).toEqual({ playable: false, durationMs: null });
  });

  test('empty or garbage files are not playable', () => {
    expect(inspectMp4(bytesReader(new Uint8Array()))).toEqual({ playable: false, durationMs: null });
    expect(inspectMp4(bytesReader(Uint8Array.from([1, 2, 3])))).toEqual({ playable: false, durationMs: null });
  });

  test('a moov box with zero duration is not playable', () => {
    const file = Uint8Array.from([...ftyp, ...box('moov', mvhdV0(1000, 0))]);
    expect(inspectMp4(bytesReader(file))).toEqual({ playable: false, durationMs: 0 });
  });
});
