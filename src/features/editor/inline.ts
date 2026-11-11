/**
 * Inline Markdown-lite parsing: **bold**, *italic* / _italic_ (also __bold__), ==highlight==,
 * `[mm:ss]` / `[h:mm:ss]` timestamps and Scripture references.
 *
 * Emphasis uses a simplified CommonMark delimiter-run algorithm (single pass, frame stack):
 * openers must be followed by non-whitespace, closers preceded by non-whitespace, and `_` never
 * opens/closes inside a word. Anything unmatched renders literally. Never throws.
 */
import { findReferences } from '@/features/bible/reference';
import type { VerseRange } from '@/features/bible/types';
import { logger } from '@/lib/logger';
import { parseDuration } from '@/lib/time';

export type NoteInline =
  | { type: 'text'; text: string }
  | { type: 'bold'; children: NoteInline[] }
  | { type: 'italic'; children: NoteInline[] }
  | { type: 'highlight'; children: NoteInline[] }
  | { type: 'timestamp'; text: string; positionMs: number }
  | { type: 'reference'; text: string; range: VerseRange };

type DelimiterChar = '*' | '_' | '=';

interface Frame {
  char: DelimiterChar | null;
  /** Remaining unmatched delimiter characters of the opening run. */
  count: number;
  children: NoteInline[];
}

/** `[04:32]`, `[4:32]`, `[1:02:07]`. Validated with `parseDuration`. */
const TIMESTAMP_PATTERN = /\[((?:\d{1,3}:)?\d{1,2}:\d{2})\]/g;

export interface TimestampToken {
  /** As written inside the brackets, e.g. "04:32" or "1:02:07". */
  text: string;
  positionMs: number;
  /** Offset of the opening `[`. */
  index: number;
  /** Length including brackets. */
  length: number;
}

/** Every valid `[mm:ss]` / `[h:mm:ss]` token in `text`, in order. */
export function scanTimestamps(text: string): TimestampToken[] {
  const tokens: TimestampToken[] = [];
  for (const match of text.matchAll(TIMESTAMP_PATTERN)) {
    const positionMs = parseDuration(match[1]);
    if (positionMs !== null) {
      tokens.push({ text: match[1], positionMs, index: match.index, length: match[0].length });
    }
  }
  return tokens;
}

const DELIMITER_CHARS = new Set(['*', '_', '=']);

function isWhitespace(char: string | undefined): boolean {
  return char === undefined || /\s/.test(char);
}

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && /[\p{L}\p{N}]/u.test(char);
}

function canOpen(char: DelimiterChar, before: string | undefined, after: string | undefined): boolean {
  if (isWhitespace(after)) return false;
  return char === '_' ? !isWordChar(before) : true;
}

function canClose(char: DelimiterChar, before: string | undefined, after: string | undefined): boolean {
  if (isWhitespace(before)) return false;
  return char === '_' ? !isWordChar(after) : true;
}

function appendText(target: NoteInline[], text: string): void {
  if (text.length === 0) return;
  const last = target[target.length - 1];
  if (last?.type === 'text') {
    target[target.length - 1] = { type: 'text', text: last.text + text };
  } else {
    target.push({ type: 'text', text });
  }
}

function appendNodes(target: NoteInline[], nodes: readonly NoteInline[]): void {
  for (const node of nodes) {
    if (node.type === 'text') appendText(target, node.text);
    else target.push(node);
  }
}

/** Turn an unmatched frame back into literal text inside its parent. */
function collapse(frame: Frame, parent: Frame): void {
  if (frame.char !== null) appendText(parent.children, frame.char.repeat(frame.count));
  appendNodes(parent.children, frame.children);
}

function nodeFor(char: DelimiterChar, used: number, children: NoteInline[]): NoteInline {
  if (char === '=') return { type: 'highlight', children };
  return used === 2 ? { type: 'bold', children } : { type: 'italic', children };
}

function findFrame(stack: readonly Frame[], char: DelimiterChar): number {
  for (let i = stack.length - 1; i > 0; i--) {
    if (stack[i].char === char) return i;
  }
  return -1;
}

