/**
 * Parse, format and detect Bible references. Pure functions, no database access.
 * Owned by the bible-data agent; exported signatures are a shared contract.
 *
 * Grammar (case-, whitespace- and period-tolerant):
 *   [1|2|3|1st|I|II|First…] Book[.] (C | C:V | C:V-V | C:V-C:V | C-C)
 *   Book chapter C [verse(s) V [to|through|-|and V]]     (spoken)
 *   Book C verse(s) V [to V]                              (spoken)
 *   Book <number words> <number words>                    ("John three sixteen")
 * Single-chapter books (Obadiah, Philemon, 2–3 John, Jude) read a bare number as a verse ("Jude 3").
 */
import { getBook, getBookByCode } from './books';
import {
  AMBIGUOUS_IN_TEXT,
  BOOK_ALIASES,
  NEEDS_VERSE_IN_TEXT,
  NUMBERED_BOOK_ALIASES,
  ORDINAL_WORDS,
} from './data/book-aliases';
import { chapterVerseCount, isOmittedVerse } from './data/chapter-verse-count';
import type { BibleBook, FoundReference, VerseRange } from './types';

// ---------------------------------------------------------------------------------------------
// Tokens

interface Token {
  kind: 'num' | 'word' | 'punct';
  text: string;
  lower: string;
  value: number;
  /** Ordinal suffix of a number token ("st" in "1st"). */
  suffix: string;
  start: number;
  end: number;
  /** Whitespace separates this token from the previous one. */
  spaced: boolean;
}

const TOKEN_PATTERN = /(\d{1,4})(st|nd|rd|th)?|([A-Za-z]+)|(\S)/g;
const DASHES = new Set(['-', '–', '—', '‐', '‑', '−']);
const RANGE_WORDS = new Set(['to', 'through', 'thru']);
const CHAPTER_WORDS = new Set(['chapter', 'chapters', 'chap', 'ch']);
const VERSE_WORDS = new Set(['verse', 'verses', 'ver', 'vs', 'vv', 'v']);
const MAX_ALIAS_WORDS = 4;

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let previousEnd = 0;
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const start = match.index ?? 0;
    const [raw, digits, suffix, word] = match;
    const kind = digits !== undefined ? 'num' : word !== undefined ? 'word' : 'punct';
    tokens.push({
      kind,
      text: raw,
      lower: raw.toLowerCase(),
      value: digits !== undefined ? Number(digits) : Number.NaN,
      suffix: suffix?.toLowerCase() ?? '',
      start,
      end: start + raw.length,
      spaced: start > previousEnd,
    });
    previousEnd = start + raw.length;
  }
  return tokens;
}

const isPunct = (token: Token | undefined, ...texts: string[]): boolean =>
  token?.kind === 'punct' && texts.includes(token.text);
const isWordIn = (token: Token | undefined, words: ReadonlySet<string>): boolean =>
  token?.kind === 'word' && words.has(token.lower);
const isDash = (token: Token | undefined): boolean =>
  (token?.kind === 'punct' && DASHES.has(token.text)) || isWordIn(token, RANGE_WORDS);

// ---------------------------------------------------------------------------------------------
// Book names

const ALIAS_INDEX: ReadonlyMap<string, number> = (() => {
  const index = new Map<string, number>();
  for (const [code, aliases] of Object.entries(BOOK_ALIASES)) {
    const book = getBookByCode(code);
    if (book) aliases.forEach((alias) => index.set(`0|${alias}`, book.id));
  }
  for (const { codes, aliases } of NUMBERED_BOOK_ALIASES) {
    codes.forEach((code, position) => {
      const book = getBookByCode(code);
      if (book) aliases.forEach((alias) => index.set(`${position + 1}|${alias}`, book.id));
    });
  }
  return index;
})();

interface BookMatch {
  book: BibleBook;
  alias: string;
  nameToken: Token;
  next: number;
}

const ORDINAL_SUFFIX: Readonly<Record<number, string>> = { 1: 'st', 2: 'nd', 3: 'rd' };

function readOrdinal(token: Token | undefined, inText: boolean): number {
  if (!token) return 0;
  if (token.kind === 'num') {
    const valid = token.value >= 1 && token.value <= 3 && (!token.suffix || token.suffix === ORDINAL_SUFFIX[token.value]);
    return valid ? token.value : 0;
  }
  const ordinal = token.kind === 'word' ? (ORDINAL_WORDS[token.lower] ?? 0) : 0;
  const isRoman = /^i+$/.test(token.lower);
  // In free text only upper-case Roman numerals count ("I John"), never the pronoun "i".
  if (ordinal && isRoman && inText && token.text !== token.text.toUpperCase()) return 0;
  return ordinal;
}

