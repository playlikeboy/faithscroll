/**
 * The seven recap sections (PRD §6.3G), each in an AI card, visually distinct from Scripture.
 * Presentational: all actions come in as callbacks.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, Chip, FaithButton, FaithText, IconButton } from '@/components/ui';
import { RECAP_SECTIONS, type RecapActionItem, type RecapSectionKey, type SermonRecap } from '@/features/recap/schema';

import { TimestampButton } from '../timestamp-button';

export interface RecapViewProps {
  recap: SermonRecap;
  /** Action items already created, by title. */
  actionIdsByTitle: Record<string, string>;
  onEdit: (key: RecapSectionKey) => void;
  onSeek: (positionMs: number) => void;
  onOpenReference: (startVerseId: number) => void;
  onAddAction: (item: RecapActionItem) => void;
  onReflect: (actionItemId: string) => void;
}

function Bullets({ items }: { items: readonly string[] }) {
  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <View key={`${index}-${item}`} style={styles.bulletRow}>
          <FaithText variant="body" accessibilityElementsHidden importantForAccessibility="no">
            •
          </FaithText>
          <FaithText variant="body" style={styles.flex}>
            {item}
          </FaithText>
        </View>
      ))}
    </View>
  );
}

function SectionBody({ sectionKey, props }: { sectionKey: RecapSectionKey; props: RecapViewProps }): ReactNode {
  const { recap, onSeek } = props;
  switch (sectionKey) {
    case 'summary':
      return <FaithText variant="body">{recap.summary}</FaithText>;
    case 'main_points':
      return recap.main_points.map((point, index) => (
        <View key={`${index}-${point.heading}`} style={styles.item}>
          <FaithText variant="heading">{`${index + 1}. ${point.heading}`}</FaithText>
          {point.description ? <FaithText variant="body">{point.description}</FaithText> : null}
          {point.timestamps.length > 0 ? (
            <View style={styles.wrap}>
              {point.timestamps.map((seconds) => (
                <TimestampButton key={seconds} seconds={seconds} onPress={onSeek} />
              ))}
            </View>
          ) : null}
        </View>
      ));
    case 'scripture_references':
      return recap.scripture_references.map((ref, index) => (
        <View key={`${index}-${ref.reference}`} style={styles.item}>
          <View style={styles.wrap}>
            {ref.startVerseId !== undefined ? (
              <Chip icon="bible" label={ref.reference} accessibilityHint="Opens this passage in the Bible" onPress={() => props.onOpenReference(ref.startVerseId as number)} />
            ) : (
              <Chip icon="bible" label={ref.reference} />
            )}
            {ref.timestamp !== null ? <TimestampButton seconds={ref.timestamp} onPress={onSeek} /> : null}
          </View>
          {ref.context ? <FaithText variant="secondary">{ref.context}</FaithText> : null}
        </View>
      ));
    case 'important_moments':
      return recap.important_moments.map((moment, index) => (
        <View key={`${index}-${moment.description}`} style={styles.momentRow}>
          {moment.timestamp !== null ? <TimestampButton seconds={moment.timestamp} onPress={onSeek} /> : null}
          <FaithText variant="body" style={styles.flex}>
            {moment.description}
          </FaithText>
        </View>
      ));
    case 'discussion_questions':
    case 'reflection_questions':
      return <Bullets items={recap[sectionKey]} />;
    case 'action_items':
      return recap.action_items.map((item, index) => {
        const actionId = props.actionIdsByTitle[item.title];
        return (
          <View key={`${index}-${item.title}`} style={styles.item}>
            <FaithText variant="heading">{item.title}</FaithText>
            {item.description ? <FaithText variant="secondary">{item.description}</FaithText> : null}
            <View style={styles.wrap}>
              {actionId ? (
                <>
                  <FaithButton label="Added to my actions" icon="check" variant="ghost" onPress={() => undefined} isDisabled />
                  <FaithButton label="Reflect in journal" icon="journal" variant="secondary" onPress={() => props.onReflect(actionId)} />
                </>
              ) : (
                <FaithButton label="Add to my actions" icon="action" variant="secondary" onPress={() => props.onAddAction(item)} />
              )}
            </View>
          </View>
        );
      });
  }
}

function isEmpty(recap: SermonRecap, key: RecapSectionKey): boolean {
  const value = recap[key];
  return Array.isArray(value) ? value.length === 0 : value.length === 0;
}

export function RecapView(props: RecapViewProps) {
  return (
    <View style={styles.sections}>
      {RECAP_SECTIONS.map(({ key, title }) => (
        <Card key={key} tone="ai" style={styles.card}>
          <View style={styles.sectionHeader}>
            <FaithText variant="title" accessibilityRole="header" style={styles.flex}>
              {title}
            </FaithText>
            <IconButton icon="edit" size={18} accessibilityLabel={`Edit ${title}`} onPress={() => props.onEdit(key)} />
          </View>
          {isEmpty(props.recap, key) ? (
            <FaithText variant="secondary">Nothing here. You can add your own with Edit.</FaithText>
          ) : (
            <SectionBody sectionKey={key} props={props} />
          )}
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sections: { gap: 14 },
  card: { gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  item: { gap: 6 },
  list: { gap: 8 },
  bulletRow: { flexDirection: 'row', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  momentRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
});
