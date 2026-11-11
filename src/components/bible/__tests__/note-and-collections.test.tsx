import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactElement } from 'react';
import { Alert } from 'react-native';

import { CollectionsPicker } from '@/components/bible/collections-picker';
import { VerseNoteScreen } from '@/components/bible/verse-note-screen';
import { db } from '@/db/client';
import { collectionItems, collections, outbox, savedVerses, verseNotes } from '@/db/schema';
import { createCollection } from '@/features/bible/annotations/collections';
import { createVerseNote, getVerseNote } from '@/features/bible/annotations/verse-notes';
import { getVerses } from '@/features/bible/repository';
import { idsToRange } from '@/features/bible/verse-id';

jest.mock('@/db/client', () => ({ db: jest.requireActual('@/db/testing/create-test-db').createTestDb() }));
jest.mock('drizzle-orm/expo-sqlite', () => ({
  useLiveQuery: (query: { all: () => unknown[] }) => ({ data: query.all(), error: undefined, updatedAt: new Date() }),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  Stack: {
    Screen: ({ options }: { options?: { headerRight?: () => ReactElement } }) => options?.headerRight?.() ?? null,
  },
}));
jest.mock('@/components/editor/note-editor', () => {
  const { TextInput } = jest.requireActual('react-native');
  return {
    NoteEditor: (props: { value: string; onChangeText: (v: string) => void; accessibilityLabel?: string }) => (
      <TextInput value={props.value} onChangeText={props.onChangeText} accessibilityLabel={props.accessibilityLabel} />
    ),
  };
});
jest.mock('@/services/monitoring/analytics', () => ({ track: jest.fn() }));
jest.mock('@/features/bible/reference', () => ({ formatReference: () => '' }));
jest.mock('@/features/bible/repository', () => ({
  ...jest.requireActual('@/features/bible/repository'),
  getVerses: jest.fn(),
}));

// Rendering full screens is slow under coverage and a busy machine.
jest.setTimeout(30_000);

const PS_23_1 = 19_023_001;

function withQuery(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

/** Let queued autosave promises settle. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const table of [collectionItems, collections, savedVerses, verseNotes, outbox]) db.delete(table).run();
  jest.mocked(getVerses).mockResolvedValue([
    { id: PS_23_1, bookId: 19, chapter: 23, verse: 1, text: 'Yahweh is my shepherd.', heading: null, paragraphStart: true, poetry: true },
  ]);
});

describe('VerseNoteScreen', () => {
  test('autosaves typed text when leaving', async () => {
    const id = createVerseNote(db, { startVerseId: PS_23_1, endVerseId: PS_23_1 });
    const { unmount } = await render(withQuery(<VerseNoteScreen noteId={id} />));

    await fireEvent.changeText(screen.getByLabelText('Note on Psalm 23:1'), 'He restores my soul.');
    await unmount();
    await settle();

    expect(getVerseNote(db, id)?.content).toBe('He restores my soul.');
  });

  test('a note left empty is removed', async () => {
    const id = createVerseNote(db, { startVerseId: PS_23_1, endVerseId: PS_23_1 });
    const { unmount } = await render(withQuery(<VerseNoteScreen noteId={id} />));

    await unmount();
    await settle();

    expect(getVerseNote(db, id)).toBeUndefined();
  });

  test('delete asks for confirmation, then removes the note and goes back', async () => {
    const id = createVerseNote(db, { startVerseId: PS_23_1, endVerseId: PS_23_1, content: 'Keep me' });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(withQuery(<VerseNoteScreen noteId={id} />));

    await fireEvent.press(screen.getByRole('button', { name: 'Delete note' }));
    const buttons = alert.mock.calls[0][2] ?? [];
    await act(async () => buttons.find((button) => button.style === 'destructive')?.onPress?.());

    expect(getVerseNote(db, id)).toBeUndefined();
    expect(router.back).toHaveBeenCalled();
  });

  test('shows a friendly state for a deleted note', async () => {
    await render(withQuery(<VerseNoteScreen noteId="missing" />));
    expect(screen.getByText('This note was deleted')).toBeTruthy();
  });
});

describe('CollectionsPicker', () => {
  const rangeTarget = {
    kind: 'range' as const,
    startVerseId: PS_23_1,
    endVerseId: PS_23_1,
    range: idsToRange(PS_23_1),
  };

  test('creates a collection and adds the passage (saving it)', async () => {
    await render(<CollectionsPicker target={rangeTarget} />);

    await fireEvent.changeText(screen.getByLabelText('New collection'), 'Comfort');
    await fireEvent.press(screen.getByRole('button', { name: 'Create and add' }));

    const saved = db.select().from(savedVerses).get();
    expect(saved).toEqual(expect.objectContaining({ startVerseId: PS_23_1, endVerseId: PS_23_1 }));
    expect(db.select().from(collectionItems).all()).toEqual([
      expect.objectContaining({ entityType: 'saved_verse', entityId: saved?.id }),
    ]);
  });

  test('toggles membership of an existing collection', async () => {
    createCollection(db, { title: 'Hope' });
    const { rerender } = await render(<CollectionsPicker target={rangeTarget} />);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Hope, 0 items' }));
    expect(db.select().from(collectionItems).all().filter((item) => !item.deletedAt)).toHaveLength(1);

    await rerender(<CollectionsPicker target={rangeTarget} />);
    const row = screen.getByRole('checkbox', { name: 'Hope, 1 item' });
    expect(row.props.accessibilityState).toEqual(expect.objectContaining({ checked: true }));
    await fireEvent.press(row);
    expect(db.select().from(collectionItems).all().filter((item) => !item.deletedAt)).toHaveLength(0);
  });

  test('works for other linkable items and reports validation errors', async () => {
    createCollection(db, { title: 'Journal' });
    await render(<CollectionsPicker target={{ kind: 'entity', entityType: 'journal_entry', entityId: 'je-1' }} />);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Journal, 0 items' }));
    expect(db.select().from(collectionItems).get()).toEqual(expect.objectContaining({ entityId: 'je-1' }));

    await fireEvent.changeText(screen.getByLabelText('New collection'), '   ');
    await fireEvent(screen.getByLabelText('New collection'), 'submitEditing');
    expect(screen.getByText('Give your collection a name.')).toBeTruthy();
  });
});
