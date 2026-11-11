import { StyleSheet, View } from 'react-native';

import { CardAction } from '@/components/today/card-action';
import { FaithText } from '@/components/ui';
import type { SessionCard } from '@/features/discover/session';
import type { ScriptureTextStyle } from '@/features/settings/scripture-size';
import { useTheme } from '@/theme';

export interface DiscoverCardViewProps {
  card: SessionCard;
  topicTitle: string;
  position: number;
  total: number;
  isSaved: boolean;
  scriptureStyle?: ScriptureTextStyle;
  onToggleSave: () => void;
  onOpenStudy: () => void;
}

/** Full-width, editorial verse card. Scripture leads; context is small and factual. */
export function DiscoverCardView({
  card,
  topicTitle,
  position,
  total,
  isSaved,
  scriptureStyle,
  onToggleSave,
  onOpenStudy,
}: DiscoverCardViewProps) {
  const { colors, fonts, radii } = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg },
      ]}>
      <View style={styles.meta}>
        <FaithText variant="label">{topicTitle}</FaithText>
        <FaithText variant="caption" accessibilityLabel={`Passage ${position} of ${total}`}>
          {position} of {total}
        </FaithText>
      </View>

      <FaithText
        style={[styles.quote, { color: colors.gold, fontFamily: fonts.serif }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        “
      </FaithText>

      {card.text ? (
        <FaithText variant="scripture" style={scriptureStyle} selectable>
          {card.text}
        </FaithText>
      ) : (
        <FaithText variant="bodySerif" color="textSecondary">
          This passage isn&apos;t available on this device right now. Open study to read {card.reference}.
        </FaithText>
      )}

      <View style={[styles.rule, { backgroundColor: colors.gold }]} />
      <FaithText variant="heading">{card.reference}</FaithText>
      {card.context ? <FaithText variant="secondary">{card.context}</FaithText> : null}

      <View style={styles.actions}>
        <CardAction
          icon={isSaved ? 'bookmarkFilled' : 'bookmark'}
          label={isSaved ? 'Saved' : 'Save'}
          accessibilityLabel={isSaved ? `Saved. Remove ${card.reference} from saved verses` : `Save ${card.reference}`}
          isSelected={isSaved}
          onPress={onToggleSave}
        />
        <CardAction icon="study" label="Open study" accessibilityLabel={`Open study for ${card.reference}`} onPress={onOpenStudy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 14,
    gap: 10,
  },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  quote: { fontSize: 48, lineHeight: 48, marginTop: 8, marginBottom: -18 },
  rule: { width: 28, height: 2, borderRadius: 1, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 4, marginLeft: -8, marginTop: 4 },
});
