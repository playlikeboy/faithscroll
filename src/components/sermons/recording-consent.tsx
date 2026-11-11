import { StyleSheet, View } from 'react-native';

import { Card, FaithButton, FaithText, Icon } from '@/components/ui';
import { useTheme } from '@/theme';

export type RecordingGate = 'consent' | 'undetermined' | 'denied' | 'blocked';

export interface RecordingConsentProps {
  gate: RecordingGate;
  onAcknowledge: () => void;
  onAllowMicrophone: () => void;
  onOpenSettings: () => void;
  onCancel: () => void;
}

const POINTS = [
  'The microphone records the audio around you while recording is on — a red indicator always shows it.',
  'Recordings stay on this device. Nothing is uploaded unless you later choose to transcribe.',
  'You are responsible for following recording laws, getting the speaker’s consent where needed and respecting your church’s policies.',
];

function ConsentPoints() {
  const { colors } = useTheme();
  return (
    <View style={styles.points}>
      {POINTS.map((point) => (
        <View key={point} style={styles.point}>
          <Icon name="check" size={16} color={colors.primaryText} />
          <FaithText variant="body" style={styles.pointText}>
            {point}
          </FaithText>
        </View>
      ))}
    </View>
  );
}

/** Explains recording before the first use (PRD §13.2) and handles microphone permission. */
export function RecordingConsent({ gate, onAcknowledge, onAllowMicrophone, onOpenSettings, onCancel }: RecordingConsentProps) {
  const { colors } = useTheme();

  if (gate === 'consent') {
    return (
      <View style={styles.container}>
        <Icon name="sermons" size={36} color={colors.primaryText} />
        <FaithText variant="display" accessibilityRole="header">
          Before you record
        </FaithText>
        <Card tone="muted">
          <ConsentPoints />
        </Card>
        <FaithButton label="I understand" icon="check" onPress={onAcknowledge} fullWidth />
        <FaithButton label="Not now" variant="ghost" onPress={onCancel} fullWidth />
      </View>
    );
  }

  const isBlocked = gate === 'blocked';
  return (
    <View style={styles.container}>
      <Icon name="sermons" size={36} color={colors.primaryText} />
      <FaithText variant="display" accessibilityRole="header">
        Microphone access
      </FaithText>
      <FaithText variant="body">
        {isBlocked
          ? 'Microphone access is turned off for Faithscroll. You can turn it on in Settings, then come back here.'
          : 'Faithscroll needs the microphone to record this sermon. It is only used while you are recording.'}
      </FaithText>
      {gate === 'undetermined' ? <FaithButton label="Allow microphone" icon="sermons" onPress={onAllowMicrophone} fullWidth /> : null}
      {gate === 'denied' ? <FaithButton label="Try again" icon="sermons" onPress={onAllowMicrophone} fullWidth /> : null}
      {gate !== 'undetermined' ? (
        <FaithButton label="Open Settings" icon="settings" variant={isBlocked ? 'primary' : 'secondary'} onPress={onOpenSettings} fullWidth />
      ) : null}
      <FaithButton label="Not now" variant="ghost" onPress={onCancel} fullWidth />
      <FaithText variant="caption">You can still take notes for this sermon without recording.</FaithText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 18, paddingVertical: 24 },
  points: { gap: 14 },
  point: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  pointText: { flex: 1 },
});
