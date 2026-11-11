import { fireEvent, render, screen } from '@testing-library/react-native';

import { AppearanceScreen } from '@/components/settings/appearance-screen';
import { SettingsScreen } from '@/components/settings/settings-screen';
import { usePreferences } from '@/stores/preferences';

const mockRouter = { push: jest.fn() };

// Screen-level suites render a lot on a cold start; allow headroom on a busy machine.
jest.setTimeout(20_000);

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('@/features/auth/use-session', () => ({
  useSession: () => ({ session: null, userId: null, isLoading: false }),
}));
jest.mock('@/features/subscriptions/use-entitlements', () => ({
  useEntitlements: () => ({ isPlus: false, isLoading: false, expiresAt: null }),
}));

describe('SettingsScreen', () => {
  beforeEach(() => {
    mockRouter.push.mockClear();
    usePreferences.getState().resetPreferences();
  });

  test('links to every settings area', async () => {
    await render(<SettingsScreen />);

    const rows = [
      [/^Appearance, System · Default text$/, '/settings/appearance'],
      [/^Reminders, Off$/, '/settings/reminders'],
      [/^Account, Not signed in$/, '/settings/account'],
      [/^Subscription, Free$/, '/settings/subscription'],
      [/^Your data & privacy,/, '/settings/data'],
      [/^About,/, '/settings/about'],
    ] as const;
    for (const [name] of rows) await fireEvent.press(screen.getByRole('button', { name }));

    expect(mockRouter.push.mock.calls.map(([href]) => href)).toEqual(rows.map(([, href]) => href));
    expect(screen.getByText(/^Faithscroll \d+\.\d+\.\d+/)).toBeTruthy();
  });

  test('changes the reading goal inline', async () => {
    await render(<SettingsScreen />);

    const row = screen.getByRole('button', { name: 'Reading goal, Not set' });
    await fireEvent.press(row);
    await fireEvent.press(screen.getByRole('radio', { name: /Explore by topic/ }));

    expect(usePreferences.getState().readingGoal).toBe('explore');
    expect(screen.getByRole('button', { name: 'Reading goal, Explore by topic' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: /Explore by topic/ })).toBeNull();
  });

  test('shows the reminder time once reminders are on', async () => {
    usePreferences.getState().setDailyReminder('21:00', true);
    await render(<SettingsScreen />);
    expect(screen.getByRole('button', { name: /^Reminders, Daily at 9:00/ })).toBeTruthy();
  });
});

describe('AppearanceScreen', () => {
  beforeEach(() => usePreferences.getState().resetPreferences());

  test('switches theme', async () => {
    await render(<AppearanceScreen />);

    expect(screen.getByRole('radio', { name: /^System/ })).toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: /^Dark/ }));

    expect(usePreferences.getState().themePreference).toBe('dark');
    expect(screen.getByRole('radio', { name: /^Dark/ })).toBeChecked();
  });

  test('adjusts Scripture size with buttons and the adjustable control', async () => {
    await render(<AppearanceScreen />);
    const slider = screen.getByRole('adjustable', { name: 'Scripture text size' });
    expect(slider.props.accessibilityValue).toEqual({ text: 'Default' });

    await fireEvent.press(screen.getByRole('button', { name: 'Larger text' }));
    expect(usePreferences.getState().scriptureSizeIndex).toBe(3);

    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(usePreferences.getState().scriptureSizeIndex).toBe(1);
    expect(screen.getByRole('adjustable', { name: 'Scripture text size' }).props.accessibilityValue).toEqual({
      text: 'Small',
    });
  });

  test('cannot shrink below the smallest size', async () => {
    usePreferences.getState().setScriptureSizeIndex(0);
    await render(<AppearanceScreen />);

    expect(screen.getByRole('button', { name: 'Smaller text' })).toBeDisabled();
    expect(screen.getByLabelText(/^Preview\. John 1:1\./)).toBeTruthy();
  });
});
