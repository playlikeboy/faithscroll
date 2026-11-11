import { createTestDb } from '@/db/testing/create-test-db';
import { sermons } from '@/db/schema';
import { assignTag } from '@/features/tags/repository';

import { formatCalendarDate, formatDateTime, formatDayHeading, parseLocalDate } from '../dates';
import { excerpt, toPlainText } from '../plain-text';
import { createJournalEntry } from '../repository';
import { groupTimelineByDay, loadJournalTimeline } from '../timeline';

jest.mock('@/features/bible/reference', () => ({ formatReference: jest.fn(() => '') }));

describe('plain text', () => {
  test('strips Markdown-lite formatting', () => {
    const md = '# Heading\n- **bold** item\n1. *italic* and ==marked==\n> quote with snake_case_name';
    expect(toPlainText(md)).toBe('Heading bold item italic and marked quote with snake_case_name');
  });

  test('excerpts on a word boundary with an ellipsis', () => {
    const text = 'Grace upon grace, '.repeat(20);
    const short = excerpt(text, 40);
    expect(short.length).toBeLessThanOrEqual(41);
    expect(short.endsWith('…')).toBe(true);
    expect(excerpt('Short', 40)).toBe('Short');
  });
});

describe('dates', () => {
  test('parses only valid calendar dates', () => {
    expect(parseLocalDate('2026-11-10')?.getDate()).toBe(10);
    expect(parseLocalDate('2026-02-30')).toBeNull();
    expect(parseLocalDate('nope')).toBeNull();
    expect(parseLocalDate(null)).toBeNull();
  });

  test('formats day headings relative to today', () => {
    const today = new Date(2026, 10, 11, 9);
    expect(formatDayHeading('2026-11-11', today)).toBe('Today');
    expect(formatDayHeading('2026-11-10', today)).toBe('Yesterday');
    expect(formatDayHeading('2026-11-01', today)).toContain('November');
    expect(formatDayHeading('2025-11-01', today)).toContain('2025');
    expect(formatDayHeading('garbage', today)).toBe('garbage');
  });

  test('formats calendar dates and date-times defensively', () => {
    expect(formatCalendarDate('2026-11-08')).toContain('2026');
    expect(formatCalendarDate('bad')).toBe('bad');
    expect(formatCalendarDate(null)).toBe('');
    expect(formatDateTime('2026-11-12T08:00:00.000Z')).not.toBe('');
    expect(formatDateTime('not a date')).toBe('');
    expect(formatDateTime(null)).toBe('');
  });
});

describe('loadJournalTimeline', () => {
  test('enriches entries with tags, passages and link counts', () => {
    const db = createTestDb();
    db.insert(sermons).values({ id: 's1', title: 'Grace' }).run();
    const entry = createJournalEntry(
      db,
      { title: '', content: '## What stood out\nThe **father** ran.', entryDate: '2026-11-10' },
      { passages: [{ startVerseId: 42015020, endVerseId: 42015020 }], links: [{ type: 'sermon', id: 's1' }] },
    );
    assignTag(db, 'journal_entry', entry.id, 'Grace');

    const [item] = loadJournalTimeline(db);

    expect(item).toEqual(
      expect.objectContaining({
        title: null,
        excerpt: 'What stood out The father ran.',
        linkCount: 1,
      }),
    );
    expect(item?.tags.map((t) => t.name)).toEqual(['Grace']);
    expect(item?.references.map((r) => r.referenceText)).toEqual(['Luke 15:20']);
  });

  test('groups consecutive entries by day', () => {
    const db = createTestDb();
    createJournalEntry(db, { title: 'A', entryDate: '2026-11-10' });
    createJournalEntry(db, { title: 'B', entryDate: '2026-11-10' });
    createJournalEntry(db, { title: 'C', entryDate: '2026-11-09' });

    const sections = groupTimelineByDay(loadJournalTimeline(db), new Date(2026, 10, 10, 12));

    expect(sections.map((s) => [s.title, s.data.map((i) => i.title)])).toEqual([
      ['Today', expect.arrayContaining(['A', 'B'])],
      ['Yesterday', ['C']],
    ]);
  });
});
