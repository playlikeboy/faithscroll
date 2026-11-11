/**
 * Book names and abbreviations (lowercase, periods removed, single spaces) used by reference parsing.
 * Covers full names, SBL abbreviations, common variants and USFM codes.
 */

/** Books without a numeric prefix, keyed by USFM code. */
export const BOOK_ALIASES: Readonly<Record<string, readonly string[]>> = {
  GEN: ['genesis', 'gen', 'ge', 'gn'],
  EXO: ['exodus', 'exod', 'exo', 'ex', 'exd'],
  LEV: ['leviticus', 'lev', 'le', 'lv'],
  NUM: ['numbers', 'num', 'nu', 'nm', 'nb'],
  DEU: ['deuteronomy', 'deut', 'deu', 'dt', 'de'],
  JOS: ['joshua', 'josh', 'jos', 'jsh'],
  JDG: ['judges', 'judg', 'jdg', 'jdgs', 'jg'],
  RUT: ['ruth', 'rut', 'rth', 'ru'],
  EZR: ['ezra', 'ezr'],
  NEH: ['nehemiah', 'neh', 'ne'],
  EST: ['esther', 'esth', 'est', 'es'],
  JOB: ['job', 'jb'],
  PSA: ['psalms', 'psalm', 'ps', 'psa', 'pss', 'psm', 'pslm'],
  PRO: ['proverbs', 'proverb', 'prov', 'pro', 'prv', 'pr'],
  ECC: ['ecclesiastes', 'eccles', 'eccl', 'ecc', 'ec', 'qoheleth', 'qoh'],
  SNG: [
    'song of songs',
    'song of solomon',
    'song of sol',
    'canticle of canticles',
    'canticles',
    'song',
    'songs',
    'sng',
    'sos',
    'so',
    'cant',
  ],
  ISA: ['isaiah', 'isa', 'is'],
  JER: ['jeremiah', 'jer', 'je', 'jr'],
  LAM: ['lamentations', 'lam', 'la'],
  EZK: ['ezekiel', 'ezek', 'eze', 'ezk'],
  DAN: ['daniel', 'dan', 'da', 'dn'],
  HOS: ['hosea', 'hos', 'ho'],
  JOL: ['joel', 'jol', 'jl'],
  AMO: ['amos', 'amo', 'am'],
  OBA: ['obadiah', 'obad', 'oba', 'ob'],
  JON: ['jonah', 'jon', 'jnh'],
  MIC: ['micah', 'mic', 'mc'],
  NAM: ['nahum', 'nah', 'nam', 'na'],
  HAB: ['habakkuk', 'hab', 'hb'],
  ZEP: ['zephaniah', 'zeph', 'zep', 'zp'],
  HAG: ['haggai', 'hag', 'hg'],
  ZEC: ['zechariah', 'zech', 'zec', 'zc'],
  MAL: ['malachi', 'mal', 'ml'],
  MAT: ['matthew', 'matt', 'mat', 'mt'],
  MRK: ['mark', 'mrk', 'mar', 'mk', 'mr'],
  LUK: ['luke', 'luk', 'lk'],
  JHN: ['john', 'jhn', 'joh', 'jn'],
  ACT: ['acts of the apostles', 'acts', 'act', 'ac'],
  ROM: ['romans', 'rom', 'ro', 'rm'],
  GAL: ['galatians', 'gal', 'ga'],
  EPH: ['ephesians', 'ephes', 'eph'],
  PHP: ['philippians', 'phil', 'php', 'pp'],
  COL: ['colossians', 'col'],
  TIT: ['titus', 'tit'],
  PHM: ['philemon', 'philem', 'phlm', 'phm'],
  HEB: ['hebrews', 'heb'],
  JAS: ['james', 'jas', 'jm'],
  JUD: ['jude', 'jud', 'jd'],
  REV: ['revelation', 'revelations', 'the revelation', 'apocalypse', 'rev', 're', 'rv'],
};

/** Books with a numeric prefix: base aliases plus the USFM code for each ordinal (1, 2, 3). */
export const NUMBERED_BOOK_ALIASES: readonly { codes: readonly string[]; aliases: readonly string[] }[] = [
  { codes: ['1SA', '2SA'], aliases: ['samuel', 'sam', 'sa', 'sm'] },
  { codes: ['1KI', '2KI'], aliases: ['kings', 'kgs', 'ki', 'kin', 'kngs'] },
  { codes: ['1CH', '2CH'], aliases: ['chronicles', 'chron', 'chr', 'ch'] },
  { codes: ['1CO', '2CO'], aliases: ['corinthians', 'cor', 'co'] },
  { codes: ['1TH', '2TH'], aliases: ['thessalonians', 'thess', 'thes', 'th'] },
  { codes: ['1TI', '2TI'], aliases: ['timothy', 'tim', 'ti', 'tm'] },
  { codes: ['1PE', '2PE'], aliases: ['peter', 'pet', 'pe', 'pt'] },
  { codes: ['1JN', '2JN', '3JN'], aliases: ['john', 'jhn', 'joh', 'jn', 'jo'] },
];

/** Ordinal prefixes accepted before numbered books. */
export const ORDINAL_WORDS: Readonly<Record<string, number>> = {
  i: 1,
  ii: 2,
  iii: 3,
  first: 1,
  second: 2,
  third: 3,
};

/**
 * Aliases that are ordinary English words or too short to trust when scanning free text.
 * `parseReference` still accepts them; `findReferences` ignores them.
 */
export const AMBIGUOUS_IN_TEXT: ReadonlySet<string> = new Set([
  'ge', 'ex', 'le', 'nu', 'nb', 'de', 'ru', 'ne', 'es', 'pr', 'ec', 'so', 'is', 'je', 'la', 'da', 'ho',
  'am', 'ob', 'na', 'mr', 'ac', 'ro', 'ga', 'pp', 're', 'jd', 'jg', 'mc', 'hb', 'hg', 'zc', 'zp', 'ml',
  'act', 'pro', 'tit', 'mar', 'can', 'cant', 'sos',
]);

/** Book names that are common words: in free text they need an explicit verse or "chapter". */
export const NEEDS_VERSE_IN_TEXT: ReadonlySet<string> = new Set(['numbers', 'num', 'judges', 'song', 'songs']);
