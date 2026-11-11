import type { Verse } from '@/features/bible/types';
import { idsToRange } from '@/features/bible/verse-id';
import { scriptureSizeLabel, scriptureTextStyle } from '@/features/settings/scripture-size';
import { buildRecentActivity, journalEntryTitle, toContinueReading } from '@/features/today/activity';
import { formatLongDate, formatRelativeDay, greetingFor, localDayNumber, parseLocalDate } from '@/features/today/dates';
import { chapterLabel, joinVerseText, passageLabel, rangeKey } from '@/features/today/passage';
import { REFLECTION_PROMPTS, promptForDate } from '@/features/today/reflection-prompts';
import { todayRoutes } from '@/features/today/routes';
import { contentFreeError } from '@/features/today/safe-error';
import { verseShareMessage } from '@/features/today/share';
import { intentionForDate } from '@/features/today/use-daily-intention';

// Exercise our fallback label independently of the bible-data formatter.
jest.mock('@/features/bible/reference', () => ({ formatReference: () => '' }));

const NOW = new Date(2026, 10, 11, 9, 15);

function verse(id: number, text: string): Verse {
  return { id, bookId: 0, chapter: 0, verse: 0, text, heading: null, paragraphStart: false, poetry: false };
}

describe('dates', () => {
  test('greets by time of day', () => {
    expect(greetingFor(new Date(2026, 10, 11, 6))).toBe('Good morning');
    expect(greetingFor(new Date(2026, 10, 11, 14))).toBe('Good afternoon');
    expect(greetingFor(new Date(2026, 10, 11, 20))).toBe('Good evening');
  });

  test('formats a long date', () => {
    expect(formatLongDate(NOW, 'en-US')).toBe('Wednesday, November 11');
  });

  test('parses local dates and rejects junk', () => {
    expect(parseLocalDate('2026-11-11')?.getDate()).toBe(11);
    expect(parseLocalDate('11/11/2026')).toBeNull();
  });

  test('describes relative days', () => {
    expect(formatRelativeDay('2026-11-11', NOW)).toBe('Today');
    expect(formatRelativeDay(new Date(2026, 10, 10, 23).toISOString(), NOW)).toBe('Yesterday');
    expect(formatRelativeDay('2026-11-02', NOW, 'en-US')).toBe('Mon, Nov 2');
    expect(formatRelativeDay('not a date', NOW)).toBeNull();
  });
});

describe('reflection prompts', () => {
  test('rotate daily and stay stable within a day', () => {
    const morning = promptForDate(new Date(2026, 10, 11, 6));
    expect(promptForDate(new Date(2026, 10, 11, 22))).toBe(morning);
    expect(promptForDate(new Date(2026, 10, 12, 6))).not.toBe(morning);
    expect(REFLECTION_PROMPTS).toContain(morning);
    expect(REFLECTION_PROMPTS[localDayNumber(NOW) % REFLECTION_PROMPTS.length]).toBe(promptForDate(NOW));
  });
});

describe('passage helpers', () => {
  test('falls back to a readable label while the shared formatter is unavailable', () => {
    expect(passageLabel(idsToRange(19_023_001))).toBe('Psalms 23:1');
    expect(passageLabel(idsToRange(45_008_028, 45_008_030))).toBe('Romans 8:28–30');
    expect(passageLabel(idsToRange(19_023_006, 19_024_002))).toBe('Psalms 23:6–24:2');
    expect(chapterLabel(idsToRange(45_008_028))).toBe('Romans 8');
    expect(rangeKey(idsToRange(1, 2))).toBe('1-2');
  });

  test('joins verse text', () => {
    expect(joinVerseText([verse(1, ' The Lord is my shepherd; '), verse(2, 'I shall lack nothing.')])).toBe(
      'The Lord is my shepherd; I shall lack nothing.',
    );
  });
});

describe('continue reading', () => {
  test('maps progress onto the book', () => {
    expect(toContinueReading({ bookId: 43, chapter: 3, verse: 16 })).toEqual({
      bookId: 43,
      bookName: 'John',
      chapter: 3,
      verse: 16,
      totalChapters: 21,
    });
    expect(toContinueReading({ bookId: 43, chapter: 99, verse: 0 })?.chapter).toBe(21);
    expect(toContinueReading(undefined)).toBeNull();
    expect(toContinueReading({ bookId: 999, chapter: 1, verse: 1 })).toBeNull();
  });
});

