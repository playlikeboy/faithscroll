/**
 * Plain-text helpers for Markdown-lite content (headings, lists, **bold**, *italic*, ==highlight==).
 * Used for timeline excerpts, link titles and accessibility labels.
 */

const DEFAULT_EXCERPT_LENGTH = 140;

function stripLineMarkers(line: string): string {
  return line
    .replace(/^\s{0,3}#{1,6}\s+/, '')
    .replace(/^\s*>\s?/, '')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '')
    .replace(/^\s*\[[ xX]\]\s+/, '');
}

export function toPlainText(markdown: string): string {
  return markdown
    .split('\n')
    .map(stripLineMarkers)
    .join(' ')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/==(.+?)==/g, '$1')
    .replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, '$1$2')
    .replace(/(^|[^_\w])_(?!\s)(.+?)_(?!\w)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/** First `maxLength` characters of the plain text, cut on a word boundary when possible. */
export function excerpt(markdown: string, maxLength: number = DEFAULT_EXCERPT_LENGTH): string {
  const plain = toPlainText(markdown);
  if (plain.length <= maxLength) return plain;
  const cut = plain.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  const trimmed = lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${trimmed.trimEnd()}…`;
}
