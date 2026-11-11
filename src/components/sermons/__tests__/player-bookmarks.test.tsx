import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { AudioPlayer } from '../audio-player';
import { BookmarkList } from '../bookmark-list';

// Gestures are exercised on device; here the detector is a pass-through so the controls render.
jest.mock('react-native-gesture-handler', () => ({
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  usePanGesture: () => ({}),
  useTapGesture: () => ({}),
  useCompetingGestures: () => ({}),
}));

function playerProps(overrides: Partial<Parameters<typeof AudioPlayer>[0]> = {}) {
  return {
    positionMs: 754_000,
    totalMs: 2_715_000,
    isPlaying: false,
    rate: 1,
    onTogglePlay: jest.fn(),
    onSkip: jest.fn(),
    onSeek: jest.fn(),
    onCycleRate: jest.fn(),
    ...overrides,
  };
}

describe('AudioPlayer', () => {
  test('shows current time and duration in tabular form', async () => {
    await render(<AudioPlayer {...playerProps({ partLabel: 'Part 2 of 3' })} />);

    expect(screen.getByText('12:34')).toBeTruthy();
    expect(screen.getByText('45:15')).toBeTruthy();
    expect(screen.getByText('Part 2 of 3')).toBeTruthy();
  });

  test('play/pause, skip and speed controls call back with the right values', async () => {
    const props = playerProps();
    await render(<AudioPlayer {...props} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Play' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Back 15 seconds' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Forward 15 seconds' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Playback speed 1×' }));

    expect(props.onTogglePlay).toHaveBeenCalledTimes(1);
    expect((props.onSkip as jest.Mock).mock.calls).toEqual([[-15_000], [15_000]]);
    expect(props.onCycleRate).toHaveBeenCalled();
  });

  test('labels the main control Pause while playing and shows the speed', async () => {
    await render(<AudioPlayer {...playerProps({ isPlaying: true, rate: 1.5 })} />);

    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    expect(screen.getByText('1.5×')).toBeTruthy();
  });

  test('the seek bar is adjustable by screen readers in 15-second steps', async () => {
    const props = playerProps();
    await render(<AudioPlayer {...props} />);
    const seekBar = screen.getByRole('adjustable', { name: 'Playback position' });

    await fireEvent(seekBar, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    await fireEvent(seekBar, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });

    expect((props.onSeek as jest.Mock).mock.calls).toEqual([[769_000], [739_000]]);
    expect(seekBar.props.accessibilityValue).toMatchObject({ min: 0, max: 2715, now: 754 });
  });
});

describe('BookmarkList', () => {
  const bookmarks = [
    { id: 'b1', positionMs: 65_000, note: 'Seventy times seven', reference: 'Matthew 18:22' },
    { id: 'b2', positionMs: null, note: null, reference: null },
  ];

  test('plays from a bookmark when tapped', async () => {
    const onPlay = jest.fn();
    await render(<BookmarkList bookmarks={bookmarks} onPlay={onPlay} onDelete={jest.fn()} />);

    expect(screen.getByText('01:05')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /Seventy times seven, Matthew 18:22, at 1 minute 5 seconds/ }));

    expect(onPlay).toHaveBeenCalledWith(65_000);
  });

  test('bookmarks whose audio is gone cannot be played', async () => {
    const onPlay = jest.fn();
    await render(<BookmarkList bookmarks={bookmarks} onPlay={onPlay} onDelete={jest.fn()} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Bookmark' }));

    expect(onPlay).not.toHaveBeenCalled();
  });

  test('asks before deleting a bookmark', async () => {
    const onDelete = jest.fn();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.style === 'destructive')?.onPress?.();
    });
    await render(<BookmarkList bookmarks={bookmarks} onPlay={jest.fn()} onDelete={onDelete} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Delete bookmark at 01:05' }));

    expect(alert).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalledWith('b1');
    alert.mockRestore();
  });

  test('explains bookmarks when there are none', async () => {
    await render(<BookmarkList bookmarks={[]} onPlay={jest.fn()} onDelete={jest.fn()} />);
    expect(screen.getByText(/Tap Bookmark while recording/)).toBeTruthy();
  });
});
