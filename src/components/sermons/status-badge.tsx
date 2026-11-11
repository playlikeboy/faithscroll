import { StyleSheet, View } from 'react-native';

import { FaithText, Icon, type IconName } from '@/components/ui';
import type { AiStatus } from '@/features/sermons/types';
import { useTheme } from '@/theme';

/** Human wording for an AI job status; never colour alone (PRD §17 explicit states). */
export function aiStatusLabel(status: AiStatus): string {
  switch (status) {
    case 'completed':
      return 'Ready';
    case 'failed':
      return 'Needs attention';
    case 'pending':
    case 'uploading':
    case 'queued':
    case 'processing':
      return 'In progress';
  }
}

export interface StatusBadgeProps {
  icon: IconName;
  label: string;
  status: AiStatus;
}

/** Small pill such as "Transcript · Ready". */
export function StatusBadge({ icon, label, status }: StatusBadgeProps) {
  const { colors } = useTheme();
  const tone = status === 'failed' ? colors.danger : status === 'completed' ? colors.primaryText : colors.textSecondary;
  const text = `${label} · ${aiStatusLabel(status)}`;
  return (
    <View style={[styles.badge, { backgroundColor: colors.aiSurface }]} accessible accessibilityLabel={text}>
      <Icon name={icon} size={12} color={tone} />
      <FaithText variant="caption" style={{ color: tone }}>
        {text}
      </FaithText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
});
