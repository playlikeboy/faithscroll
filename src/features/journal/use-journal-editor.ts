/**
 * State + persistence for the journal editor (new and existing entries).
 *
 * - New entries are created on the first meaningful input (a title, words beyond an inserted
 *   prompt, or an explicit attach/tag action) so opening and leaving never leaves clutter.
 * - Prefilled passages/links stay "pending" until the entry exists, then attach in the same
 *   transaction as the insert.
 * - Text autosaves (debounced) and flushes on blur/background/unmount via `useAutosave`.
 */
import { useEffect, useRef, useState } from 'react';

import { db } from '@/db/client';
import type { AutosaveResult } from '@/features/editor/use-autosave';
import {
  CONNECTION_TABLES,
  EMPTY_PENDING,
  existingLinks,
  loadConnections,
  loadPendingConnections,
  pendingConnectionsKey,
  type ConnectedItem,
  type Connections,
  type PassageItem,
  type PendingConnections,
} from '@/features/links/connections';
import type { LinkTarget } from '@/features/links/link-picker-registry';
import { createLink, removeLink } from '@/features/links/repository';
import { attachScriptureReference, detachScriptureReference } from '@/features/links/scripture-references';
import { assignTag, unassignTag } from '@/features/tags/repository';
import { logger } from '@/lib/logger';
import { toLocalDateString } from '@/lib/time';
import { track } from '@/services/monitoring/analytics';

import { appendPrompt, hasMeaningfulContent, toDraftChanges, type JournalDraft, type JournalPrefill } from './prefill';
import { createJournalEntry, deleteJournalEntry, getJournalEntry, updateJournalEntry, type PassageIds } from './repository';
import { DEFAULT_JOURNAL_TYPE, type JournalEntry, type JournalEntryType } from './types';
import { useDeferredRecord } from './use-deferred-record';
import { useLiveData } from './use-live-data';

export type EditorLoadStatus = 'ready' | 'not_found' | 'error';

export interface JournalEditor {
  status: EditorLoadStatus;
  entryId: string | null;
  draft: JournalDraft;
  connections: Connections | undefined;
  autosave: AutosaveResult;
  /** Last failed attach/remove action, as a user-friendly message. */
  actionError: string | null;
  setTitle: (title: string) => void;
  setContent: (content: string) => void;
  setEntryType: (entryType: JournalEntryType) => void;
  setEntryDate: (date: Date) => void;
  insertPrompt: (prompt: string) => void;
  clearPrompt: () => void;
  attachPassage: (passage: PassageIds) => void;
  removePassage: (item: PassageItem) => void;
  attachLink: (target: LinkTarget) => void;
  removeConnection: (item: ConnectedItem) => void;
  addTag: (name: string) => void;
  removeTag: (tagId: string) => void;
  /** Delete (or discard an unsaved draft). Returns false if deleting failed. */
  deleteEntry: () => boolean;
}

interface InitialState {
  status: EditorLoadStatus;
  entryId: string | null;
  draft: JournalDraft;
  pending: PendingConnections;
}

function draftFromEntry(entry: JournalEntry): JournalDraft {
  return { title: entry.title, content: entry.content, entryType: entry.entryType, entryDate: entry.entryDate, prompt: entry.prompt };
}

function loadInitial(entryId: string | undefined, prefill: JournalPrefill): InitialState {
  const blank: JournalDraft = {
    title: '',
    content: '',
    entryType: prefill.entryType ?? DEFAULT_JOURNAL_TYPE,
    entryDate: toLocalDateString(),
    prompt: prefill.prompt,
  };
  try {
    if (entryId === undefined) {
      const pending = { passages: prefill.passage ? [prefill.passage] : [], links: existingLinks(db, prefill.links) };
      return { status: 'ready', entryId: null, draft: blank, pending };
    }
    const entry = getJournalEntry(db, entryId);
    if (!entry) return { status: 'not_found', entryId: null, draft: blank, pending: EMPTY_PENDING };
    return { status: 'ready', entryId, draft: draftFromEntry(entry), pending: EMPTY_PENDING };
  } catch (error) {
    logger.error('Opening journal entry failed', error);
    return { status: 'error', entryId: null, draft: blank, pending: EMPTY_PENDING };
  }
}

