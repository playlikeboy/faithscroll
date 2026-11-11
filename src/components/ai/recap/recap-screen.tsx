/**
 * Sermon recap (PRD §6.3G, flow D): generate from the transcript (or notes), read the seven sections,
 * edit any of them, turn "Live It Out" items into actions and journal reflections.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { Card, EmptyState, FaithButton, FaithText, Screen } from '@/components/ui';
import { useRecap } from '@/features/recap/use-recap';
import type { RecapSectionKey } from '@/features/recap/schema';
import { useEntitlements } from '@/features/subscriptions/use-entitlements';
import { aiErrorMessage, fromServerCode, needsPaywall } from '@/services/ai/errors';
import { usePreferences } from '@/stores/preferences';
import { useTheme } from '@/theme';

import { AiLabel } from '../ai-label';
import { aiRoutes } from '../ai-routes';
import { RecapSectionEditor } from './recap-section-editor';
import { RecapView } from './recap-view';

export interface RecapScreenProps {
  sermonId: string;
}

const DISCLOSURE = 'Your transcript (or notes) is sent to our AI provider, OpenAI, to write the recap. It isn’t stored afterwards or used to train AI models.';

export function RecapScreen({ sermonId }: RecapScreenProps) {
  const { colors } = useTheme();
  const recap = useRecap(sermonId);
  const { isPlus } = useEntitlements();
  const consentAt = usePreferences((state) => state.aiProcessingConsentAt);
  const acknowledgeConsent = usePreferences((state) => state.acknowledgeAiProcessingConsent);
  const [editingKey, setEditingKey] = useState<RecapSectionKey | null>(null);
  const { content } = recap;

  const runGenerate = async () => {
    const code = await recap.generate();
    if (code && needsPaywall(code)) router.push(aiRoutes.paywall('recap'));
  };

  const handleGenerate = () => {
    if (consentAt) {
      void runGenerate();
      return;
    }
    Alert.alert('Create a recap with AI?', DISCLOSURE, [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Continue',
        onPress: () => {
          acknowledgeConsent();
          void runGenerate();
        },
      },
    ]);
  };

  const handleRegenerate = () =>
    Alert.alert('Regenerate recap?', 'A new recap replaces this one, including any edits you made.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Regenerate', onPress: handleGenerate },
    ]);

  const handleDelete = () =>
    Alert.alert('Delete recap?', 'Actions you already added stay in your list.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: recap.remove },
    ]);

  const failedCode = recap.failedCode ? fromServerCode(recap.failedCode) : null;
  const canGenerate = recap.gate === 'ready' && !recap.isGenerating;
  const gateMessage =
    recap.gate === 'not_configured'
      ? { title: 'Cloud features aren’t set up', message: 'Recaps need the Faithscroll cloud service, which isn’t configured in this build.' }
      : recap.gate === 'signed_out'
        ? { title: 'Sign in to create a recap', message: 'Recaps are created in your private account.' }
        : recap.gate === 'no_content'
          ? { title: 'Nothing to recap yet', message: 'Transcribe the recording or write some notes first.' }
          : null;

  return (
    <Screen edges={[]}>
      <View style={styles.stack}>
        {content ? (
          <Card tone="ai" style={styles.headerCard}>
            <AiLabel text={recap.recap?.transcriptId ? 'AI-generated from your recording' : 'AI-generated from your notes'} />
            {content.title ? <FaithText variant="title">{content.title}</FaithText> : null}
            <FaithText variant="secondary">
              {recap.recap?.editedAt ? 'Edited by you. ' : ''}Check it against what you heard — AI can make mistakes.
            </FaithText>
          </Card>
        ) : null}

        {!content && gateMessage ? (
          <EmptyState
            icon="sparkles"
            title={gateMessage.title}
            message={gateMessage.message}
            actionLabel={recap.gate === 'signed_out' ? 'Sign in' : undefined}
            onAction={recap.gate === 'signed_out' ? () => router.push(aiRoutes.signIn()) : undefined}
          />
        ) : null}

        {!content && recap.gate === 'ready' && !recap.isGenerating ? (
          <Card style={styles.card}>
            <FaithText variant="heading">Turn this sermon into lasting insights</FaithText>
            <FaithText variant="secondary">
              A summary, main points, Scripture mentioned, key moments, discussion questions, “Live It Out” actions and reflection questions.
            </FaithText>
            <FaithText variant="caption">{DISCLOSURE}</FaithText>
            {!isPlus ? <FaithText variant="caption">The free plan includes a few recaps each month; Faithscroll Plus includes more.</FaithText> : null}
            <FaithButton label="Generate recap" icon="sparkles" onPress={handleGenerate} isDisabled={!canGenerate} />
          </Card>
        ) : null}

        {recap.isGenerating ? (
          <Card style={styles.card}>
            <View style={styles.row} accessibilityLiveRegion="polite">
              <ActivityIndicator color={colors.primaryText} />
              <FaithText variant="heading" style={styles.flex}>
                Writing your recap…
              </FaithText>
            </View>
            <FaithText variant="secondary">This usually takes under a minute. You can leave this screen.</FaithText>
          </Card>
        ) : null}

        {failedCode && !recap.isGenerating ? (
          <Card style={styles.card}>
            <View accessibilityLiveRegion="polite" style={styles.gap}>
              <FaithText variant="heading">The recap wasn’t created</FaithText>
              <FaithText variant="secondary">{aiErrorMessage(failedCode)}</FaithText>
            </View>
            {needsPaywall(failedCode) ? (
              <FaithButton label="See Faithscroll Plus" variant="secondary" onPress={() => router.push(aiRoutes.paywall('recap'))} />
            ) : (
              <FaithButton label="Try again" variant="secondary" onPress={handleGenerate} isDisabled={!canGenerate} />
            )}
          </Card>
        ) : null}

        {recap.report && recap.report.droppedReferences > 0 ? (
          <FaithText variant="caption" accessibilityLiveRegion="polite">
            {recap.report.droppedReferences === 1
              ? '1 Scripture reference was left out because it couldn’t be verified.'
              : `${recap.report.droppedReferences} Scripture references were left out because they couldn’t be verified.`}
          </FaithText>
        ) : null}

        {content ? (
          <RecapView
            recap={content}
            actionIdsByTitle={recap.actionIdsByTitle}
            onEdit={setEditingKey}
            onSeek={(ms) => router.push(aiRoutes.sermonAt(sermonId, ms))}
            onOpenReference={(startVerseId) => router.push(aiRoutes.bibleAt(startVerseId))}
            onAddAction={(item) => recap.addAction(item)}
            onReflect={(actionItemId) => router.push(aiRoutes.journalForAction(sermonId, actionItemId))}
          />
        ) : null}

        {content ? (
          <View style={styles.footer}>
            <FaithButton label="Regenerate recap" icon="sparkles" variant="secondary" onPress={handleRegenerate} isDisabled={!canGenerate} />
            <FaithButton label="Delete recap" icon="trash" variant="destructive" onPress={handleDelete} />
          </View>
        ) : null}
      </View>

      {editingKey && content ? (
        <RecapSectionEditor
          key={editingKey}
          sectionKey={editingKey}
          recap={content}
          onClose={() => setEditingKey(null)}
          onSave={(next) => {
            recap.saveContent(next);
            setEditingKey(null);
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 16, paddingTop: 12 },
  headerCard: { gap: 8 },
  card: { gap: 12 },
  gap: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  footer: { gap: 10, marginTop: 12 },
});
