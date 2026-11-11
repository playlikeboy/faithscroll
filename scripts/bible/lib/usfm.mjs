/**
 * USFM → verse rows. Handles the subset of USFM used by eBible.org's World English Bible:
 * footnotes / cross references / alternate numbers are dropped, word-level attributes and character
 * styles are stripped, section-like headings (\s, \ms, \d, \sp…) attach to the following verse,
 * paragraph / stanza starts and poetry lines become flags.
 *
 * Input is untrusted text: it is only ever parsed, never evaluated.
 */

/** Notes and alternate numbering whose whole content is removed. */
const NOTE_PATTERN = /\\(f|fe|ef|x|ex|fig|va|vp|ca)\s[\s\S]*?\\\1\*/g;
/** `|lemma="…" strong="…"` attributes inside character markers. */
const ATTRIBUTE_PATTERN = /\|[^\\|]*(?=\\\+?[a-z]+\d*\*)/g;
/** Closing markers (`\w*`) take no delimiter; opening markers swallow one delimiting space. */
const TOKEN_PATTERN = /\\(\+?[a-z]+\d*\*)|\\(\+?[a-z]+\d*)[ \t]?|([^\\]+)/g;

const HEADING_MARKERS = new Set(['s', 's1', 's2', 's3', 's4', 'ms', 'ms1', 'ms2', 'ms3', 'd', 'sp', 'qa']);
const IGNORED_CONTENT_MARKERS = new Set([
  'id', 'ide', 'h', 'h1', 'h2', 'h3', 'toc1', 'toc2', 'toc3', 'toca1', 'toca2', 'toca3',
  'mt', 'mt1', 'mt2', 'mt3', 'mt4', 'mte', 'mte1', 'mte2', 'cl', 'cd', 'cp', 'rem', 'sts', 'usfm',
  'r', 'mr', 'sr', 'sd', 'sd1', 'sd2', 'imt', 'imt1', 'imt2', 'is', 'is1', 'is2', 'ip', 'ipi', 'im',
  'imi', 'ipq', 'imq', 'ipr', 'iq', 'iq1', 'iq2', 'ib', 'ili', 'ili1', 'ili2', 'iot', 'io', 'io1',
  'io2', 'ior', 'iex', 'ie',
]);
const PROSE_MARKERS = new Set([
  'p', 'm', 'pi', 'pi1', 'pi2', 'pi3', 'mi', 'pc', 'pr', 'pm', 'pmo', 'pmc', 'pmr', 'po', 'cls',
  'ph', 'ph1', 'ph2', 'ph3', 'li', 'li1', 'li2', 'li3', 'li4', 'lh', 'lf', 'lim', 'lim1', 'lim2', 'tr',
]);
const POETRY_MARKERS = new Set(['q', 'q1', 'q2', 'q3', 'q4', 'qr', 'qc', 'qm', 'qm1', 'qm2', 'qm3', 'qd']);
const CHARACTER_MARKERS = new Set([
  'w', 'wj', 'qs', 'qac', 'bk', 'add', 'nd', 'tl', 'sc', 'it', 'bd', 'bdit', 'em', 'k', 'pn', 'png',
  'qt', 'sig', 'sls', 'ord', 'dc', 'no', 'rq', 'wh', 'wg', 'wa', 'lik', 'liv', 'litl', 'th1', 'th2',
  'tc1', 'tc2', 'tcr1', 'tcr2', 'ndx', 'rb', 'pro', 'jmp', 'sup',
]);

function normalizeSpace(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/ ([,.;:!?])/g, '$1')
    .trim();
}

function preprocess(source) {
  return source.replace(NOTE_PATTERN, '').replace(ATTRIBUTE_PATTERN, '');
}

/**
 * @typedef {{ chapter: number, verse: number, text: string, heading: string | null,
 *             paragraphStart: boolean, poetry: boolean }} ParsedVerse
 * @typedef {{ code: string, verses: ParsedVerse[], warnings: string[] }} ParsedBook
 */

class BookParser {
  constructor() {
    this.code = '';
    this.verses = [];
    this.warnings = [];
    this.chapter = 0;
    this.lastVerseChapter = -1;
    this.current = null;
    this.state = 'none';
    this.mode = 'prose';
    this.pendingBreak = false;
    this.headingLines = [];
    this.headingBuffer = '';
  }

  flushHeadingLine() {
    const line = normalizeSpace(this.headingBuffer);
    if (line) this.headingLines.push(line);
    this.headingBuffer = '';
  }