function matchAlias(tokens: Token[], first: number, ordinal: number, inText: boolean): BookMatch | null {
  for (let length = MAX_ALIAS_WORDS; length >= 1; length -= 1) {
    const words = tokens.slice(first, first + length);
    if (words.length < length || words.some((token, i) => token.kind !== 'word' || (i > 0 && !token.spaced))) continue;
    const alias = words.map((token) => token.lower).join(' ');
    const bookId = ALIAS_INDEX.get(`${ordinal}|${alias}`);
    if (bookId === undefined) continue;
    if (inText && ordinal === 0 && AMBIGUOUS_IN_TEXT.has(alias)) return null;
    const book = getBook(bookId);
    if (!book) return null;
    let next = first + length;
    // Abbreviation period ("Rom."), but not a sentence end after a full name ("…in Romans. 8 people").
    if (isPunct(tokens[next], '.') && !tokens[next].spaced && alias !== book.name.toLowerCase()) next += 1;
    return { book, alias, nameToken: words[0], next };
  }
  return null;
}

function matchBook(tokens: Token[], index: number, inText: boolean): BookMatch | null {
  const ordinal = readOrdinal(tokens[index], inText);
  if (ordinal) {
    const name = tokens[index + 1];
    // "1Co" may be attached; word ordinals ("First", "II") need a space.
    if (!name || (tokens[index].kind === 'word' && !name.spaced)) return null;
    return matchAlias(tokens, index + 1, ordinal, inText);
  }
  return matchAlias(tokens, index, 0, inText);
}

// ---------------------------------------------------------------------------------------------
// Numbers (digits or spoken words)

const UNITS = new Map(['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'].map((w, i) => [w, i + 1]));
const TEENS = new Map(
  ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'].map(
    (w, i) => [w, i + 10],
  ),
);
const TENS = new Map(
  ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'].map((w, i) => [w, (i + 2) * 10]),
);

interface NumberRead {
  value: number;
  next: number;
  spoken: boolean;
}

function wordAt(tokens: Token[], index: number): string {
  const token = tokens[index];
  return token?.kind === 'word' ? token.lower : '';
}

function readTensAndUnits(tokens: Token[], index: number): { value: number; next: number } {
  const word = wordAt(tokens, index);
  const teen = TEENS.get(word);
  if (teen) return { value: teen, next: index + 1 };
  const tens = TENS.get(word);
  if (tens) {
    const hyphen = tokens[index + 1];
    const unitAfterHyphen = UNITS.get(wordAt(tokens, index + 2));
    if (isPunct(hyphen, '-') && !hyphen.spaced && unitAfterHyphen && !tokens[index + 2].spaced) {
      return { value: tens + unitAfterHyphen, next: index + 3 };
    }
    const unit = UNITS.get(wordAt(tokens, index + 1));
    return unit ? { value: tens + unit, next: index + 2 } : { value: tens, next: index + 1 };
  }
  const unit = UNITS.get(word);
  return unit ? { value: unit, next: index + 1 } : { value: 0, next: index };
}

function readSpokenNumber(tokens: Token[], index: number): NumberRead | null {
  let next = index;
  let value = 0;
  const hundreds = UNITS.get(wordAt(tokens, index));
  if (hundreds && wordAt(tokens, index + 1) === 'hundred') {
    value = hundreds * 100;
    next = index + 2;
    if (wordAt(tokens, next) === 'and' && readTensAndUnits(tokens, next + 1).value > 0) next += 1;
  }
  const rest = readTensAndUnits(tokens, next);
  value += rest.value;
  next = rest.next;
  return value > 0 ? { value, next, spoken: true } : null;
}

function readNumber(tokens: Token[], index: number, allowSpoken: boolean): NumberRead | null {
  const token = tokens[index];
  if (token?.kind === 'num' && !token.suffix) return { value: token.value, next: index + 1, spoken: false };
  return allowSpoken ? readSpokenNumber(tokens, index) : null;
}

/** Skips a partial-verse letter ("28a") attached to a verse number. */
function skipVerseSuffix(tokens: Token[], index: number): number {
  const token = tokens[index];
  return token?.kind === 'word' && !token.spaced && /^[abc]$/.test(token.lower) ? index + 1 : index;
}

/** ":" always separates chapter and verse; "." only when the verse follows without a space. */
function isChapterVerseSeparator(tokens: Token[], index: number): boolean {
  if (isPunct(tokens[index], ':')) return true;
  return isPunct(tokens[index], '.') && !tokens[index].spaced && tokens[index + 1]?.kind === 'num' && !tokens[index + 1].spaced;
}

