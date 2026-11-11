/**
 * Parses OpenBible.info's cross_references.txt (tab separated, CC-BY):
 *   From Verse <TAB> To Verse <TAB> Votes
 *   Gen.1.1    <TAB> Ps.89.11-Ps.89.12 <TAB> 64
 * Book names are OSIS abbreviations ("1Cor", "Phlm").
 */

const OSIS_REF = /^([1-3]?[A-Za-z]+)\.(\d{1,3})\.(\d{1,3})$/;

/**
 * @param {Map<string, number>} osisToBookId
 * @param {string} osis e.g. "Gen.1.1"
 * @returns {number | null} verse id
 */
function toVerseId(osisToBookId, osis) {
  const match = OSIS_REF.exec(osis.trim());
  if (!match) return null;
  const bookId = osisToBookId.get(match[1]);
  if (!bookId) return null;
  return bookId * 1_000_000 + Number(match[2]) * 1_000 + Number(match[3]);
}

/**
 * @typedef {{ from: number, toStart: number, toEnd: number, votes: number }} CrossReference
 *
 * Keeps positively voted references whose verses exist, de-duplicated, and at most
 * `maxPerVerse` per source verse (highest votes first).
 *
 * @param {string} text file contents
 * @param {{ osisToBookId: Map<string, number>, verseExists: (id: number) => boolean, maxPerVerse: number }} options
 * @returns {{ references: CrossReference[], stats: Record<string, number> }}
 */
export function parseCrossReferences(text, { osisToBookId, verseExists, maxPerVerse }) {
  const stats = { lines: 0, malformed: 0, nonPositive: 0, missingVerse: 0, duplicate: 0, trimmed: 0, kept: 0 };
  /** @type {Map<number, Map<string, CrossReference>>} */
  const bySource = new Map();

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('From Verse') || line.startsWith('#')) continue;
    stats.lines += 1;
    const [fromRaw, toRaw, votesRaw] = line.split('\t');
    const votes = Number.parseInt(votesRaw ?? '', 10);
    if (!fromRaw || !toRaw || !Number.isFinite(votes)) {
      stats.malformed += 1;
      continue;
    }
    if (votes <= 0) {
      stats.nonPositive += 1;
      continue;
    }
    const [toStartRaw, toEndRaw = toStartRaw] = toRaw.split('-');
    const from = toVerseId(osisToBookId, fromRaw);
    const toStart = toVerseId(osisToBookId, toStartRaw);
    const toEnd = toVerseId(osisToBookId, toEndRaw);
    if (from === null || toStart === null || toEnd === null || toEnd < toStart) {
      stats.malformed += 1;
      continue;
    }
    if (!verseExists(from) || !verseExists(toStart) || !verseExists(toEnd)) {
      stats.missingVerse += 1;
      continue;
    }
    const targets = bySource.get(from) ?? new Map();
    const key = `${toStart}-${toEnd}`;
    const existing = targets.get(key);
    if (existing) {
      stats.duplicate += 1;
      if (existing.votes >= votes) continue;
    }
    targets.set(key, { from, toStart, toEnd, votes });
    bySource.set(from, targets);
  }

  const references = [];
  for (const targets of bySource.values()) {
    const ranked = [...targets.values()].sort((a, b) => b.votes - a.votes || a.toStart - b.toStart);
    stats.trimmed += Math.max(0, ranked.length - maxPerVerse);
    references.push(...ranked.slice(0, maxPerVerse));
  }
  stats.kept = references.length;
  return { references, stats };
}
