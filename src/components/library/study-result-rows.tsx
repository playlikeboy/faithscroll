import { ListRow } from '@/components/ui';
import type { DictionaryEntrySummary, TopicSummary } from '@/features/bible/study-data/types';

const passageCount = (count: number): string => (count === 1 ? '1 passage' : `${count} passages`);

export interface TopicResultRowProps {
  topic: TopicSummary;
  onPress: (topic: TopicSummary) => void;
}

/** A topic from the bundled topical index (OpenBible.info + Nave's). */
export function TopicResultRow({ topic, onPress }: TopicResultRowProps) {
  return (
    <ListRow
      icon="list"
      title={topic.name}
      subtitle={topic.verseCount > 0 ? passageCount(topic.verseCount) : 'See related topics'}
      accessibilityHint="Opens the verses for this topic"
      onPress={() => onPress(topic)}
    />
  );
}

export interface DictionaryResultRowProps {
  entry: DictionaryEntrySummary;
  onPress: (entry: DictionaryEntrySummary) => void;
}

/** An Easton's Bible Dictionary entry with the start of its definition. */
export function DictionaryResultRow({ entry, onPress }: DictionaryResultRowProps) {
  return (
    <ListRow
      icon="study"
      title={entry.term}
      subtitle={entry.preview}
      accessibilityHint="Opens the dictionary entry"
      onPress={() => onPress(entry)}
    />
  );
}
