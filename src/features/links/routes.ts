/**
 * Where to navigate for each kind of linked item. Some targets are owned by other agents;
 * hrefs are cast because typed routes may not be generated for them yet.
 */
import type { Href } from 'expo-router';

import type { LinkableType } from '@/db/schema';
import { fromVerseId } from '@/features/bible/verse-id';

export function linkedItemHref(type: LinkableType, id: string): Href {
  const encoded = encodeURIComponent(id);
  switch (type) {
    case 'sermon':
      return `/sermons/${encoded}` as Href;
    case 'sermon_series':
      return `/sermons/series/${encoded}` as Href;
    case 'journal_entry':
      return `/journal/${encoded}` as Href;
    case 'prayer_entry':
      return `/prayers/${encoded}` as Href;
    case 'action_item':
      return '/library/actions' as Href;
    case 'verse_note':
      return `/bible/note/${encoded}` as Href;
    case 'saved_verse':
      return '/library/saved' as Href;
  }
}

/** Open the reader at the first verse of a passage. */
export function passageHref(startVerseId: number): Href {
  const { bookId, chapter, verse } = fromVerseId(startVerseId);
  return `/bible/read/${bookId}/${chapter}?verse=${verse}` as Href;
}
