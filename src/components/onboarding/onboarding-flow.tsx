import type { ReactNode } from 'react';

import { FaithButton } from '@/components/ui';
import { useOnboardingFlow, type OnboardingFlow as Flow } from '@/features/onboarding/use-onboarding-flow';

import { GoalStep, ReminderStep } from './choice-steps';
import { ConceptsStep, ReadyStep, WelcomeStep } from './intro-steps';
import { OnboardingChrome } from './onboarding-chrome';

interface StepView {
  body: ReactNode;
  footer: ReactNode;
}

function renderStep(flow: Flow): StepView {
  switch (flow.step) {
    case 'welcome':
      return {
        body: <WelcomeStep />,
        footer: <FaithButton label="Get started" onPress={flow.next} fullWidth />,
      };
    case 'concepts':
      return {
        body: <ConceptsStep />,
        footer: <FaithButton label="Continue" onPress={flow.next} fullWidth />,
      };
    case 'goal':
      return {
        body: <GoalStep goal={flow.goal} onSelect={flow.selectGoal} />,
        footer: <FaithButton label="Continue" onPress={flow.confirmGoal} isDisabled={!flow.goal} fullWidth />,
      };
    case 'reminder':
      return {
        body: <ReminderStep time={flow.reminderTime} onChange={flow.changeReminderTime} />,
        footer: (
          <>
            <FaithButton label="Remember this time" onPress={flow.confirmReminder} fullWidth />
            <FaithButton label="Not now" variant="ghost" onPress={flow.skip} fullWidth />
          </>
        ),
      };
    case 'ready':
      return {
        body: <ReadyStep />,
        footer: <FaithButton label="Go to Today" onPress={flow.finish} fullWidth />,
      };
  }
}

/** First-run experience (PRD flow A). No permission prompts happen here. */
export function OnboardingFlow() {
  const flow = useOnboardingFlow();
  const { body, footer } = renderStep(flow);

  return (
    <OnboardingChrome
      stepIndex={flow.stepIndex}
      stepCount={flow.stepCount}
      onBack={flow.canGoBack ? flow.back : undefined}
      onSkip={flow.canSkip ? flow.skip : undefined}
      footer={footer}>
      {body}
    </OnboardingChrome>
  );
}
