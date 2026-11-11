import { outbox, verseNotes } from '@/db/schema';
import { createTestDb } from '@/db/testing/create-test-db';
import {
  createVerseNote,
  deleteVerseNote,
  getVerseNote,
  listNotesOverlapping,
  updateVerseNote,
} from '@/features/bible/annotations/verse-notes';

const PS_23_1 = 19_023_001;
const PS_23_6 = 19_023_006;

describe('verse notes repository', () => {
  test('creates an empty note for a range', () => {
    const db = createTestDb();

    const id = createVerseNote(db, { startVerseId: PS_23_1, endVerseId: PS_23_6 });

    expect(getVerseNote(db, id)).toEqual(
      expect.objectContaining({ id, startVerseId: PS_23_1, endVerseId: PS_23_6, content: '' }),
    );
    expect(db.select().from(outbox).all()).toEqual([
      expect.objectContaining({ entityType: 'verse_note', entityId: id, operation: 'upsert' }),
    ]);
  });

  test('updates content and bumps the version', () => {
    const db = createTestDb();
    const id = createVerseNote(db, { startVerseId: PS_23_1, endVerseId: PS_23_1, content: 'First' });

    updateVerseNote(db, id, 'The Lord is my shepherd');

    expect(getVerseNote(db, id)).toEqual(expect.objectContaining({ content: 'The Lord is my shepherd', version: 2 }));
  });

  test('skips writes when content is unchanged', () => {
    const db = createTestDb();
    const id = createVerseNote(db, { startVerseId: PS_23_1, endVerseId: PS_23_1, content: 'Same' });

    updateVerseNote(db, id, 'Same');

    expect(getVerseNote(db, id)?.version).toBe(1);
    expect(db.select().from(outbox).all()).toHaveLength(1);
  });

  test('updating a deleted note throws a friendly error', () => {
    const db = createTestDb();
    const id = createVerseNote(db, { startVerseId: PS_23_1, endVerseId: PS_23_1 });
    deleteVerseNote(db, id);

    expect(() => updateVerseNote(db, id, 'x')).toThrow(/no longer exists/i);
  });

  test('deletes softly and hides the note', () => {
    const db = createTestDb();
    const id = createVerseNote(db, { startVerseId: PS_23_1, endVerseId: PS_23_1 });

    deleteVerseNote(db, id);

    expect(getVerseNote(db, id)).toBeUndefined();
    expect(db.select().from(verseNotes).all()[0].deletedAt).not.toBeNull();
    expect(db.select().from(outbox).all().at(-1)?.operation).toBe('delete');
  });

  test('lists notes overlapping a range, newest first', () => {
    const db = createTestDb();
    const a = createVerseNote(db, { startVerseId: PS_23_1, endVerseId: PS_23_6 });
    createVerseNote(db, { startVerseId: 19_024_001, endVerseId: 19_024_001 });

    expect(listNotesOverlapping(db, 19_023_004, 19_023_004).all().map((n) => n.id)).toEqual([a]);
  });
});
