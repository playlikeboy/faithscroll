import { fireEvent, render, screen } from '@testing-library/react-native';
import type { Href } from 'expo-router';

import { ContinueReadingCard } from '@/components/today/continue-reading-card';
import { DailyIntention } from '@/components/today/daily-intention';
import { DailyReflectionCard, type DailyReflectionCardProps } from '@/components/today/daily-reflection-card';
import { QuickActions } from '@/components/today/quick-actions';
import { RecentActivityList } from '@/components/today/recent-activity-list';
import { VerseOfTheDayCard, type VerseOfTheDayCardProps } from '@/components/today/verse-of-the-day-card';
import type { RecentActivityItem } from '@/features/today/activity';

function votdProps(overrides: Partial<VerseOfTheDayCardProps> = {}): VerseOfTheDayCardProps {
  return {
    reference: 'Psalm 23:1',
    translation: 'WEB',
    text: 'Yahweh is my shepherd; I shall lack nothing.',
    isLoading: false,
    isSaved: false,
    onToggleSave: jest.fn(),
    onShare: jest.fn(),
    onStudy: jest.fn(),
    onRead: jest.fn(),
    ...overrides,
  };
}

describe('VerseOfTheDayCard', () => {
  test('shows Scripture with its reference and wires save, share and study', async () => {
    const props = votdProps();
    await render(<VerseOfTheDayCard {...props} />);

    expect(screen.getByText('Yahweh is my shepherd; I shall lack nothing.')).toBeTruthy();
    expect(screen.getByText('Psalm 23:1 · WEB')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Save Psalm 23:1' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Share Psalm 23:1' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Study Psalm 23:1' }));
    expect(props.onToggleSave).toHaveBeenCalledTimes(1);
    expect(props.onShare).toHaveBeenCalledTimes(1);
    expect(props.onStudy).toHaveBeenCalledTimes(1);
  });

  test('reflects the saved state and surfaces save errors', async () => {
    await render(<VerseOfTheDayCard {...votdProps({ isSaved: true, saveError: 'Could not save.' })} />);

    expect(screen.getByRole('button', { name: /^Saved\. Remove Psalm 23:1/ })).toBeSelected();
    expect(screen.getByText('Could not save.')).toBeTruthy();
  });

  test('offers to open the passage when the text is not available yet', async () => {
    const props = votdProps({ text: null });
    await render(<VerseOfTheDayCard {...props} />);

    expect(screen.getByText(/Today’s passage is Psalm 23:1/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save Psalm 23:1' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Read Psalm 23:1' }));
    expect(props.onRead).toHaveBeenCalled();
  });
});

describe('ContinueReadingCard', () => {
  test('resumes where the reader left off and reports progress', async () => {
    const onResume = jest.fn();
    await render(
      <ContinueReadingCard
        progress={{ bookId: 43, bookName: 'John', chapter: 3, verse: 16, totalChapters: 21 }}
        onResume={onResume}
        onStart={jest.fn()}
      />,
    );

    expect(screen.getByText('John 3')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'John progress' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Resume' }));
    expect(onResume).toHaveBeenCalled();
  });

  test('suggests John 1 when there is no history', async () => {
    const onStart = jest.fn();
    await render(<ContinueReadingCard progress={null} onResume={jest.fn()} onStart={onStart} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Start with John 1' }));
    expect(onStart).toHaveBeenCalled();
  });
});

function reflectionProps(overrides: Partial<DailyReflectionCardProps> = {}): DailyReflectionCardProps {
  return {
    prompt: 'What am I grateful for?',
    text: '',
    onChangeText: jest.fn(),
    passageLabel: null,
    onAttachPassage: jest.fn(),
    onRemovePassage: jest.fn(),
    canSave: false,
    onSave: jest.fn(),
    isSaved: false,
    onOpenEntry: jest.fn(),
    error: null,
    ...overrides,
  };
}

describe('DailyReflectionCard', () => {
  test('captures text, attaches a passage and only saves when there is something to save', async () => {
    const props = reflectionProps();
    await render(<DailyReflectionCard {...props} />);

    expect(screen.getByRole('button', { name: 'Save reflection' })).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Reflection. What am I grateful for?'), 'Friends');
    await fireEvent.press(screen.getByRole('button', { name: 'Attach a passage' }));

    expect(props.onChangeText).toHaveBeenCalledWith('Friends');
    expect(props.onAttachPassage).toHaveBeenCalled();
  });

  test('shows the attached passage with a remove control and saves', async () => {
    const props = reflectionProps({ text: 'Friends', canSave: true, passageLabel: 'Psalm 100:4' });
    await render(<DailyReflectionCard {...props} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Remove Psalm 100:4' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save reflection' }));
    expect(props.onRemovePassage).toHaveBeenCalled();
    expect(props.onSave).toHaveBeenCalled();
  });

  test('confirms gently after saving and links to the entry', async () => {
    const props = reflectionProps({ isSaved: true, error: null });
    await render(<DailyReflectionCard {...props} />);

    expect(screen.getByText('Saved to your journal.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Open entry' }));
    expect(props.onOpenEntry).toHaveBeenCalled();
  });

  test('shows save errors', async () => {
    await render(<DailyReflectionCard {...reflectionProps({ error: "We couldn't save your reflection." })} />);
    expect(screen.getByText("We couldn't save your reflection.")).toBeTruthy();
  });
});

describe('DailyIntention', () => {
  test('sets an intention inline', async () => {
    const onSave = jest.fn();
    await render(<DailyIntention intention={null} onSave={onSave} onClear={jest.fn()} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Set an intention for today' }));
    await fireEvent.changeText(screen.getByLabelText("Today's intention"), 'Listen more');
    await fireEvent.press(screen.getByRole('button', { name: 'Save intention' }));

    expect(onSave).toHaveBeenCalledWith('Listen more');
  });

  test('shows, edits and clears an existing intention', async () => {
    const onClear = jest.fn();
    await render(<DailyIntention intention="Be patient" onSave={jest.fn()} onClear={onClear} />);

    expect(screen.getByLabelText("Today's intention: Be patient")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: "Clear today's intention" }));
    expect(onClear).toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: "Edit today's intention" }));
    expect(screen.getByDisplayValue('Be patient')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByDisplayValue('Be patient')).toBeNull();
  });
});

describe('QuickActions', () => {
  test('exposes the four quick actions', async () => {
    const onAction = jest.fn();
    await render(<QuickActions onAction={onAction} />);

    for (const name of ['Read the Bible', 'Start a sermon', 'New journal entry', 'Write a prayer']) {
      await fireEvent.press(screen.getByRole('button', { name }));
    }
    expect(onAction.mock.calls.map(([key]) => key)).toEqual(['read', 'sermon', 'journal', 'prayer']);
  });
});

describe('RecentActivityList', () => {
  const item: RecentActivityItem = {
    key: 'sermon-1',
    kind: 'sermon',
    icon: 'sermons',
    title: 'The Power of Forgiveness',
    subtitle: 'Sermon · Pastor John',
    href: '/sermons/1' as Href,
  };

  test('shows a calm placeholder when empty', async () => {
    await render(<RecentActivityList items={[]} onOpen={jest.fn()} />);
    expect(screen.getByText(/will gather here/)).toBeTruthy();
  });

  test('opens an item', async () => {
    const onOpen = jest.fn();
    await render(<RecentActivityList items={[item]} onOpen={onOpen} />);

    await fireEvent.press(screen.getByRole('button', { name: 'The Power of Forgiveness, Sermon · Pastor John' }));
    expect(onOpen).toHaveBeenCalledWith(item);
  });
});
