/**
 * Minimal reader for CrossWire SWORD "zLD" lexicon/dictionary modules (e.g. Easton, Nave), read
 * from buffers held in memory. Downloaded modules are untrusted data: every offset and size is
 * bounds-checked, decompressed blocks are size-limited, and nothing is executed.
 *
 * Layout (SWORD zStr):
 *   <name>.idx  per entry: u32 offset, u32 size            → into .dat
 *   <name>.dat  key bytes, "\n", then u32 block, u32 index  (or "@LINK <key>" for aliases)
 *   <name>.zdx  per block: u32 offset, u32 size            → into .zdt
 *   <name>.zdt  zlib-compressed block: u32 count, count × (u32 offset, u32 size), entry bytes
 */
import { inflateSync } from 'node:zlib';

const MAX_BLOCK_BYTES = 16 * 1024 * 1024;
const LINK_PREFIX = '@LINK';

function u32(buffer, offset, what) {
  if (offset < 0 || offset + 4 > buffer.length) throw new Error(`zLD: ${what} out of bounds`);
  return buffer.readUInt32LE(offset);
}

function slice(buffer, start, size, what) {
  if (start < 0 || size < 0 || start + size > buffer.length) throw new Error(`zLD: ${what} out of bounds`);
  return buffer.subarray(start, start + size);
}

function blockReader(zdx, zdt) {
  const cache = new Map();
  return (blockNumber) => {
    if (cache.has(blockNumber)) return cache.get(blockNumber);
    const offset = u32(zdx, blockNumber * 8, 'block index');
    const size = u32(zdx, blockNumber * 8 + 4, 'block index');
    const block = inflateSync(slice(zdt, offset, size, 'block'), { maxOutputLength: MAX_BLOCK_BYTES });
    cache.set(blockNumber, block);
    return block;
  };
}

function entryFromBlock(block, index) {
  const count = u32(block, 0, 'block header');
  if (index >= count) throw new Error('zLD: entry index out of range');
  const offset = u32(block, 4 + index * 8, 'entry header');
  const size = u32(block, 8 + index * 8, 'entry header');
  // Entries are NUL-terminated inside the block.
  return slice(block, offset, size, 'entry').toString('utf8').replace(/\0+$/, '');
}

/**
 * Reads every entry of a zLD module. Link entries ("@LINK target") are resolved to their target's
 * text and flagged so callers can skip duplicates.
 * @param {{ idx: Buffer, dat: Buffer, zdx: Buffer, zdt: Buffer }} files
 * @returns {{ key: string, text: string, linkTo: string | null }[]}
 */
export function readZldModule({ idx, dat, zdx, zdt }) {
  const readBlock = blockReader(zdx, zdt);
  const entries = [];
  for (let offset = 0; offset + 8 <= idx.length; offset += 8) {
    const datOffset = u32(idx, offset, 'idx');
    const datSize = u32(idx, offset + 4, 'idx');
    const record = slice(dat, datOffset, datSize, 'dat record');
    const newline = record.indexOf(0x0a);
    if (newline < 0) throw new Error('zLD: key without terminator');
    const key = record.subarray(0, newline).toString('utf8').replace(/\r$/, '').trim();
    const rest = record.subarray(newline + 1);
    if (rest.toString('utf8', 0, LINK_PREFIX.length) === LINK_PREFIX) {
      const target = rest.toString('utf8').slice(LINK_PREFIX.length).replace(/\0/g, '').trim();
      entries.push({ key, text: '', linkTo: target });
      continue;
    }
    if (rest.length < 8) continue; // empty placeholder entry
    const text = entryFromBlock(readBlock(rest.readUInt32LE(0)), rest.readUInt32LE(4));
    entries.push({ key, text, linkTo: null });
  }
  return entries;
}

/**
 * Picks the four zLD files of a module out of a downloaded rawzip archive.
 * @param {Map<string, Buffer>} files archive entry name → bytes
 */
export function zldFilesFrom(files) {
  const idxName = [...files.keys()].find((candidate) => candidate.toLowerCase().endsWith('.idx'));
  if (!idxName) throw new Error('zLD module is missing its .idx file');
  const base = idxName.slice(0, -'.idx'.length);
  const find = (extension) => {
    const bytes = files.get(`${base}${extension}`);
    if (!bytes) throw new Error(`zLD module is missing ${base}${extension}`);
    return bytes;
  };
  return { idx: find('.idx'), dat: find('.dat'), zdx: find('.zdx'), zdt: find('.zdt') };
}
