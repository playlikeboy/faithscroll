/**
 * Passage assistant (PRD §6.2G): questions about the selected passage, answered with citations.
 * The conversation exists only in memory while this screen is open.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Chip, EmptyState, ErrorState, FaithButton, FaithText, LoadingState, Screen, TextField } from '@/components/ui';
import { useSession } from '@/features/auth/use-session';
import { MAX_QUESTION_LENGTH, useAsk } from '@/features/study-ai/use-ask';
import { usePassage } from '@/features/study-ai/use-passage';
import { aiErrorMessage, needsPaywall } from '@/services/ai/errors';
import { isSupabaseConfigured } from '@/services/supabase/client';
import { useTheme } from '@/theme';

import { aiRoutes } from '../ai-routes';
import { AnswerCard } from './answer-card';
import { PassageHeader } from './passage-header';
import { StudyDisclaimer } from './study-disclaimer';

export const SUGGESTED_QUESTIONS = ['What does this mean?', 'What happened before this?', 'Explain it more simply'] as const;

export interface AskScreenProps {
  start: number;
  end: number;
}

export function AskScreen({ start, end }: AskScreenProps) {
  const { colors } = useTheme();
  const passage = usePassage(start, end);
  const conversation = useAsk(passage.data);
  const { userId } = useSession();
  const [question, setQuestion] = useState('');

  if (passage.isLoading) return <LoadingState label="Loading passage" />;
  if (passage.error || !passage.data || passage.data.verses.length === 0) {
    return (
      <Screen edges={[]}>
        <ErrorState title="Passage unavailable" message="This passage couldn’t be loaded from your Bible." onRetry={() => void passage.refetch()} />
      </Screen>
    );
  }

  const send = async (text: string) => {
    const code = await conversation.ask(text);
    if (code === null) setQuestion('');
    else if (needsPaywall(code)) router.push(aiRoutes.paywall('ask'));
  };

  const ready = isSupabaseConfigured() && userId !== null;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={96}>
      <Screen edges={[]}>
        <View style={styles.stack}>
          <PassageHeader passage={passage.data} maxVerses={3} />

          {!isSupabaseConfigured() ? (
            <EmptyState icon="cloud" title="Cloud features aren’t set up" message="The study assistant needs the Faithscroll cloud service." />
          ) : !userId ? (
            <EmptyState icon="person" title="Sign in to ask questions" message="Answers are created in your private account." actionLabel="Sign in" onAction={() => router.push(aiRoutes.signIn())} />
          ) : null}

          {conversation.entries.map((entry) =>
            entry.role === 'user' ? (
              <View key={entry.id} style={[styles.question, { backgroundColor: colors.surfaceMuted }]}>
                <FaithText variant="label">You asked</FaithText>
                <FaithText variant="body">{entry.text}</FaithText>
              </View>
            ) : (
              <AnswerCard key={entry.id} answer={entry.answer} droppedReferences={entry.droppedReferences} />
            ),
          )}

          {conversation.isAsking ? (
            <View style={styles.row} accessibilityLiveRegion="polite">
              <ActivityIndicator color={colors.primaryText} />
              <FaithText variant="secondary">Thinking about the passage…</FaithText>
            </View>
          ) : null}

          {conversation.errorCode ? (
            <FaithText variant="secondary" color="danger" accessibilityLiveRegion="polite">
              {aiErrorMessage(conversation.errorCode)}
            </FaithText>
          ) : null}

          {ready ? (
            <>
              {conversation.entries.length === 0 ? (
                <View style={styles.suggestions}>
                  {SUGGESTED_QUESTIONS.map((suggestion) => (
                    <Chip key={suggestion} label={suggestion} onPress={() => void send(suggestion)} />
                  ))}
                </View>
              ) : null}
              <TextField
                label="Your question"
                value={question}
                onChangeText={setQuestion}
                placeholder="Ask about this passage"
                maxLength={MAX_QUESTION_LENGTH}
                multiline
                helper="Your question and the passage are sent to our AI provider. This conversation isn’t saved."
              />
              <FaithButton
                label="Ask"
                icon="sparkles"
                onPress={() => void send(question)}
                isDisabled={!question.trim()}
                isLoading={conversation.isAsking}
              />
            </>
          ) : null}

          <StudyDisclaimer />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: 16, paddingTop: 12 },
  question: { gap: 4, padding: 14, borderRadius: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
