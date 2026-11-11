/** Short previews around the first match, for search results. */
import { toPlainText } from '@/features/journal/plain-text';

const CONTEXT_BEFORE = 40;
const SNIPPET_LENGTH = 140;

function clean(text: string): string {
  // Strip Markdown-lite and timestamp tokens like [12:34] so previews read naturally.
  return toPlainText(text).replace(/\[\d{1,2}:\d{2}(?::\d{2})?\]/g, '').replace(/\s+/g, ' ').trim();
}

/** A ~140 character preview of `text` starting shortly before the first term found, or null. */
export function makeSnippet(text: string | null | undefined, terms: readonly string[]): string | null {
  if (!text) return null;
  const plain = clean(text);
  if (!plain) return null;
  const lower = plain.toLowerCase();
  const positions = terms.map((term) => lower.indexOf(term)).filter((index) => index >= 0);
  if (positions.length === 0) return null;
  const first = Math.min(...positions);
  const start = Math.max(0, first - CONTEXT_BEFORE);
  const end = Math.min(plain.length, start + SNIPPET_LENGTH);
  return `${start > 0 ? '…' : ''}${plain.slice(start, end).trim()}${end < plain.length ? '…' : ''}`;
}

/** The first snippet produced from several candidate texts, in priority order. */
export function firstSnippet(candidates: readonly (string | null | undefined)[], terms: readonly string[]): string | null {
  for (const candidate of candidates) {
    const snippet = makeSnippet(candidate, terms);
    if (snippet) return snippet;
  }
  return null;
}
