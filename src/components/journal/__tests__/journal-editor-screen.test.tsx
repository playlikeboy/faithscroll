import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { eq } from 'drizzle-orm';
import { Alert } from 'react-native';

import { db } from '@/db/client';
import { journalEntries, sermons } from '@/db/schema';
import { getJournalEntry, createJournalEntry } from '@/features/journal/repository';
import { parseJournalPrefill } from '@/features/journal/prefill';
import { listLinks } from '@/features/links/repository';
import { listScriptureReferences } from '@/features/links/scripture-references';
import { listTagsForEntity } from '@/features/tags/repository';
import { track } from '@/services/monitoring/analytics';

import { JournalEditorScreen } from '../journal-editor-screen';

jest.mock('@/db/client', () => ({ db: jest.requireActual('@/db/testing/create-test-db').createTestDb() }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('@/features/bible/reference', () => ({ formatReference: jest.fn(() => '') }));
jest.mock('@/services/monitoring/analytics', () => ({ track: jest.fn() }));
jest.mock('@/features/bible/use-passage-picker', () => ({ usePassagePicker: () => jest.fn(async () => null) }));
jest.mock('@/features/links/use-link-picker', () => ({ useLinkPicker: () => jest.fn(async () => null) }));
jest.mock('@react-native-community/datetimepicker', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: View, DateTimePickerAndroid: { open: jest.fn() } };
});
jest.mock('@/components/editor/note-editor', () => {
  const { TextInput } = jest.requireActual('react-native');
  return {
    NoteEditor: ({ value, onChangeText, accessibilityLabel }: { value: string; onChangeText: (t: string) => void; accessibilityLabel?: string }) => (
      <TextInput value={value} onChangeText={onChangeText} accessibilityLabel={accessibilityLabel} />
    ),
  };
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

const JOHN_3_16 = 43003016;
const JOHN_3_18 = 43003018;
const AUTOSAVE_WAIT_MS = 1_000;

/** Simulate expo-sqlite change events (better-sqlite3 doesn't emit them). */
async function flushChanges() {
  await act(async () => {
    for (const table of ['journal_entries', 'scripture_references', 'entity_links', 'entity_tags', 'tags']) {
      for (const listener of mockListeners) listener({ tableName: table });
    }
    jest.advanceTimersByTime(AUTOSAVE_WAIT_MS);
  });
}

function allEntries() {
  return db.select().from(journalEntries).all();
}

beforeAll(() => {
  db.insert(sermons).values({ id: 'sermon-1', title: 'The Power of Forgiveness', speaker: 'Pastor John' }).run();
});

beforeEach(() => {
  jest.useFakeTimers();
  db.delete(journalEntries).run();
  jest.clearAllMocks();
});

afterEach(() => jest.useRealTimers());

describe('JournalEditorScreen — prefill', () => {
  test('shows pending passage and sermon link, and saves them with the first words', async () => {
    const prefill = parseJournalPrefill({ start: String(JOHN_3_16), end: String(JOHN_3_18), sermonId: 'sermon-1' });

    await render(<JournalEditorScreen prefill={prefill} />);

    expect(screen.getByRole('button', { name: 'Sermon reflection', selected: true })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Personal thoughts', selected: true })).toBeNull();
    expect(screen.getByText('John 3:16–18')).toBeTruthy();
    expect(screen.getByText('The Power of Forgiveness')).toBeTruthy();
    expect(allEntries()).toHaveLength(0);

    await fireEvent.changeText(screen.getByLabelText('Journal entry text'), 'Forgiven people forgive.');
    await flushChanges();

    const [entry] = allEntries();
    expect(entry).toEqual(expect.objectContaining({ content: 'Forgiven people forgive.', entryType: 'sermon_reflection' }));
    expect(listScriptureReferences(db, 'journal_entry', entry!.id)).toEqual([
      expect.objectContaining({ startVerseId: JOHN_3_16, endVerseId: JOHN_3_18 }),
    ]);
    expect(listLinks(db, { type: 'journal_entry', id: entry!.id })).toEqual([expect.objectContaining({ id: 'sermon-1' })]);
    expect(track).toHaveBeenCalledWith({ name: 'journal_entry_created', entryType: 'sermon_reflection' });
  });

  test('a removed pending passage is not attached', async () => {
    const prefill = parseJournalPrefill({ start: String(JOHN_3_16) });
    await render(<JournalEditorScreen prefill={prefill} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Remove John 3:16' }));
    await fireEvent.changeText(screen.getByLabelText('Entry title'), 'Loved');
    await flushChanges();

    const [entry] = allEntries();
    expect(entry?.entryType).toBe('bible_study');
    expect(listScriptureReferences(db, 'journal_entry', entry!.id)).toEqual([]);
  });

  test('shows the prefilled prompt; inserting prompts alone does not create an entry', async () => {
    await render(<JournalEditorScreen prefill={parseJournalPrefill({ prompt: 'What has been on your heart lately?' })} />);

    expect(screen.getByText('What has been on your heart lately?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'What am I learning?' }));
    await flushChanges();

    expect(screen.getByLabelText('Journal entry text').props.value).toBe('## What am I learning?\n');
    expect(allEntries()).toHaveLength(0);

    await fireEvent.changeText(screen.getByLabelText('Journal entry text'), '## What am I learning?\nPatience.');
    await flushChanges();

    expect(allEntries()).toEqual([
      expect.objectContaining({ prompt: 'What has been on your heart lately?', content: '## What am I learning?\nPatience.' }),
    ]);
  });

  test('adding a tag to a new entry creates it right away', async () => {
    await render(<JournalEditorScreen prefill={parseJournalPrefill({ type: 'gratitude' })} />);

    await fireEvent.changeText(screen.getByLabelText('Add a tag'), 'Thankful');
    await fireEvent(screen.getByLabelText('Add a tag'), 'submitEditing');
    await flushChanges();

    const [entry] = allEntries();
    expect(entry?.entryType).toBe('gratitude');
    expect(listTagsForEntity(db, 'journal_entry', entry!.id).map((t) => t.name)).toEqual(['Thankful']);
    expect(screen.getByRole('button', { name: '#Thankful' })).toBeTruthy();
  });
});

describe('JournalEditorScreen — existing entries', () => {
  test('loads, edits and autosaves an entry', async () => {
    const entry = createJournalEntry(db, { title: 'Evening', content: 'Quiet', entryType: 'reflection', entryDate: '2026-11-09' });

    await render(<JournalEditorScreen entryId={entry.id} prefill={parseJournalPrefill({})} />);
    expect(screen.getByLabelText('Entry title').props.value).toBe('Evening');

    await fireEvent.changeText(screen.getByLabelText('Entry title'), 'Evening light');
    await flushChanges();

    expect(getJournalEntry(db, entry.id)?.title).toBe('Evening light');
    expect(screen.getByText('Saved')).toBeTruthy();
  });

  test('deletes after confirmation and goes back', async () => {
    const entry = createJournalEntry(db, { title: 'To delete' });
    const alertSpy = jest.spyOn(Alert, 'alert');

    await render(<JournalEditorScreen entryId={entry.id} prefill={parseJournalPrefill({})} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete entry' }));

    const buttons = alertSpy.mock.calls[0]?.[2] ?? [];
    await act(async () => buttons.find((b) => b.style === 'destructive')?.onPress?.());

    expect(getJournalEntry(db, entry.id)).toBeNull();
    expect(db.select().from(journalEntries).where(eq(journalEntries.id, entry.id)).get()?.deletedAt).not.toBeNull();
    expect(mockRouter.back).toHaveBeenCalled();
  });

  test('Done flushes pending edits before going back', async () => {
    const entry = createJournalEntry(db, { title: 'Draft' });
    await render(<JournalEditorScreen entryId={entry.id} prefill={parseJournalPrefill({})} />);

    await fireEvent.changeText(screen.getByLabelText('Journal entry text'), 'Finished thought');
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

    expect(getJournalEntry(db, entry.id)?.content).toBe('Finished thought');
    expect(mockRouter.back).toHaveBeenCalled();
  });

  test('shows a calm message for a missing entry', async () => {
    await render(<JournalEditorScreen entryId="missing-id" prefill={parseJournalPrefill({})} />);
    expect(screen.getByText('Entry not found')).toBeTruthy();
  });
});
