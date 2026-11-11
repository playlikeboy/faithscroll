/**
 * Turns free-form user input into a safe FTS5 MATCH expression.
 *
 * Every word becomes a quoted string and every "quoted phrase" (straight or curly quotes) a quoted
 * phrase, so FTS5 operators (AND, OR, NOT, NEAR, *, ^, :, parentheses…) in user input are plain text
 * and can never produce a syntax error. Terms are implicitly AND-ed.
 */
const TERM_PATTERN = /["“”„](?<phrase>[^"“”„]*)["“”„]?|(?<word>[^\s"“”„]+)/gu;
const HAS_WORD_CHARACTER = /[\p{L}\p{N}]/u;
const MAX_TERMS = 16;
const MAX_TERM_LENGTH = 100;

function quote(text: string): string {
  return `"${text.replace(/"/g, '""')}"`;
}

/** Returns null when the input has nothing searchable. */
export function toFtsQuery(input: string): string | null {
  const terms: string[] = [];
  for (const match of input.matchAll(TERM_PATTERN)) {
    const raw = (match.groups?.phrase ?? match.groups?.word ?? '').replace(/\s+/g, ' ').trim();
    if (!raw || !HAS_WORD_CHARACTER.test(raw)) continue;
    terms.push(quote(raw.slice(0, MAX_TERM_LENGTH)));
    if (terms.length === MAX_TERMS) break;
  }
  return terms.length > 0 ? terms.join(' ') : null;
}
