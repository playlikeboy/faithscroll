import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FaithText, Icon } from '@/components/ui';
import type { StudySource } from '@/features/study-ai/schema';
import { MIN_TOUCH_TARGET, useTheme } from '@/theme';

import { KindBadge, type KindValue } from './kind-badge';

const SOURCE_LABELS: Record<StudySource['type'], string> = {
  passage: 'The passage',
  scripture: 'Scripture',
  lexical_data: 'Lexical data',
  historical_scholarship: 'Historical scholarship',
  tradition: 'Christian tradition',
};

export function SourcesLine({ sources }: { sources: readonly StudySource[] }) {
  if (sources.length === 0) return null;
  const text = sources
    .map((source) => {
      const detail = source.reference ?? source.label;
      return detail && detail !== SOURCE_LABELS[source.type] ? `${SOURCE_LABELS[source.type]}: ${detail}` : SOURCE_LABELS[source.type];
    })
    .join(' · ');
  return <FaithText variant="caption">{`Sources — ${text}`}</FaithText>;
}

export interface StudySectionProps {
  title: string;
  kind: KindValue | null;
  sources: readonly StudySource[];
  initiallyExpanded?: boolean;
  children: ReactNode;
}

/** Collapsible editorial section with its kind (text vs interpretation) and sources. */
export function StudySection({ title, kind, sources, initiallyExpanded = false, children }: StudySectionProps) {
  const { colors } = useTheme();
  const [isExpanded, setExpanded] = useState(initiallyExpanded);
  return (
    <View style={[styles.section, { borderBottomColor: colors.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: isExpanded }}
        onPress={() => setExpanded((value) => !value)}
        style={styles.header}>
        <FaithText variant="title" style={styles.title}>
          {title}
        </FaithText>
        <Icon name={isExpanded ? 'down' : 'forward'} size={14} color={colors.textTertiary} />
      </Pressable>
      {isExpanded ? (
        <View style={styles.body}>
          {kind ? <KindBadge kind={kind} /> : null}
          {children}
          <SourcesLine sources={sources} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: MIN_TOUCH_TARGET },
  title: { flex: 1 },
  body: { gap: 10, paddingBottom: 14 },
});