  closeVerse() {
    if (!this.current) return;
    const text = normalizeSpace(this.current.parts.join(''));
    if (!text) this.warnings.push(`${this.code} ${this.current.chapter}:${this.current.verse} has no text (omitted)`);
    this.verses.push({
      chapter: this.current.chapter,
      verse: this.current.verse,
      text,
      heading: this.current.heading,
      paragraphStart: this.current.paragraphStart,
      poetry: this.current.poetry,
    });
    this.current = null;
  }

  /** Text after `\v` / `\c` begins with the number. */
  takeNumber(marker, text) {
    const match = /^\s*(\d+)(?:[-–](\d+))?[a-z]?\s?/.exec(text);
    if (!match) {
      this.warnings.push(`${this.code}: \\${marker} without a number near chapter ${this.chapter}`);
      return { value: null, rest: text };
    }
    if (match[2]) this.warnings.push(`${this.code} ${this.chapter}:${match[1]}-${match[2]} is a verse bridge`);
    return { value: Number(match[1]), rest: text.slice(match[0].length) };
  }

  handleMarker(name, nextText) {
    const marker = name.replace(/^\+/, '');

    if (marker === 'c') {
      this.closeVerse();
      this.flushHeadingLine();
      const { value, rest } = this.takeNumber('c', nextText ?? '');
      if (value !== null) this.chapter = value;
      this.state = 'none';
      this.pendingBreak = true;
      return rest;
    }
    if (marker === 'v') {
      this.closeVerse();
      this.flushHeadingLine();
      const { value, rest } = this.takeNumber('v', nextText ?? '');
      if (value === null) return rest;
      const firstInChapter = this.lastVerseChapter !== this.chapter;
      this.lastVerseChapter = this.chapter;
      this.current = {
        chapter: this.chapter,
        verse: value,
        parts: [],
        heading: this.headingLines.length > 0 ? this.headingLines.join('\n') : null,
        paragraphStart: this.pendingBreak || firstInChapter,
        poetry: this.mode === 'poetry',
      };
      this.headingLines = [];
      this.pendingBreak = false;
      this.state = 'verse';
      return rest;
    }
    if (HEADING_MARKERS.has(marker)) {
      this.flushHeadingLine();
      this.pendingBreak = true;
      this.state = 'heading';
      return nextText;
    }
    if (IGNORED_CONTENT_MARKERS.has(marker)) {
      this.flushHeadingLine();
      if (marker === 'id') this.code = (nextText ?? '').trim().slice(0, 3).toUpperCase();
      this.state = 'ignore';
      return nextText;
    }
    if (PROSE_MARKERS.has(marker) || POETRY_MARKERS.has(marker) || marker === 'b' || marker === 'nb') {
      this.flushHeadingLine();
      if (marker === 'b') this.pendingBreak = true;
      else if (POETRY_MARKERS.has(marker)) {
        if (this.mode !== 'poetry') this.pendingBreak = true;
        this.mode = 'poetry';
      } else {
        if (marker !== 'nb') this.pendingBreak = true;
        this.mode = 'prose';
      }
      this.state = this.current ? 'verse' : 'none';
      return nextText;
    }
    if (!CHARACTER_MARKERS.has(marker)) this.warnings.push(`${this.code}: unknown marker \\${marker}`);
    return nextText;
  }

  handleText(text) {
    if (this.state === 'heading') {
      this.headingBuffer += text;
      return;
    }
    if (this.state !== 'verse' || !this.current) return;
    this.current.parts.push(text);
    // Real text after a break marker means the break fell inside this verse, not before the next one.
    if (this.pendingBreak && text.trim()) this.pendingBreak = false;
  }

  parse(source) {
    const tokens = [...preprocess(source).matchAll(TOKEN_PATTERN)];
    for (let index = 0; index < tokens.length; index += 1) {
      const [, closing, opening, text] = tokens[index];
      if (text !== undefined) {
        this.handleText(text);
        continue;
      }
      if (closing !== undefined) continue;
      const marker = opening;
      const following = tokens[index + 1];
      const followingText = following ? following[3] : undefined;
      const rest = this.handleMarker(marker, followingText);
      if (followingText !== undefined) {
        index += 1;
        if (rest) this.handleText(rest);
      }
    }
    this.closeVerse();
    return { code: this.code, verses: this.verses, warnings: this.warnings };
  }
}

/**
 * Parses one USFM book.
 * @param {string} source
 * @returns {ParsedBook}
 */
export function parseUsfmBook(source) {
  return new BookParser().parse(source);
}
