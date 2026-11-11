import type { BibleBook, Testament } from './types';

type BookTuple = [code: string, name: string, shortName: string, chapters: number];

const OLD_TESTAMENT: BookTuple[] = [
  ['GEN', 'Genesis', 'Gen', 50],
  ['EXO', 'Exodus', 'Exod', 40],
  ['LEV', 'Leviticus', 'Lev', 27],
  ['NUM', 'Numbers', 'Num', 36],
  ['DEU', 'Deuteronomy', 'Deut', 34],
  ['JOS', 'Joshua', 'Josh', 24],
  ['JDG', 'Judges', 'Judg', 21],
  ['RUT', 'Ruth', 'Ruth', 4],
  ['1SA', '1 Samuel', '1 Sam', 31],
  ['2SA', '2 Samuel', '2 Sam', 24],
  ['1KI', '1 Kings', '1 Kgs', 22],
  ['2KI', '2 Kings', '2 Kgs', 25],
  ['1CH', '1 Chronicles', '1 Chr', 29],
  ['2CH', '2 Chronicles', '2 Chr', 36],
  ['EZR', 'Ezra', 'Ezra', 10],
  ['NEH', 'Nehemiah', 'Neh', 13],
  ['EST', 'Esther', 'Esth', 10],
  ['JOB', 'Job', 'Job', 42],
  ['PSA', 'Psalms', 'Ps', 150],
  ['PRO', 'Proverbs', 'Prov', 31],
  ['ECC', 'Ecclesiastes', 'Eccl', 12],
  ['SNG', 'Song of Songs', 'Song', 8],
  ['ISA', 'Isaiah', 'Isa', 66],
  ['JER', 'Jeremiah', 'Jer', 52],
  ['LAM', 'Lamentations', 'Lam', 5],
  ['EZK', 'Ezekiel', 'Ezek', 48],
  ['DAN', 'Daniel', 'Dan', 12],
  ['HOS', 'Hosea', 'Hos', 14],
  ['JOL', 'Joel', 'Joel', 3],
  ['AMO', 'Amos', 'Amos', 9],
  ['OBA', 'Obadiah', 'Obad', 1],
  ['JON', 'Jonah', 'Jonah', 4],
  ['MIC', 'Micah', 'Mic', 7],
  ['NAM', 'Nahum', 'Nah', 3],
  ['HAB', 'Habakkuk', 'Hab', 3],
  ['ZEP', 'Zephaniah', 'Zeph', 3],
  ['HAG', 'Haggai', 'Hag', 2],
  ['ZEC', 'Zechariah', 'Zech', 14],
  ['MAL', 'Malachi', 'Mal', 4],
];

const NEW_TESTAMENT: BookTuple[] = [
  ['MAT', 'Matthew', 'Matt', 28],
  ['MRK', 'Mark', 'Mark', 16],
  ['LUK', 'Luke', 'Luke', 24],
  ['JHN', 'John', 'John', 21],
  ['ACT', 'Acts', 'Acts', 28],
  ['ROM', 'Romans', 'Rom', 16],
  ['1CO', '1 Corinthians', '1 Cor', 16],
  ['2CO', '2 Corinthians', '2 Cor', 13],
  ['GAL', 'Galatians', 'Gal', 6],
  ['EPH', 'Ephesians', 'Eph', 6],
  ['PHP', 'Philippians', 'Phil', 4],
  ['COL', 'Colossians', 'Col', 4],
  ['1TH', '1 Thessalonians', '1 Thess', 5],
  ['2TH', '2 Thessalonians', '2 Thess', 3],
  ['1TI', '1 Timothy', '1 Tim', 6],
  ['2TI', '2 Timothy', '2 Tim', 4],
  ['TIT', 'Titus', 'Titus', 3],
  ['PHM', 'Philemon', 'Phlm', 1],
  ['HEB', 'Hebrews', 'Heb', 13],
  ['JAS', 'James', 'Jas', 5],
  ['1PE', '1 Peter', '1 Pet', 5],
  ['2PE', '2 Peter', '2 Pet', 3],
  ['1JN', '1 John', '1 John', 5],
  ['2JN', '2 John', '2 John', 1],
  ['3JN', '3 John', '3 John', 1],
  ['JUD', 'Jude', 'Jude', 1],
  ['REV', 'Revelation', 'Rev', 22],
];

function toBooks(tuples: BookTuple[], testament: Testament, offset: number): BibleBook[] {
  return tuples.map(([code, name, shortName, chapters], index) => ({
    id: offset + index + 1,
    code,
    name,
    shortName,
    testament,
    chapters,
  }));
}

export const BOOKS: readonly BibleBook[] = Object.freeze([
  ...toBooks(OLD_TESTAMENT, 'OT', 0),
  ...toBooks(NEW_TESTAMENT, 'NT', OLD_TESTAMENT.length),
]);

const BY_ID = new Map(BOOKS.map((book) => [book.id, book]));
const BY_CODE = new Map(BOOKS.map((book) => [book.code, book]));

export function getBook(bookId: number): BibleBook | undefined {
  return BY_ID.get(bookId);
}

export function getBookByCode(code: string): BibleBook | undefined {
  return BY_CODE.get(code.toUpperCase());
}

export function booksInTestament(testament: Testament): BibleBook[] {
  return BOOKS.filter((book) => book.testament === testament);
}

export interface ChapterLocation {
  bookId: number;
  chapter: number;
}

/** Next chapter across book boundaries; null after Revelation 22. */
export function nextChapter({ bookId, chapter }: ChapterLocation): ChapterLocation | null {
  const book = getBook(bookId);
  if (!book) return null;
  if (chapter < book.chapters) return { bookId, chapter: chapter + 1 };
  const nextBook = getBook(bookId + 1);
  return nextBook ? { bookId: nextBook.id, chapter: 1 } : null;
}

/** Previous chapter across book boundaries; null before Genesis 1. */
export function previousChapter({ bookId, chapter }: ChapterLocation): ChapterLocation | null {
  if (chapter > 1) return { bookId, chapter: chapter - 1 };
  const previousBook = getBook(bookId - 1);
  return previousBook ? { bookId: previousBook.id, chapter: previousBook.chapters } : null;
}
