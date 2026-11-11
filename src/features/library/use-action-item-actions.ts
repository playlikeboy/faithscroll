import { useCallback, useState } from 'react';

import { db } from '@/db/client';
import type { ScheduleResult } from '@/features/reminders/notifications';
import { getErrorMessage, logger } from '@/lib/logger';

import { createActionItem, getActionItem, updateActionItem, type ActionItemRow } from './action-items';
import { removeActionItem, setActionCompleted, setActionReminder } from './action-service';

export interface ActionDraft {
  title: string;
  notes: string;
  dueAt: Date | null;
  reminderAt: Date | null;
}

const REMINDER_MESSAGES: Partial<Record<ScheduleResult['status'], string>> = {
  denied: 'Saved. Notifications are turned off for Faithscroll, so no reminder was set — you can allow them in your device settings.',
  invalid: 'Saved. Reminders need a time in the future, so no reminder was set.',
  failed: 'Saved, but we couldn’t set the reminder just now. Please try again.',
};

function sameInstant(a: Date | null, iso: string | null): boolean {
  if (a === null || iso === null) return a === null && iso === null;
  return a.getTime() === new Date(iso).getTime();
}

async function saveDraft(existing: ActionItemRow | null, draft: ActionDraft): Promise<string | null> {
  const input = { title: draft.title, notes: draft.notes, dueAt: draft.dueAt?.toISOString() ?? null };
  const id = existing ? existing.id : createActionItem(db, input);
  if (existing) updateActionItem(db, existing.id, input);
  const saved = getActionItem(db, id);
  const currentReminder = existing?.reminderNotificationId ? existing.reminderAt : null;
  if (!saved || sameInstant(draft.reminderAt, currentReminder)) return null;
  const result = await setActionReminder(db, saved, draft.reminderAt);
  return result ? (REMINDER_MESSAGES[result.status] ?? null) : null;
}

export interface ActionItemActions {
  isBusy: boolean;
  message: string | null;
  clearMessage: () => void;
  /** Returns true when saved (the editor can close); otherwise `message` explains why. */
  save: (existing: ActionItemRow | null, draft: ActionDraft) => Promise<boolean>;
  toggleComplete: (item: ActionItemRow) => Promise<void>;
  remove: (item: ActionItemRow) => Promise<void>;
}

export function useActionItemActions(): ActionItemActions {
  const [isBusy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const save = useCallback(async (existing: ActionItemRow | null, draft: ActionDraft) => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await saveDraft(existing, draft));
      return true;
    } catch (error) {
      logger.error('Saving an action failed', error);
      setMessage(getErrorMessage(error));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const toggleComplete = useCallback(async (item: ActionItemRow) => {
    setMessage(null);
    try {
      await setActionCompleted(db, item, item.completedAt === null);
    } catch (error) {
      logger.error('Updating an action failed', error);
      setMessage('We couldn’t update that action. Please try again.');
    }
  }, []);

  const remove = useCallback(async (item: ActionItemRow) => {
    setMessage(null);
    try {
      await removeActionItem(db, item);
    } catch (error) {
      logger.error('Deleting an action failed', error);
      setMessage('We couldn’t delete that action. Please try again.');
    }
  }, []);

  const clearMessage = useCallback(() => setMessage(null), []);

  return { isBusy, message, clearMessage, save, toggleComplete, remove };
}
