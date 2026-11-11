/**
 * Cloud-processing disclosure (PRD §13): separate from the recording consent, shown before every
 * transcription. The first time it carries the full explanation; afterwards a short confirmation.
 */
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FaithButton, FaithText, Icon, type IconName } from '@/components/ui';
import { GUTTER, useTheme } from '@/theme';

export interface AiConsentSheetProps {
  visible: boolean;
  /** True until the user has acknowledged the disclosure once. */
  firstTime: boolean;
  partCount: number;
  durationLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function Point({ icon, text }: { icon: IconName; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.point}>
      <Icon name={icon} size={18} color={colors.primaryText} />
      <FaithText variant="body" style={styles.pointText}>
        {text}
      </FaithText>
    </View>
  );
}

export function AiConsentSheet({ visible, firstTime, partCount, durationLabel, onConfirm, onCancel }: AiConsentSheetProps) {
  const { colors } = useTheme();
  const parts = partCount === 1 ? 'this recording' : `these ${partCount} recording parts`;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <SafeAreaView edges={['bottom']} style={[styles.root, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.content}>
          <FaithText variant="title" accessibilityRole="header">
            Transcribe with cloud AI?
          </FaithText>
          <FaithText variant="secondary">
            {`To create a transcript, ${parts} (${durationLabel}) will be uploaded from this device.`}
          </FaithText>
          <View style={styles.points}>
            <Point icon="lock" text="Audio is stored privately in your account. Only you can access it." />
            <Point icon="sparkles" text="Our AI provider, OpenAI, processes the audio to write the transcript. It isn’t used to train AI models." />
            {firstTime ? (
              <>
                <Point icon="trash" text="You can delete the cloud copy at any time; otherwise it is deleted automatically after 30 days. Your recording stays on this device." />
                <Point icon="info" text="Please make sure you’re allowed to record and process this sermon (speaker consent and your church’s policy)." />
                <Point icon="warning" text="Transcripts can contain mistakes. You can correct any line." />
              </>
            ) : null}
          </View>
        </ScrollView>
        <View style={styles.actions}>
          <FaithButton label="Upload and transcribe" icon="cloud" onPress={onConfirm} fullWidth />
          <FaithButton label="Not now" variant="ghost" onPress={onCancel} fullWidth />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: GUTTER, paddingTop: 28, gap: 12 },
  points: { gap: 14, marginTop: 8 },
  point: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  pointText: { flex: 1 },
  actions: { paddingHorizontal: GUTTER, paddingVertical: 12, gap: 8 },
});
