import { fireEvent, render, screen } from '@testing-library/react-native';

import { recoveryNoticeFor } from '@/features/recording/recovery-notice';

import { RecordingConsent } from '../recording-consent';
import { RecordingControls } from '../recording-controls';
import { RecordingIndicator } from '../recording-indicator';
import { RecoveryNotice } from '../recovery-notice';

function controls(overrides: Partial<Parameters<typeof RecordingControls>[0]> = {}) {
  const props = {
    phase: 'recording' as const,
    canBookmark: true,
    onPause: jest.fn(),
    onResume: jest.fn(),
    onBookmark: jest.fn(),
    onStop: jest.fn(),
    ...overrides,
  };
  return props;
}

describe('RecordingControls', () => {
  test('while recording: bookmark, pause and stop are available by name', async () => {
    const props = controls();
    await render(<RecordingControls {...props} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Bookmark this moment' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Stop & Save' }));

    expect(props.onBookmark).toHaveBeenCalled();
    expect(props.onPause).toHaveBeenCalled();
    expect(props.onStop).toHaveBeenCalled();
    expect(props.onResume).not.toHaveBeenCalled();
  });

  test('while paused or interrupted the main control resumes', async () => {
    const props = controls({ phase: 'interrupted' });
    await render(<RecordingControls {...props} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Resume' }));

    expect(props.onResume).toHaveBeenCalled();
  });

  test('bookmark is disabled until there is audio', async () => {
    const props = controls({ canBookmark: false });
    await render(<RecordingControls {...props} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Bookmark this moment' }));

    expect(props.onBookmark).not.toHaveBeenCalled();
  });
});

describe('RecordingIndicator', () => {
  test('announces the state in words, not colour alone', async () => {
    await render(<RecordingIndicator state="recording" />);
    expect(screen.getByLabelText('Recording')).toBeTruthy();
  });
});

describe('RecordingConsent', () => {
  const handlers = () => ({ onAcknowledge: jest.fn(), onAllowMicrophone: jest.fn(), onOpenSettings: jest.fn(), onCancel: jest.fn() });

  test('explains recording responsibilities before the first recording', async () => {
    const props = handlers();
    await render(<RecordingConsent gate="consent" {...props} />);

    expect(screen.getByText(/recording laws/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'I understand' }));
    expect(props.onAcknowledge).toHaveBeenCalled();
  });

  test('offers Settings when microphone access is blocked', async () => {
    const props = handlers();
    await render(<RecordingConsent gate="blocked" {...props} />);

    expect(screen.queryByRole('button', { name: 'Allow microphone' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Open Settings' }));
    expect(props.onOpenSettings).toHaveBeenCalled();
  });
});

describe('recovery notice', () => {
  test('describes recovered and lost recordings gently', () => {
    expect(recoveryNoticeFor(null)).toBeNull();
    expect(recoveryNoticeFor({ recovered: 0, failed: 0, sermonIds: [] })).toBeNull();
    expect(recoveryNoticeFor({ recovered: 1, failed: 0, sermonIds: ['s1'] })).toMatchObject({ kind: 'recovered', sermonId: 's1' });
    expect(recoveryNoticeFor({ recovered: 0, failed: 2, sermonIds: ['a', 'b'] })).toMatchObject({ kind: 'lost', sermonId: null });
  });

  test('opens the affected sermon and dismisses itself', async () => {
    const onDismiss = jest.fn();
    const onOpenSermon = jest.fn();
    const notice = recoveryNoticeFor({ recovered: 1, failed: 0, sermonIds: ['s1'] });
    if (!notice) throw new Error('expected a notice');
    await render(<RecoveryNotice notice={notice} onDismiss={onDismiss} onOpenSermon={onOpenSermon} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Open sermon' }));

    expect(onDismiss).toHaveBeenCalled();
    expect(onOpenSermon).toHaveBeenCalledWith('s1');
  });
});
