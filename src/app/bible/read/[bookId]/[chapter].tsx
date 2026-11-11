import { useLocalSearchParams } from 'expo-router';

import { ChapterReader } from '@/components/bible/chapter-reader';
import { PassageNotFound } from '@/components/bible/passage-not-found';
import { parseReaderParams } from '@/features/bible/reader/params';

export default function ChapterReaderScreen() {
  const params = parseReaderParams(useLocalSearchParams());
  if (!params) return <PassageNotFound />;
  return <ChapterReader key={`${params.bookId}:${params.chapter}:${params.verse ?? ''}`} {...params} />;
}
