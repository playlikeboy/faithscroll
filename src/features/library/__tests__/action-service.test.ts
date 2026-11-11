import { createTestDb } from '@/db/testing/create-test-db';
import type { AppDatabase } from '@/db/types';
import * as scheduler from '@/features/reminders/scheduler';

import { createActionItem, getActionItem, setActionItemReminder, type ActionItemRow } from '../action-items';
import { ACTION_REMINDER_COPY, removeActionItem, setActionCompleted, setActionReminder } from '../action-service';

jest.mock('@/features/reminders/scheduler', () => ({
  cancelReminder: jest.fn(async () => undefined),
  scheduleOneTimeReminderWithResult: jest.fn(async () => ({ status: 'scheduled', id: 'n-action' })),
}));

const mocked = jest.mocked(scheduler);

let db: AppDatabase;
function item(id: string): ActionItemRow {
  const row = getActionItem(db, id);
  if (!row) throw new Error('missing');
  return row;
}

beforeEach(() => {
  jest.clearAllMocks();
  db = createTestDb();
});

describe('action service', () => {
  it('schedules a one-time reminder with generic copy', async () => {
    const id = createActionItem(db, { title: 'Call my brother to reconcile' });
    const date = new Date('2030-01-01T09:00:00.000Z');
    await expect(setActionReminder(db, item(id), date)).resolves.toEqual({ status: 'scheduled', id: 'n-action' });
    expect(mocked.scheduleOneTimeReminderWithResult).toHaveBeenCalledWith({ ...ACTION_REMINDER_COPY, date });
    expect(JSON.stringify(mocked.scheduleOneTimeReminderWithResult.mock.calls)).not.toContain('brother');
    expect(item(id)).toMatchObject({ reminderAt: date.toISOString(), reminderNotificationId: 'n-action' });
  });

  it('clears the reminder when scheduling fails or is removed', async () => {
    const id = createActionItem(db, { title: 'x' });
    setActionItemReminder(db, id, '2030-01-01T09:00:00.000Z', 'old');
    mocked.scheduleOneTimeReminderWithResult.mockResolvedValueOnce({ status: 'denied' });
    await expect(setActionReminder(db, item(id), new Date('2030-01-02T09:00:00.000Z'))).resolves.toEqual({ status: 'denied' });
    expect(mocked.cancelReminder).toHaveBeenCalledWith('old');
    expect(item(id)).toMatchObject({ reminderAt: null, reminderNotificationId: null });
    await expect(setActionReminder(db, item(id), null)).resolves.toBeNull();
  });

  it('cancels the reminder when an action is completed or deleted', async () => {
    const id = createActionItem(db, { title: 'x' });
    setActionItemReminder(db, id, '2030-01-01T09:00:00.000Z', 'n1');
    await setActionCompleted(db, item(id), true);
    expect(mocked.cancelReminder).toHaveBeenCalledWith('n1');
    expect(item(id).completedAt).toBeTruthy();
    expect(item(id).reminderNotificationId).toBeNull();

    const other = createActionItem(db, { title: 'y' });
    setActionItemReminder(db, other, '2030-01-01T09:00:00.000Z', 'n2');
    await removeActionItem(db, item(other));
    expect(mocked.cancelReminder).toHaveBeenCalledWith('n2');
    expect(getActionItem(db, other)).toBeUndefined();
  });

  it('reopens a completed action without touching reminders', async () => {
    const id = createActionItem(db, { title: 'x' });
    await setActionCompleted(db, item(id), true);
    await setActionCompleted(db, item(id), false);
    expect(item(id).completedAt).toBeNull();
    expect(mocked.cancelReminder).not.toHaveBeenCalled();
  });
});
