// PLACEHOLDER — owned by the today agent (onboarding flow); replace this screen entirely.
import { FaithButton, FaithText, Screen } from '@/components/ui';
import { usePreferences } from '@/stores/preferences';

export default function OnboardingScreen() {
  const completeOnboarding = usePreferences((s) => s.completeOnboarding);
  return (
    <Screen title="Faithscroll" edges={['top', 'bottom']}>
      <FaithText variant="bodySerif">Read deeply. Listen carefully. Reflect meaningfully.</FaithText>
      <FaithButton label="Continue" onPress={completeOnboarding} style={{ marginTop: 32 }} />
    </Screen>
  );
}
