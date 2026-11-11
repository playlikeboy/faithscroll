import { fireEvent, render, screen } from '@testing-library/react-native';

import type { FoundReference } from '@/features/bible/types';

import { NoteRenderer } from '../note-renderer';

jest.mock('@/features/bible/reference', () => ({
  findReferences: (text: string): FoundReference[] =>
    [...text.matchAll(/\bRomans (\d+):(\d+)/g)].map((match) => {
      const ref = { bookId: 45, chapter: Number(match[1]), verse: Number(match[2]) };
      return { range: { start: ref, end: ref }, text: match[0], index: match.index, length: match[0].length };
    }),
  formatReference: () => 'Romans 8:28',
}));

const NOTE = [
  '# Living With Grace',
  '',
  'Pastor said **forgive** at [04:32] and read Romans 8:28.',
  '',
  '- ==first== point',
  '- second point',
  '',
  '3. third',
  '4. fourth',
].join('\n');

describe('NoteRenderer', () => {
  test('renders nothing for empty content', async () => {
    await render(<NoteRenderer content="" testID="note" />);
    expect(screen.queryByTestId('note')).toBeNull();
  });

  test('renders headings as headers and list markers', async () => {
    await render(<NoteRenderer content={NOTE} />);

    expect(screen.getByRole('header', { name: 'Living With Grace' })).toBeTruthy();
    expect(screen.getAllByLabelText('Bullet')).toHaveLength(2);
    expect(screen.getByText('3.')).toBeTruthy();
    expect(screen.getByText('4.')).toBeTruthy();
    expect(screen.getByText('first')).toBeTruthy();
  });

  test('plays from a timestamp when it is tapped', async () => {
    const onPressTimestamp = jest.fn();
    await render(<NoteRenderer content={NOTE} onPressTimestamp={onPressTimestamp} />);

    await fireEvent.press(screen.getByRole('link', { name: 'Play from 4 minutes 32 seconds' }));

    expect(onPressTimestamp).toHaveBeenCalledWith(272_000);
  });

  test('opens a Scripture reference when it is tapped', async () => {
    const onPressReference = jest.fn();
    await render(<NoteRenderer content={NOTE} onPressReference={onPressReference} />);

    await fireEvent.press(screen.getByRole('link', { name: 'Open Romans 8:28' }));

    expect(onPressReference).toHaveBeenCalledWith({
      start: { bookId: 45, chapter: 8, verse: 28 },
      end: { bookId: 45, chapter: 8, verse: 28 },
    });
  });

  test('tokens are plain text when no handlers are given', async () => {
    await render(<NoteRenderer content={NOTE} />);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  test('blocks without tappable tokens stay selectable', async () => {
    await render(<NoteRenderer content={'plain text\n\nat [00:05]'} onPressTimestamp={jest.fn()} />);

    expect(screen.getByText('plain text').props.selectable).toBe(true);
    const link = screen.getByRole('link', { name: 'Play from 5 seconds' });
    expect(link.parent?.parent?.props.selectable ?? false).toBe(false);
  });

  test('can turn selection off', async () => {
    await render(<NoteRenderer content="plain text" selectable={false} />);
    expect(screen.getByText('plain text').props.selectable).toBe(false);
  });
});
