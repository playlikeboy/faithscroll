import type { IconName } from '@/components/ui';
import type { ReadingGoal } from '@/stores/preferences';

export const ONBOARDING_STEPS = ['welcome', 'concepts', 'goal', 'reminder', 'ready'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** Short names announced to screen readers when the step changes. */
export const STEP_TITLES: Record<OnboardingStep, string> = {
  welcome: 'Welcome to Faithscroll',
  concepts: 'Everything in one quiet place',
  goal: 'How would you like to read?',
  reminder: 'A gentle daily reminder',
  ready: "You're ready",
};

/** Steps the user may skip without choosing anything. */
export const SKIPPABLE_STEPS: readonly OnboardingStep[] = ['concepts', 'goal', 'reminder'];

export interface CoreConcept {
  key: 'bible' | 'sermons' | 'journal' | 'prayer';
  icon: IconName;
  title: string;
  description: string;
}

export const CORE_CONCEPTS: readonly CoreConcept[] = [
  {
    key: 'bible',
    icon: 'bible',
    title: 'Bible',
    description: 'Read Scripture in a calm, clear reader. Highlight, save and study any verse.',
  },
  {
    key: 'sermons',
    icon: 'sermons',
    title: 'Sermons',
    description: 'Record sermons, mark meaningful moments and keep your notes together.',
  },
  {
    key: 'journal',
    icon: 'journal',
    title: 'Journal',
    description: "Reflect on what you're learning, connected to the passages behind it.",
  },
  {
    key: 'prayer',
    icon: 'prayer',
    title: 'Prayer',
    description: 'Keep your prayers close and notice how they are answered over time.',
  },
];

export interface ReadingGoalOption {
  value: ReadingGoal;
  title: string;
  description: string;
}

export const READING_GOAL_OPTIONS: readonly ReadingGoalOption[] = [
  {
    value: 'daily_chapter',
    title: 'A chapter a day',
    description: 'Read steadily through Scripture, one chapter at a time.',
  },
  {
    value: 'few_times_week',
    title: 'A few times a week',
    description: 'Read at a gentle pace that fits your week.',
  },
  {
    value: 'explore',
    title: 'Explore by topic',
    description: 'Discover passages on hope, peace, forgiveness and more.',
  },
  {
    value: 'sermons',
    title: 'Remember sermons',
    description: "Capture and reflect on what you hear on Sunday.",
  },
];

export function readingGoalLabel(goal: ReadingGoal | null): string | null {
  return READING_GOAL_OPTIONS.find((option) => option.value === goal)?.title ?? null;
}
