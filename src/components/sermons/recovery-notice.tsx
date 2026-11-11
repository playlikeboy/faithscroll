import { StyleSheet, View } from 'react-native';

import { Card, FaithButton, FaithText, IconButton } from '@/components/ui';
import type { RecoveryNoticeData } from '@/features/recording/recovery-notice';

export interface RecoveryNoticeProps {
  notice: RecoveryNoticeData;
  onDismiss: () => void;
  onOpenSermon?: (sermonId: string) => void;
}

/** Gentle notice shown after the app recovered (or could not recover) an interrupted recording. */
export function RecoveryNotice({ notice, onDismiss, onOpenSermon }: RecoveryNoticeProps) {
  return (
    <Card tone="muted">
      <View style={styles.header} accessibilityLiveRegion="polite">
        <FaithText variant="heading" style={styles.title}>
          {notice.title}
        </FaithText>
        <IconButton icon="close" accessibilityLabel="Dismiss notice" onPress={onDismiss} size={18} />
      </View>
      <FaithText variant="secondary">{notice.message}</FaithText>
      {notice.sermonId && onOpenSermon ? (
        <FaithButton
          label="Open sermon"
          variant="ghost"
          onPress={() => {
            onDismiss();
            onOpenSermon(notice.sermonId as string);
          }}
          style={styles.action}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1 },
  action: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 0 },
});
