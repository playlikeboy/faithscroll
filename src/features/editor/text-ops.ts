/**
 * Pure text operations behind the editor toolbar. Every function takes `{ text, selection }`
 * and returns a new `{ text, selection }`; inputs are never mutated and nothing throws.
 *
 * - `toggleInlineFormat` wraps/unwraps **bold**, *italic* and ==highlight== around the selection
 *   (per line for multi-line selections, list/heading prefixes excluded), or inserts an empty
 *   pair with the cursor inside when nothing is selected.
 * - `toggleBlockFormat` / `continueList` live in `line-ops.ts` and are re-exported here.
 * - `insertToken` inserts a timestamp or Scripture reference at the cursor with sensible spacing.
 */
import { formatDuration } from '@/lib/time';

import { caret, lineEndAt, lineStartAt, normalizeState, type EditorState, type TextSelection } from './text-state';

export { continueList, toggleBlockFormat, type BlockFormat } from './line-ops';
export { normalizeState, type EditorState, type TextSelection } from './text-state';

export type InlineFormat = 'bold' | 'italic' | 'highlight';

const MARKERS: Record<InlineFormat, { chars: readonly string[]; length: number }> = {
  bold: { chars: ['*', '_'], length: 2 },
  italic: { chars: ['*', '_'], length: 1 },
  highlight: { chars: ['='], length: 2 },
};

const LINE_PREFIX = /^(?:#{1,3}[ \t]+|[ \t]{0,3}[-*][ \t]+|[ \t]{0,3}\d{1,9}\.[ \t]+)/;

interface Segment {
  start: number;
  end: number;
}

/** Content segments of the selection: one per line, trimmed, excluding line prefixes. */
function segmentsFor(text: string, { start, end }: TextSelection): Segment[] {
  const segments: Segment[] = [];
  let lineStart = lineStartAt(text, start);
  for (;;) {
    const lineEnd = lineEndAt(text, lineStart);
    const prefixLength = LINE_PREFIX.exec(text.slice(lineStart, lineEnd))?.[0].length ?? 0;
    let from = Math.max(start, lineStart + prefixLength);
    let to = Math.min(end, lineEnd);
    while (from < to && /\s/.test(text[from])) from++;
    while (to > from && /\s/.test(text[to - 1])) to--;
    if (to > from) segments.push({ start: from, end: to });
    if (lineEnd >= end) return segments;
    lineStart = lineEnd + 1;
  }
}

function runBefore(text: string, index: number, char: string, limit = 0): number {
  let count = 0;
  while (index - count - 1 >= limit && text[index - count - 1] === char) count++;
  return count;
}

function runAfter(text: string, index: number, char: string, limit = text.length): number {
  let count = 0;
  while (index + count < limit && text[index + count] === char) count++;
  return count;
}

/** Does a delimiter run of `count` characters carry `format`? (`***` is bold + italic.) */
function runHasFormat(format: InlineFormat, count: number): boolean {
  if (format === 'italic') return count === 1 || count >= 3;
  return count >= 2;
}

interface SegmentEdit {
  /** Range removed before the content (markers), content range, range removed after. */
  removeFrom: number;
  contentStart: number;
  contentEnd: number;
  removeTo: number;
  insert: string;
}

/** How to unwrap `format` from this segment, or null when it isn't formatted. */
function unwrapEdit(text: string, segment: Segment, format: InlineFormat): SegmentEdit | null {
  const { chars, length } = MARKERS[format];
  for (const char of chars) {
    const outside = Math.min(runBefore(text, segment.start, char), runAfter(text, segment.end, char));
    if (runHasFormat(format, outside)) {
      return { removeFrom: segment.start - length, contentStart: segment.start, contentEnd: segment.end, removeTo: segment.end + length, insert: '' };
    }
    const leading = runAfter(text, segment.start, char, segment.end);
    const trailing = runBefore(text, segment.end, char, segment.start);
    const inside = Math.min(leading, trailing);
    if (runHasFormat(format, inside) && leading + trailing < segment.end - segment.start) {
      return { removeFrom: segment.start, contentStart: segment.start + length, contentEnd: segment.end - length, removeTo: segment.end, insert: '' };
    }
  }
  return null;
}

function wrapEdit(segment: Segment, format: InlineFormat): SegmentEdit {
  const marker = MARKERS[format].chars[0].repeat(MARKERS[format].length);
  return { removeFrom: segment.start, contentStart: segment.start, contentEnd: segment.end, removeTo: segment.end, insert: marker };
}

function applySegmentEdits(text: string, edits: readonly SegmentEdit[]): EditorState {
  let out = '';
  let cursor = 0;
  let selectionStart = 0;
  let selectionEnd = 0;
  edits.forEach((edit, i) => {
    out += text.slice(cursor, edit.removeFrom) + edit.insert;
    if (i === 0) selectionStart = out.length;
    out += text.slice(edit.contentStart, edit.contentEnd);
    selectionEnd = out.length;
    out += edit.insert;
    cursor = edit.removeTo;
  });
  out += text.slice(cursor);
  return { text: out, selection: { start: selectionStart, end: selectionEnd } };
}

function togglePairAtCaret(text: string, offset: number, format: InlineFormat): EditorState {
  const { chars, length } = MARKERS[format];
  const marker = chars[0].repeat(length);
  const isEmptyPair = runBefore(text, offset, chars[0]) === length && runAfter(text, offset, chars[0]) === length;
  if (isEmptyPair) return caret(text.slice(0, offset - length) + text.slice(offset + length), offset - length);
  return caret(text.slice(0, offset) + marker + marker + text.slice(offset), offset + length);
}

/** Toggle bold / italic / highlight around the selection (or insert an empty pair at the caret). */
export function toggleInlineFormat(state: EditorState, format: InlineFormat): EditorState {
  const { text, selection } = normalizeState(state);
  if (selection.start === selection.end) return togglePairAtCaret(text, selection.start, format);
  const segments = segmentsFor(text, selection);
  if (segments.length === 0) return { text, selection };
  const unwraps = segments.map((segment) => unwrapEdit(text, segment, format));
  const allFormatted = unwraps.every((edit) => edit !== null);
  const edits = segments.map((segment, i) => {
    const unwrap = unwraps[i];
    if (allFormatted && unwrap) return unwrap;
    if (unwrap) return { removeFrom: segment.start, contentStart: segment.start, contentEnd: segment.end, removeTo: segment.end, insert: '' };
    return wrapEdit(segment, format);
  });
  return applySegmentEdits(text, edits);
}

/** `[04:32]` / `[1:02:07]` for a playback or recording position. */
export function timestampToken(positionMs: number): string {
  return `[${formatDuration(Number.isFinite(positionMs) ? positionMs : 0)}]`;
}

const NO_SPACE_AFTER = /[\s([{"'“‘]/;
const NO_SPACE_BEFORE = /[\s.,;:!?)\]}"'”’]/;

/**
 * Replace the selection with `token` (a timestamp or Scripture reference), adding a space on
 * either side when it would otherwise touch a word. The caret lands after the token.
 */
export function insertToken(state: EditorState, token: string): EditorState {
  const { text, selection } = normalizeState(state);
  if (typeof token !== 'string' || token.trim().length === 0) return { text, selection };
  const before = text[selection.start - 1];
  const after = text[selection.end];
  const lead = before === undefined || NO_SPACE_AFTER.test(before) ? '' : ' ';
  const trail = after !== undefined && NO_SPACE_BEFORE.test(after) ? '' : ' ';
  const insert = lead + token.trim() + trail;
  return caret(text.slice(0, selection.start) + insert + text.slice(selection.end), selection.start + insert.length);
}
