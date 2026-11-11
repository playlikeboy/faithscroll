import { Pressable, StyleSheet, View } from 'react-native';

import { Card, FaithButton, FaithText, Icon, type IconName } from '@/components/ui';
import type { ScriptureTextStyle } from '@/features/settings/scripture-size';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

export interface VerseOfTheDayCardProps {
  reference: string;
  translation: string;
  text: string | null;
  isLoading: boolean;
  isSaved: boolean;
  saveError?: string | null;
  scriptureStyle?: ScriptureTextStyle;
  onToggleSave: () => void;
  onShare: () => void;
  onStudy: () => void;
  onRead: () => void;
}

interface ActionProps {
  icon: IconName;
  label: string;
  accessibilityLabel: string;
  isSelected?: boolean;
  onPress: () => void;
}

function CardAction({ icon, label, accessibilityLabel, isSelected, onPress }: ActionProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={isSelected === undefined ? undefined : { selected: isSelected }}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]}>
      <Icon name={icon} size={18} color={colors.primaryText} />
      <FaithText variant="secondary" weight="600" color="primaryText">
        {label}
      </FaithText>
    </Pressable>
  );
}

/** Featured passage on Today: Scripture first, then quiet actions (save, share, study). */
export function VerseOfTheDayCard({
  reference,
  translation,
  text,
  isLoading,
  isSaved,
  saveError,
  scriptureStyle,
  onToggleSave,
  onShare,
  onStudy,
  onRead,
}: VerseOfTheDayCardProps) {
  const { colors } = useTheme();
  const citation = `${reference} · ${translation}`;

  return (
    <Card style={styles.card}>
      <View style={[styles.accent, { backgroundColor: colors.gold }]} />
      <FaithText variant="label" accessibilityRole="header">
        Verse of the day
      </FaithText>

      {text ? (
        <FaithText variant="scripture" style={scriptureStyle} selectable>
          {text}
        </FaithText>
      ) : (
        <FaithText variant="bodySerif" color="textSecondary">
          {isLoading ? 'Opening today’s passage…' : `Today’s passage is ${reference}. Open it to read in context.`}
        </FaithText>
      )}

      <FaithText variant="secondary" weight="600" accessibilityLabel={`${reference}, ${translation}`}>
        {citation}
      </FaithText>

      {text ? (
        <View style={styles.actions}>
          <CardAction
            icon={isSaved ? 'bookmarkFilled' : 'bookmark'}
            label={isSaved ? 'Saved' : 'Save'}
            accessibilityLabel={isSaved ? `Saved. Remove ${reference} from saved verses` : `Save ${reference}`}
            isSelected={isSaved}
            onPress={onToggleSave}
          />
          <CardAction icon="share" label="Share" accessibilityLabel={`Share ${reference}`} onPress={onShare} />
          <CardAction icon="study" label="Study" accessibilityLabel={`Study ${reference}`} onPress={onStudy} />
        </View>
      ) : (
        <FaithButton label={`Read ${reference}`} variant="secondary" icon="bible" onPress={onRead} />
      )}

      {saveError ? (
        <FaithText variant="caption" color="danger" accessibilityLiveRegion="polite">
          {saveError}
        </FaithText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14, paddingVertical: 22, paddingHorizontal: 20, overflow: 'hidden' },
  accent: { position: 'absolute', left: 0, top: 22, width: 3, height: 28, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  actions: { flexDirection: 'row', gap: 4, marginTop: 2, marginLeft: -8 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 8,
  },
});
