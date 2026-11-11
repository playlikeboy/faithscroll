import type { Href } from 'expo-router';

import { bibleRoutes } from '@/features/bible/reader/routes';
import { fromVerseId } from '@/features/bible/verse-id';

const id = (value: string) => encodeURIComponent(value);

/** Href builders used by the AI screens (cast so typed routes compile while sibling routes are built). */
export const aiRoutes = {
  /** Sermon detail, seeking playback to a timeline position. */
  sermonAt: (sermonId: string, positionMs: number): Href => `/sermons/${id(sermonId)}?t=${Math.max(0, Math.round(positionMs))}` as Href,
  transcript: (sermonId: string): Href => `/sermons/${id(sermonId)}/transcript` as Href,
  recap: (sermonId: string): Href => `/sermons/${id(sermonId)}/recap` as Href,
  paywall: (source: 'transcription' | 'recap' | 'study' | 'ask'): Href => `/paywall?source=${source}` as Href,
  signIn: (): Href => '/auth/sign-in' as Href,
  journalForAction: (sermonId: string, actionItemId: string): Href =>
    `/journal/new?type=sermon_reflection&sermonId=${id(sermonId)}&actionItemId=${id(actionItemId)}` as Href,
  bibleAt: (startVerseId: number): Href => {
    const ref = fromVerseId(startVerseId);
    return bibleRoutes.reader(ref.bookId, ref.chapter, ref.verse);
  },
};
