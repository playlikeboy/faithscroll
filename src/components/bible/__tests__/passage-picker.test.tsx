import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { PassagePicker } from '@/components/bible/passage-picker';
import { createPassageRequest } from '@/features/bible/reader/passage-requests';
import { parseReference } from '@/features/bible/reference';
import { idsToRange } from '@/features/bible/verse-id';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: jest.fn(() => true) },
  Stack: { Screen: () => null },
}));
jest.mock('@/features/bible/reference', () => ({ parseReference: jest.fn(() => null), formatReference: () => '' }));
jest.mock('@/features/bible/repository', () => ({
  ...jest.requireActual('@/features/bible/repository'),
  getVerseCount: jest.fn(() => 39),
}));

async function renderPicker(requestId: string, initial: ReturnType<typeof idsToRange> | null = null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(
    <QueryClientProvider client={client}>
      <PassagePicker requestId={requestId} initial={initial} />
    </QueryClientProvider>,
  );
}

describe('PassagePicker', () => {
  beforeEach(() => jest.clearAllMocks());

  test('book → chapter → start and end verse resolves the range', async () => {
    const { id, promise } = createPassageRequest();
    await renderPicker(id);

    await fireEvent.changeText(screen.getByLabelText('Find a book'), 'rom');
    await fireEvent.press(screen.getByRole('button', { name: 'Romans, 16 chapters' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Chapter 8' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Verse 28' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Verse 30' }));

    await expect(promise).resolves.toEqual(idsToRange(45_008_028, 45_008_030));
    expect(router.back).toHaveBeenCalled();
  });

  test('a typed reference can be used directly', async () => {
    const range = idsToRange(43_003_016);
    jest.mocked(parseReference).mockImplementation((text) => (text === 'John 3:16' ? range : null));
    const { id, promise } = createPassageRequest();
    await renderPicker(id);

    await fireEvent.changeText(screen.getByLabelText('Type a reference'), 'John 3:16');
    await fireEvent.press(screen.getByRole('button', { name: 'Use John 3:16' }));

    await expect(promise).resolves.toEqual(range);
  });

  test('shows a friendly error for an unreadable reference', async () => {
    const { id } = createPassageRequest();
    await renderPicker(id);

    await fireEvent.changeText(screen.getByLabelText('Type a reference'), 'nonsense');
    await fireEvent(screen.getByLabelText('Type a reference'), 'submitEditing');

    expect(screen.getByText(/couldn’t read that reference/)).toBeTruthy();
  });

  test('opens on the initial chapter and offers the whole chapter', async () => {
    const { id, promise } = createPassageRequest();
    await renderPicker(id, idsToRange(45_008_028));

    expect(screen.getByText('Romans 8')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Whole chapter' }));

    await expect(promise).resolves.toEqual(idsToRange(45_008_001, 45_008_039));
  });

  test('closing without choosing resolves with null', async () => {
    const { id, promise } = createPassageRequest();
    const { unmount } = await renderPicker(id);

    await unmount();

    await expect(promise).resolves.toBeNull();
  });
});
