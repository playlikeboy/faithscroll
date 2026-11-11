/**
 * State behind `NoteEditor`: tracks the selection, applies toolbar text operations, continues
 * lists on Return and places the caret after programmatic edits. Kept free of per-keystroke
 * re-renders: the latest text/selection live in refs; state changes only for toolbar edits.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TextInputSelectionChangeEvent } from 'react-native';

import { logger } from '@/lib/logger';

import {
  continueList,
  insertToken,
  timestampToken,
  toggleBlockFormat,
  toggleInlineFormat,
  type EditorState,
  type TextSelection,
} from './text-ops';

export type EditorAction = 'heading' | 'bold' | 'italic' | 'highlight' | 'bullet' | 'numbered' | 'timestamp' | 'scripture';

export interface UseNoteEditorOptions {
  value: string;
  onChangeText: (next: string) => void;
  getTimestampMs?: () => number | null;
  onRequestScripture?: () => Promise<string | null>;
  /** Called after an asynchronous insertion (e.g. return focus to the input). */
  onInserted?: () => void;
}

export interface NoteEditorController {
  /** Controlled selection for one render after a toolbar edit; otherwise undefined. */
  selection: TextSelection | undefined;
  handleChangeText: (next: string) => void;
  handleSelectionChange: (event: TextInputSelectionChangeEvent) => void;
  runAction: (action: EditorAction) => void;
  isScriptureBusy: boolean;
  errorMessage: string | null;
}

export const SCRIPTURE_ERROR = "Couldn't add that Scripture reference. Please try again.";
export const TIMESTAMP_ERROR = "Couldn't read the current time. Please try again.";

export function useNoteEditor(options: UseNoteEditorOptions): NoteEditorController {
  const { value } = options;
  const valueRef = useRef(value);
  const optionsRef = useRef(options);
  const selectionRef = useRef<TextSelection>({ start: value.length, end: value.length });
  const pendingRef = useRef(false);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const [selection, setSelection] = useState<TextSelection | undefined>(undefined);
  const [isScriptureBusy, setScriptureBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    valueRef.current = value;
    optionsRef.current = options;
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const current = useCallback((): EditorState => ({ text: valueRef.current, selection: selectionRef.current }), []);

  const commit = useCallback((next: EditorState) => {
    valueRef.current = next.text;
    selectionRef.current = next.selection;
    pendingRef.current = true;
    setSelection(next.selection);
    optionsRef.current.onChangeText(next.text);
  }, []);

  const handleChangeText = useCallback(
    (next: string) => {
      const continued = continueList(valueRef.current, next, selectionRef.current.start);
      if (continued) {
        commit(continued);
        return;
      }
      valueRef.current = next;
      optionsRef.current.onChangeText(next);
    },
    [commit],
  );

  const handleSelectionChange = useCallback((event: TextInputSelectionChangeEvent) => {
    const { start, end } = event.nativeEvent.selection;
    selectionRef.current = { start, end };
    if (pendingRef.current) {
      pendingRef.current = false;
      setSelection(undefined);
    }
  }, []);

  const insertTimestamp = useCallback(() => {
    try {
      const positionMs = optionsRef.current.getTimestampMs?.();
      if (positionMs === null || positionMs === undefined || !Number.isFinite(positionMs)) return;
      setErrorMessage(null);
      commit(insertToken(current(), timestampToken(positionMs)));
    } catch (error) {
      logger.error('Reading the timestamp failed', error);
      setErrorMessage(TIMESTAMP_ERROR);
    }
  }, [commit, current]);

  const insertScripture = useCallback(async () => {
    const request = optionsRef.current.onRequestScripture;
    if (!request || busyRef.current) return;
    busyRef.current = true;
    setScriptureBusy(true);
    setErrorMessage(null);
    try {
      const reference = await request();
      if (mountedRef.current && reference && reference.trim().length > 0) {
        commit(insertToken(current(), reference));
        optionsRef.current.onInserted?.();
      }
    } catch (error) {
      logger.error('Scripture reference request failed', error);
      if (mountedRef.current) setErrorMessage(SCRIPTURE_ERROR);
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setScriptureBusy(false);
    }
  }, [commit, current]);

  const runAction = useCallback(
    (action: EditorAction) => {
      switch (action) {
        case 'bold':
        case 'italic':
        case 'highlight':
          commit(toggleInlineFormat(current(), action));
          return;
        case 'heading':
        case 'bullet':
        case 'numbered':
          commit(toggleBlockFormat(current(), action));
          return;
        case 'timestamp':
          insertTimestamp();
          return;
        case 'scripture':
          void insertScripture();
          return;
      }
    },
    [commit, current, insertScripture, insertTimestamp],
  );

  return { selection, handleChangeText, handleSelectionChange, runAction, isScriptureBusy, errorMessage };
}
