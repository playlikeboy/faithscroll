/**
 * State + persistence for a prayer (new or existing). Same lazy-creation + autosave pattern as
 * the journal editor; status changes, notes and reminders apply once the prayer exists.
 */
import { useEffect, useRef, useState } from 'react';

import { db } from '@/db/client';
import type { AutosaveResult } from '@/features/editor/use-autosave';
import type { EditorLoadStatus } from '@/features/journal/use-journal-editor';
import type { PassageIds } from '@/features/journal/repository';
import { useDeferredRecord } from '@/features/journal/use-deferred-record';
import { useLiveData } from '@/features/journal/use-live-data';
import {
  CONNECTION_TABLES,
  EMPTY_PENDING,
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
import { logger } from '@/lib/logger';
import { track } from '@/services/monitoring/analytics';

import { deletePrayerWithReminder, REMINDER_OUTCOME_MESSAGES, setPrayerReminder, type ReminderOutcome } from './reminders';
import { addPrayerUpdate, changePrayerStatus, createPrayer, getPrayer, listPrayerUpdates, updatePrayer } from './repository';
import type { Prayer, PrayerStatus, PrayerUpdate } from './types';

export interface PrayerDraft {
  title: string;
  content: string;
  category: string | null;
}

export interface PrayerPrefill {
  passage: PassageIds | null;
}

export interface PrayerEditor {
  status: EditorLoadStatus;
  prayerId: string | null;
  draft: PrayerDraft;
  /** The saved row (status, reminder, answered date); null until created. */
  prayer: Prayer | null;
  updates: PrayerUpdate[];
  connections: Connections | undefined;
  autosave: AutosaveResult;
  actionError: string | null;
  setTitle: (title: string) => void;
  setContent: (content: string) => void;
  setCategory: (category: string | null) => void;
  changeStatus: (status: PrayerStatus, note: string) => void;
  addNote: (note: string) => void;
  setReminder: (date: Date | null) => Promise<ReminderOutcome>;
  attachPassage: (passage: PassageIds) => void;
  removePassage: (item: PassageItem) => void;
  attachLink: (target: LinkTarget) => void;
  removeConnection: (item: ConnectedItem) => void;
  deletePrayer: () => Promise<boolean>;
}

const EMPTY_DRAFT: PrayerDraft = { title: '', content: '', category: null };
const DETAIL_TABLES = ['prayer_entries', 'prayer_updates'] as const;

function loadInitial(prayerId: string | undefined, prefill: PrayerPrefill) {
  if (!prayerId) {
    const pending: PendingConnections = { passages: prefill.passage ? [prefill.passage] : [], links: [] };
    return { status: 'ready' as EditorLoadStatus, prayerId: null, draft: EMPTY_DRAFT, pending };
  }
  try {
    const prayer = getPrayer(db, prayerId);
    if (!prayer) return { status: 'not_found' as EditorLoadStatus, prayerId: null, draft: EMPTY_DRAFT, pending: EMPTY_PENDING };
    const draft = { title: prayer.title, content: prayer.content, category: prayer.category };
    return { status: 'ready' as EditorLoadStatus, prayerId, draft, pending: EMPTY_PENDING };
  } catch (error) {
    logger.error('Opening prayer failed', error);
    return { status: 'error' as EditorLoadStatus, prayerId: null, draft: EMPTY_DRAFT, pending: EMPTY_PENDING };
  }
}

const isMeaningful = (draft: PrayerDraft) => draft.title.trim().length > 0 || draft.content.trim().length > 0;

export function usePrayerEditor(prayerIdParam: string | undefined, prefill: PrayerPrefill): PrayerEditor {
  const [initial] = useState(() => loadInitial(prayerIdParam, prefill));
  const [pending, setPending] = useState(initial.pending);
  const pendingRef = useRef(initial.pending);
  useEffect(() => {
    pendingRef.current = pending;
  });

  const record = useDeferredRecord<PrayerDraft>({
    initialId: initial.prayerId,
    initialDraft: initial.draft,
    enabled: initial.status === 'ready',
    isMeaningful,
    create: (value) => {
      const created = createPrayer(db, value, { passages: pendingRef.current.passages });
      pendingRef.current = EMPTY_PENDING;
      setPending(EMPTY_PENDING);
      track({ name: 'prayer_created' });
      return created.id;
    },
    update: (id, value) => updatePrayer(db, id, value),
  });
  const { id: prayerId, setDraft, withRecord, run } = record;

  const { data: detail } = useLiveData(
    () => (prayerId ? { prayer: getPrayer(db, prayerId), updates: listPrayerUpdates(db, prayerId) } : null),
    DETAIL_TABLES,
    prayerId ?? 'new',
  );
  const { data: connections } = useLiveData(
    () => (prayerId ? loadConnections(db, { type: 'prayer_entry', id: prayerId }) : loadPendingConnections(db, pending)),
    CONNECTION_TABLES,
    prayerId ?? `pending:${pendingConnectionsKey(pending)}`,
  );

  const update = (changes: Partial<PrayerDraft>) => setDraft((current) => ({ ...current, ...changes }));

  return {
    status: initial.status,
    prayerId,
    draft: record.draft,
    prayer: detail?.prayer ?? null,
    updates: detail?.updates ?? [],
    connections,
    autosave: record.autosave,
    actionError: record.actionError,
    setTitle: (title) => update({ title }),
    setContent: (content) => update({ content }),
    setCategory: (category) => update({ category }),
    changeStatus: (status, note) =>
      withRecord((id) => {
        const change = changePrayerStatus(db, id, status, note);
        if (change?.statusChange) track({ name: 'prayer_status_changed', status });
      }, "We couldn't update this prayer."),
    addNote: (note) => withRecord((id) => addPrayerUpdate(db, id, note), "We couldn't save that note."),
    setReminder: async (date) => {
      const id = record.currentId();
      if (!id) return 'failed';
      const outcome = await setPrayerReminder(db, id, date);
      record.setActionError(outcome === 'scheduled' || outcome === 'cleared' ? null : REMINDER_OUTCOME_MESSAGES[outcome]);
      return outcome;
    },
    attachPassage: (passage) =>
      withRecord((id) => attachScriptureReference(db, { sourceType: 'prayer_entry', sourceId: id, ...passage }), "We couldn't attach that passage."),
    removePassage: (item) =>
      item.isPending
        ? setPending((current) => ({
            ...current,
            passages: current.passages.filter((p) => p.startVerseId !== item.startVerseId || p.endVerseId !== item.endVerseId),
          }))
        : run(() => detachScriptureReference(db, item.key), "We couldn't remove that passage."),
    attachLink: (target) => withRecord((id) => createLink(db, { type: 'prayer_entry', id }, target), "We couldn't link that item."),
    removeConnection: (item) => run(() => removeLink(db, item.key), "We couldn't remove that link."),
    deletePrayer: async () => {
      record.setDeleted(true);
      try {
        const id = record.currentId();
        if (id) await deletePrayerWithReminder(db, id);
        return true;
      } catch (error) {
        record.setDeleted(false);
        logger.error('Deleting prayer failed', error);
        record.setActionError("We couldn't delete this prayer. Please try again.");
        return false;
      }
    },
  };
}