// ---------------------------------------------------------------------------------------------
// Locations

interface Location {
  startChapter: number;
  startVerse: number | null;
  endChapter: number;
  endVerse: number | null;
  /** An explicit verse was given. */
  hasVerse: boolean;
  /** The word "chapter" was used. */
  hasChapterWord: boolean;
  /** Chapter given only as number words ("Psalm twenty-three"). */
  spokenChapterOnly: boolean;
  next: number;
}

interface VerseSpan {
  startVerse: number;
  endChapter: number | null;
  endVerse: number;
  next: number;
}

/** After "C:" — reads "V", "V-V" or "V-C:V". */
function readVerseSpanAfterSeparator(tokens: Token[], index: number): VerseSpan | null {
  const first = readNumber(tokens, index, false);
  if (!first) return null;
  let next = skipVerseSuffix(tokens, first.next);
  const span: VerseSpan = { startVerse: first.value, endChapter: null, endVerse: first.value, next };
  if (!isDash(tokens[next])) return span;
  const second = readNumber(tokens, next + 1, false);
  if (!second) return span;
  if (isChapterVerseSeparator(tokens, second.next)) {
    const third = readNumber(tokens, second.next + 1, false);
    if (!third) return span;
    next = skipVerseSuffix(tokens, third.next);
    return { startVerse: first.value, endChapter: second.value, endVerse: third.value, next };
  }
  return { ...span, endVerse: second.value, next: skipVerseSuffix(tokens, second.next) };
}

/** "[,] [and] verse(s) V [to|through|-|and V]" */
function readKeywordVerses(tokens: Token[], index: number): VerseSpan | null {
  let next = index;
  if (isPunct(tokens[next], ',')) next += 1;
  if (wordAt(tokens, next) === 'and') next += 1;
  if (!isWordIn(tokens[next], VERSE_WORDS)) return null;
  next += 1;
  if (isPunct(tokens[next], '.') && !tokens[next].spaced) next += 1;
  const first = readNumber(tokens, next, true);
  if (!first) return null;
  next = skipVerseSuffix(tokens, first.next);
  const isAnd = wordAt(tokens, next) === 'and';
  if (isDash(tokens[next]) || isAnd) {
    const second = readNumber(tokens, next + 1, true);
    if (second && (!isAnd || second.value === first.value + 1)) {
      return { startVerse: first.value, endChapter: null, endVerse: second.value, next: skipVerseSuffix(tokens, second.next) };
    }
  }
  return { startVerse: first.value, endChapter: null, endVerse: first.value, next };
}

function withVerses(chapter: number, span: VerseSpan, hasChapterWord: boolean): Location {
  return {
    startChapter: chapter,
    startVerse: span.startVerse,
    endChapter: span.endChapter ?? chapter,
    endVerse: span.endVerse,
    hasVerse: true,
    hasChapterWord,
    spokenChapterOnly: false,
    next: span.next,
  };
}

function wholeChapters(start: number, end: number, next: number, flags: Partial<Location> = {}): Location {
  return {
    startChapter: start,
    startVerse: null,
    endChapter: end,
    endVerse: null,
    hasVerse: false,
    hasChapterWord: false,
    spokenChapterOnly: false,
    next,
    ...flags,
  };
}

function parseChapterWordLocation(tokens: Token[], index: number): Location | null {
  let next = index + 1;
  if (isPunct(tokens[next], '.') && !tokens[next].spaced) next += 1;
  const chapter = readNumber(tokens, next, true);
  if (!chapter) return null;
  const verses = readKeywordVerses(tokens, chapter.next);
  if (verses) return withVerses(chapter.value, verses, true);
  return wholeChapters(chapter.value, chapter.value, chapter.next, { hasChapterWord: true });
}

function parseNumericLocation(tokens: Token[], chapter: NumberRead): Location {
  if (isChapterVerseSeparator(tokens, chapter.next)) {
    const span = readVerseSpanAfterSeparator(tokens, chapter.next + 1);
    if (span) return withVerses(chapter.value, span, false);
  }
  const verses = readKeywordVerses(tokens, chapter.next);
  if (verses) return withVerses(chapter.value, verses, false);
  if (isDash(tokens[chapter.next])) {
    const end = readNumber(tokens, chapter.next + 1, false);
    if (end && !isChapterVerseSeparator(tokens, end.next)) return wholeChapters(chapter.value, end.value, end.next);
  }
  return wholeChapters(chapter.value, chapter.value, chapter.next);
}

