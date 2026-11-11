import { eq } from 'drizzle-orm';

import { outbox, prayerUpdates } from '@/db/schema';
import { createTestDb } from '@/db/testing/create-test-db';
import { createLink, listLinks } from '@/features/links/repository';
import { listScriptureReferences } from '@/features/links/scripture-references';

import {
  addPrayerUpdate,
  changePrayerStatus,
  createPrayer,
  deletePrayer,
  getPrayer,
  listPrayers,
  listPrayerUpdates,
  setPrayerReminderFields,
  updatePrayer,
} from '../repository';

jest.mock('@/features/bible/reference', () => ({ formatReference: jest.fn(() => '') }));

describe('createPrayer', () => {
  test('creates a praying prayer with an optional passage', () => {
    const db = createTestDb();

    const prayer = createPrayer(
      db,
      { title: '  For my brother  ', content: 'Healing', category: 'Family' },
      { passages: [{ startVerseId: 50004006, endVerseId: 50004007 }] },
    );

    expect(prayer).toEqual(expect.objectContaining({ title: 'For my brother', content: 'Healing', category: 'Family', status: 'praying' }));
    expect(listScriptureReferences(db, 'prayer_entry', prayer.id)).toEqual([
      expect.objectContaining({ referenceText: 'Philippians 4:6–7' }),
    ]);
    expect(db.select().from(outbox).where(eq(outbox.entityType, 'prayer_entry')).all()).toHaveLength(1);
  });

  test('allows an empty title (untitled draft) but trims whitespace-only categories to null', () => {
    const db = createTestDb();
    const prayer = createPrayer(db, { title: '', content: 'Just words', category: '  ' });
    expect(prayer.title).toBe('');
    expect(prayer.category).toBeNull();
  });
});

describe('updatePrayer', () => {
  test('updates fields and bumps the version', () => {
    const db = createTestDb();
    const prayer = createPrayer(db, { title: 'Work' });

    updatePrayer(db, prayer.id, { title: 'New job', content: 'Wisdom', category: 'Work' });

    expect(getPrayer(db, prayer.id)).toEqual(expect.objectContaining({ title: 'New job', content: 'Wisdom', category: 'Work', version: 2 }));
  });

  test('throws when the prayer does not exist', () => {
    const db = createTestDb();
    expect(() => updatePrayer(db, 'missing', { title: 'x' })).toThrow('not found');
  });
});

describe('changePrayerStatus', () => {
  test('records the change with an optional note and stamps answered_at', () => {
    const db = createTestDb();
    const prayer = createPrayer(db, { title: 'Exam' });

    const update = changePrayerStatus(db, prayer.id, 'answered', '  Passed, with peace  ');

    expect(update).toEqual(expect.objectContaining({ prayerId: prayer.id, statusChange: 'answered', content: 'Passed, with peace' }));
    const row = getPrayer(db, prayer.id);
    expect(row?.status).toBe('answered');
    expect(row?.answeredAt).not.toBeNull();
    expect(db.select().from(outbox).where(eq(outbox.entityType, 'prayer_update')).all()).toHaveLength(1);
  });

  test('clears answered_at when moving away from Answered', () => {
    const db = createTestDb();
    const prayer = createPrayer(db, { title: 'Exam' });
    changePrayerStatus(db, prayer.id, 'answered');

    changePrayerStatus(db, prayer.id, 'ongoing');

    expect(getPrayer(db, prayer.id)).toEqual(expect.objectContaining({ status: 'ongoing', answeredAt: null }));
    expect(listPrayerUpdates(db, prayer.id).map((u) => u.statusChange)).toEqual(['ongoing', 'answered']);
  });

  test('same status with a note adds a plain update; without a note it does nothing', () => {
    const db = createTestDb();
    const prayer = createPrayer(db, { title: 'Exam' });

    expect(changePrayerStatus(db, prayer.id, 'praying')).toBeNull();
    const note = changePrayerStatus(db, prayer.id, 'praying', 'Still trusting');

    expect(note).toEqual(expect.objectContaining({ statusChange: null, content: 'Still trusting' }));
    expect(listPrayerUpdates(db, prayer.id)).toHaveLength(1);
  });

  test('throws for a missing prayer', () => {
    const db = createTestDb();
    expect(() => changePrayerStatus(db, 'missing', 'answered')).toThrow('not found');
  });
});

