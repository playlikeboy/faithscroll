import { eq } from 'drizzle-orm';

import { outbox, scriptureReferences } from '@/db/schema';
import { createTestDb } from '@/db/testing/create-test-db';
import { formatReference } from '@/features/bible/reference';

import { describeVerseRange } from '../reference-text';
import {
  attachScriptureReference,
  detachAllScriptureReferencesFor,
  detachScriptureReference,
  listScriptureReferences,
  listScriptureReferencesForSources,
} from '../scripture-references';

// formatReference belongs to bible-data; pin it so the local fallback formatter is exercised.
jest.mock('@/features/bible/reference', () => ({ formatReference: jest.fn(() => '') }));

const ROMANS_8_28 = 45008028;
const MATTHEW_18_21 = 40018021;
const MATTHEW_18_35 = 40018035;

describe('describeVerseRange', () => {
  test('formats single verses, ranges and chapter spans', () => {
    expect(describeVerseRange(ROMANS_8_28, ROMANS_8_28)).toBe('Romans 8:28');
    expect(describeVerseRange(MATTHEW_18_21, MATTHEW_18_35)).toBe('Matthew 18:21–35');
    expect(describeVerseRange(43003016, 43004002)).toBe('John 3:16–4:2');
    expect(describeVerseRange(1001001, 2001001)).toBe('Genesis 1:1 – Exodus 1:1');
  });

  test('falls back gracefully for unknown books', () => {
    expect(describeVerseRange(99001001, 99001001)).toBe('Passage');
  });

  test('prefers the shared formatReference when it returns text', () => {
    jest.mocked(formatReference).mockReturnValueOnce('Rom 8:28');
    expect(describeVerseRange(ROMANS_8_28)).toBe('Rom 8:28');
  });

  test('survives a throwing formatReference', () => {
    jest.mocked(formatReference).mockImplementationOnce(() => {
      throw new Error('boom');
    });
    expect(describeVerseRange(ROMANS_8_28)).toBe('Romans 8:28');
  });
});

describe('scripture references', () => {
  test('attaches a passage to a source and lists it', () => {
    const db = createTestDb();

    const ref = attachScriptureReference(db, {
      sourceType: 'journal_entry',
      sourceId: 'j1',
      startVerseId: MATTHEW_18_21,
      endVerseId: MATTHEW_18_35,
    });

    expect(ref.referenceText).toBe('Matthew 18:21–35');
    expect(ref.origin).toBe('user');
    expect(listScriptureReferences(db, 'journal_entry', 'j1')).toEqual([expect.objectContaining({ id: ref.id })]);
    expect(db.select().from(outbox).where(eq(outbox.entityType, 'scripture_reference')).all()).toHaveLength(1);
  });

  test('does not duplicate the same passage on the same source', () => {
    const db = createTestDb();
    const input = { sourceType: 'prayer_entry' as const, sourceId: 'p1', startVerseId: ROMANS_8_28, endVerseId: ROMANS_8_28 };

    const first = attachScriptureReference(db, input);
    const second = attachScriptureReference(db, input);

    expect(second.id).toBe(first.id);
    expect(db.select().from(scriptureReferences).all()).toHaveLength(1);
  });

  test('swaps reversed ranges and keeps a custom display text', () => {
    const db = createTestDb();
    const ref = attachScriptureReference(db, {
      sourceType: 'journal_entry',
      sourceId: 'j1',
      startVerseId: MATTHEW_18_35,
      endVerseId: MATTHEW_18_21,
      referenceText: 'Matt 18:21-35',
    });
    expect(ref.startVerseId).toBe(MATTHEW_18_21);
    expect(ref.endVerseId).toBe(MATTHEW_18_35);
    expect(ref.referenceText).toBe('Matt 18:21-35');
  });

  test('detaches with a tombstone and lists in canonical order', () => {
    const db = createTestDb();
    const later = attachScriptureReference(db, { sourceType: 'journal_entry', sourceId: 'j1', startVerseId: ROMANS_8_28, endVerseId: ROMANS_8_28 });
    attachScriptureReference(db, { sourceType: 'journal_entry', sourceId: 'j1', startVerseId: MATTHEW_18_21, endVerseId: MATTHEW_18_21 });

    expect(listScriptureReferences(db, 'journal_entry', 'j1').map((r) => r.startVerseId)).toEqual([MATTHEW_18_21, ROMANS_8_28]);

    detachScriptureReference(db, later.id);

    expect(listScriptureReferences(db, 'journal_entry', 'j1')).toHaveLength(1);
    const row = db.select().from(scriptureReferences).where(eq(scriptureReferences.id, later.id)).get();
    expect(row?.deletedAt).not.toBeNull();
  });

  test('re-attaching a detached passage revives it', () => {
    const db = createTestDb();
    const input = { sourceType: 'journal_entry' as const, sourceId: 'j1', startVerseId: ROMANS_8_28, endVerseId: ROMANS_8_28 };
    const ref = attachScriptureReference(db, input);
    detachScriptureReference(db, ref.id);

    const again = attachScriptureReference(db, input);

    expect(again.id).toBe(ref.id);
    expect(again.deletedAt).toBeNull();
  });

  test('lists references for many sources and detaches all for one source', () => {
    const db = createTestDb();
    attachScriptureReference(db, { sourceType: 'journal_entry', sourceId: 'a', startVerseId: ROMANS_8_28, endVerseId: ROMANS_8_28 });
    attachScriptureReference(db, { sourceType: 'journal_entry', sourceId: 'b', startVerseId: MATTHEW_18_21, endVerseId: MATTHEW_18_35 });

    const map = listScriptureReferencesForSources(db, 'journal_entry', ['a', 'b', 'c']);
    expect(map.get('a')).toHaveLength(1);
    expect(map.get('b')?.[0]?.referenceText).toBe('Matthew 18:21–35');
    expect(map.has('c')).toBe(false);
    expect(listScriptureReferencesForSources(db, 'journal_entry', []).size).toBe(0);

    detachAllScriptureReferencesFor(db, 'journal_entry', 'a');
    expect(listScriptureReferences(db, 'journal_entry', 'a')).toEqual([]);
    expect(listScriptureReferences(db, 'journal_entry', 'b')).toHaveLength(1);
  });
});
