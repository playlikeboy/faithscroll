import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { SermonListItem } from '@/features/sermons/types';

import { SermonCard } from '../sermon-card';
import { SermonForm } from '../sermon-form';

const sermon: SermonListItem = {
  id: 's1',
  title: 'The Power of Forgiveness',
  speaker: 'Pastor John',
  church: 'Grace Community Church',
  seriesId: 'series-1',
  seriesTitle: 'Living With Grace',
  sermonDate: '2026-11-08',
  mainPassage: 'Matthew 18:21–35',
  mainPassageStartVerseId: 40018021,
  mainPassageEndVerseId: 40018035,
  createdAt: '2026-11-08T10:00:00.000Z',
  totalDurationMs: 2_715_000,
  recordingCount: 2,
  bookmarkCount: 3,
  transcriptStatus: 'completed',
  recapStatus: 'processing',
};

describe('SermonCard', () => {
  test('shows editorial metadata, duration and AI badges in words', async () => {
    await render(<SermonCard sermon={sermon} onPress={jest.fn()} />);

    expect(screen.getByText('The Power of Forgiveness')).toBeTruthy();
    expect(screen.getByText('Pastor John · Grace Community Church · 8 Nov 2026')).toBeTruthy();
    expect(screen.getByText('Matthew 18:21–35')).toBeTruthy();
    expect(screen.getByText('45:15')).toBeTruthy();
    expect(screen.getByText('Transcript · Ready')).toBeTruthy();
    expect(screen.getByText('Recap · In progress')).toBeTruthy();
  });

  test('opens the sermon when pressed', async () => {
    const onPress = jest.fn();
    await render(<SermonCard sermon={sermon} onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: /The Power of Forgiveness/ }));

    expect(onPress).toHaveBeenCalledWith('s1');
  });
});

describe('SermonForm', () => {
  const defaults = {
    title: '',
    speaker: '',
    church: '',
    series: { kind: 'none' as const },
    sermonDate: '2026-11-08',
    mainPassage: null,
  };

  test('submits with every optional field blank and explains the default title', async () => {
    const onSubmit = jest.fn();
    await render(
      <SermonForm
        defaultValues={defaults}
        seriesOptions={[]}
        onPickPassage={async () => null}
        actions={[{ label: 'Save without recording', onSubmit }]}
      />,
    );

    expect(screen.getByText('Leave blank to use “Sermon · 8 Nov 2026”.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Save without recording' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining(defaults), undefined));
  });

  test('requires a name when creating a new series', async () => {
    const onSubmit = jest.fn();
    await render(
      <SermonForm
        defaultValues={defaults}
        seriesOptions={[{ id: 'a', title: 'Hope' }]}
        onPickPassage={async () => null}
        actions={[{ label: 'Save', onSubmit }]}
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'New series' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Name the new series')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('stores the passage chosen in the picker', async () => {
    const onSubmit = jest.fn();
    const passage = { text: 'Romans 8:28', startVerseId: 45008028, endVerseId: 45008028 };
    await render(
      <SermonForm
        defaultValues={defaults}
        seriesOptions={[{ id: 'a', title: 'Hope' }]}
        onPickPassage={async () => passage}
        actions={[{ label: 'Save', onSubmit }]}
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Hope' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add passage' }));
    expect(await screen.findByText('Romans 8:28')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ mainPassage: passage, series: { kind: 'existing', id: 'a' } }), undefined),
    );
  });
});
