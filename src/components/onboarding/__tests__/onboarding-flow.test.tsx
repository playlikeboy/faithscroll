import { fireEvent, render, screen } from '@testing-library/react-native';

import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';
import { track } from '@/services/monitoring/analytics';
import { usePreferences } from '@/stores/preferences';

jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('@/services/monitoring/analytics', () => ({ track: jest.fn() }));
jest.mock('@react-native-community/datetimepicker', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: View, DateTimePickerAndroid: { open: jest.fn() } };
});

async function press(name: string) {
  await fireEvent.press(screen.getByRole('button', { name }));
}

describe('OnboardingFlow', () => {
  beforeEach(() => {
    usePreferences.getState().resetPreferences();
    jest.mocked(track).mockClear();
  });

  test('walks through every step, saving the goal and reminder time without enabling reminders', async () => {
    await render(<OnboardingFlow />);
    expect(screen.getByText('Faithscroll')).toBeTruthy();

    await press('Get started');
    expect(screen.getByText('Everything in one quiet place')).toBeTruthy();
    expect(screen.getByText('Bible')).toBeTruthy();
    expect(screen.getByText('Prayer')).toBeTruthy();

    await press('Continue');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('radio', { name: /A chapter a day/ }));
    await press('Continue');

    expect(screen.getByText('A gentle daily reminder')).toBeTruthy();
    await press('Remember this time');

    expect(screen.getByText('An account is optional')).toBeTruthy();
    await press('Go to Today');

    const state = usePreferences.getState();
    expect(state.readingGoal).toBe('daily_chapter');
    expect(state.dailyReminderTime).toBe('07:30');
    expect(state.dailyReminderEnabled).toBe(false);
    expect(state.onboardingCompleted).toBe(true);
    expect(track).toHaveBeenCalledWith({ name: 'onboarding_completed', goal: 'daily_chapter' });
  });

  test('skipping leaves choices unset and back returns to the previous step', async () => {
    await render(<OnboardingFlow />);
    await press('Get started');
    await press('Skip');
    expect(screen.getByText('How would you like to read?')).toBeTruthy();

    await press('Back');
    expect(screen.getByText('Everything in one quiet place')).toBeTruthy();

    await press('Skip');
    await press('Skip');
    await press('Not now');
    await press('Go to Today');

    const state = usePreferences.getState();
    expect(state.readingGoal).toBeNull();
    expect(state.dailyReminderTime).toBeNull();
    expect(state.onboardingCompleted).toBe(true);
    expect(track).toHaveBeenCalledWith({ name: 'onboarding_completed', goal: null });
  });

  test('announces progress without offering skip on the welcome step', async () => {
    await render(<OnboardingFlow />);
    expect(screen.getByLabelText('Step 1 of 5')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });
});
