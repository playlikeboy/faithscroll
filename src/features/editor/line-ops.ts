/**
 * Line-prefix operations: toggling headings / bullet lists / numbered lists on every selected
 * line (numbered lists are renumbered), and continuing a list when Return is pressed.
 * Pure; never mutates input; never throws.
 */
import type { HeadingLevel } from './markdown';
import { caret, lineStartAt, normalizeState, type EditorState } from './text-state';

export type BlockFormat = 'heading' | 'bullet' | 'numbered';

type Prefix =
  | { kind: 'none' }
  | { kind: 'heading'; level: HeadingLevel }
  | { kind: 'bullet'; marker: string }
  | { kind: 'numbered'; number: number };

interface ParsedLine {
  prefix: Prefix;
  /** Length of the prefix text (including indentation and spacing). */
  prefixLength: number;
}

const HEADING_PREFIX = /^(#{1,3})[ \t]+/;
const BULLET_PREFIX = /^[ \t]{0,3}([-*])[ \t]+/;
const NUMBERED_PREFIX = /^[ \t]{0,3}(\d{1,9})\.[ \t]+/;

function parseLine(line: string): ParsedLine {
  const heading = HEADING_PREFIX.exec(line);
  if (heading) return { prefix: { kind: 'heading', level: heading[1].length as HeadingLevel }, prefixLength: heading[0].length };
  const bullet = BULLET_PREFIX.exec(line);
  if (bullet) return { prefix: { kind: 'bullet', marker: bullet[1] }, prefixLength: bullet[0].length };
  const numbered = NUMBERED_PREFIX.exec(line);
  if (numbered) return { prefix: { kind: 'numbered', number: Number(numbered[1]) }, prefixLength: numbered[0].length };
  return { prefix: { kind: 'none' }, prefixLength: 0 };
}

function prefixText(prefix: Prefix): string {
  switch (prefix.kind) {
    case 'none':
      return '';
    case 'heading':
      return `${'#'.repeat(prefix.level)} `;
    case 'bullet':
      return `${prefix.marker} `;
    case 'numbered':
      return `${prefix.number}. `;
  }
}

function nextHeading(current: Prefix, level: HeadingLevel | undefined, allAtLevel: boolean): Prefix {
  if (level !== undefined) return allAtLevel ? { kind: 'none' } : { kind: 'heading', level };
  if (current.kind !== 'heading') return { kind: 'heading', level: 1 };
  return current.level === 3 ? { kind: 'none' } : { kind: 'heading', level: (current.level + 1) as HeadingLevel };
}

function targetPrefix(format: BlockFormat, lines: readonly ParsedLine[], headingLevel?: HeadingLevel): Prefix {
  const kinds = lines.map((line) => line.prefix);
  switch (format) {
    case 'bullet':
      return kinds.every((p) => p.kind === 'bullet') ? { kind: 'none' } : { kind: 'bullet', marker: '-' };
    case 'numbered':
      return kinds.every((p) => p.kind === 'numbered') ? { kind: 'none' } : { kind: 'numbered', number: 1 };
    case 'heading':
      return nextHeading(kinds[0], headingLevel, kinds.every((p) => p.kind === 'heading' && p.level === headingLevel));
  }
}

/**
 * Renumber every run of consecutive numbered lines that touches lines [from, to]. A run that
 * starts before `keepStartBefore` keeps its first number; any other run starts at 1.
 */
function renumber(lines: readonly string[], from: number, to: number, keepStartBefore: number): string[] {
  const out = [...lines];
  let i = 0;
  while (i < out.length) {
    if (parseLine(out[i]).prefix.kind !== 'numbered') {
      i++;
      continue;
    }
    let end = i;
    while (end + 1 < out.length && parseLine(out[end + 1]).prefix.kind === 'numbered') end++;
    if (end >= from && i <= to) {
      const first = parseLine(out[i]).prefix;
      const start = i < keepStartBefore && first.kind === 'numbered' ? first.number : 1;
      for (let k = i; k <= end; k++) out[k] = out[k].replace(/^([ \t]{0,3})\d{1,9}\./, `$1${start + k - i}.`);
    }
    i = end + 1;
  }
  return out;
}

function lineOffsets(lines: readonly string[]): number[] {
  const offsets: number[] = [];
  let offset = 0;
  for (const line of lines) {
    offsets.push(offset);
    offset += line.length + 1;
  }
  return offsets;
}

function lineIndexAt(offsets: readonly number[], offset: number): number {
  let index = 0;
  while (index + 1 < offsets.length && offsets[index + 1] <= offset) index++;
  return index;
}

/** Map an old caret offset to the rewritten lines, keeping it in the same spot of the content. */
function mapOffset(offset: number, oldLines: readonly string[], newLines: readonly string[]): number {
  const oldOffsets = lineOffsets(oldLines);
  const newOffsets = lineOffsets(newLines);
  const index = lineIndexAt(oldOffsets, offset);
  const column = offset - oldOffsets[index];
  if (oldLines[index] === newLines[index]) return newOffsets[index] + column;
  const oldPrefix = parseLine(oldLines[index]).prefixLength;
  const newPrefix = parseLine(newLines[index]).prefixLength;
  return newOffsets[index] + newPrefix + Math.max(0, column - oldPrefix);
}

/**
 * Toggle a heading / bullet / numbered prefix on every selected line. Blank lines inside a
 * multi-line selection are left alone. Without `headingLevel`, Heading cycles # → ## → ### → none.
 */
export function toggleBlockFormat(state: EditorState, format: BlockFormat, options: { headingLevel?: HeadingLevel } = {}): EditorState {
  const { text, selection } = normalizeState(state);
  const lines = text.split('\n');
  const offsets = lineOffsets(lines);
  const first = lineIndexAt(offsets, selection.start);
  let last = lineIndexAt(offsets, selection.end);
  if (last > first && offsets[last] === selection.end) last--;

  const touched = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const nonBlank = touched.filter((i) => lines[i].trim().length > 0);
  const targets = nonBlank.length > 0 ? nonBlank : touched;
  const next = targetPrefix(format, targets.map((i) => parseLine(lines[i])), options.headingLevel);

  const targetSet = new Set(targets);
  const rewritten = lines.map((line, i) =>
    targetSet.has(i) ? prefixText(next) + line.slice(parseLine(line).prefixLength) : line,
  );
  const newLines = renumber(rewritten, first, last + 1, first);
  return {
    text: newLines.join('\n'),
    selection: {
      start: mapOffset(selection.start, lines, newLines),
      end: mapOffset(selection.end, lines, newLines),
    },
  };
}

/**
 * Find the single inserted "\n" between two texts, or -1. Next to existing newlines the position
 * is ambiguous; then the caret position before the change decides, else the leftmost candidate.
 */
function insertedNewlineAt(prev: string, next: string, caretHint?: number): number {
  if (next.length !== prev.length + 1) return -1;
  let index = 0;
  while (index < prev.length && prev[index] === next[index]) index++;
  if (next[index] !== '\n' || next.slice(index + 1) !== prev.slice(index)) return -1;
  let lowest = index;
  while (lowest > 0 && next[lowest - 1] === '\n') lowest--;
  return caretHint !== undefined && caretHint >= lowest && caretHint <= index ? caretHint : lowest;
}

/**
 * Called with the text before and after a change. When the change is a Return pressed on a list
 * item, continue the list on the new line ("- ", next number) — or, on an empty item, end the
 * list by removing its marker. Returns null when no list handling applies.
 * `caretBefore` (the caret offset before the change) disambiguates Return next to blank lines.
 */
export function continueList(prev: string, next: string, caretBefore?: number): EditorState | null {
  if (typeof prev !== 'string' || typeof next !== 'string') return null;
  const at = insertedNewlineAt(prev, next, caretBefore);
  if (at < 0) return null;
  const lineStart = lineStartAt(prev, at);
  const { prefix, prefixLength } = parseLine(prev.slice(lineStart));
  if ((prefix.kind !== 'bullet' && prefix.kind !== 'numbered') || at < lineStart + prefixLength) return null;

  const lineEnd = prev.indexOf('\n', at);
  const content = prev.slice(lineStart + prefixLength, lineEnd === -1 ? prev.length : lineEnd);
  if (content.trim().length === 0) {
    return caret(prev.slice(0, lineStart) + prev.slice(lineStart + prefixLength), lineStart);
  }

  const indent = /^[ \t]*/.exec(prev.slice(lineStart))?.[0] ?? '';
  const marker = prefix.kind === 'bullet' ? `${indent}${prefix.marker} ` : `${indent}${prefix.number + 1}. `;
  const text = next.slice(0, at + 1) + marker + next.slice(at + 1);
  const cursor = at + 1 + marker.length;
  if (prefix.kind === 'bullet') return caret(text, cursor);

  const lines = text.split('\n');
  const newLineIndex = lineIndexAt(lineOffsets(lines), at + 1);
  const renumbered = renumber(lines, newLineIndex - 1, newLineIndex + 1, newLineIndex);
  return caret(renumbered.join('\n'), mapOffset(cursor, lines, renumbered));
}
