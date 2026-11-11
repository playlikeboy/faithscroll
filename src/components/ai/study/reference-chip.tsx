import { router } from 'expo-router';

import { Chip } from '@/components/ui';
import { parseReference } from '@/features/bible/reference';
import { toVerseId } from '@/features/bible/verse-id';

import { aiRoutes } from '../ai-routes';

/** A verified reference; tapping it opens the passage in the Bible reader. */
export function ReferenceChip({ reference }: { reference: string }) {
  const range = parseReference(reference);
  if (!range) return <Chip icon="bible" label={reference} />;
  return (
    <Chip
      icon="bible"
      label={reference}
      accessibilityHint="Opens this passage in the Bible"
      onPress={() => router.push(aiRoutes.bibleAt(toVerseId(range.start)))}
    />
  );
}
