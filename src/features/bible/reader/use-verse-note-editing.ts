import { useCallback, useEffect, useRef, useState } from 'react';

import { db } from '@/db/client';
import { useAutosave, type AutosaveStatus } from '@/features/editor/use-autosave';
import { getErrorMessage, logger } from '@/lib/logger';

import { deleteVerseNote, updateVerseNote } from '../annotations/verse-notes';

export interface VerseNoteEditing {
  content: string;
  setContent: (next: string) => void;
  status: AutosaveStatus;
  /** Delete the note now. Returns false (with `deleteError` set) when it failed. */
  remove: () => boolean;
  deleteError: string | null;
}

/**
 * Local editing state for a verse note with debounced autosave.
 * Empty content is never written; a note left empty is removed when the editor closes,
 * so "Add note" followed by "back" doesn't leave blank notes behind.
 */
export function useVerseNoteEditing(noteId: string, initialContent: string): VerseNoteEditing {
  const [content, setContent] = useState(initialContent);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const latest = useRef(initialContent);
  const isDeleted = useRef(false);

  useEffect(() => {
    latest.current = content;
  }, [content]);

  const save = useCallback(
    (value: string) => {
      if (isDeleted.current || !value.trim()) return;
      updateVerseNote(db, noteId, value);
    },
    [noteId],
  );
  const { status } = useAutosave(content, save);

  useEffect(
    () => () => {
      if (isDeleted.current || latest.current.trim()) return;
      try {
        deleteVerseNote(db, noteId);
      } catch (error) {
        logger.error('Could not remove an empty note', error);
      }
    },
    [noteId],
  );

  const remove = useCallback((): boolean => {
    try {
      deleteVerseNote(db, noteId);
      isDeleted.current = true;
      return true;
    } catch (error) {
      logger.error('Could not delete note', error, { reason: getErrorMessage(error) });
      setDeleteError('We couldn’t delete this note. Please try again.');
      return false;
    }
  }, [noteId]);

  return { content, setContent, status, remove, deleteError };
}
