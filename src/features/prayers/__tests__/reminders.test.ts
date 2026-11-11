import { createTestDb } from '@/db/testing/create-test-db';
import { cancelReminder, scheduleOneTimeReminderWithResult } from '@/features/reminders/notifications';

import { groupPrayersByStatus } from '../grouping';
import { clearReminderWhenClosed, deletePrayerWithReminder, isReminderUpcoming, setPrayerReminder } from '../reminders';
import { changePrayerStatus, createPrayer, getPrayer, listPrayers, setPrayerReminderFields } from '../repository';
import { PRAYER_REMINDER_BODY } from '../types';

jest.mock('@/features/reminders/notifications', () => ({
  scheduleOneTimeReminderWithResult: jest.fn(),
  cancelReminder: jest.fn(async () => undefined),
}));

const schedule = jest.mocked(scheduleOneTimeReminderWithResult);
const cancel = jest.mocked(cancelReminder);

const FUTURE = new Date('2099-01-01T08:00:00.000Z');

beforeEach(() => jest.clearAllMocks());

describe('setPrayerReminder', () => {
  test('schedules with a generic body (never the prayer text) and stores the id', async () => {
    const db = createTestDb();
    const prayer = createPrayer(db, { title: 'Private: healing for Anna', content: 'very private' });
    schedule.mockResolvedValueOnce({ status: 'scheduled', id: 'notif-1' });

    const outcome = await setPrayerReminder(db, prayer.id, FUTURE);

    expect(outcome).toBe('scheduled');
    const reminder = schedule.mock.calls[0]?.[0];
    expect(reminder).toEqual({ title: 'Prayer', body: PRAYER_REMINDER_BODY, date: FUTURE, url: `/prayers/${prayer.id}` });
    expect(JSON.stringify(reminder)).not.toContain('Anna');
    expect(getPrayer(db, prayer.id)).toEqual(
      expect.objectContaining({ reminderAt: FUTURE.toISOString(), reminderNotificationId: 'notif-1' }),
    );
  });

  test('replaces an existing reminder only after the new one is scheduled', async () => {
    const db = createTestDb();
    const prayer = createPrayer(db, { title: 'A' });
    setPrayerReminderFields(db, prayer.id, { reminderAt: FUTURE.toISOString(), notificationId: 'old' });
    schedule.mockResolvedValueOnce({ status: 'scheduled', id: 'new' });

    await setPrayerReminder(db, prayer.id, new Date('2099-02-01T08:00:00.000Z'));

    expect(cancel).toHaveBeenCalledWith('old');
    expect(getPrayer(db, prayer.id)?.reminderNotificationId).toBe('new');
  });

  test('keeps the old reminder when scheduling is denied', async () => {
    const db = createTestDb();
    const prayer = createPrayer(db, { title: 'A' });
    setPrayerReminderFields(db, prayer.id, { reminderAt: FUTURE.toISOString(), notificationId: 'old' });
    schedule.mockResolvedValueOnce({ status: 'denied' });

    const outcome = await setPrayerReminder(db, prayer.id, new Date('2099-02-01T08:00:00.000Z'));

    expect(outcome).toBe('denied');
    expect(cancel).not.toHaveBeenCalled();
    expect(getPrayer(db, prayer.id)?.reminderNotificationId).toBe('old');
  });

  test('clears a reminder', async () => {
    const db = createTestDb();
    const prayer = createPrayer(db, { title: 'A' });
    setPrayerReminderFields(db, prayer.id, { reminderAt: FUTURE.toISOString(), notificationId: 'old' });

    expect(await setPrayerReminder(db, prayer.id, null)).toBe('cleared');

    expect(cancel).toHaveBeenCalledWith('old');
    expect(getPrayer(db, prayer.id)).toEqual(expect.objectContaining({ reminderAt: null, reminderNotificationId: null }));
  });

  test('rejects past dates without calling the scheduler, and reports a missing prayer', async () => {
    const db = createTestDb();
    const prayer = createPrayer(db, { title: 'A' });

    expect(await setPrayerReminder(db, prayer.id, new Date('2000-01-01T00:00:00.000Z'))).toBe('invalid');
    expect(schedule).not.toHaveBeenCalled();
    expect(await setPrayerReminder(db, 'missing', FUTURE)).toBe('failed');
  });

  test('reports failure when the scheduler throws', async () => {
    const db = createTestDb();
    const prayer = createPrayer(db, { title: 'A' });
    schedule.mockRejectedValueOnce(new Error('native'));

    expect(await setPrayerReminder(db, prayer.id, FUTURE)).toBe('failed');
  });
});

