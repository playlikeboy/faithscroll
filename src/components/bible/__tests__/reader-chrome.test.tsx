import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { PassageNotFound } from '@/components/bible/passage-not-found';
import { HeaderTitleButton, SelectionBar, TextSizeBar } from '@/components/bible/reader-chrome';
import { SCRIPTURE_SIZES } from '@/theme';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() }, Stack: { Screen: () => null } }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

// Rendering full screens is slow under coverage and a busy machine.
jest.setTimeout(30_000);

describe('reader chrome', () => {
  test('text size buttons step the size and stop at the limits', async () => {
    const onChange = jest.fn();
    const { rerender } = await render(<TextSizeBar sizeIndex={2} onChange={onChange} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Larger text' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Smaller text' }));
    expect(onChange.mock.calls).toEqual([[3], [1]]);
    expect(screen.getByText(`Text size 3 of ${SCRIPTURE_SIZES.length}`)).toBeTruthy();

    await rerender(<TextSizeBar sizeIndex={SCRIPTURE_SIZES.length - 1} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Larger text' }).props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
  });

  test('header title opens the book selector', async () => {
    const onPress = jest.fn();
    await render(<HeaderTitleButton title="John 3" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'John 3. Choose another book or chapter' }));
    expect(onPress).toHaveBeenCalled();
  });

  test('selection bar offers single verse and cancel', async () => {
    const onCancel = jest.fn();
    const onUseSingleVerse = jest.fn();
    await render(<SelectionBar startLabel="John 3:16" onCancel={onCancel} onUseSingleVerse={onUseSingleVerse} />);

    expect(screen.getByText(/Selecting from John 3:16/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Just this verse' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onUseSingleVerse).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  test('invalid links get a friendly way back to the books', async () => {
    await render(<PassageNotFound />);

    expect(screen.getByText("We couldn't find that passage")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Browse books' }));
    expect(router.replace).toHaveBeenCalledWith('/bible/books');
  });
});
