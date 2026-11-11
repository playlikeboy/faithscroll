import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { useReduceMotion, useScreenReaderEnabled } from '@/features/bible/hooks/use-accessibility-settings';

type Listener = (value: boolean) => void;

describe('accessibility setting hooks', () => {
  const listeners = new Map<string, Listener>();
  const remove = jest.fn();

  beforeEach(() => {
    listeners.clear();
    remove.mockClear();
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((event: string, listener: Listener) => {
      listeners.set(event, listener);
      return { remove };
    }) as unknown as typeof AccessibilityInfo.addEventListener);
  });

  test('reads the screen reader state and follows changes', async () => {
    const { result, unmount } = await renderHook(() => useScreenReaderEnabled());
    await act(async () => undefined);
    expect(result.current).toBe(true);

    await act(async () => listeners.get('screenReaderChanged')?.(false));
    expect(result.current).toBe(false);

    await unmount();
    expect(remove).toHaveBeenCalled();
  });

  test('reads reduce motion', async () => {
    const { result } = await renderHook(() => useReduceMotion());
    await act(async () => listeners.get('reduceMotionChanged')?.(true));
    expect(result.current).toBe(true);
  });
});
