import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { db } from '@/db/client';
import { prayerEntries, prayerUpdates } from '@/db/schema';
import { listScriptureReferences } from '@/features/links/scripture-references';
import { scheduleOneTimeReminderWithResult } from '@/features/reminders/notifications';
import { changePrayerStatus, createPrayer, getPrayer, listPrayerUpdates } from '@/features/prayers/repository';
import { PRAYER_REMINDER_BODY } from '@/features/prayers/types';
import { track } from '@/services/monitoring/analytics';

import { PrayerEditorScreen } from '../prayer-editor-screen';
import { PrayerListScreen } from '../prayer-list-screen';

jest.mock('@/db/client', () => ({ db: jest.requireActual('@/db/testing/create-test-db').createTestDb() }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('@/features/bible/reference', () => ({ formatReference: jest.fn(() => '') }));
jest.mock('@/services/monitoring/analytics', () => ({ track: jest.fn() }));
jest.mock('@/features/bible/use-passage-picker', () => ({ usePassagePicker: () => jest.fn(async () => null) }));
jest.mock('@/features/links/use-link-picker', () => ({ useLinkPicker: () => jest.fn(async () => null) }));
jest.mock('@/features/reminders/notifications', () => ({
  scheduleOneTimeReminderWithResult: jest.fn(async () => ({ status: 'scheduled', id: 'notif-1' })),
  cancelReminder: jest.fn(async () => undefined),
}));
jest.mock('@react-native-community/datetimepicker', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: View, DateTimePickerAndroid: { open: jest.fn() } };
});

type Listener = (event: { tableName: string }) => void;
const mockListeners = new Set<Listener>();
jest.mock('expo-sqlite', () => ({
  addDatabaseChangeListener: (listener: Listener) => {
    mockListeners.add(listener);
    return { remove: () => mockListeners.delete(listener) };
  },
}));

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  Stack: { Screen: ({ options }: { options?: { headerRight?: () => React.ReactNode } }) => options?.headerRight?.() ?? null },
}));

jest.setTimeout(30_000);

const PHILIPPIANS_4_6 = 50004006;

