import { act, renderHook } from '@testing-library/react-native';

import { useLiveData } from '../use-live-data';

type Listener = (event: { tableName: string }) => void;
const mockListeners = new Set<Listener>();

jest.mock('expo-sqlite', () => ({
  addDatabaseChangeListener: (listener: Listener) => {
    mockListeners.add(listener);
    return { remove: () => mockListeners.delete(listener) };
  },
}));

function emit(tableName: string) {
  for (const listener of mockListeners) listener({ tableName });
}

describe('useLiveData', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockListeners.clear();
  });
  afterEach(() => jest.useRealTimers());

  test('loads immediately and reloads when a watched table changes', async () => {
    let value = 1;
    const load = jest.fn(() => value);
    const { result } = await renderHook(() => useLiveData(load, ['journal_entries', 'tags'], 'k'));

    expect(result.current.data).toBe(1);

    value = 2;
    await act(async () => {
      emit('tags');
      emit('journal_entries');
      jest.runAllTimers();
    });

    expect(result.current.data).toBe(2);
    expect(load).toHaveBeenCalledTimes(2);
  });

  test('ignores unrelated tables', async () => {
    const load = jest.fn(() => 'x');
    await renderHook(() => useLiveData(load, ['journal_entries'], 'k'));

    await act(async () => {
      emit('sermons');
      jest.runAllTimers();
    });

    expect(load).toHaveBeenCalledTimes(1);
  });

  test('reloads when the key changes and keeps last data on error', async () => {
    let shouldFail = false;
    const load = jest.fn((n: number) => {
      if (shouldFail) throw new Error('db closed');
      return n * 10;
    });
    const { result, rerender } = await renderHook(({ n }: { n: number }) => useLiveData(() => load(n), ['t'], String(n)), {
      initialProps: { n: 1 },
    });
    expect(result.current.data).toBe(10);

    await rerender({ n: 2 });
    expect(result.current.data).toBe(20);

    shouldFail = true;
    await act(async () => result.current.reload());
    expect(result.current.error?.message).toBe('db closed');
    expect(result.current.data).toBe(20);
  });

  test('unsubscribes on unmount', async () => {
    const { unmount } = await renderHook(() => useLiveData(() => 1, ['t'], 'k'));
    expect(mockListeners.size).toBe(1);
    await unmount();
    expect(mockListeners.size).toBe(0);
  });
});
