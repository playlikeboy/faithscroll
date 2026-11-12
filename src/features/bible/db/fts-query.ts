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

interface Term {
  text: string;
  isPhrase: boolean;
}

function readTerms(input: string): Term[] {
  const terms: Term[] = [];
  for (const match of input.matchAll(TERM_PATTERN)) {
    const isPhrase = match.groups?.phrase !== undefined;
    const raw = (match.groups?.phrase ?? match.groups?.word ?? '').replace(/\s+/g, ' ').trim();
    if (!raw || !HAS_WORD_CHARACTER.test(raw)) continue;
    terms.push({ text: raw.slice(0, MAX_TERM_LENGTH), isPhrase });
    if (terms.length === MAX_TERMS) break;
  }
  return terms;
}

/** Returns null when the input has nothing searchable. */
export function toFtsQuery(input: string): string | null {
  const terms = readTerms(input);
  return terms.length > 0 ? terms.map((term) => quote(term.text)).join(' ') : null;
}

/**
 * Like `toFtsQuery`, but the last bare word also matches as a prefix ("anx" → anxiety), for
 * search-as-you-type over short names (topics, dictionary terms).
 */
export function toFtsPrefixQuery(input: string): string | null {
  const terms = readTerms(input);
  if (terms.length === 0) return null;
  return terms
    .map((term, index) => {
      const isLast = index === terms.length - 1;
      return isLast && !term.isPhrase && /^[\p{L}\p{N}]+$/u.test(term.text) ? `${quote(term.text)}*` : quote(term.text);
    })
    .join(' ');
}

/** Any of the words or phrases (OR). Each entry is matched as a quoted phrase. Null when empty. */
export function toFtsAnyQuery(words: readonly string[]): string | null {
  const quoted = words
    .map((word) => word.replace(/\s+/g, ' ').trim().slice(0, MAX_TERM_LENGTH))
    .filter((word) => HAS_WORD_CHARACTER.test(word))
    .map(quote);
  const unique = [...new Set(quoted)];
  return unique.length > 0 ? unique.join(' OR ') : null;
}

/** The whole input as one exact phrase, when it has at least two words; otherwise null. */
export function toFtsPhraseQuery(input: string): string | null {
  const words = input.replace(/["“”„]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!words.includes(' ') || !HAS_WORD_CHARACTER.test(words)) return null;
  return quote(words.slice(0, MAX_TERM_LENGTH));
}
