/**
 * OSIS reference parsing for the study-data builders ("Gen.1.1", "Exod.6.16-Exod.6.20",
 * "Bible:Rev.1.8", chapter-only "Gen.20" or "1Cor.13").
 */

const OSIS_POINT = /^(?:Bible:)?([1-3]?[A-Za-z]+)\.(\d{1,3})(?:\.(\d{1,3}))?$/;

/**
 * @typedef {{ osisToBookId: Map<string, number>, lastVerse: (bookId: number, chapter: number) => number,
 *   verseExists: (id: number) => boolean }} OsisContext
 */

function point(context, raw, edge) {
  const match = OSIS_POINT.exec(raw.trim());
  if (!match) return null;
  const bookId = context.osisToBookId.get(match[1]);
  if (!bookId) return null;
  const chapter = Number(match[2]);
  const last = context.lastVerse(bookId, chapter);
  if (!last) return null;
  const verse = match[3] === undefined ? (edge === 'start' ? 1 : last) : Number(match[3]);
  return bookId * 1_000_000 + chapter * 1_000 + verse;
}

/**
 * Parses one OSIS reference or range into inclusive verse ids, or null when it is malformed,
 * outside the 66 books, or points at a verse the WEB text does not contain.
 * @param {OsisContext} context
 * @param {string} osis
 * @returns {{ start: number, end: number } | null}
 */
export function parseOsisRange(context, osis) {
  const [startRaw, endRaw, extra] = osis.split('-');
  if (extra !== undefined || !startRaw) return null;
  const start = point(context, startRaw, 'start');
  const end = point(context, endRaw ?? startRaw, 'end');
  if (start === null || end === null || end < start) return null;
  // Snap to existing verses (a few verse numbers are omitted in the WEB).
  if (!context.verseExists(start) || !context.verseExists(end)) return null;
  return { start, end };
}
