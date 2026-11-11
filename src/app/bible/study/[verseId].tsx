import { useLocalSearchParams } from 'expo-router';

import { BasicStudy } from '@/components/bible/basic-study';
import { PassageNotFound } from '@/components/bible/passage-not-found';
import { parseVerseRangeParams } from '@/features/bible/reader/params';

/** Basic study for `/bible/study/<startVerseId>?end=<endVerseId>`. */
export default function StudyScreen() {
  const { verseId, end } = useLocalSearchParams<{ verseId: string; end?: string }>();
  const params = parseVerseRangeParams({ start: verseId, end });
  if (!params) return <PassageNotFound />;
  return <BasicStudy key={`${params.startVerseId}-${params.endVerseId}`} {...params} />;
}
