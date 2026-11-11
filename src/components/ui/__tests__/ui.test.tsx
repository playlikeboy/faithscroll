import { fireEvent, render, screen } from '@testing-library/react-native';

import { EmptyState, FaithButton, IconButton, ListRow } from '@/components/ui';

describe('FaithButton', () => {
  test('calls onPress when tapped and exposes an accessible label', async () => {
    const onPress = jest.fn();
    await render(<FaithButton label="Start recording" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Start recording' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('does not fire while loading', async () => {
    const onPress = jest.fn();
    await render(<FaithButton label="Save" onPress={onPress} isLoading />);

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('IconButton', () => {
  test('is announced by its accessibility label', async () => {
    const onPress = jest.fn();
    await render(<IconButton icon="bookmark" accessibilityLabel="Bookmark this moment" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Bookmark this moment' }));

    expect(onPress).toHaveBeenCalled();
  });
});

describe('EmptyState', () => {
  test('renders title, message and action', async () => {
    const onAction = jest.fn();
    await render(<EmptyState title="No sermons yet" message="Record your first sermon." actionLabel="New sermon" onAction={onAction} />);

    expect(screen.getByText('No sermons yet')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'New sermon' }));
    expect(onAction).toHaveBeenCalled();
  });
});

describe('ListRow', () => {
  test('combines title and subtitle in its label', async () => {
    await render(<ListRow title="Appearance" subtitle="System" onPress={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Appearance, System' })).toBeTruthy();
  });
});
