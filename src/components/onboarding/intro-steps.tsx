import { StyleSheet, View } from 'react-native';

import { Card, FaithText, Icon } from '@/components/ui';
import { CORE_CONCEPTS, STEP_TITLES } from '@/features/onboarding/steps';
import { useTheme } from '@/theme';

const PROMISE = ['Read deeply.', 'Listen carefully.', 'Reflect meaningfully.'];

export function WelcomeStep() {
  const { colors } = useTheme();
  return (
    <View style={styles.welcome}>
      <View style={[styles.mark, { backgroundColor: colors.primary }]}>
        <Icon name="bible" size={30} color={colors.onPrimary} />
      </View>
      <FaithText variant="display" accessibilityRole="header">
        Faithscroll
      </FaithText>
      <View style={[styles.rule, { backgroundColor: colors.gold }]} />
      <View accessible accessibilityLabel={PROMISE.join(' ')}>
        {PROMISE.map((line) => (
          <FaithText key={line} variant="title" style={styles.promiseLine}>
            {line}
          </FaithText>
        ))}
      </View>
      <FaithText variant="body" color="textSecondary" style={styles.lede}>
        A quiet, private place for Scripture, sermons, journaling and prayer — kept together so the moments that
        matter stay connected.
      </FaithText>
    </View>
  );
}

export function ConceptsStep() {
  const { colors } = useTheme();
  return (
    <View style={styles.stack}>
      <FaithText variant="display" accessibilityRole="header">
        {STEP_TITLES.concepts}
      </FaithText>
      <FaithText variant="body" color="textSecondary">
        Four simple spaces that work together.
      </FaithText>
      <View style={styles.concepts}>
        {CORE_CONCEPTS.map((concept) => (
          <Card key={concept.key} style={styles.conceptCard}>
            <View style={styles.conceptRow} accessible accessibilityLabel={`${concept.title}. ${concept.description}`}>
              <View style={[styles.conceptIcon, { backgroundColor: colors.surfaceMuted }]}>
                <Icon name={concept.icon} size={22} color={colors.primaryText} />
              </View>
              <View style={styles.conceptText}>
                <FaithText variant="heading">{concept.title}</FaithText>
                <FaithText variant="secondary">{concept.description}</FaithText>
              </View>
            </View>
          </Card>
        ))}
      </View>
    </View>
  );
}

export function ReadyStep() {
  const { colors } = useTheme();
  return (
    <View style={styles.stack}>
      <FaithText variant="display" accessibilityRole="header">
        {STEP_TITLES.ready}
      </FaithText>
      <FaithText variant="bodySerif">
        Today&apos;s verse is waiting for you. Read it now, or open the Bible wherever you like.
      </FaithText>
      <Card tone="muted" style={styles.accountCard}>
        <View style={styles.conceptRow}>
          <Icon name="cloud" size={22} color={colors.primaryText} />
          <View style={styles.conceptText}>
            <FaithText variant="heading">An account is optional</FaithText>
            <FaithText variant="secondary">
              Everything works privately on this device. If you&apos;d like to sync across devices or use AI study
              tools, you can create an account later in Settings.
            </FaithText>
          </View>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  welcome: { flex: 1, justifyContent: 'center', gap: 16, paddingVertical: 24 },
  mark: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  rule: { width: 40, height: 2, borderRadius: 1 },
  promiseLine: { marginVertical: 2 },
  lede: { marginTop: 8 },
  stack: { gap: 12 },
  concepts: { gap: 10, marginTop: 12 },
  conceptCard: { paddingVertical: 14 },
  conceptRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  conceptIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  conceptText: { flex: 1, gap: 2 },
  accountCard: { marginTop: 16 },
});
