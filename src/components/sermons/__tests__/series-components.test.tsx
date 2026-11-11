import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { SermonListItem } from '@/features/sermons/types';

import { SeriesForm } from '../series-form';
import { SeriesTimeline } from '../series-timeline';

const base: Omit<SermonListItem, 'id' | 'title' | 'sermonDate'> = {
  speaker: 'Pastor John',
  church: null,
  seriesId: 's',
  seriesTitle: 'Living With Grace',
  mainPassage: null,
  mainPassageStartVerseId: null,
  mainPassageEndVerseId: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  totalDurationMs: 0,
  recordingCount: 0,
  bookmarkCount: 0,
  transcriptStatus: null,
  recapStatus: null,
};

describe('SeriesTimeline', () => {
  test('lists sermons in order with dates and opens one when tapped', async () => {
    const onOpen = jest.fn();
    const sermons = [
      { ...base, id: 'a', title: 'Grace Received', sermonDate: '2026-11-01', mainPassage: 'Ephesians 2:1–10' },
      { ...base, id: 'b', title: 'The Power of Forgiveness', sermonDate: '2026-11-08' },
    ];
    await render(<SeriesTimeline sermons={sermons} onOpenSermon={onOpen} />);

    expect(screen.getByText('1 Nov 2026')).toBeTruthy();
    expect(screen.getByText('Pastor John · Ephesians 2:1–10')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /Week 2, The Power of Forgiveness, 8 Nov 2026/ }));

    expect(onOpen).toHaveBeenCalledWith('b');
  });

  test('explains how to add sermons when the series is empty', async () => {
    await render(<SeriesTimeline sermons={[]} onOpenSermon={jest.fn()} />);
    expect(screen.getByText(/No sermons in this series yet/)).toBeTruthy();
  });
});

describe('SeriesForm', () => {
  test('requires a name and submits trimmed values', async () => {
    const onSubmit = jest.fn();
    await render(<SeriesForm defaultValues={{ title: '', description: '', speaker: '', church: '' }} submitLabel="Create series" onSubmit={onSubmit} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Create series' }));
    expect(await screen.findByText('Give the series a name')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Series name'), '  Living With Grace ');
    await fireEvent.press(screen.getByRole('button', { name: 'Create series' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: 'Living With Grace' }), undefined));
  });
});
