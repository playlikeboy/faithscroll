/**
 * Passage assistant: a conversation kept in memory only (never stored on device or server).
 */
import { useCallback, useState } from 'react';

import { newId } from '@/lib/ids';
import { askAboutPassage } from '@/services/ai/api';
import type { AskTurn } from '@/services/ai/contracts';
import { AiServiceError, toAiServiceError, type AiClientErrorCode } from '@/services/ai/errors';
import { track } from '@/services/monitoring/analytics';

import type { LoadedPassage } from './passage';
import { toPassageContext } from './passage';
import { parseAskAnswer, type AskAnswer } from './schema';
import { validateAskAnswer } from './validate';

export const MAX_QUESTION_LENGTH = 1_000;
const HISTORY_TURNS = 6;

export type ConversationEntry =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; answer: AskAnswer; droppedReferences: number };

export function historyFor(entries: readonly ConversationEntry[]): AskTurn[] {
  return entries
    .map((entry): AskTurn => (entry.role === 'user' ? { role: 'user', content: entry.text } : { role: 'assistant', content: entry.answer.answer }))
    .slice(-HISTORY_TURNS);
}

export async function askQuestion(
  passage: LoadedPassage,
  question: string,
  entries: readonly ConversationEntry[],
): Promise<{ answer: AskAnswer; droppedReferences: number }> {
  const response = await askAboutPassage({ ...toPassageContext(passage), question, history: historyFor(entries) });
  const parsed = parseAskAnswer(response.answer);
  if (!parsed.success) throw new AiServiceError('invalid_output');
  const { answer, report } = await validateAskAnswer(parsed.data);
  return { answer, droppedReferences: report.droppedReferences };
}

export function useAsk(passage: LoadedPassage | undefined) {
  const [entries, setEntries] = useState<ConversationEntry[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [errorCode, setErrorCode] = useState<AiClientErrorCode | null>(null);

  const ask = useCallback(
    async (rawQuestion: string): Promise<AiClientErrorCode | null> => {
      const question = rawQuestion.trim().slice(0, MAX_QUESTION_LENGTH);
      if (!passage || !question || isAsking) return null;
      const userEntry: ConversationEntry = { id: newId(), role: 'user', text: question };
      const previous = entries;
      setEntries([...previous, userEntry]);
      setErrorCode(null);
      setIsAsking(true);
      track({ name: 'ai_question_asked' });
      try {
        const { answer, droppedReferences } = await askQuestion(passage, question, previous);
        setEntries((current) => [...current, { id: newId(), role: 'assistant', answer, droppedReferences }]);
        return null;
      } catch (error) {
        const code = toAiServiceError(error).code;
        // Remove the unanswered question so it can be asked again.
        setEntries((current) => current.filter((entry) => entry.id !== userEntry.id));
        setErrorCode(code);
        return code;
      } finally {
        setIsAsking(false);
      }
    },
    [passage, entries, isAsking],
  );

  return { entries, ask, isAsking, errorCode, clear: () => setEntries([]) };
}
