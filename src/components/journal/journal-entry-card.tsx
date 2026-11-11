import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, Chip, FaithText, Icon } from '@/components/ui';
import type { JournalTimelineItem } from '@/features/journal/timeline';
import { JOURNAL_TYPE_ICONS, JOURNAL_TYPE_LABELS } from '@/features/journal/types';
import { useTheme } from '@/theme';

export interface JournalEntryCardProps {
  item: JournalTimelineItem;
  onPress: (id: string) => void;
}

const MAX_REFERENCE_CHIPS = 3;

function accessibilitySummary(item: JournalTimelineItem): string {
  const parts = [
    JOURNAL_TYPE_LABELS[item.entry.entryType],
    item.title ?? 'Untitled entry',
    item.excerpt,
    item.references.length > 0 ? `Passages: ${item.references.map((r) => r.referenceText).join(', ')}` : '',
    item.tags.length > 0 ? `Tags: ${item.tags.map((t) => t.name).join(', ')}` : '',
    item.linkCount > 0 ? `${item.linkCount} linked ${item.linkCount === 1 ? 'item' : 'items'}` : '',
  ];
  return parts.filter(Boolean).join('. ');
}

function JournalEntryCardBase({ item, onPress }: JournalEntryCardProps) {
  const { colors } = useTheme();
  const { entry, title, excerpt, references, tags, linkCount } = item;
  const extraReferences = references.length - MAX_REFERENCE_CHIPS;

  return (
    <Card onPress={() => onPress(entry.id)} accessibilityLabel={accessibilitySummary(item)} accessibilityHint="Opens the entry">
      <View style={styles.body}>
        <View style={styles.typeRow}>
          <Icon name={JOURNAL_TYPE_ICONS[entry.entryType]} size={14} color={colors.textSecondary} />
          <FaithText variant="label">{JOURNAL_TYPE_LABELS[entry.entryType]}</FaithText>
        </View>
        {title ? (
          <FaithText variant="title" numberOfLines={2}>
            {title}
          </FaithText>
        ) : null}
        {excerpt ? (
          <FaithText variant={title ? 'secondary' : 'bodySerif'} numberOfLines={3}>
            {excerpt}
          </FaithText>
        ) : !title ? (
          <FaithText variant="secondary">Untitled entry</FaithText>
        ) : null}
        {references.length > 0 ? (
          <View style={styles.chips}>
            {references.slice(0, MAX_REFERENCE_CHIPS).map((reference) => (
              <Chip key={reference.id} icon="bible" label={reference.referenceText} />
            ))}
            {extraReferences > 0 ? <FaithText variant="caption">+{extraReferences}</FaithText> : null}
          </View>
        ) : null}
        {tags.length > 0 || linkCount > 0 ? (
          <View style={styles.meta}>
            {tags.length > 0 ? (
              <FaithText variant="caption" numberOfLines={1} style={styles.tags}>
                {tags.map((tag) => `#${tag.name}`).join('  ')}
              </FaithText>
            ) : null}
            {linkCount > 0 ? (
              <View style={styles.linkCount}>
                <Icon name="related" size={12} color={colors.textSecondary} />
                <FaithText variant="caption">{linkCount}</FaithText>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

export const JournalEntryCard = memo(JournalEntryCardBase);

const styles = StyleSheet.create({
  body: { gap: 8 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tags: { flex: 1 },
  linkCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
