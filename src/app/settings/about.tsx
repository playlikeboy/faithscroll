import * as WebBrowser from 'expo-web-browser';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, FaithText, ListRow, Screen, Section } from '@/components/ui';
import { ATTRIBUTIONS, COPYRIGHT_NOTICE, PRIVACY_POLICY_SUMMARY, TERMS_SUMMARY } from '@/features/export/legal-content';
import { getLegalUrl, openLegalDocument, type LegalDocument } from '@/features/subscriptions/legal-links';
import { logger } from '@/lib/logger';
import { getAppInfo } from '@/services/monitoring/config';

const SUMMARIES: Record<LegalDocument, { title: string; body: string }> = {
  privacy: { title: 'Privacy Policy', body: PRIVACY_POLICY_SUMMARY },
  terms: { title: 'Terms of Use', body: TERMS_SUMMARY },
};

async function openUrl(url: string): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch (error) {
    logger.error('Could not open link', error);
  }
}

export default function AboutScreen() {
  const { version, platform } = getAppInfo();
  const [expanded, setExpanded] = useState<LegalDocument | null>(null);

  // Hosted documents open in the browser; until they're hosted, show the in-app summary.
  const openDocument = async (document: LegalDocument) => {
    if (await openLegalDocument(document)) return;
    setExpanded((current) => (current === document ? null : document));
  };

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: 'About' }} />

      <View style={styles.header} accessible accessibilityLabel={`Faithscroll version ${version}`}>
        <FaithText variant="display">Faithscroll</FaithText>
        <FaithText variant="secondary">{`Version ${version} · ${platform === 'ios' ? 'iOS' : platform}`}</FaithText>
        <FaithText variant="bodySerif">Read deeply. Listen carefully. Reflect meaningfully.</FaithText>
      </View>

      <Section title="Policies">
        {(['privacy', 'terms'] as const).map((document) => (
          <View key={document}>
            <ListRow
              icon={document === 'privacy' ? 'lock' : 'note'}
              title={SUMMARIES[document].title}
              subtitle={getLegalUrl(document) ? 'Opens in your browser' : 'Summary'}
              onPress={() => void openDocument(document)}
            />
            {expanded === document ? (
              <Card tone="muted">
                <FaithText variant="secondary" color="text">
                  {SUMMARIES[document].body}
                </FaithText>
              </Card>
            ) : null}
          </View>
        ))}
      </Section>

      <Section title="Acknowledgements">
        {ATTRIBUTIONS.map((item) => (
          <View key={item.title} style={styles.attribution}>
            <FaithText variant="heading">{item.title}</FaithText>
            <FaithText variant="secondary">{item.body}</FaithText>
            {item.url ? (
              <ListRow title="Visit website" subtitle={item.url} onPress={() => void openUrl(item.url as string)} />
            ) : null}
          </View>
        ))}
      </Section>

      <FaithText variant="caption" style={styles.copyright}>
        {COPYRIGHT_NOTICE}
      </FaithText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 6, marginTop: 16 },
  attribution: { gap: 4 },
  copyright: { marginTop: 32 },
});
