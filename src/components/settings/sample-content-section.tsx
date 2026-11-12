import { Alert } from 'react-native';

import { FaithButton, FaithText, Section } from '@/components/ui';
import type { SampleContentStatus } from '@/features/seed/use-sample-content';

export interface SampleContentSectionProps {
  hasSamples: boolean;
  status: SampleContentStatus;
  isDisabled?: boolean;
  onRemove: () => void;
}

export function confirmRemoveSampleContent(onConfirmed: () => void): void {
  Alert.alert(
    'Remove sample content?',
    'This removes the example journal entries, prayers, sermon, highlights, saved verses and collection. Anything you created yourself stays.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove samples', style: 'destructive', onPress: onConfirmed },
    ],
  );
}

/** Settings → Your data: explains the example content added on first launch and removes it. */
export function SampleContentSection({ hasSamples, status, isDisabled = false, onRemove }: SampleContentSectionProps) {
  const finished = status.kind === 'done' || status.kind === 'error';
  if (!hasSamples && !finished) return null;

  return (
    <Section title="Sample content">
      {hasSamples ? (
        <>
          <FaithText variant="secondary">
            Faithscroll added a few example journal entries, prayers, a sermon and saved verses (tagged “Sample”) so you
            can see how everything connects. They stay on this device and are never uploaded.
          </FaithText>
          <FaithButton
            label="Remove sample content"
            icon="trash"
            variant="secondary"
            onPress={() => confirmRemoveSampleContent(onRemove)}
            isLoading={status.kind === 'working'}
            isDisabled={isDisabled || status.kind === 'working'}
          />
        </>
      ) : null}
      {finished ? (
        <FaithText
          variant="secondary"
          color={status.kind === 'error' ? 'danger' : 'textSecondary'}
          accessibilityLiveRegion="polite"
          accessibilityRole={status.kind === 'error' ? 'alert' : 'text'}>
          {status.message}
        </FaithText>
      ) : null}
    </Section>
  );
}