/** Close as much of `run` as possible against open frames; returns the unused length. */
function closeRun(stack: Frame[], char: DelimiterChar, length: number): number {
  let remaining = length;
  while (remaining > 0) {
    const index = findFrame(stack, char);
    if (index < 0) break;
    const frame = stack[index];
    const used = char === '=' ? 2 : Math.min(2, frame.count, remaining);
    if (char === '=' && (frame.count < 2 || remaining < 2)) break;
    while (stack.length - 1 > index) {
      const top = stack.pop() as Frame;
      collapse(top, stack[stack.length - 1]);
    }
    const node = nodeFor(char, used, frame.children);
    frame.count -= used;
    remaining -= used;
    if (frame.count > 0) {
      frame.children = [node];
    } else {
      stack.pop();
      stack[stack.length - 1].children.push(node);
    }
  }
  return remaining;
}

function parseEmphasis(text: string): NoteInline[] {
  const root: Frame = { char: null, count: 0, children: [] };
  const stack: Frame[] = [root];
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (!DELIMITER_CHARS.has(char)) {
      let end = i + 1;
      while (end < text.length && !DELIMITER_CHARS.has(text[end])) end++;
      appendText(stack[stack.length - 1].children, text.slice(i, end));
      i = end;
      continue;
    }
    let end = i + 1;
    while (end < text.length && text[end] === char) end++;
    const delimiter = char as DelimiterChar;
    const length = end - i;
    const before = text[i - 1];
    const after = text[end];
    const usable = delimiter !== '=' || length >= 2;
    let remaining = usable && canClose(delimiter, before, after) ? closeRun(stack, delimiter, length) : length;
    if (remaining > 0 && usable && canOpen(delimiter, before, after)) {
      stack.push({ char: delimiter, count: remaining, children: [] });
      remaining = 0;
    }
    appendText(stack[stack.length - 1].children, char.repeat(remaining));
    i = end;
  }
  while (stack.length > 1) {
    const top = stack.pop() as Frame;
    collapse(top, stack[stack.length - 1]);
  }
  return root.children;
}

function safeFindReferences(text: string) {
  try {
    const found = findReferences(text);
    let cursor = 0;
    return [...found]
      .sort((a, b) => a.index - b.index)
      .filter((ref) => {
        const valid = ref.index >= cursor && ref.length > 0 && ref.index + ref.length <= text.length;
        if (valid) cursor = ref.index + ref.length;
        return valid;
      });
  } catch (error) {
    logger.warn('Scripture reference detection failed', { error: error instanceof Error ? error.name : typeof error });
    return [];
  }
}

function splitReferences(text: string, out: NoteInline[]): void {
  let cursor = 0;
  for (const ref of safeFindReferences(text)) {
    appendText(out, text.slice(cursor, ref.index));
    out.push({ type: 'reference', text: text.slice(ref.index, ref.index + ref.length), range: ref.range });
    cursor = ref.index + ref.length;
  }
  appendText(out, text.slice(cursor));
}

export interface ParseOptions {
  /** Detect Scripture references (default true). Skip it when only plain text is needed. */
  detectReferences?: boolean;
}

/** Split a plain text run into text, timestamp and Scripture reference nodes. */
function splitTokens(text: string, out: NoteInline[], detectReferences: boolean): void {
  const pushText = detectReferences ? splitReferences : (slice: string, target: NoteInline[]) => appendText(target, slice);
  let cursor = 0;
  for (const token of scanTimestamps(text)) {
    pushText(text.slice(cursor, token.index), out);
    out.push({ type: 'timestamp', text: token.text, positionMs: token.positionMs });
    cursor = token.index + token.length;
  }
  pushText(text.slice(cursor), out);
}

function tokenize(nodes: readonly NoteInline[], detectReferences: boolean): NoteInline[] {
  const out: NoteInline[] = [];
  for (const node of nodes) {
    if (node.type === 'text') splitTokens(node.text, out, detectReferences);
    else if ('children' in node) out.push({ ...node, children: tokenize(node.children, detectReferences) });
    else out.push(node);
  }
  return out;
}

/** Parse one block's inline content. */
export function parseInline(text: string, options: ParseOptions = {}): NoteInline[] {
  return tokenize(parseEmphasis(text), options.detectReferences ?? true);
}

/** Flatten inline nodes to plain text (timestamps as `mm:ss`). */
export function inlineToPlainText(nodes: readonly NoteInline[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
        case 'reference':
        case 'timestamp':
          return node.text;
        default:
          return inlineToPlainText(node.children);
      }
    })
    .join('');
}
