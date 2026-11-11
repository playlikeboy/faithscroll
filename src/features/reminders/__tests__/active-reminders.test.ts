import { createTestDb } from '@/db/testing/create-test-db';
import { seedActionItem, seedPlanProgress, seedPrayer } from '@/features/library/testing/fixtures';

import { listActiveReminders } from '../active-reminders';

const NOW = new Date('2026-11-11T10:00:00.000Z');
const LATER = '2026-11-12T08:00:00.000Z';
const EARLIER = '2026-11-10T08:00:00.000Z';

describe('listActiveReminders', () => {
  it('returns an empty list for a fresh database', () => {
    expect(listActiveReminders(createTestDb(), NOW)).toEqual({ plans: [], prayers: [], actions: [] });
  });

  it('lists active plan reminders with the plan title', () => {
    const db = createTestDb();
    const id = seedPlanProgress(db, { planId: 'john-21', reminderTime: '07:30', reminderNotificationId: 'n1' });
    seedPlanProgress(db, { planId: 'psalms-30', status: 'paused', reminderTime: '07:30' });
    seedPlanProgress(db, { planId: 'hope-7' });
    seedPlanProgress(db, { planId: 'unknown-plan', reminderTime: '07:30' });
    seedPlanProgress(db, { planId: 'gratitude-7', reminderTime: '09:00', deletedAt: EARLIER });

    expect(listActiveReminders(db, NOW).plans).toEqual([
      { kind: 'plan', id, title: 'The Gospel of John', schedule: { type: 'daily', time: '07:30' }, href: '/plans/john-21' },
    ]);
  });

  it('lists only upcoming prayer reminders for prayers still being prayed', () => {
    const db = createTestDb();
    const upcoming = seedPrayer(db, { title: 'For my family', reminderAt: LATER, reminderNotificationId: 'n1' });
    seedPrayer(db, { title: 'Past', reminderAt: EARLIER, reminderNotificationId: 'n2' });
    seedPrayer(db, { title: 'Answered', status: 'answered', reminderAt: LATER, reminderNotificationId: 'n3' });
    seedPrayer(db, { title: 'Not scheduled', reminderAt: LATER });
    seedPrayer(db, { title: 'Deleted', reminderAt: LATER, reminderNotificationId: 'n4', deletedAt: EARLIER });

    expect(listActiveReminders(db, NOW).prayers).toEqual([
      { kind: 'prayer', id: upcoming, title: 'For my family', schedule: { type: 'once', at: LATER }, href: `/prayers/${upcoming}` },
    ]);
  });

  it('lists upcoming reminders for open action items', () => {
    const db = createTestDb();
    const open = seedActionItem(db, { title: 'Call Sam', reminderAt: LATER, reminderNotificationId: 'n1' });
    seedActionItem(db, { title: 'Done', reminderAt: LATER, reminderNotificationId: 'n2', completedAt: EARLIER });

    expect(listActiveReminders(db, NOW).actions).toEqual([
      { kind: 'action', id: open, title: 'Call Sam', schedule: { type: 'once', at: LATER }, href: '/library/actions' },
    ]);
  });
});
