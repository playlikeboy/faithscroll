import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import { SampleContentSection } from '@/components/settings/sample-content-section';

jest.setTimeout(20_000);

function pressAlertButton(text: string): void {
  const buttons = (jest.mocked(Alert.alert).mock.calls.at(-1)?.[2] ?? []) as AlertButton[];
  buttons.find((button) => button.text === text)?.onPress?.();
}

describe('SampleContentSection', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  test('renders nothing when there are no samples and nothing to report', async () => {
    await render(<SampleContentSection hasSamples={false} status={{ kind: 'idle' }} onRemove={jest.fn()} />);
    expect(screen.queryByText('Sample content')).toBeNull();
  });

  test('asks for confirmation before removing samples', async () => {
    const onRemove = jest.fn();
    await render(<SampleContentSection hasSamples status={{ kind: 'idle' }} onRemove={onRemove} />);

    await fireEvent.press(screen.getByRole('button', { name: /Remove sample content/ }));
    expect(Alert.alert).toHaveBeenCalledWith('Remove sample content?', expect.any(String), expect.any(Array));
    expect(onRemove).not.toHaveBeenCalled();

    pressAlertButton('Cancel');
    expect(onRemove).not.toHaveBeenCalled();

    pressAlertButton('Remove samples');
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  test('shows the result once the samples are gone', async () => {
    await render(<SampleContentSection hasSamples={false} status={{ kind: 'done', message: 'Sample content removed.' }} onRemove={jest.fn()} />);
    expect(screen.getByText('Sample content removed.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Remove sample content/ })).toBeNull();
  });

  test('announces errors as alerts', async () => {
    await render(<SampleContentSection hasSamples status={{ kind: 'error', message: 'Please try again.' }} onRemove={jest.fn()} />);
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
