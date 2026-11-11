/**
 * Minimal MP4/M4A inspection used by crash recovery.
 *
 * AVAudioRecorder (iOS) and MediaRecorder (Android) write the `moov` index box only when a recording
 * is stopped cleanly. A file without `moov` (the app was terminated mid-recording) cannot be played.
 * We walk the top-level boxes, find `moov` and read the duration from its `mvhd` child.
 */

export interface ByteReader {
  size: number;
  /** Bytes from `offset` (may return fewer at end of file). */
  read: (offset: number, length: number) => Uint8Array;
}

export interface Mp4Inspection {
  playable: boolean;
  durationMs: number | null;
}

interface BoxHeader {
  type: string;
  start: number;
  headerSize: number;
  size: number;
}

const NOT_PLAYABLE: Mp4Inspection = { playable: false, durationMs: null };
const MAX_TOP_LEVEL_BOXES = 64;

function uint32(bytes: Uint8Array, at: number): number {
  return ((bytes[at] << 24) >>> 0) + (bytes[at + 1] << 16) + (bytes[at + 2] << 8) + bytes[at + 3];
}

function uint64(bytes: Uint8Array, at: number): number {
  return uint32(bytes, at) * 2 ** 32 + uint32(bytes, at + 4);
}

function fourCC(bytes: Uint8Array, at: number): string {
  return String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
}

/** Reads a box header at `offset`; null when it is malformed or runs past `limit`. */
function readBoxHeader(reader: ByteReader, offset: number, limit: number): BoxHeader | null {
  const head = reader.read(offset, 16);
  if (head.length < 8) return null;
  let size = uint32(head, 0);
  let headerSize = 8;
  if (size === 1) {
    if (head.length < 16) return null;
    size = uint64(head, 8);
    headerSize = 16;
  } else if (size === 0) {
    size = limit - offset;
  }
  if (size < headerSize || offset + size > limit) return null;
  return { type: fourCC(head, 4), start: offset, headerSize, size };
}

function readMvhdDurationMs(reader: ByteReader, mvhd: BoxHeader): number | null {
  const body = reader.read(mvhd.start + mvhd.headerSize, 32);
  if (body.length < 20) return null;
  const version = body[0];
  const timescale = version === 1 ? uint32(body, 20) : uint32(body, 12);
  const duration = version === 1 ? (body.length >= 32 ? uint64(body, 24) : null) : uint32(body, 16);
  if (!timescale || duration === null) return null;
  return Math.round((duration / timescale) * 1000);
}

function findChild(reader: ByteReader, parent: BoxHeader, type: string): BoxHeader | null {
  const end = parent.start + parent.size;
  let offset = parent.start + parent.headerSize;
  while (offset + 8 <= end) {
    const child = readBoxHeader(reader, offset, end);
    if (!child) return null;
    if (child.type === type) return child;
    offset += child.size;
  }
  return null;
}

export function inspectMp4(reader: ByteReader): Mp4Inspection {
  let offset = 0;
  for (let count = 0; count < MAX_TOP_LEVEL_BOXES && offset + 8 <= reader.size; count += 1) {
    const header = readBoxHeader(reader, offset, reader.size);
    if (!header) return NOT_PLAYABLE;
    if (header.type === 'moov') {
      const mvhd = findChild(reader, header, 'mvhd');
      const durationMs = mvhd ? readMvhdDurationMs(reader, mvhd) : null;
      return { playable: durationMs !== null && durationMs > 0, durationMs };
    }
    offset += header.size;
  }
  return NOT_PLAYABLE;
}

/** ByteReader over an in-memory buffer (tests, small files). */
export function bytesReader(bytes: Uint8Array): ByteReader {
  return { size: bytes.length, read: (offset, length) => bytes.subarray(offset, Math.min(bytes.length, offset + length)) };
}
