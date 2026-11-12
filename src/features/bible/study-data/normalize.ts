/**
 * The lookup form of topic names and dictionary terms.
 * MUST match `normalizeName` in scripts/bible/lib/text.mjs, which wrote `topics.normalized`
 * and `dictionary.normalized` into the bundled database.
 */
export function normalizeName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’‘`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