function parseSpokenLocation(tokens: Token[], chapter: NumberRead): Location {
  const verses = readKeywordVerses(tokens, chapter.next);
  if (verses) return withVerses(chapter.value, verses, false);
  const verse = readSpokenNumber(tokens, chapter.next);
  if (verse) {
    const span: VerseSpan = { startVerse: verse.value, endChapter: null, endVerse: verse.value, next: verse.next };
    const end = isWordIn(tokens[verse.next], RANGE_WORDS) ? readSpokenNumber(tokens, verse.next + 1) : null;
    return withVerses(chapter.value, end ? { ...span, endVerse: end.value, next: end.next } : span, false);
  }
  return wholeChapters(chapter.value, chapter.value, chapter.next, { spokenChapterOnly: true });
}

/** Single-chapter books read bare numbers as verses: "Jude 3", "Jude 24-25". */
function adaptSingleChapter(book: BibleBook, location: Location): Location {
  if (book.chapters !== 1 || location.hasVerse || location.hasChapterWord) return location;
  return {
    ...location,
    startChapter: 1,
    endChapter: 1,
    startVerse: location.startChapter,
    endVerse: location.endChapter,
    hasVerse: true,
    spokenChapterOnly: false,
  };
}

function parseLocation(tokens: Token[], index: number, book: BibleBook): Location | null {
  let start = index;
  if (isPunct(tokens[start], ',') && isWordIn(tokens[start + 1], CHAPTER_WORDS)) start += 1;
  if (isWordIn(tokens[start], CHAPTER_WORDS)) {
    const located = parseChapterWordLocation(tokens, start);
    return located && adaptSingleChapter(book, located);
  }
  const chapter = readNumber(tokens, start, true);
  if (!chapter) return null;
  const located = chapter.spoken ? parseSpokenLocation(tokens, chapter) : parseNumericLocation(tokens, chapter);
  return adaptSingleChapter(book, located);
}

function resolveRange(book: BibleBook, location: Location): VerseRange | null {
  const { startChapter, endChapter } = location;
  if (startChapter < 1 || endChapter > book.chapters || endChapter < startChapter) return null;
  const startVerse = location.startVerse ?? 1;
  const endVerse = location.endVerse ?? chapterVerseCount(book.id, endChapter);
  if (startVerse < 1 || startVerse > chapterVerseCount(book.id, startChapter)) return null;
  if (endVerse < 1 || endVerse > chapterVerseCount(book.id, endChapter)) return null;
  if (endChapter === startChapter && endVerse < startVerse) return null;
  const range: VerseRange = {
    start: { bookId: book.id, chapter: startChapter, verse: startVerse },
    end: { bookId: book.id, chapter: endChapter, verse: endVerse },
  };
  if (isOmittedVerse(range.start) || isOmittedVerse(range.end)) return null;
  return range;
}

function wholeBook(book: BibleBook): VerseRange {
  return {
    start: { bookId: book.id, chapter: 1, verse: 1 },
    end: { bookId: book.id, chapter: book.chapters, verse: chapterVerseCount(book.id, book.chapters) },
  };
}

// ---------------------------------------------------------------------------------------------
// Public API

/** Book for a name or abbreviation ("Psalms", "1 cor", "Song of Songs"), if any. */
export function findBook(name: string): BibleBook | undefined {
  const tokens = tokenize(name);
  const match = matchBook(tokens, 0, false);
  return match && match.next === tokens.length ? match.book : undefined;
}

/**
 * Parse a single reference such as "Romans 8:28", "Rom 8:28-30", "1 Cor 13:4-7",
 * "John 3" (whole chapter), "Ps 23:1-24:2". A bare book name ("Jude") is the whole book.
 * Returns null when not a valid reference.
 */
export function parseReference(input: string): VerseRange | null {
  const tokens = tokenize(input);
  const match = matchBook(tokens, 0, false);
  if (!match) return null;
  if (match.next === tokens.length) return wholeBook(match.book);
  const location = parseLocation(tokens, match.next, match.book);
  if (!location) return null;
  const trailing = tokens.length - location.next;
  if (trailing > 1 || (trailing === 1 && !isPunct(tokens[location.next], '.'))) return null;
  return resolveRange(match.book, location);
}

function acceptedInText(match: BookMatch, location: Location): boolean {
  if (location.hasVerse || location.hasChapterWord) return true;
  const capitalized = /^[A-Z]/.test(match.nameToken.text);
  if (!capitalized || NEEDS_VERSE_IN_TEXT.has(match.alias)) return false;
  return !location.spokenChapterOnly || match.book.code === 'PSA';
}