export function useJournalEditor(entryIdParam: string | undefined, prefill: JournalPrefill): JournalEditor {
  const [initial] = useState(() => loadInitial(entryIdParam, prefill));
  const [pending, setPending] = useState(initial.pending);
  const pendingRef = useRef(initial.pending);
  useEffect(() => {
    pendingRef.current = pending;
  });

  const record = useDeferredRecord<JournalDraft>({
    initialId: initial.entryId,
    initialDraft: initial.draft,
    enabled: initial.status === 'ready',
    isMeaningful: hasMeaningfulContent,
    create: (value) => {
      const created = createJournalEntry(db, toDraftChanges(value), pendingRef.current);
      pendingRef.current = EMPTY_PENDING;
      setPending(EMPTY_PENDING);
      track({ name: 'journal_entry_created', entryType: created.entryType });
      return created.id;
    },
    update: (id, value) => updateJournalEntry(db, id, toDraftChanges(value)),
  });
  const { id: entryId, setDraft, withRecord, run } = record;

  const { data: connections } = useLiveData(
    () => (entryId ? loadConnections(db, { type: 'journal_entry', id: entryId }) : loadPendingConnections(db, pending)),
    CONNECTION_TABLES,
    entryId ?? `pending:${pendingConnectionsKey(pending)}`,
  );

  const update = (changes: Partial<JournalDraft>) => setDraft((current) => ({ ...current, ...changes }));

  return {
    status: initial.status,
    entryId,
    draft: record.draft,
    connections,
    autosave: record.autosave,
    actionError: record.actionError,
    setTitle: (title) => update({ title }),
    setContent: (content) => update({ content }),
    setEntryType: (entryType) => update({ entryType }),
    setEntryDate: (date) => update({ entryDate: toLocalDateString(date) }),
    insertPrompt: (prompt) =>
      setDraft((current) => ({ ...current, content: appendPrompt(current.content, prompt), prompt: current.prompt ?? prompt })),
    clearPrompt: () => update({ prompt: null }),
    attachPassage: (passage) =>
      withRecord((id) => attachScriptureReference(db, { sourceType: 'journal_entry', sourceId: id, ...passage }), "We couldn't attach that passage."),
    removePassage: (item) =>
      item.isPending
        ? setPending((current) => ({
            ...current,
            passages: current.passages.filter((p) => p.startVerseId !== item.startVerseId || p.endVerseId !== item.endVerseId),
          }))
        : run(() => detachScriptureReference(db, item.key), "We couldn't remove that passage."),
    attachLink: (target) => withRecord((id) => createLink(db, { type: 'journal_entry', id }, target), "We couldn't link that item."),
    removeConnection: (item) =>
      item.isPending
        ? setPending((current) => ({ ...current, links: current.links.filter((l) => l.type !== item.type || l.id !== item.id) }))
        : run(() => removeLink(db, item.key), "We couldn't remove that link."),
    addTag: (name) => withRecord((id) => assignTag(db, 'journal_entry', id, name), "We couldn't add that tag."),
    removeTag: (tagId) =>
      run(() => {
        const id = record.currentId();
        if (id) unassignTag(db, 'journal_entry', id, tagId);
      }, "We couldn't remove that tag."),
    deleteEntry: () => {
      record.setDeleted(true);
      try {
        const id = record.currentId();
        if (id) deleteJournalEntry(db, id);
        return true;
      } catch (error) {
        record.setDeleted(false);
        logger.error('Deleting journal entry failed', error);
        record.setActionError("We couldn't delete this entry. Please try again.");
        return false;
      }
    },
  };
}
