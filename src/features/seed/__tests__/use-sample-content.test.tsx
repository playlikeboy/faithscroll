import { act, renderHook } from '@testing-library/react-native';
import { eq } from 'drizzle-orm';

import { prayerEntries } from '@/db/schema';
import { createTestDb } from '@/db/testing/create-test-db';
import { cancelReminder } from '@/features/reminders/scheduler';

import { seedSampleContentOnce } from '../seed-sample-content';
import { useSampleContent } from '../use-sample-content';

jest.mock('@/features/bible/reference', () => ({ formatReference: jest.fn(() => '') }));
jest.mock('@/features/reminders/scheduler', () => ({ cancelReminder: jest.fn(() => Promise.resolve()) }));

jest.setTimeout(20_000);

describe('useSampleContent', () => {
  test('reports no samples on an empty library', async () => {
    const db = createTestDb();
    const { result } = await renderHook(() => useSampleContent(db));
    expect(result.current.hasSamples).toBe(false);
  });

  test('removes the samples and cancels their reminders', async () => {
    const db = createTestDb();
    await seedSampleContentOnce(db);
    const prayer = db.select().from(prayerEntries).get()!;
    db.update(prayerEntries).set({ reminderNotificationId: 'notif-1' }).where(eq(prayerEntries.id, prayer.id)).run();
    const { result } = await renderHook(() => useSampleContent(db));
    expect(result.current.hasSamples).toBe(true);

    await act(() => result.current.removeSamples());

    expect(result.current.hasSamples).toBe(false);
    expect(result.current.status.kind).toBe('done');
    expect(cancelReminder).toHaveBeenCalledWith('notif-1');
  });

  test('reports a friendly error when removal fails', async () => {
    const db = createTestDb();
    await seedSampleContentOnce(db);
    const { result } = await renderHook(() => useSampleContent(db));
    jest.spyOn(db, 'transaction').mockImplementation(() => {
      throw new Error('disk full');
    });

    await act(() => result.current.removeSamples());

    expect(result.current.status).toEqual({ kind: 'error', message: expect.stringMatching(/couldn’t remove/) });
  });
});