/** A reference must not run straight into letters or more digits ("3:16am", "8:28:1"). */
function endsCleanly(tokens: Token[], index: number): boolean {
  const token = tokens[index];
  if (!token) return true;
  if (token.kind === 'word' || token.kind === 'num') return token.spaced;
  return !(token.text === ':' && tokens[index + 1]?.kind === 'num');
}

/** After ", " or "; " — "18", "18-20" (same chapter, comma only) or "4:24". */
function readContinuation(
  tokens: Token[],
  index: number,
  book: BibleBook,
  chapter: number,
): { range: VerseRange; start: number; next: number } | null {
  const separator = tokens[index];
  if (!isPunct(separator, ',', ';')) return null;
  const first = readNumber(tokens, index + 1, false);
  if (!first) return null;
  let location: Location | null = null;
  if (isChapterVerseSeparator(tokens, first.next)) {
    const span = readVerseSpanAfterSeparator(tokens, first.next + 1);
    location = span && withVerses(first.value, span, false);
  } else if (separator.text === ',') {
    const span = readVerseSpanAfterSeparator(tokens, index + 1);
    location = span && withVerses(chapter, span, false);
  }
  if (!location) return null;
  const after = tokens[location.next];
  const listContinues = !after || (after.kind === 'punct' && !DASHES.has(after.text) && after.text !== ':') || wordAt(tokens, location.next) === 'and';
  if (!listContinues) return null;
  const range = resolveRange(book, location);
  return range ? { range, start: index + 1, next: location.next } : null;
}

function toFound(text: string, tokens: Token[], first: number, next: number, range: VerseRange): FoundReference {
  const index = tokens[first].start;
  const length = tokens[next - 1].end - index;
  return { range, text: text.slice(index, index + length), index, length };
}

/** Find every Bible reference mentioned in free text (notes, transcripts). */
export function findReferences(text: string): FoundReference[] {
  const tokens = tokenize(text);
  const found: FoundReference[] = [];
  let index = 0;
  while (index < tokens.length) {
    const match = matchBook(tokens, index, true);
    const location = match && parseLocation(tokens, match.next, match.book);
    const range =
      match && location && acceptedInText(match, location) && endsCleanly(tokens, location.next)
        ? resolveRange(match.book, location)
        : null;
    if (!match || !location || !range) {
      index += 1;
      continue;
    }
    found.push(toFound(text, tokens, index, location.next, range));
    index = location.next;
    let chapter = range.end.chapter;
    for (let next = readContinuation(tokens, index, match.book, chapter); next; ) {
      found.push(toFound(text, tokens, next.start, next.next, next.range));
      index = next.next;
      chapter = next.range.end.chapter;
      next = readContinuation(tokens, index, match.book, chapter);
    }
  }
  return found;
}

function bookLabel(book: BibleBook, short: boolean, singleChapter: boolean): string {
  if (book.code === 'PSA' && singleChapter) return short ? 'Ps' : 'Psalm';
  return short ? book.shortName : book.name;
}

function formatWithinBook(book: BibleBook, range: VerseRange, short: boolean): string {
  const { start, end } = range;
  const sameChapter = start.chapter === end.chapter;
  const name = bookLabel(book, short, sameChapter);
  const endsChapter = end.verse === chapterVerseCount(book.id, end.chapter) && end.verse > 0;
  const wholeChapters = start.verse === 1 && endsChapter;

  if (wholeChapters && start.chapter === 1 && end.chapter === book.chapters) return bookLabel(book, short, book.chapters === 1);
  if (wholeChapters && book.chapters > 1) {
    return sameChapter ? `${name} ${start.chapter}` : `${name} ${start.chapter}–${end.chapter}`;
  }
  if (!sameChapter) return `${name} ${start.chapter}:${start.verse}–${end.chapter}:${end.verse}`;
  if (start.verse === end.verse) return `${name} ${start.chapter}:${start.verse}`;
  return `${name} ${start.chapter}:${start.verse}–${end.verse}`;
}

/** "Romans 8:28", "Matthew 18:21–35", "John 3"; `short` uses abbreviations ("Rom 8:28"). */
export function formatReference(range: VerseRange, options?: { short?: boolean }): string {
  const short = options?.short ?? false;
  const book = getBook(range.start.bookId);
  if (!book) return '';
  if (range.end.bookId === range.start.bookId) return formatWithinBook(book, range, short);
  const endBook = getBook(range.end.bookId);
  if (!endBook) return '';
  const left = formatWithinBook(book, { start: range.start, end: range.start }, short);
  const right = formatWithinBook(endBook, { start: range.end, end: range.end }, short);
  return `${left}–${right}`;
}
