import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { FaithButton } from './button';
import { Icon, type IconName } from './icon';
import { FaithText } from './text';

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.container} accessible accessibilityLabel={[title, message].filter(Boolean).join('. ')}>
      {icon ? <Icon name={icon} size={32} color={colors.textTertiary} /> : null}
      <FaithText variant="title" align="center">
        {title}
      </FaithText>
      {message ? (
        <FaithText variant="secondary" align="center" style={styles.message}>
          {message}
        </FaithText>
      ) : null}
      {actionLabel && onAction ? <FaithButton label={actionLabel} onPress={onAction} variant="secondary" /> : null}
    </View>
  );
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.container} accessible accessibilityLabel={label} accessibilityRole="progressbar">
      <ActivityIndicator color={colors.primaryText} />
    </View>
  );
}

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: ErrorStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      <Icon name="warning" size={28} color={colors.danger} />
      <FaithText variant="heading" align="center">
        {title}
      </FaithText>
      <FaithText variant="secondary" align="center" style={styles.message}>
        {message}
      </FaithText>
      {onRetry ? <FaithButton label="Try again" onPress={onRetry} variant="secondary" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 12 },
  message: { maxWidth: 320 },
});
