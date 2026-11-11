import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, Chip, FaithText, Icon } from '@/components/ui';
import { formatDateTime } from '@/features/journal/dates';
import { excerpt } from '@/features/journal/plain-text';
import type { ScriptureReference } from '@/features/links/scripture-references';
import { isReminderUpcoming } from '@/features/prayers/reminders';
import { PRAYER_STATUS_LABELS, type Prayer } from '@/features/prayers/types';
import { useTheme } from '@/theme';

export interface PrayerCardProps {
  prayer: Prayer;
  references?: readonly ScriptureReference[];
  onPress: (id: string) => void;
}

const EXCERPT_LENGTH = 120;

function PrayerCardBase({ prayer, references = [], onPress }: PrayerCardProps) {
  const { colors } = useTheme();
  const title = prayer.title.trim() || 'Untitled prayer';
  const body = excerpt(prayer.content, EXCERPT_LENGTH);
  const hasReminder = isReminderUpcoming(prayer.reminderAt);
  const answeredOn = prayer.status === 'answered' && prayer.answeredAt ? new Date(prayer.answeredAt).toLocaleDateString() : null;

  const label = [
    title,
    PRAYER_STATUS_LABELS[prayer.status],
    prayer.category,
    body,
    answeredOn ? `Answered ${answeredOn}` : null,
    hasReminder ? `Reminder ${formatDateTime(prayer.reminderAt)}` : null,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <Card onPress={() => onPress(prayer.id)} accessibilityLabel={label} accessibilityHint="Opens the prayer">
      <View style={styles.body}>
        <View style={styles.metaRow}>
          <FaithText variant="label" style={styles.flex}>
            {[PRAYER_STATUS_LABELS[prayer.status], prayer.category].filter(Boolean).join(' · ')}
          </FaithText>
          {hasReminder ? <Icon name="bell" size={14} color={colors.textSecondary} /> : null}
        </View>
        <FaithText variant="title" numberOfLines={2}>
          {title}
        </FaithText>
        {body ? (
          <FaithText variant="secondary" numberOfLines={2}>
            {body}
          </FaithText>
        ) : null}
        {references.length > 0 ? (
          <View style={styles.chips}>
            {references.slice(0, 2).map((reference) => (
              <Chip key={reference.id} icon="bible" label={reference.referenceText} />
            ))}
          </View>
        ) : null}
        {answeredOn ? <FaithText variant="caption">Answered {answeredOn}</FaithText> : null}
      </View>
    </Card>
  );
}

export const PrayerCard = memo(PrayerCardBase);

const styles = StyleSheet.create({
  body: { gap: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
