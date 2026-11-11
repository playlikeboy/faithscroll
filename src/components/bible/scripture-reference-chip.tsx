import { Chip } from '@/components/ui';
import { rangeLabel } from '@/features/bible/reader/format';
import type { VerseRange } from '@/features/bible/types';

export interface ScriptureReferenceChipProps {
  range: VerseRange;
  onPress?: (range: VerseRange) => void;
  /** Override the displayed reference (defaults to the formatted range). */
  label?: string;
}

/** Tappable Scripture reference pill ("Romans 8:28"). */
export function ScriptureReferenceChip({ range, onPress, label }: ScriptureReferenceChipProps) {
  return (
    <Chip
      icon="bible"
      label={label ?? rangeLabel(range)}
      onPress={onPress ? () => onPress(range) : undefined}
      accessibilityHint={onPress ? 'Opens this passage' : undefined}
    />
  );
}
