import { renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';

import { resolvePassageRequest, usePassagePicker } from '@/features/bible/use-passage-picker';
import { idsToRange } from '@/features/bible/verse-id';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

function lastRequestId(): string {
  const href = String(jest.mocked(router.push).mock.calls.at(-1)?.[0]);
  return decodeURIComponent(/requestId=([^&]+)/.exec(href)?.[1] ?? '');
}

describe('usePassagePicker', () => {
  beforeEach(() => jest.clearAllMocks());

  test('opens the picker with a request id, title and initial range', async () => {
    const { result } = await renderHook(() => usePassagePicker());

    const pending = result.current({ title: 'Main passage', initial: idsToRange(40_018_021, 40_018_035) });

    const href = String(jest.mocked(router.push).mock.calls[0][0]);
    expect(href).toMatch(/^\/bible\/passage-picker\?requestId=passage-/);
    expect(href).toContain('title=Main%20passage');
    expect(href).toContain('start=40018021&end=40018035');

    resolvePassageRequest(lastRequestId(), idsToRange(40_018_021));
    await expect(pending).resolves.toEqual(idsToRange(40_018_021));
  });

  test('resolves null when the calling screen unmounts', async () => {
    const { result, unmount } = await renderHook(() => usePassagePicker());
    const pending = result.current();

    await unmount();

    await expect(pending).resolves.toBeNull();
  });

  test('resolves null when navigation fails', async () => {
    jest.mocked(router.push).mockImplementationOnce(() => {
      throw new Error('no navigator');
    });
    const { result } = await renderHook(() => usePassagePicker());

    await expect(result.current()).resolves.toBeNull();
  });
});