async function flushChanges() {
  await act(async () => {
    for (const table of ['prayer_entries', 'prayer_updates', 'scripture_references', 'entity_links']) {
      for (const listener of mockListeners) listener({ tableName: table });
    }
    jest.advanceTimersByTime(1_000);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  db.delete(prayerUpdates).run();
  db.delete(prayerEntries).run();
  jest.clearAllMocks();
});

afterEach(() => jest.useRealTimers());

describe('PrayerEditorScreen — status', () => {
  test('changes status with an optional note and shows it in the updates timeline', async () => {
    const prayer = createPrayer(db, { title: 'Job interview' });
    await render(<PrayerEditorScreen prayerId={prayer.id} prefill={{ passage: null }} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Answered' }));
    await fireEvent.changeText(screen.getByLabelText('What changed? (optional)'), 'Got the job, with peace');
    await fireEvent.press(screen.getByRole('button', { name: 'Mark as Answered' }));
    await flushChanges();

    expect(getPrayer(db, prayer.id)?.status).toBe('answered');
    expect(listPrayerUpdates(db, prayer.id)).toEqual([
      expect.objectContaining({ statusChange: 'answered', content: 'Got the job, with peace' }),
    ]);
    expect(track).toHaveBeenCalledWith({ name: 'prayer_status_changed', status: 'answered' });
    expect(screen.getByText('Moved to Answered')).toBeTruthy();
    expect(screen.getByText('Got the job, with peace')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Answered', selected: true })).toBeTruthy();
  });

  test('cancelling a status change leaves the prayer untouched', async () => {
    const prayer = createPrayer(db, { title: 'Healing' });
    await render(<PrayerEditorScreen prayerId={prayer.id} prefill={{ passage: null }} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Archived' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(getPrayer(db, prayer.id)?.status).toBe('praying');
    expect(listPrayerUpdates(db, prayer.id)).toEqual([]);
    expect(track).not.toHaveBeenCalled();
  });

  test('adds a note without changing status', async () => {
    const prayer = createPrayer(db, { title: 'Healing' });
    await render(<PrayerEditorScreen prayerId={prayer.id} prefill={{ passage: null }} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Add a note' }));
    await fireEvent.changeText(screen.getByLabelText('Note'), 'Doctor was hopeful');
    await fireEvent.press(screen.getByRole('button', { name: 'Save note' }));
    await flushChanges();

    expect(getPrayer(db, prayer.id)?.status).toBe('praying');
    expect(listPrayerUpdates(db, prayer.id)).toEqual([expect.objectContaining({ statusChange: null, content: 'Doctor was hopeful' })]);
    expect(screen.getByText('Doctor was hopeful')).toBeTruthy();
  });
});

describe('PrayerEditorScreen — new prayer', () => {
  test('creates on first words with the prefilled passage, then offers status and reminders', async () => {
    await render(<PrayerEditorScreen prefill={{ passage: { startVerseId: PHILIPPIANS_4_6, endVerseId: PHILIPPIANS_4_6 } }} />);

    expect(screen.getByText('Philippians 4:6')).toBeTruthy();
    expect(screen.queryByText('Status')).toBeNull();
    expect(db.select().from(prayerEntries).all()).toHaveLength(0);

    await fireEvent.changeText(screen.getByLabelText('Prayer title'), 'Peace for exams');
    await flushChanges();

    const [prayer] = db.select().from(prayerEntries).all();
    expect(prayer?.title).toBe('Peace for exams');
    expect(listScriptureReferences(db, 'prayer_entry', prayer!.id)).toHaveLength(1);
    expect(track).toHaveBeenCalledWith({ name: 'prayer_created' });
    expect(screen.getByText('Status')).toBeTruthy();
  });

  test('sets a reminder with a generic lock-screen body', async () => {
    const prayer = createPrayer(db, { title: 'Something very private' });
    await render(<PrayerEditorScreen prayerId={prayer.id} prefill={{ passage: null }} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Add a reminder' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Set reminder' }));
    await flushChanges();

    const reminder = jest.mocked(scheduleOneTimeReminderWithResult).mock.calls[0]?.[0];
    expect(reminder?.body).toBe(PRAYER_REMINDER_BODY);
    expect(JSON.stringify(reminder)).not.toContain('private');
    expect(getPrayer(db, prayer.id)?.reminderNotificationId).toBe('notif-1');
    expect(screen.getByRole('button', { name: 'Remove reminder' })).toBeTruthy();
  });

  test('deletes after confirmation', async () => {
    const prayer = createPrayer(db, { title: 'To remove' });
    const alertSpy = jest.spyOn(Alert, 'alert');
    await render(<PrayerEditorScreen prayerId={prayer.id} prefill={{ passage: null }} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Delete prayer' }));
    const buttons = alertSpy.mock.calls[0]?.[2] ?? [];
    await act(async () => buttons.find((b) => b.style === 'destructive')?.onPress?.());

    expect(getPrayer(db, prayer.id)).toBeNull();
    expect(mockRouter.back).toHaveBeenCalled();
  });
});

describe('PrayerListScreen', () => {
  test('shows a gentle empty state', async () => {
    await render(<PrayerListScreen />);
    expect(screen.getByText('Keep your prayers close')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Write a prayer' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/prayers/new');
  });

  test('groups prayers by status and opens one', async () => {
    const praying = createPrayer(db, { title: 'For my brother' });
    const answered = createPrayer(db, { title: 'New job' });
    changePrayerStatus(db, answered.id, 'answered');

    await render(<PrayerListScreen />);

    expect(screen.getByRole('header', { name: 'Praying' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Answered' })).toBeTruthy();
    expect(screen.queryByRole('header', { name: 'Archived' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: /^For my brother/ }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/prayers/${praying.id}`);
  });
});
