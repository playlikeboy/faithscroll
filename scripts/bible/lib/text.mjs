/**
 * Small text helpers shared by the topical-index and dictionary builders.
 *
 * `normalizeName` MUST stay in sync with `normalizeName` in src/features/bible/study-data/normalize.ts:
 * the app looks topics and dictionary terms up by this exact form.
 */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);

export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

/** Removes every tag, decodes entities and collapses whitespace. */
export function stripTags(markup) {
  return decodeEntities(markup.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** Lowercase, no diacritics, apostrophes dropped, other punctuation → space, single spaces. */
export function normalizeName(name) {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’‘`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** "LORD’S SUPPER" / "love of god" → "Lord’s Supper" / "Love of God". */
export function titleCase(name) {
  const words = name.trim().replace(/\s+/g, ' ').toLowerCase().split(' ');
  return words
    .map((word, index) => {
      if (index > 0 && SMALL_WORDS.has(word)) return word;
      return word.replace(/^(\P{L}*)(\p{L})/u, (_, lead, letter) => `${lead}${letter.toUpperCase()}`);
    })
    .join(' ')
    .replace(/\bgod\b/g, 'God')
    .replace(/\bjesus\b/g, 'Jesus')
    .replace(/\bchrist\b/g, 'Christ');
}
