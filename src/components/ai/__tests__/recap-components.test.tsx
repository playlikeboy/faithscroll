import { fireEvent, render, screen } from '@testing-library/react-native';

import { RecapSectionEditor } from '../recap/recap-section-editor';
import { RecapView, type RecapViewProps } from '../recap/recap-view';
import { emptyRecap, parseRecapOutput, type SermonRecap } from '@/features/recap/schema';
import { recapFixture } from '@/features/study-ai/testing/fixtures';

jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

function recap(): SermonRecap {
  const parsed = parseRecapOutput(recapFixture());
  if (!parsed.success) throw new Error(parsed.error);
  return {
    ...parsed.data,
    scripture_references: [{ ...parsed.data.scripture_references[0], startVerseId: 40018021, endVerseId: 40018022 }],
  };
}

function viewProps(overrides: Partial<RecapViewProps> = {}): RecapViewProps {
  return {
    recap: recap(),
    actionIdsByTitle: {},
    onEdit: jest.fn(),
    onSeek: jest.fn(),
    onOpenReference: jest.fn(),
    onAddAction: jest.fn(),
    onReflect: jest.fn(),
    ...overrides,
  };
}

describe('RecapView', () => {
  test('renders all seven sections with headers', async () => {
    await render(<RecapView {...viewProps()} />);
    for (const title of ['Summary', 'Main points', 'Scripture mentioned', 'Important moments', 'Discussion questions', 'Live It Out', 'Personal reflection']) {
      expect(screen.getByRole('header', { name: title })).toBeTruthy();
    }
  });

  test('timestamps seek, references open the Bible, sections can be edited', async () => {
    const props = viewProps();
    await render(<RecapView {...props} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Play from 06:50' }));
    expect(props.onSeek).toHaveBeenCalledWith(410_000);

    await fireEvent.press(screen.getByRole('button', { name: 'Matthew 18:21-22' }));
    expect(props.onOpenReference).toHaveBeenCalledWith(40018021);

    await fireEvent.press(screen.getByRole('button', { name: 'Edit Live It Out' }));
    expect(props.onEdit).toHaveBeenCalledWith('action_items');
  });

  test('Live It Out: add an action, then reflect on it in the journal', async () => {
    const add = viewProps();
    const { rerender } = await render(<RecapView {...add} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add to my actions' }));
    expect(add.onAddAction).toHaveBeenCalledWith({ title: 'Write down one name to pray for', description: null });

    const added = viewProps({ actionIdsByTitle: { 'Write down one name to pray for': 'action-1' } });
    await rerender(<RecapView {...added} />);
    expect(screen.getByRole('button', { name: 'Added to my actions' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Reflect in journal' }));
    expect(added.onReflect).toHaveBeenCalledWith('action-1');
  });

  test('empty sections invite the user to add their own', async () => {
    await render(<RecapView {...viewProps({ recap: { ...emptyRecap(), summary: 'Only a summary' } })} />);
    expect(screen.getAllByText('Nothing here. You can add your own with Edit.')).toHaveLength(6);
  });
});

describe('RecapSectionEditor', () => {
  test('edits, adds and removes questions, then saves a new recap', async () => {
    const onSave = jest.fn();
    const original = recap();
    await render(<RecapSectionEditor sectionKey="discussion_questions" recap={original} onSave={onSave} onClose={jest.fn()} />);

    await fireEvent.changeText(screen.getByLabelText('Question 1'), 'Who do I need to forgive?');
    await fireEvent.press(screen.getByRole('button', { name: 'Add a question' }));
    await fireEvent.changeText(screen.getByLabelText('Question 2'), 'What stops me?');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith({ ...original, discussion_questions: ['Who do I need to forgive?', 'What stops me?'] });
  });

  test('Scripture references can only be removed', async () => {
    const onSave = jest.fn();
    await render(<RecapSectionEditor sectionKey="scripture_references" recap={recap()} onSave={onSave} onClose={jest.fn()} />);
    expect(screen.queryByRole('button', { name: /^Add/ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Remove item 1' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onSave.mock.calls[0][0].scripture_references).toEqual([]);
  });

  test('cancel closes without saving', async () => {
    const onSave = jest.fn();
    const onClose = jest.fn();
    await render(<RecapSectionEditor sectionKey="summary" recap={recap()} onSave={onSave} onClose={onClose} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
