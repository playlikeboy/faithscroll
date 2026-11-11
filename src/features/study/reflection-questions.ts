/**
 * Human-written, tradition-neutral reflection questions for basic study (no AI).
 * A few are chosen per passage so different passages feel a little different.
 */
export const REFLECTION_QUESTIONS: readonly string[] = [
  'What does this passage show you about God?',
  'What stands out to you most, and why?',
  'Is there a promise to trust, an invitation to accept, or an example to learn from?',
  'What did this passage mean for its first readers?',
  'Which word or phrase would you like to carry with you today?',
  'How might this passage shape one thing you do this week?',
  'Is there something here you find hard to understand or accept? What could you ask about it?',
  'What would you like to say to God in response?',
];

export const DEFAULT_QUESTION_COUNT = 4;

/** A stable selection of questions for a passage (same passage → same questions). */
export function reflectionQuestionsFor(startVerseId: number, count: number = DEFAULT_QUESTION_COUNT): string[] {
  const total = REFLECTION_QUESTIONS.length;
  const size = Math.max(0, Math.min(count, total));
  const offset = Math.abs(Math.trunc(startVerseId)) % total;
  return Array.from({ length: size }, (_, index) => REFLECTION_QUESTIONS[(offset + index) % total]);
}