describe('recent activity', () => {
  test('is empty without data', () => {
    expect(buildRecentActivity({}, NOW)).toEqual([]);
  });

  test('lists each kind with a destination', () => {
    const items = buildRecentActivity(
      {
        lastChapter: { id: 'h', bookId: 45, chapter: 8, readAt: NOW.toISOString() },
        sermon: { id: 's', title: 'The Power of Forgiveness', speaker: 'Pastor John', updatedAt: '2026-11-08T10:00:00Z' },
        journal: { id: 'j', title: '', prompt: null, content: '# Grace\nMore text', entryDate: '2026-11-10' },
        prayer: { id: 'p', title: 'For my sister' },
        action: { id: 'a', title: 'Forgive quickly' },
      },
      NOW,
    );

    expect(items.map((item) => [item.kind, item.title, item.href])).toEqual([
      ['reading', 'Romans 8', todayRoutes.readChapter(45, 8)],
      ['sermon', 'The Power of Forgiveness', '/sermons/s'],
      ['journal', 'Grace', '/journal/j'],
      ['prayer', 'For my sister', '/prayers/p'],
      ['action', 'Forgive quickly', '/library/actions'],
    ]);
    expect(items[0].subtitle).toBe('Last read · Today');
    expect(items[1].subtitle).toMatch(/^Sermon · Pastor John · /);
    expect(items[2].subtitle).toBe('Journal · Yesterday');
  });

  test('journal titles fall back to prompt, first line, then a generic label', () => {
    expect(journalEntryTitle({ title: 'Morning', prompt: 'P', content: 'c' })).toBe('Morning');
    expect(journalEntryTitle({ title: ' ', prompt: 'What am I learning?', content: 'c' })).toBe('What am I learning?');
    expect(journalEntryTitle({ title: '', prompt: null, content: '\n- first point\n' })).toBe('first point');
    expect(journalEntryTitle({ title: '', prompt: null, content: '' })).toBe('Journal entry');
    expect(journalEntryTitle({ title: 'x'.repeat(200), prompt: null, content: '' })).toHaveLength(80);
  });
});

describe('routes', () => {
  test('build reader, study and topic links', () => {
    expect(todayRoutes.readChapter(43, 1)).toBe('/bible/read/43/1');
    expect(todayRoutes.readChapter(43, 3, 16)).toBe('/bible/read/43/3?verse=16');
    expect(todayRoutes.study(19_023_001, 19_023_003)).toBe('/bible/study/19023001?end=19023003');
    expect(todayRoutes.discoverTopic('hope & peace')).toBe('/discover/hope%20%26%20peace');
  });
});

describe('misc', () => {
  test('share message quotes Scripture with its citation', () => {
    expect(verseShareMessage({ text: 'Rejoice always.', reference: '1 Thessalonians 5:16', translation: 'WEB' })).toBe(
      '“Rejoice always.”\n— 1 Thessalonians 5:16 (WEB)',
    );
    expect(verseShareMessage({ text: null, reference: 'John 1:1', translation: 'WEB' })).toBe('John 1:1 (WEB)');
  });

  test("an intention only counts for the day it was set", () => {
    expect(intentionForDate({ date: '2026-11-11', text: 'Be kind' }, '2026-11-11')).toBe('Be kind');
    expect(intentionForDate({ date: '2026-11-10', text: 'Be kind' }, '2026-11-11')).toBeNull();
    expect(intentionForDate(null, '2026-11-11')).toBeNull();
  });

  test('scripture size maps index to font metrics', () => {
    expect(scriptureTextStyle(2)).toEqual({ fontSize: 21, lineHeight: 33 });
    expect(scriptureTextStyle(99).fontSize).toBe(21);
    expect(scriptureSizeLabel(5)).toBe('Largest');
  });

  test('content-free errors drop query parameters', () => {
    const cause = new Error('UNIQUE constraint failed: saved_verses.id');
    const queryError = new Error('Failed query: insert ... params: my private prayer', { cause });
    expect(contentFreeError(queryError).message).toBe('Error: UNIQUE constraint failed: saved_verses.id');
    expect(contentFreeError(new TypeError('secret text')).message).toBe('TypeError');
    expect(contentFreeError('nope').message).toBe('Unknown error');
  });
});
