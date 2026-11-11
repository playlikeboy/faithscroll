/** Text shared from the verse action sheet: passage, reference and translation name. */
export function buildShareMessage(reference: string, passageText: string, translationName: string): string {
  return `“${passageText.trim()}”\n— ${reference} (${translationName})`;
}
