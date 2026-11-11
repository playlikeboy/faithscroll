import { StyleSheet, Text, View } from 'react-native';

import { Card, FaithText } from '@/components/ui';
import type { Verse } from '@/features/bible/types';
import { scriptureLineHeight, useTheme } from '@/theme';

export interface ScriptureTextProps {
  verses: readonly Verse[];
  fontSize?: number;
  /** Show small verse numbers before each verse (default when there is more than one verse). */
  showVerseNumbers?: boolean;
  numberOfLines?: number;
}

/** Plain text of a passage, verses joined by spaces (for share text and labels). */
export function passagePlainText(verses: readonly Verse[]): string {
  return verses.map((verse) => verse.text.trim()).join(' ');
}

/** Scripture in Literata with optional verse numbers. */
export function ScriptureText({ verses, fontSize = 19, showVerseNumbers = verses.length > 1, numberOfLines }: ScriptureTextProps) {
  const { colors } = useTheme();
  const numberStyle = { fontSize: Math.round(fontSize * 0.6), color: colors.verseNumber };
  return (
    <FaithText
      variant="scripture"
      numberOfLines={numberOfLines}
      style={{ fontSize, lineHeight: scriptureLineHeight(fontSize) }}>
      {verses.map((verse, index) => (
        <Text key={verse.id}>
          {showVerseNumbers ? <Text style={numberStyle}>{`${verse.verse} `}</Text> : null}
          {verse.text.trim()}
          {index < verses.length - 1 ? ' ' : ''}
        </Text>
      ))}
    </FaithText>
  );
}

export interface ScriptureCardProps {
  reference: string;
  verses: readonly Verse[];
  translationLabel?: string;
  fontSize?: number;
  numberOfLines?: number;
  onPress?: () => void;
  accessibilityHint?: string;
}

/** Reference + passage text + translation, read by VoiceOver as one element. */
export function ScriptureCard({
  reference,
  verses,
  translationLabel,
  fontSize,
  numberOfLines,
  onPress,
  accessibilityHint,
}: ScriptureCardProps) {
  const label = [reference, passagePlainText(verses), translationLabel].filter(Boolean).join('. ');
  const body = (
    <View style={styles.body}>
      <FaithText variant="label">{reference}</FaithText>
      <ScriptureText verses={verses} fontSize={fontSize} numberOfLines={numberOfLines} />
      {translationLabel ? <FaithText variant="caption">{translationLabel}</FaithText> : null}
    </View>
  );

  if (onPress) {
    return (
      <Card onPress={onPress} accessibilityLabel={label} accessibilityHint={accessibilityHint}>
        {body}
      </Card>
    );
  }
  return (
    <Card>
      <View accessible accessibilityLabel={label}>
        {body}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { gap: 8 },
});
