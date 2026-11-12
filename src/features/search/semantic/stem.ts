/**
 * A deliberately light English stemmer for matching query words to concept words
 * ("worried" / "worrying" / "worries" → "worri"). It only needs to be consistent with itself:
 * both the concept map and the query go through it. Verse text uses SQLite's Porter stemmer.
 */
const SUFFIXES: readonly (readonly [suffix: string, replacement: string])[] = [
  ['fulness', ''],
  ['fully', ''],
  ['iness', 'y'],
  ['ness', ''],
  ['ments', ''],
  ['ment', ''],
  ['ful', ''],
  ['ies', 'y'],
  ['ied', 'y'],
  ['ily', 'y'],
  ['ly', ''],
  ['ing', ''],
  ['ed', ''],
  ['es', ''],
  ['s', ''],
];
const MIN_STEM = 3;
const MAX_PASSES = 2;

function stripSuffix(word: string): string {
  for (const [suffix, replacement] of SUFFIXES) {
    if (!word.endsWith(suffix)) continue;
    if (suffix === 's' && /(ss|us|is)$/.test(word)) return word;
    const stem = word.slice(0, -suffix.length) + replacement;
    return stem.length >= MIN_STEM ? stem : word;
  }
  return word;
}

export function stem(input: string): string {
  let word = input.toLowerCase().replace(/['’]s$/, '').replace(/[^\p{L}\p{N}]/gu, '');
  if (word.length <= MIN_STEM) return word;
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const next = stripSuffix(word);
    if (next === word) break;
    word = next;
  }
  if (word.length > MIN_STEM && word.endsWith('e')) word = word.slice(0, -1);
  if (word.endsWith('y')) word = `${word.slice(0, -1)}i`;
  // "running" → "runn" → "run"; keep "ss" ("stress") and "ll" ("will").
  if (word.length > MIN_STEM && /([b-df-hjkmnp-rtv-z])\1$/.test(word)) word = word.slice(0, -1);
  return word;
}
