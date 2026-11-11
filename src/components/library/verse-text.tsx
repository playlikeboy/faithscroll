import { FaithText } from '@/components/ui';
import { useVerses } from '@/features/bible/hooks/use-bible-text';
import { idsToRange } from '@/features/bible/verse-id';

export interface VerseTextProps {
  startVerseId: number;
  endVerseId?: number;
  numberOfLines?: number;
}

/** Scripture text for a verse range, from the bundled Bible (cached by TanStack Query). */
export function VerseText({ startVerseId, endVerseId = startVerseId, numberOfLines = 3 }: VerseTextProps) {
  const { data, isLoading, isError } = useVerses(idsToRange(startVerseId, endVerseId));
  if (isLoading) return <FaithText variant="secondary">Loading verse…</FaithText>;
  const text = (data ?? []).map((verse) => verse.text).join(' ');
  if (isError || !text) return <FaithText variant="secondary">Verse text isn’t available right now.</FaithText>;
  return (
    <FaithText variant="bodySerif" color="scripture" numberOfLines={numberOfLines}>
      {text}
    </FaithText>
  );
}
