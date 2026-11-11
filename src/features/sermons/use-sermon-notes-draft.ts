import { useState } from 'react';

import { db } from '@/db/client';
import { useAutosave, type AutosaveStatus } from '@/features/editor';
import { logger } from '@/lib/logger';

import { getSermonNote, saveSermonNote } from './notes-repository';

function readNote(sermonId: string): string {
  try {
    return getSermonNote(db, sermonId)?.content ?? '';
  } catch (error) {
    logger.error('Could not load sermon notes', error);
    return '';
  }
}

export interface SermonNotesDraft {
  content: string;
  setContent: (next: string) => void;
  status: AutosaveStatus;
  error: Error | null;
  /** Save pending changes now (before leaving the screen). */
  flush: () => Promise<boolean>;
}

/** Editable sermon notes that autosave locally while typing (and when the app is backgrounded). */
export function useSermonNotesDraft(sermonId: string): SermonNotesDraft {
  const [content, setContent] = useState(() => readNote(sermonId));
  const autosave = useAutosave(content, (value: string) => {
    saveSermonNote(db, sermonId, value);
  });
  return { content, setContent, status: autosave.status, error: autosave.error, flush: autosave.flush };
}
