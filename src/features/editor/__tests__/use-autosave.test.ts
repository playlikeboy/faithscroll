import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { defaultIsEqual, useAutosave, type UseAutosaveOptions } from '../use-autosave';

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  getErrorMessage: (error: unknown) => (error instanceof Error ? error.message : 'Something went wrong'),
}));

interface HookProps {
  value: string;
  enabled?: boolean;
}

type AppStateHandler = (state: AppStateStatus) => void;

let appStateHandlers: AppStateHandler[] = [];

function setup(save: jest.Mock, initial: HookProps, options: UseAutosaveOptions<string> = {}) {
  return renderHook(
    ({ value, enabled }: HookProps) => useAutosave(value, save, { ...options, enabled }),
    { initialProps: initial },
  );
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  appStateHandlers = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    appStateHandlers.push(handler as AppStateHandler);
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('useAutosave', () => {
  test('starts idle and does not save the initial value', async () => {
    const save = jest.fn(async () => undefined);
    const hook = await setup(save, { value: 'hello' });

    await advance(2000);

    expect(save).not.toHaveBeenCalled();
    expect(hook.result.current.status).toBe('idle');
  });

  test('debounces changes and saves only the latest value', async () => {
    const save = jest.fn(async () => undefined);
    const hook = await setup(save, { value: 'a' });

    await hook.rerender({ value: 'ab' });
    await advance(500);
    await hook.rerender({ value: 'abc' });
    await advance(799);
    expect(save).not.toHaveBeenCalled();

    await advance(1);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('abc');
    expect(hook.result.current.status).toBe('saved');
  });

  test('respects a custom delay', async () => {
    const save = jest.fn(async () => undefined);
    const hook = await setup(save, { value: 'a' }, { delayMs: 200 });

    await hook.rerender({ value: 'b' });
    await advance(200);

    expect(save).toHaveBeenCalledWith('b');
  });

  test('never saves a value equal to the last saved one', async () => {
    const save = jest.fn(async () => undefined);
    const hook = await setup(save, { value: 'a' });

    await hook.rerender({ value: 'b' });
    await advance(800);
    await hook.rerender({ value: 'b' });
    await advance(800);
    await hook.rerender({ value: 'a2' });
    await hook.rerender({ value: 'b' });
    await advance(800);

    expect(save).toHaveBeenCalledTimes(1);
  });

  test('reverting to the saved value cancels the pending save', async () => {
    const save = jest.fn(async () => undefined);
    const hook = await setup(save, { value: 'a' });

    await hook.rerender({ value: 'ab' });
    await hook.rerender({ value: 'a' });
    await advance(1000);

    expect(save).not.toHaveBeenCalled();
  });

  test('reports saving while the save is in flight', async () => {
    let resolveSave: () => void = () => undefined;
    const save = jest.fn(() => new Promise<void>((resolve) => (resolveSave = resolve)));
    const hook = await setup(save, { value: 'a' });

    await hook.rerender({ value: 'b' });
    await advance(800);
    expect(hook.result.current.status).toBe('saving');

    await act(async () => resolveSave());
    expect(hook.result.current.status).toBe('saved');
  });

  test('surfaces errors and retries on the next change', async () => {
    const save = jest.fn().mockRejectedValueOnce(new Error('disk full')).mockResolvedValue(undefined);
    const hook = await setup(save, { value: 'a' });

    await hook.rerender({ value: 'b' });
    await advance(800);

    expect(hook.result.current.status).toBe('error');
    expect(hook.result.current.error?.message).toBe('disk full');
    const { logger } = jest.requireMock('@/lib/logger') as { logger: { error: jest.Mock } };
    expect(logger.error).toHaveBeenCalledWith('Autosave failed', expect.any(Error));

    await hook.rerender({ value: 'bc' });
    await advance(800);

    expect(save).toHaveBeenLastCalledWith('bc');
    expect(hook.result.current.status).toBe('saved');
    expect(hook.result.current.error).toBeNull();
  });

  test('wraps non-Error rejections', async () => {
    const save = jest.fn().mockRejectedValue('nope');
    const hook = await setup(save, { value: 'a' });

    await hook.rerender({ value: 'b' });
    let ok = true;
    await act(async () => {
      ok = await hook.result.current.flush();
    });

    expect(ok).toBe(false);
    expect(hook.result.current.error).toBeInstanceOf(Error);
  });

  test('flush saves immediately and cancels the timer', async () => {
    const save = jest.fn(async () => undefined);
    const hook = await setup(save, { value: 'a' });

    await hook.rerender({ value: 'b' });
    let ok = false;
    await act(async () => {
      ok = await hook.result.current.flush();
    });
    await advance(1000);

    expect(ok).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('b');
  });

  test('flush with nothing to save resolves true without saving', async () => {
    const save = jest.fn(async () => undefined);
    const hook = await setup(save, { value: 'a' });

    let ok = false;
    await act(async () => {
      ok = await hook.result.current.flush();
    });

    expect(ok).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });

  test('flushes pending changes on unmount', async () => {
    const save = jest.fn(async () => undefined);
    const hook = await setup(save, { value: 'a' });

    await hook.rerender({ value: 'unsaved' });
    await hook.unmount();
    await act(async () => undefined);

    expect(save).toHaveBeenCalledWith('unsaved');
  });

  test('flushes when the app goes to the background', async () => {
    const save = jest.fn(async () => undefined);
    const hook = await setup(save, { value: 'a' });

    await hook.rerender({ value: 'typed' });
    await act(async () => {
      appStateHandlers.forEach((handler) => handler('background'));
    });

    expect(save).toHaveBeenCalledWith('typed');
  });

  test('ignores the app becoming active', async () => {
    const save = jest.fn(async () => undefined);
    const hook = await setup(save, { value: 'a' });

    await hook.rerender({ value: 'typed' });
    await act(async () => {
      appStateHandlers.forEach((handler) => handler('active'));
    });

    expect(save).not.toHaveBeenCalled();
  });

  test('serialises overlapping saves in order', async () => {
    const resolvers: (() => void)[] = [];
    const save = jest.fn(() => new Promise<void>((resolve) => resolvers.push(resolve)));
    const hook = await setup(save, { value: 'a' });

    await hook.rerender({ value: 'b' });
    await advance(800);
    await hook.rerender({ value: 'c' });
    await advance(800);
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => resolvers[0]());
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith('c');

    await act(async () => resolvers[1]());
    expect(hook.result.current.status).toBe('saved');
  });

  test('does nothing while disabled and rebaselines when enabled', async () => {
    const save = jest.fn(async () => undefined);
    const hook = await setup(save, { value: '', enabled: false });

    await hook.rerender({ value: 'loaded from db', enabled: false });
    await advance(1000);
    await hook.rerender({ value: 'loaded from db', enabled: true });
    await advance(1000);
    expect(save).not.toHaveBeenCalled();

    await hook.rerender({ value: 'loaded from db!', enabled: true });
    await advance(800);
    expect(save).toHaveBeenCalledWith('loaded from db!');
  });

  test('uses the latest save callback', async () => {
    const first = jest.fn(async () => undefined);
    const second = jest.fn(async () => undefined);
    const hook = await renderHook(({ value, save }: { value: string; save: jest.Mock }) => useAutosave(value, save), {
      initialProps: { value: 'a', save: first },
    });

    await hook.rerender({ value: 'b', save: second });
    await advance(800);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('b');
  });
});

describe('defaultIsEqual', () => {
  test('compares primitives by identity and objects structurally', () => {
    expect(defaultIsEqual('a', 'a')).toBe(true);
    expect(defaultIsEqual('a', 'b')).toBe(false);
    expect(defaultIsEqual({ title: 'x', body: 'y' }, { title: 'x', body: 'y' })).toBe(true);
    expect(defaultIsEqual({ title: 'x' }, { title: 'z' })).toBe(false);
    expect(defaultIsEqual<unknown>(null, {})).toBe(false);
  });

  test('treats unserialisable objects as different', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(defaultIsEqual<unknown>(cyclic, { ...cyclic })).toBe(false);
  });
});
