import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RecordingConsent, type RecordingGate } from '@/components/sermons/recording-consent';
import { EmptyState, FaithButton, LoadingState } from '@/components/ui';
import { RecorderScreen } from '@/features/recording/recorder-screen';
import { useMicrophonePermission, type MicPermissionState } from '@/features/recording/use-microphone-permission';
import { useSermon } from '@/features/sermons/hooks';
import { usePreferences } from '@/stores/preferences';
import { GUTTER, useTheme } from '@/theme';

function gateFor(hasConsent: boolean, permission: MicPermissionState): RecordingGate | 'checking' | null {
  if (!hasConsent) return 'consent';
  if (permission === 'granted') return null;
  return permission;
}

export default function RecordSermonScreen() {
  const params = useLocalSearchParams<{ id: string; then?: string }>();
  const sermonId = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const { colors } = useTheme();
  const sermon = useSermon(sermonId);
  const consentAt = usePreferences((state) => state.recordingConsentAt);
  const acknowledgeConsent = usePreferences((state) => state.acknowledgeRecordingConsent);
  const microphone = useMicrophonePermission();
  const gate = gateFor(consentAt !== null, microphone.state);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/sermons'));

  if (!sermon.data) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
        <EmptyState icon="sermons" title="This sermon isn't available" message="It may have been deleted." />
        <FaithButton label="Close" variant="secondary" onPress={close} style={styles.close} />
      </SafeAreaView>
    );
  }

  if (gate === 'checking') {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
        <LoadingState label="Checking microphone access" />
      </SafeAreaView>
    );
  }

  if (gate) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.gate}>
          <RecordingConsent
            gate={gate}
            onAcknowledge={() => {
              acknowledgeConsent();
              // The explanation above covers the microphone, so ask right away (only when the system still can).
              if (microphone.state === 'undetermined') void microphone.request();
            }}
            onAllowMicrophone={() => void microphone.request()}
            onOpenSettings={microphone.openSettings}
            onCancel={close}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return <RecorderScreen key={sermonId} sermonId={sermonId} title={sermon.data.title} returnToDetail={params.then === 'detail'} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  gate: { paddingHorizontal: GUTTER },
  close: { alignSelf: 'center' },
});
