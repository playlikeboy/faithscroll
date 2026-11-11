import { StyleSheet, View } from 'react-native';

import { FaithText } from '@/components/ui';
import type { LoadedPassage } from '@/features/study-ai/passage';
import { useTheme } from '@/theme';

export interface PassageHeaderProps {
  passage: LoadedPassage;
  /** Show at most this many verses (the rest are summarised). */
  maxVerses?: number;
}

/** The Scripture being studied, in the Scripture typeface — visually separate from AI content. */
export function PassageHeader({ passage, maxVerses = 6 }: PassageHeaderProps) {
  const { colors } = useTheme();
  const shown = passage.verses.slice(0, maxVerses);
  const hidden = passage.verses.length - shown.length;
  return (
    <View style={[styles.root, { borderLeftColor: colors.gold }]}>
      <FaithText variant="label">{`${passage.reference} · ${passage.translation}`}</FaithText>
      <FaithText variant="scripture">
        {shown.map((verse) => (
          <FaithText key={verse.id} variant="scripture">
            <FaithText variant="caption" style={{ color: colors.verseNumber }}>{`${verse.verse} `}</FaithText>
            {`${verse.text.trim()} `}
          </FaithText>
        ))}
      </FaithText>
      {hidden > 0 || passage.truncated ? (
        <FaithText variant="caption">{`…and ${hidden > 0 ? `${hidden} more verses` : 'more'}.`}</FaithText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8, borderLeftWidth: 3, paddingLeft: 14, paddingVertical: 4 },
});
