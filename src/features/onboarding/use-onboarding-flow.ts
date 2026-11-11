import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler } from 'react-native';

import { track } from '@/services/monitoring/analytics';
import { usePreferences, type ReadingGoal } from '@/stores/preferences';

import { DEFAULT_REMINDER_TIME, isValidTime } from './reminder-time';
import { ONBOARDING_STEPS, SKIPPABLE_STEPS, STEP_TITLES, type OnboardingStep } from './steps';

export interface OnboardingFlow {
  step: OnboardingStep;
  stepIndex: number;
  stepCount: number;
  canGoBack: boolean;
  canSkip: boolean;
  goal: ReadingGoal | null;
  reminderTime: string;
  selectGoal: (goal: ReadingGoal) => void;
  changeReminderTime: (time: string) => void;
  next: () => void;
  back: () => void;
  /** Move on without saving anything for the current step. */
  skip: () => void;
  confirmGoal: () => void;
  confirmReminder: () => void;
  finish: () => void;
}

/**
 * State for the first-run flow. Nothing here requests a permission: the reminder time is only
 * remembered (`setDailyReminder(time, false)`); reminders are switched on later in Settings.
 */
export function useOnboardingFlow(): OnboardingFlow {
  const storedGoal = usePreferences((s) => s.readingGoal);
  const storedTime = usePreferences((s) => s.dailyReminderTime);
  const setReadingGoal = usePreferences((s) => s.setReadingGoal);
  const setDailyReminder = usePreferences((s) => s.setDailyReminder);
  const completeOnboarding = usePreferences((s) => s.completeOnboarding);

  const [stepIndex, setStepIndex] = useState(0);
  const [goal, setGoal] = useState<ReadingGoal | null>(storedGoal);
  const [reminderTime, setReminderTime] = useState(isValidTime(storedTime) ? storedTime : DEFAULT_REMINDER_TIME);
  const isFirstRender = useRef(true);

  const stepCount = ONBOARDING_STEPS.length;
  const step = ONBOARDING_STEPS[stepIndex];

  const goTo = (index: number) => setStepIndex(Math.min(stepCount - 1, Math.max(0, index)));
  const next = () => goTo(stepIndex + 1);
  const back = () => goTo(stepIndex - 1);

  // Let VoiceOver/TalkBack users know the content changed.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    AccessibilityInfo.announceForAccessibility(`Step ${stepIndex + 1} of ${stepCount}. ${STEP_TITLES[step]}`);
  }, [step, stepIndex, stepCount]);

  // Android back button walks back through the steps instead of leaving the app.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stepIndex === 0) return false;
      setStepIndex(stepIndex - 1);
      return true;
    });
    return () => subscription.remove();
  }, [stepIndex]);

  return {
    step,
    stepIndex,
    stepCount,
    canGoBack: stepIndex > 0,
    canSkip: SKIPPABLE_STEPS.includes(step),
    goal,
    reminderTime,
    selectGoal: setGoal,
    changeReminderTime: setReminderTime,
    next,
    back,
    skip: next,
    confirmGoal: () => {
      setReadingGoal(goal);
      next();
    },
    confirmReminder: () => {
      setDailyReminder(reminderTime, false);
      next();
    },
    finish: () => {
      track({ name: 'onboarding_completed', goal: usePreferences.getState().readingGoal });
      // The root layout's Stack.Protected guard moves the user to the Today tab.
      completeOnboarding();
    },
  };
}