describe('deletePrayerWithReminder', () => {
  test('deletes and cancels the scheduled notification', async () => {
    const db = createTestDb();
    const prayer = createPrayer(db, { title: 'A' });
    setPrayerReminderFields(db, prayer.id, { reminderAt: FUTURE.toISOString(), notificationId: 'n1' });

    await deletePrayerWithReminder(db, prayer.id);

    expect(getPrayer(db, prayer.id)).toBeNull();
    expect(cancel).toHaveBeenCalledWith('n1');
  });
});

describe('clearReminderWhenClosed', () => {
  test.each(['answered', 'archived'] as const)('cancels the reminder when a prayer becomes %s', async (status) => {
    const db = createTestDb();
    const prayer = createPrayer(db, { title: 'A' });
    setPrayerReminderFields(db, prayer.id, { reminderAt: FUTURE.toISOString(), notificationId: 'n1' });

    await clearReminderWhenClosed(db, prayer.id, status);

    expect(cancel).toHaveBeenCalledWith('n1');
    expect(getPrayer(db, prayer.id)?.reminderAt).toBeNull();
  });

  test.each(['praying', 'ongoing'] as const)('keeps the reminder while the prayer is %s', async (status) => {
    const db = createTestDb();
    const prayer = createPrayer(db, { title: 'A' });
    setPrayerReminderFields(db, prayer.id, { reminderAt: FUTURE.toISOString(), notificationId: 'n1' });

    await clearReminderWhenClosed(db, prayer.id, status);

    expect(cancel).not.toHaveBeenCalled();
    expect(getPrayer(db, prayer.id)?.reminderAt).toBe(FUTURE.toISOString());
  });

  test('does nothing when no reminder is set', async () => {
    const db = createTestDb();
    const prayer = createPrayer(db, { title: 'A' });

    await clearReminderWhenClosed(db, prayer.id, 'answered');

    expect(cancel).not.toHaveBeenCalled();
  });
});

describe('isReminderUpcoming', () => {
  test('is true only for future, valid times', () => {
    const now = new Date('2026-11-11T00:00:00.000Z');
    expect(isReminderUpcoming('2026-11-12T00:00:00.000Z', now)).toBe(true);
    expect(isReminderUpcoming('2026-11-10T00:00:00.000Z', now)).toBe(false);
    expect(isReminderUpcoming(null, now)).toBe(false);
    expect(isReminderUpcoming('garbage', now)).toBe(false);
  });
});

describe('groupPrayersByStatus', () => {
  test('groups in a calm, fixed order and omits empty groups', () => {
    const db = createTestDb();
    const a = createPrayer(db, { title: 'Praying one' });
    const b = createPrayer(db, { title: 'Answered one' });
    createPrayer(db, { title: 'Ongoing one' });
    changePrayerStatus(db, b.id, 'answered');
    const ongoing = listPrayers(db).find((p) => p.title === 'Ongoing one');
    changePrayerStatus(db, ongoing!.id, 'ongoing');

    const sections = groupPrayersByStatus(listPrayers(db));

    expect(sections.map((s) => [s.status, s.title, s.data.map((p) => p.title)])).toEqual([
      ['praying', 'Praying', [a.title]],
      ['ongoing', 'Ongoing', ['Ongoing one']],
      ['answered', 'Answered', ['Answered one']],
    ]);
    expect(sections[0]?.description).toBeTruthy();
  });

  test('orders answered prayers by when they were answered, most recent first', () => {
    const base = { content: '', category: null, reminderAt: null, reminderNotificationId: null, createdAt: '', deletedAt: null, version: 1 };
    const older = { ...base, id: 'a', title: 'Older', status: 'answered' as const, answeredAt: '2026-01-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z' };
    const newer = { ...base, id: 'b', title: 'Newer', status: 'answered' as const, answeredAt: '2026-06-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z' };
    const archived = { ...base, id: 'c', title: 'Set aside', status: 'archived' as const, answeredAt: null, updatedAt: '2026-03-01T00:00:00Z' };

    const sections = groupPrayersByStatus([older, archived, newer]);

    expect(sections.map((s) => [s.status, s.data.map((p) => p.title)])).toEqual([
      ['answered', ['Newer', 'Older']],
      ['archived', ['Set aside']],
    ]);
  });
});
