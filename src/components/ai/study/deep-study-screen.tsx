/** Deep Study (PRD §6.2F): passage from the local Bible + AI study in Basic or Advanced mode. */
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Card, Chip, EmptyState, ErrorState, FaithButton, FaithText, LoadingState, Screen } from '@/components/ui';
import { useSession } from '@/features/auth/use-session';
import { bibleRoutes } from '@/features/bible/reader/routes';
import { useDeepStudy } from '@/features/study-ai/use-deep-study';
import { usePassage } from '@/features/study-ai/use-passage';
import { useEntitlements } from '@/features/subscriptions/use-entitlements';
import { aiErrorMessage, fromServerCode, needsPaywall } from '@/services/ai/errors';
import { track } from '@/services/monitoring/analytics';
import { isSupabaseConfigured } from '@/services/supabase/client';
import { useTheme } from '@/theme';

import { aiRoutes } from '../ai-routes';
import { DeepStudyView } from './deep-study-view';
import { PassageHeader } from './passage-header';

export interface DeepStudyScreenProps {
  start: number;
  end: number;
}

export function DeepStudyScreen({ start, end }: DeepStudyScreenProps) {
  const { colors } = useTheme();
  const passage = usePassage(start, end);
  const study = useDeepStudy(passage.data, start, end);
  const { userId } = useSession();
  const { isPlus } = useEntitlements();

  useEffect(() => {
    track({ name: 'study_opened', mode: 'deep' });
  }, []);

  if (passage.isLoading) return <LoadingState label="Loading passage" />;
  if (passage.error || !passage.data || passage.data.verses.length === 0) {
    return (
      <Screen edges={[]}>
        <ErrorState title="Passage unavailable" message="This passage couldn’t be loaded from your Bible." onRetry={() => void passage.refetch()} />
      </Screen>
    );
  }

  const handleGenerate = async () => {
    const code = await study.generate();
    if (code && needsPaywall(code)) router.push(aiRoutes.paywall('study'));
  };

  const errorCode = study.errorCode ? fromServerCode(study.errorCode) : null;
  const gate = !isSupabaseConfigured() ? 'not_configured' : !userId ? 'signed_out' : 'ready';

  return (
    <Screen edges={[]}>
      <View style={styles.stack}>
        <PassageHeader passage={passage.data} />

        <View style={styles.modes} accessibilityRole="radiogroup" accessibilityLabel="Study depth">
          <Chip label="Basic" isSelected={study.mode === 'basic'} onPress={() => study.setMode('basic')} />
          <Chip label={isPlus ? 'Advanced' : 'Advanced · Plus'} isSelected={study.mode === 'advanced'} onPress={() => study.setMode('advanced')} />
        </View>

        {gate === 'not_configured' ? (
          <EmptyState icon="cloud" title="Cloud features aren’t set up" message="Deep Study needs the Faithscroll cloud service, which isn’t configured in this build." />
        ) : gate === 'signed_out' ? (
          <EmptyState icon="person" title="Sign in for Deep Study" message="AI study runs in your private account." actionLabel="Sign in" onAction={() => router.push(aiRoutes.signIn())} />
        ) : null}

        {gate === 'ready' && !study.study && !study.isWorking ? (
          <Card style={styles.card}>
            <FaithText variant="heading">{study.mode === 'basic' ? 'A clear, simple study' : 'A deeper editorial study'}</FaithText>
            <FaithText variant="secondary">
              {study.mode === 'basic'
                ? 'Overview, simple explanation, key words, related Scripture, application and reflection questions.'
                : 'Adds historical background, literary context and theological significance, with different Christian perspectives presented fairly.'}
            </FaithText>
            <FaithText variant="caption">The passage text is sent to our AI provider to write the study.</FaithText>
            <FaithButton label="Create study" icon="sparkles" onPress={() => void handleGenerate()} />
          </Card>
        ) : null}

        {study.isWorking ? (
          <View style={styles.row} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.primaryText} />
            <FaithText variant="secondary">Preparing your study…</FaithText>
          </View>
        ) : null}

        {errorCode && !study.isWorking ? (
          <Card style={styles.card}>
            <FaithText variant="secondary" accessibilityLiveRegion="polite">
              {aiErrorMessage(errorCode)}
            </FaithText>
            {needsPaywall(errorCode) ? (
              <FaithButton label="See Faithscroll Plus" variant="secondary" onPress={() => router.push(aiRoutes.paywall('study'))} />
            ) : (
              <FaithButton label="Try again" variant="secondary" onPress={() => void handleGenerate()} />
            )}
          </Card>
        ) : null}

        {study.study ? <DeepStudyView study={study.study} mode={study.mode} droppedReferences={study.droppedReferences} /> : null}

        <FaithButton label="Ask about this passage" icon="sparkles" variant="ghost" onPress={() => router.push(bibleRoutes.askAboutPassage(start, end))} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 18, paddingTop: 12 },
  modes: { flexDirection: 'row', gap: 8 },
  card: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
