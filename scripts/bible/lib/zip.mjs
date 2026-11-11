/**
 * Minimal, in-memory ZIP reader (stored + deflate entries, no ZIP64).
 *
 * Downloaded archives are untrusted: entries are never written to disk (no zip-slip),
 * sizes are bounded (no zip bombs) and nothing inside an archive is ever executed.
 */
import { Buffer } from 'node:buffer';
import { inflateRawSync } from 'node:zlib';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const EOCD_MIN_SIZE = 22;
const MAX_COMMENT_SIZE = 0xffff;
const ZIP64_MARKER = 0xffffffff;
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;
/** Largest single entry we are willing to inflate (the biggest USFM book is ~1 MB). */
export const MAX_ENTRY_BYTES = 64 * 1024 * 1024;

function findEndOfCentralDirectory(buffer) {
  const lowest = Math.max(0, buffer.length - EOCD_MIN_SIZE - MAX_COMMENT_SIZE);
  for (let offset = buffer.length - EOCD_MIN_SIZE; offset >= lowest; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) return offset;
  }
  throw new Error('Not a ZIP archive (end of central directory not found)');
}

/**
 * Lists the entries of a ZIP archive held in memory.
 * @param {Buffer} buffer
 * @returns {{ name: string, method: number, compressedSize: number, size: number, localOffset: number }[]}
 */
export function listEntries(buffer) {
  const eocd = findEndOfCentralDirectory(buffer);
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) {
      throw new Error('Corrupt ZIP central directory');
    }
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const size = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    if (compressedSize === ZIP64_MARKER || size === ZIP64_MARKER || localOffset === ZIP64_MARKER) {
      throw new Error('ZIP64 archives are not supported');
    }
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    entries.push({ name, method, compressedSize, size, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/**
 * Reads one entry's bytes.
 * @param {Buffer} buffer
 * @param {{ name: string, method: number, compressedSize: number, size: number, localOffset: number }} entry
 * @returns {Buffer}
 */
export function readEntry(buffer, entry) {
  if (entry.size > MAX_ENTRY_BYTES) throw new Error(`ZIP entry too large: ${entry.name}`);
  const { localOffset } = entry;
  if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) {
    throw new Error(`Corrupt ZIP local header: ${entry.name}`);
  }
  const nameLength = buffer.readUInt16LE(localOffset + 26);
  const extraLength = buffer.readUInt16LE(localOffset + 28);
  const start = localOffset + 30 + nameLength + extraLength;
  const end = start + entry.compressedSize;
  if (end > buffer.length) throw new Error(`Truncated ZIP entry: ${entry.name}`);
  const raw = buffer.subarray(start, end);

  let data;
  if (entry.method === METHOD_STORED) data = Buffer.from(raw);
  else if (entry.method === METHOD_DEFLATE) data = inflateRawSync(raw, { maxOutputLength: MAX_ENTRY_BYTES });
  else throw new Error(`Unsupported ZIP compression method ${entry.method}: ${entry.name}`);

  if (data.length !== entry.size) throw new Error(`ZIP entry size mismatch: ${entry.name}`);
  return data;
}

/**
 * Reads every entry whose name matches `predicate` as UTF-8 text.
 * @param {Buffer} buffer
 * @param {(name: string) => boolean} predicate
 * @returns {Map<string, string>}
 */
export function readTextEntries(buffer, predicate) {
  const result = new Map();
  for (const entry of listEntries(buffer)) {
    if (entry.name.endsWith('/') || !predicate(entry.name)) continue;
    result.set(entry.name, readEntry(buffer, entry).toString('utf8'));
  }
  return result;
}
