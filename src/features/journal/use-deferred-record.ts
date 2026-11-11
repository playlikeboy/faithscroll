/**
 * Editing state for a record that is created lazily: nothing is written until the draft becomes
 * meaningful (or the user performs an explicit action that needs the record), then edits
 * autosave. Shared by the journal and prayer editors.
 */
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import { useAutosave, type AutosaveResult } from '@/features/editor/use-autosave';
import { logger } from '@/lib/logger';

export interface DeferredRecordOptions<D> {
  initialId: string | null;
  initialDraft: D;
  /** False when the record failed to load: nothing is saved. */
  enabled: boolean;
  isMeaningful: (draft: D) => boolean;
  /** Insert the record (with any pending attachments) and return its id. */
  create: (draft: D) => string;
  update: (id: string, draft: D) => void;
}

export interface DeferredRecord<D> {
  id: string | null;
  draft: D;
  setDraft: Dispatch<SetStateAction<D>>;
  autosave: AutosaveResult;
  actionError: string | null;
  setActionError: (message: string | null) => void;
  /** Run a write that needs the record, creating it first when necessary. */
  withRecord: (action: (id: string) => void, failure: string) => void;
  /** Run a write that does not need the record. */
  run: (action: () => void, failure: string) => void;
  /** Current id without waiting for a render (null before creation). */
  currentId: () => string | null;
  /** Stop all saving (after delete/discard); pass false to resume if deleting failed. */
  setDeleted: (deleted: boolean) => void;
}

export function useDeferredRecord<D>(options: DeferredRecordOptions<D>): DeferredRecord<D> {
  const { initialId, initialDraft, enabled } = options;
  const [draft, setDraft] = useState(initialDraft);
  const [id, setId] = useState(initialId);
  const [actionError, setActionError] = useState<string | null>(null);

  const idRef = useRef(initialId);
  const draftRef = useRef(initialDraft);
  const optionsRef = useRef(options);
  const deletedRef = useRef(false);

  useEffect(() => {
    draftRef.current = draft;
    optionsRef.current = options;
  });

  const createNow = useCallback((value: D): string => {
    const createdId = optionsRef.current.create(value);
    idRef.current = createdId;
    setId(createdId);
    return createdId;
  }, []);

  const save = useCallback(
    (value: D) => {
      if (deletedRef.current) return;
      if (idRef.current) optionsRef.current.update(idRef.current, value);
      else if (optionsRef.current.isMeaningful(value)) createNow(value);
    },
    [createNow],
  );

  const autosave = useAutosave(draft, save, { enabled });

  const run = useCallback((action: () => void, failure: string) => {
    try {
      action();
      setActionError(null);
    } catch (error) {
      logger.error('Editor action failed', error);
      setActionError(failure);
    }
  }, []);

  const withRecord = useCallback(
    (action: (recordId: string) => void, failure: string) =>
      run(() => action(idRef.current ?? createNow(draftRef.current)), failure),
    [run, createNow],
  );

  return {
    id,
    draft,
    setDraft,
    autosave,
    actionError,
    setActionError,
    withRecord,
    run,
    currentId: () => idRef.current,
    setDeleted: (deleted) => {
      deletedRef.current = deleted;
    },
  };
}
