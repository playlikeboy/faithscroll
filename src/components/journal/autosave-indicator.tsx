import type { AutosaveStatus } from '@/features/editor/use-autosave';
import { FaithText } from '@/components/ui';

export interface AutosaveIndicatorProps {
  status: AutosaveStatus;
  /** False until the item exists (nothing to save yet). */
  hasSaved: boolean;
}

const LABELS: Record<AutosaveStatus, string> = {
  idle: 'Saved',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Not saved',
};

/** Quiet save status for the header; announced politely to screen readers. */
export function AutosaveIndicator({ status, hasSaved }: AutosaveIndicatorProps) {
  const label = !hasSaved && status !== 'error' ? 'Draft' : LABELS[status];
  return (
    <FaithText variant="caption" color={status === 'error' ? 'danger' : 'textSecondary'} accessibilityLiveRegion="polite">
      {label}
    </FaithText>
  );
}
