import { fireEvent, render, screen } from '@testing-library/react-native';

import { AiConsentSheet } from '../ai-consent-sheet';
import { AiLabel } from '../ai-label';
import { ScriptureChips } from '../scripture-chips';
import { SegmentRow } from '../transcript/segment-row';
import { TranscriptionStatus, type TranscriptionStatusProps } from '../transcript/transcription-status';

jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

function statusProps(overrides: Partial<TranscriptionStatusProps> = {}): TranscriptionStatusProps {
  return {
    gate: 'ready',
    phase: { kind: 'idle' },
    partCount: 2,
    durationMs: 1_800_000,
    jobProgress: null,
    onTranscribe: jest.fn(),
    onCancelUpload: jest.fn(),
    onSignIn: jest.fn(),
    onPaywall: jest.fn(),
    ...overrides,
  };
}

describe('TranscriptionStatus', () => {
  test('idle: explains and offers to transcribe', async () => {
    const props = statusProps();
    await render(<TranscriptionStatus {...props} />);
    expect(screen.getByText('2 recording parts · 30:00')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Transcribe recording' }));
    expect(props.onTranscribe).toHaveBeenCalled();
  });

  test('gates: not configured, signed out, no recording', async () => {
    const signIn = statusProps({ gate: 'signed_out' });
    const { rerender } = await render(<TranscriptionStatus {...statusProps({ gate: 'not_configured' })} />);
    expect(screen.getByText('Cloud features aren’t set up')).toBeTruthy();

    await rerender(<TranscriptionStatus {...signIn} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(signIn.onSignIn).toHaveBeenCalled();

    await rerender(<TranscriptionStatus {...statusProps({ gate: 'no_recording' })} />);
    expect(screen.getByText('No recording yet')).toBeTruthy();
  });

  test('uploading: shows part progress and can cancel', async () => {
    const props = statusProps({ phase: { kind: 'uploading', upload: { phase: 'uploading', partIndex: 1, partCount: 3, fraction: 0.5 } } });
    await render(<TranscriptionStatus {...props} />);
    expect(screen.getByText('Uploading part 2 of 3')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Upload progress' }).props.accessibilityValue).toMatchObject({ now: 50 });
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel upload' }));
    expect(props.onCancelUpload).toHaveBeenCalled();
  });

  test('processing and interrupted states', async () => {
    const props = statusProps({ phase: { kind: 'interrupted' } });
    const { rerender } = await render(<TranscriptionStatus {...statusProps({ phase: { kind: 'processing' }, jobProgress: { done: 1, total: 4 } })} />);
    expect(screen.getByText('Transcribing…')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: '1 of 4 parts transcribed' })).toBeTruthy();

    await rerender(<TranscriptionStatus {...props} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Resume upload' }));
    expect(props.onTranscribe).toHaveBeenCalled();
  });

  test('failures show a clear message and the right next step', async () => {
    const offline = statusProps({ phase: { kind: 'failed', errorCode: 'offline' } });
    const { rerender } = await render(<TranscriptionStatus {...offline} />);
    expect(screen.getByText(/offline/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(offline.onTranscribe).toHaveBeenCalled();

    const quota = statusProps({ phase: { kind: 'failed', errorCode: 'quota_exceeded' } });
    await rerender(<TranscriptionStatus {...quota} />);
    await fireEvent.press(screen.getByRole('button', { name: 'See Faithscroll Plus' }));
    expect(quota.onPaywall).toHaveBeenCalled();
  });

  test('renders nothing once completed', async () => {
    await render(<TranscriptionStatus {...statusProps({ phase: { kind: 'completed' } })} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('SegmentRow', () => {
  test('tapping a line seeks to its start', async () => {
    const onSeek = jest.fn();
    await render(<SegmentRow id="s1" startMs={65_000} text="Turn to Romans 8." approximate={false} onSeek={onSeek} onSave={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Play from 01:05: Turn to Romans 8.' }));
    expect(onSeek).toHaveBeenCalledWith(65_000);
  });

  test('corrects a line inline', async () => {
    const onSave = jest.fn(async () => undefined);
    await render(<SegmentRow id="s1" startMs={0} text="Turn to Roman 8." approximate onSeek={jest.fn()} onSave={onSave} />);
    expect(screen.getByText('≈00:00')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Correct the line at 00:00' }));
    await fireEvent.changeText(screen.getByLabelText('Edit transcript line at 00:00'), 'Turn to Romans 8.');
    await fireEvent.press(screen.getByRole('button', { name: 'Save line' }));

    expect(onSave).toHaveBeenCalledWith('s1', 'Turn to Romans 8.');
  });

  test('shows an error when saving fails', async () => {
    const onSave = jest.fn(async () => Promise.reject(new Error('db')));
    await render(<SegmentRow id="s1" startMs={0} text="Hello" approximate={false} onSeek={jest.fn()} onSave={onSave} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Correct the line at 00:00' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save line' }));
    expect(await screen.findByText('This line couldn’t be saved. Please try again.')).toBeTruthy();
  });
});

describe('AiConsentSheet', () => {
  test('first time: full disclosure; confirm and cancel callbacks', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    await render(<AiConsentSheet visible firstTime partCount={2} durationLabel="30:00" onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByText(/these 2 recording parts \(30:00\)/)).toBeTruthy();
    expect(screen.getByText(/speaker consent/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Upload and transcribe' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    expect(onConfirm).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  test('later confirmations stay short', async () => {
    await render(<AiConsentSheet visible firstTime={false} partCount={1} durationLabel="10:00" onConfirm={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByText(/this recording \(10:00\)/)).toBeTruthy();
    expect(screen.queryByText(/speaker consent/)).toBeNull();
  });
});

describe('AiLabel / ScriptureChips', () => {
  test('label is announced and chips open passages', async () => {
    const onOpen = jest.fn();
    await render(
      <>
        <AiLabel text="AI-generated from your recording" />
        <ScriptureChips items={[{ key: 'a', referenceText: 'Romans 8:28', startVerseId: 45008028, positionMs: 61_000 }]} onOpen={onOpen} />
      </>,
    );
    expect(screen.getByLabelText('AI-generated from your recording')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Romans 8:28 · 01:01' }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ startVerseId: 45008028 }));
  });
});
