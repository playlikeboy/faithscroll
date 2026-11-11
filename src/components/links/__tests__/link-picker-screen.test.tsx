import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';

import { db } from '@/db/client';
import { journalEntries, prayerEntries, sermons } from '@/db/schema';
import { isLinkRequestPending, type LinkTarget } from '@/features/links/link-picker-registry';
import { useLinkPicker } from '@/features/links/use-link-picker';

import { LinkPickerScreen } from '../link-picker-screen';

jest.mock('@/db/client', () => ({ db: jest.requireActual('@/db/testing/create-test-db').createTestDb() }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('@/features/bible/reference', () => ({ formatReference: jest.fn(() => '') }));
jest.mock('expo-sqlite', () => ({ addDatabaseChangeListener: () => ({ remove: () => undefined }) }));

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  Stack: { Screen: ({ options }: { options?: { headerLeft?: () => React.ReactNode } }) => options?.headerLeft?.() ?? null },
}));

jest.setTimeout(30_000);

beforeAll(() => {
  db.insert(sermons).values({ id: 's1', title: 'The Power of Forgiveness', speaker: 'Pastor John' }).run();
  db.insert(journalEntries).values({ id: 'j1', title: 'Seventy times seven', entryDate: '2026-11-09' }).run();
  db.insert(journalEntries).values({ id: 'j-self', title: 'This entry', entryDate: '2026-11-10' }).run();
  db.insert(prayerEntries).values({ id: 'p1', title: 'For my brother' }).run();
});

beforeEach(() => jest.clearAllMocks());

async function openPicker(): Promise<{ promise: Promise<LinkTarget | null>; params: Record<string, string> }> {
  const { result } = await renderHook(() => useLinkPicker());
  let promise: Promise<LinkTarget | null> = Promise.resolve(null);
  await act(async () => {
    promise = result.current({ exclude: { type: 'journal_entry', id: 'j-self' }, title: 'Link to…' });
  });
  const pushed = mockRouter.push.mock.calls[0]?.[0] as { pathname: string; params: Record<string, string> };
  expect(pushed.pathname).toBe('/links/picker');
  return { promise, params: pushed.params };
}

describe('LinkPickerScreen + useLinkPicker', () => {
  test('lists recent items by type, excluding the source, and resolves with the choice', async () => {
    const { promise, params } = await openPicker();

    await render(<LinkPickerScreen params={params} />);

    expect(screen.getByRole('header', { name: 'Sermons' })).toBeTruthy();
    expect(screen.getByText('Seventy times seven')).toBeTruthy();
    expect(screen.queryByText('This entry')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: /^For my brother/ }));

    await expect(promise).resolves.toEqual({ type: 'prayer_entry', id: 'p1', title: 'For my brother' });
    expect(mockRouter.back).toHaveBeenCalled();
    expect(isLinkRequestPending(params.requestId!)).toBe(false);
  });

  test('filters by search text', async () => {
    jest.useFakeTimers();
    const { params } = await openPicker();
    await render(<LinkPickerScreen params={params} />);

    await fireEvent.changeText(screen.getByLabelText('Search to link'), 'forgive');
    await act(async () => jest.advanceTimersByTime(500));

    expect(screen.getByText('The Power of Forgiveness')).toBeTruthy();
    expect(screen.queryByText('For my brother')).toBeNull();
    jest.useRealTimers();
  });

  test('resolves with null when cancelled or unmounted', async () => {
    const { promise, params } = await openPicker();
    const { unmount } = await render(<LinkPickerScreen params={params} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockRouter.back).toHaveBeenCalled();
    await unmount();

    await expect(promise).resolves.toBeNull();
  });

  test('shows a calm error for a malformed request', async () => {
    await render(<LinkPickerScreen params={{}} />);
    expect(screen.getByText('Nothing to link')).toBeTruthy();
  });
});
