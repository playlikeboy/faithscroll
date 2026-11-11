import type { Href } from 'expo-router';

import type { IconName } from '@/components/ui';
import { getBook } from '@/features/bible/books';

import { formatRelativeDay } from './dates';
import { todayRoutes } from './routes';

export interface ContinueReading {
  bookId: number;
  bookName: string;
  chapter: number;
  verse: number;
  totalChapters: number;
}

export function toContinueReading(
  row: { bookId: number; chapter: number; verse: number } | null | undefined,
): ContinueReading | null {
  if (!row) return null;
  const book = getBook(row.bookId);
  if (!book) return null;
  const chapter = Math.min(Math.max(1, row.chapter), book.chapters);
  return { bookId: book.id, bookName: book.name, chapter, verse: Math.max(1, row.verse), totalChapters: book.chapters };
}

export type ActivityKind = 'reading' | 'sermon' | 'journal' | 'prayer' | 'action';

export interface RecentActivityItem {
  key: string;
  kind: ActivityKind;
  icon: IconName;
  title: string;
  subtitle: string;
  href: Href;
}

export interface RecentActivitySources {
  lastChapter?: { id: string; bookId: number; chapter: number; readAt: string } | null;
  sermon?: { id: string; title: string; speaker: string | null; updatedAt: string } | null;
  journal?: {
    id: string;
    title: string;
    prompt: string | null;
    content: string;
    entryDate: string;
  } | null;
  prayer?: { id: string; title: string } | null;
  action?: { id: string; title: string } | null;
}

const MAX_TITLE_LENGTH = 80;

function truncate(text: string): string {
  return text.length > MAX_TITLE_LENGTH ? `${text.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…` : text;
}

/** First meaningful line of Markdown-lite content, without list/heading/quote markers. */
function firstLine(content: string): string {
  const line = content
    .split('\n')
    .map((value) => value.replace(/^\s*(#{1,6}|[-*>]|\d+\.)\s*/, '').trim())
    .find(Boolean);
  return line ?? '';
}

export function journalEntryTitle(entry: { title: string; prompt: string | null; content: string }): string {
  const title = entry.title.trim() || entry.prompt?.trim() || firstLine(entry.content);
  return title ? truncate(title) : 'Journal entry';
}

function joinParts(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(' · ');
}

/** Compact "where you left off" list: reading, sermon, journal, prayer, action — whichever exist. */
export function buildRecentActivity(sources: RecentActivitySources, now: Date = new Date()): RecentActivityItem[] {
  const items: RecentActivityItem[] = [];
  const { lastChapter, sermon, journal, prayer, action } = sources;

  if (lastChapter) {
    const book = getBook(lastChapter.bookId);
    if (book) {
      items.push({
        key: `reading-${lastChapter.id}`,
        kind: 'reading',
        icon: 'bible',
        title: `${book.name} ${lastChapter.chapter}`,
        subtitle: joinParts(['Last read', formatRelativeDay(lastChapter.readAt, now)]),
        href: todayRoutes.readChapter(book.id, lastChapter.chapter),
      });
    }
  }
  if (sermon) {
    items.push({
      key: `sermon-${sermon.id}`,
      kind: 'sermon',
      icon: 'sermons',
      title: truncate(sermon.title.trim() || 'Untitled sermon'),
      subtitle: joinParts(['Sermon', sermon.speaker?.trim(), formatRelativeDay(sermon.updatedAt, now)]),
      href: todayRoutes.sermon(sermon.id),
    });
  }
  if (journal) {
    items.push({
      key: `journal-${journal.id}`,
      kind: 'journal',
      icon: 'journal',
      title: journalEntryTitle(journal),
      subtitle: joinParts(['Journal', formatRelativeDay(journal.entryDate, now)]),
      href: todayRoutes.journalEntry(journal.id),
    });
  }
  if (prayer) {
    items.push({
      key: `prayer-${prayer.id}`,
      kind: 'prayer',
      icon: 'prayer',
      title: truncate(prayer.title.trim() || 'Prayer'),
      subtitle: 'Still praying',
      href: todayRoutes.prayer(prayer.id),
    });
  }
  if (action) {
    items.push({
      key: `action-${action.id}`,
      kind: 'action',
      icon: 'action',
      title: truncate(action.title.trim() || 'Action'),
      subtitle: 'To live out',
      href: todayRoutes.actions,
    });
  }
  return items;
}
