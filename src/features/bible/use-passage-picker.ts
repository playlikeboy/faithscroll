/**
 * CONTRACT STUB — owned by the bible-ui agent.
 * Opens the `bible/passage-picker` modal and resolves with the chosen range
 * (or null if the user cancels). Used by sermons, journal, prayers and the note editor.
 *
 *   const pickPassage = usePassagePicker();
 *   const range = await pickPassage({ title: 'Main passage' });
 */
import type { VerseRange } from './types';

export interface PassagePickerOptions {
  title?: string;
  initial?: VerseRange | null;
}

export function usePassagePicker(): (options?: PassagePickerOptions) => Promise<VerseRange | null> {
  return async () => null;
}
