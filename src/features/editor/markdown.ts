/**
 * Markdown-lite for notes, journal entries and prayers. Pure functions; never throws.
 *
 * Blocks (one per line group, separated by blank lines):
 *   `# `, `## `, `### `  headings (single line, non-empty)
 *   `- ` / `* `          bullet list items
 *   `1. `                numbered list items (the first number is the list start)
 *   anything else        paragraph; consecutive lines are kept as line breaks
 * Inline: `**bold**`, `*italic*` / `_italic_`, `==highlight==`, `[mm:ss]` / `[h:mm:ss]`
 * timestamps and Scripture references (see `inline.ts`).
 */
import { inlineToPlainText, parseInline, scanTimestamps, type NoteInline, type ParseOptions } from './inline';

export { parseInline, scanTimestamps, type NoteInline, type ParseOptions, type TimestampToken } from './inline';

export type HeadingLevel = 1 | 2 | 3;

export type NoteBlock =
  | { type: 'heading'; level: HeadingLevel; children: NoteInline[] }
  | { type: 'paragraph'; children: NoteInline[] }
  | { type: 'bulletList'; items: NoteInline[][] }
  | { type: 'numberedList'; start: number; items: NoteInline[][] };

export interface NoteTimestamp {
  /** As written, e.g. "04:32" or "1:02:07". */
  text: string;
  positionMs: number;
  /** Offset of the opening `[` in the source. */
  index: number;
}

const HEADING_LINE = /^(#{1,3})[ \t]+(.*\S)[ \t]*$/;
const BULLET_LINE = /^[ \t]{0,3}[-*][ \t]+(.*)$/;
const NUMBERED_LINE = /^[ \t]{0,3}(\d{1,9})\.[ \t]+(.*)$/;

type Line =
  | { kind: 'blank' }
  | { kind: 'heading'; level: HeadingLevel; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'numbered'; number: number; text: string }
  | { kind: 'text'; text: string };

export function classifyLine(line: string): Line {
  if (line.trim().length === 0) return { kind: 'blank' };
  const heading = HEADING_LINE.exec(line);
  if (heading) return { kind: 'heading', level: heading[1].length as HeadingLevel, text: heading[2] };
  const bullet = BULLET_LINE.exec(line);
  if (bullet) return { kind: 'bullet', text: bullet[1] };
  const numbered = NUMBERED_LINE.exec(line);
  if (numbered) return { kind: 'numbered', number: Number(numbered[1]), text: numbered[2] };
  return { kind: 'text', text: line };
}

export function splitLines(content: string): string[] {
  return content.split(/\r\n|\r|\n/);
}

interface Pending {
  kind: 'paragraph' | 'bullet' | 'numbered';
  lines: string[];
  start: number;
}

function finish(pending: Pending, options: ParseOptions): NoteBlock {
  const inline = (text: string) => parseInline(text, options);
  switch (pending.kind) {
    case 'paragraph':
      return { type: 'paragraph', children: inline(pending.lines.join('\n')) };
    case 'bullet':
      return { type: 'bulletList', items: pending.lines.map(inline) };
    case 'numbered':
      return { type: 'numberedList', start: pending.start, items: pending.lines.map(inline) };
  }
}

/** Parse Markdown-lite content into blocks. */
export function parseNote(content: string, options: ParseOptions = {}): NoteBlock[] {
  if (typeof content !== 'string' || content.length === 0) return [];
  const blocks: NoteBlock[] = [];
  let pending: Pending | null = null;
  const flush = () => {
    if (pending) blocks.push(finish(pending, options));
    pending = null;
  };
  const extend = (kind: Pending['kind'], text: string, start = 1) => {
    if (pending?.kind === kind) {
      pending.lines.push(text);
    } else {
      flush();
      pending = { kind, lines: [text], start };
    }
  };

  for (const raw of splitLines(content)) {
    const line = classifyLine(raw);
    switch (line.kind) {
      case 'blank':
        flush();
        break;
      case 'heading':
        flush();
        blocks.push({ type: 'heading', level: line.level, children: parseInline(line.text, options) });
        break;
      case 'bullet':
        extend('bullet', line.text);
        break;
      case 'numbered':
        extend('numbered', line.text, line.number);
        break;
      case 'text':
        extend('paragraph', line.text);
        break;
    }
  }
  flush();
  return blocks;
}

function blockToPlainText(block: NoteBlock): string {
  switch (block.type) {
    case 'heading':
    case 'paragraph':
      return inlineToPlainText(block.children);
    case 'bulletList':
    case 'numberedList':
      return block.items.map(inlineToPlainText).join('\n');
  }
}

/**
 * Content without Markdown syntax, for search indexes and previews. Blocks are separated by a
 * newline; list markers are dropped; timestamps read as `04:32`.
 */
export function toPlainText(content: string): string {
  return parseNote(content, { detectReferences: false }).map(blockToPlainText).join('\n');
}

/** Every valid `[mm:ss]` / `[h:mm:ss]` token in document order. */
export function extractTimestamps(content: string): NoteTimestamp[] {
  if (typeof content !== 'string') return [];
  return scanTimestamps(content).map(({ text, positionMs, index }) => ({ text, positionMs, index }));
}