describe('updates', () => {
  test('adds and lists updates newest first; rejects blank notes', () => {
    const db = createTestDb();
    const prayer = createPrayer(db, { title: 'Exam' });
    const first = addPrayerUpdate(db, prayer.id, 'Studied today');
    db.update(prayerUpdates).set({ createdAt: '2020-01-01T00:00:00.000Z' }).where(eq(prayerUpdates.id, first.id)).run();
    addPrayerUpdate(db, prayer.id, 'Felt calm');

    expect(listPrayerUpdates(db, prayer.id).map((u) => u.content)).toEqual(['Felt calm', 'Studied today']);
    expect(() => addPrayerUpdate(db, prayer.id, '   ')).toThrow();
  });
});

describe('listPrayers', () => {
  test('lists live prayers, optionally by status and search', () => {
    const db = createTestDb();
    createPrayer(db, { title: 'Healing for Mum', category: 'Family' });
    const answered = createPrayer(db, { title: 'New job', content: 'Guidance in the interview' });
    changePrayerStatus(db, answered.id, 'answered');
    const gone = createPrayer(db, { title: 'Gone' });
    deletePrayer(db, gone.id);

    expect(listPrayers(db).map((p) => p.title).sort()).toEqual(['Healing for Mum', 'New job']);
    expect(listPrayers(db, { status: 'answered' }).map((p) => p.title)).toEqual(['New job']);
    expect(listPrayers(db, { search: 'interview' }).map((p) => p.title)).toEqual(['New job']);
  });
});

describe('reminders', () => {
  test('stores and clears reminder fields', () => {
    const db = createTestDb();
    const prayer = createPrayer(db, { title: 'Exam' });

    setPrayerReminderFields(db, prayer.id, { reminderAt: '2026-12-01T08:00:00.000Z', notificationId: 'n-1' });
    expect(getPrayer(db, prayer.id)).toEqual(expect.objectContaining({ reminderAt: '2026-12-01T08:00:00.000Z', reminderNotificationId: 'n-1' }));

    setPrayerReminderFields(db, prayer.id, null);
    expect(getPrayer(db, prayer.id)).toEqual(expect.objectContaining({ reminderAt: null, reminderNotificationId: null }));
  });
});

describe('deletePrayer', () => {
  test('soft-deletes the prayer, its updates, links and passages, and returns the deleted row', () => {
    const db = createTestDb();
    const prayer = createPrayer(db, { title: 'Exam' }, { passages: [{ startVerseId: 50004006, endVerseId: 50004006 }] });
    addPrayerUpdate(db, prayer.id, 'Note');
    const other = createPrayer(db, { title: 'Other' });
    createLink(db, { type: 'prayer_entry', id: prayer.id }, { type: 'prayer_entry', id: other.id });
    setPrayerReminderFields(db, prayer.id, { reminderAt: '2026-12-01T08:00:00.000Z', notificationId: 'n-1' });

    const deleted = deletePrayer(db, prayer.id);

    expect(deleted?.reminderNotificationId).toBe('n-1');
    expect(getPrayer(db, prayer.id)).toBeNull();
    expect(listPrayerUpdates(db, prayer.id)).toEqual([]);
    expect(listLinks(db, { type: 'prayer_entry', id: other.id })).toEqual([]);
    expect(listScriptureReferences(db, 'prayer_entry', prayer.id)).toEqual([]);
    expect(deletePrayer(db, prayer.id)).toBeNull();
  });
});
