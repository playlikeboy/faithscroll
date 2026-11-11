import { useLocalSearchParams } from 'expo-router';

import { PassageNotFound } from '@/components/bible/passage-not-found';
import { VerseActionSheet } from '@/components/bible/verse-action-sheet';
import { parseVerseRangeParams } from '@/features/bible/reader/params';

/** Presented as a form sheet by the root layout. `?start=&end=` are verse ids. */
export default function VerseActionsScreen() {
  const params = parseVerseRangeParams(useLocalSearchParams());
  if (!params) return <PassageNotFound />;
  return <VerseActionSheet {...params} />;
}
