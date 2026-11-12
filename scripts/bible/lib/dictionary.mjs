/**
 * Easton's Bible Dictionary (1897, public domain), CrossWire SWORD "Easton" module (TEI entries)
 * → plain-text dictionary rows. Paragraphs are separated by a blank line; Scripture references
 * keep their printed form ("Rom. 11:6") so the app can link them with its reference finder.
 */
import { normalizeName, stripTags, titleCase } from './text.mjs';

const MAX_DEFINITION_LENGTH = 60_000;

function toParagraphs(markup) {
  const body = markup.replace(/<title>[\s\S]*?<\/title>/g, '').replace(/<\/?entryFree[^>]*>/g, '');
  const parts = body.split(/<\/p>|<p>|<lb\/>/);
  return parts
    .map((part) => stripTags(part).replace(/\s+([,.;:)])/g, '$1').replace(/\(\s+/g, '('))
    .filter((part) => part.length > 0);
}

/** "Agrippa I." / "PORCH, SOLOMON’S" → display term. Easton keys are upper case; titles keep case. */
function displayTerm(key, markup) {
  const title = /<title>([\s\S]*?)<\/title>/.exec(markup);
  const text = title ? stripTags(title[1]) : '';
  return text || titleCase(key);
}

/**
 * @param {{ key: string, text: string, linkTo: string | null }[]} entries
 * @returns {{ rows: { id: number, term: string, normalized: string, definition: string }[], stats: Record<string, number> }}
 */
export function parseEastonEntries(entries) {
  const stats = { entries: entries.length, empty: 0, duplicate: 0, kept: 0 };
  const rows = [];
  const seen = new Set();
  for (const entry of entries) {
    if (!entry.text) {
      stats.empty += 1;
      continue;
    }
    const term = displayTerm(entry.key, entry.text);
    const normalized = normalizeName(term);
    const definition = toParagraphs(entry.text).join('\n\n').slice(0, MAX_DEFINITION_LENGTH);
    if (!normalized || !definition) {
      stats.empty += 1;
      continue;
    }
    if (seen.has(`${normalized}|${definition}`)) {
      stats.duplicate += 1;
      continue;
    }
    seen.add(`${normalized}|${definition}`);
    rows.push({ term, normalized, definition });
  }
  rows.sort((a, b) => a.normalized.localeCompare(b.normalized) || a.term.localeCompare(b.term));
  stats.kept = rows.length;
  return { rows: rows.map((row, index) => ({ id: index + 1, ...row })), stats };
}
