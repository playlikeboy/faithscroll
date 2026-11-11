import { localDayNumber } from './dates';

/** Gentle daily prompts (PRD §6.1 D, §6.4). Never framed as obligations. */
export const REFLECTION_PROMPTS: readonly string[] = [
  'What has been on your heart lately?',
  'What stood out to me today?',
  'What am I learning?',
  'What am I struggling with?',
  'What am I grateful for?',
  'What do I want to remember?',
  'What action can I take?',
];

/** The same prompt all day, a different one tomorrow. */
export function promptForDate(date: Date = new Date()): string {
  const index = localDayNumber(date) % REFLECTION_PROMPTS.length;
  return REFLECTION_PROMPTS[index];
}
