import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FaithText } from '@/components/ui';
import { MIN_TOUCH_TARGET } from '@/theme';

import { VerseText } from './verse-text';

export interface VerseEntryRowProps {
  reference: string;
  startVerseId: number;
  endVerseId?: number;
  /** Extra line under the reference, e.g. a colour name or a note excerpt. */
  detail?: string;
  /** Show the verse text (default true). */
  showText?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress: () => void;
  accessibilityHint?: string;
}

/** A passage in a Library list: reference, optional detail and the Scripture text. */
export function VerseEntryRow({
  reference,
  startVerseId,
  endVerseId,
  detail,
  showText = true,
  leading,
  trailing,
  onPress,
  accessibilityHint = 'Opens the passage in the reader',
}: VerseEntryRowProps) {
  return (
    <View style={styles.row}>
      {leading}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={detail ? `${reference}, ${detail}` : reference}
        accessibilityHint={accessibilityHint}
        onPress={onPress}
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}>
        <FaithText variant="heading">{reference}</FaithText>
        {detail ? (
          <FaithText variant="secondary" numberOfLines={3}>
            {detail}
          </FaithText>
        ) : null}
        {showText ? <VerseText startVerseId={startVerseId} endVerseId={endVerseId} /> : null}
      </Pressable>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, minHeight: MIN_TOUCH_TARGET + 8 },
  body: { flex: 1, gap: 4 },
  pressed: { opacity: 0.6 },
});
