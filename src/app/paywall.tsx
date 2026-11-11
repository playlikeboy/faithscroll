import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  FeatureList,
  LegalFooter,
  LimitsTable,
  PlanPicker,
  StatusMessage,
  SubscriptionStatusCard,
} from '@/components/paywall';
import { FaithButton, FaithText, IconButton, Screen, Section } from '@/components/ui';
import { openLegalDocument, type LegalDocument } from '@/features/subscriptions/legal-links';
import {
  DOWNGRADE_PROMISE,
  FREE_FOREVER,
  LIMIT_NOTES,
  MONTHLY_LIMITS,
  PLUS_ADDS,
  describeSubscription,
} from '@/features/subscriptions/plan-content';
import { usePaywall } from '@/features/subscriptions/use-paywall';
import { openManageSubscriptions } from '@/services/payments/purchases';

/** Faithscroll Plus: calm, editorial, no countdowns. `?source=` names the screen that opened it (analytics only). */
export default function PaywallScreen() {
  const { source } = useLocalSearchParams<{ source?: string }>();
  const router = useRouter();
  const model = usePaywall(source);
  const { subscription, plans, selected, flow } = model;
  const isPlus = subscription.snapshot.isPlus;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const openLegal = async (document: LegalDocument) => {
    if (!(await openLegalDocument(document))) router.push('/settings/about');
  };
  const buy = async () => {
    if (model.requiresSignIn) {
      router.push('/auth/sign-in');
      return;
    }
    await model.buySelected();
  };
  const restore = async () => {
    if (model.requiresSignIn) {
      router.push('/auth/sign-in');
      return;
    }
    await flow.restore();
  };

  return (
    <Screen
      eyebrow="Faithscroll Plus"
      title={isPlus ? 'Thank you for your support' : 'Go deeper, at your own pace'}
      edges={['top', 'bottom']}
      headerRight={<IconButton icon="close" accessibilityLabel="Close" onPress={close} filled />}>
      <FaithText variant="bodySerif">
        Faithscroll’s essentials are free, for good. Plus adds deeper study and more room for your sermons, and helps
        keep Faithscroll independent, private and ad-free.
      </FaithText>

      {isPlus ? (
        <View style={styles.block}>
          <SubscriptionStatusCard summary={describeSubscription(subscription.snapshot)} isPlus />
          <StatusMessage message={flow.message} />
          <FaithButton
            label="Manage subscription"
            variant="secondary"
            onPress={() => void openManageSubscriptions(subscription.snapshot.managementUrl)}
          />
          <FaithButton label="Done" onPress={close} />
        </View>
      ) : null}

      <Section title="Always free">
        <FeatureList items={FREE_FOREVER} tone="free" />
      </Section>

      <Section title="Plus adds">
        <FeatureList items={PLUS_ADDS} tone="plus" />
      </Section>

      <Section title="AI and storage limits">
        <LimitsTable rows={MONTHLY_LIMITS} notes={LIMIT_NOTES} />
        <FaithText variant="secondary">{DOWNGRADE_PROMISE}</FaithText>
      </Section>

      {isPlus ? null : (
        <Section title="Choose a plan">
          <PlanPicker plans={plans} selectedId={selected?.id ?? null} onSelect={model.select} />
          <StatusMessage message={flow.message} />
          {model.requiresSignIn && plans.kind === 'ready' ? (
            <FaithText variant="secondary">
              Plus is linked to your Faithscroll account so it works on all your devices and with AI features. Sign in
              or create a free account first.
            </FaithText>
          ) : null}
          {plans.kind === 'ready' && model.cta ? (
            <FaithButton
              label={model.requiresSignIn ? 'Sign in to continue' : model.cta}
              onPress={() => void buy()}
              isLoading={flow.busy === 'purchase'}
              isDisabled={flow.busy !== null}
              fullWidth
            />
          ) : null}
        </Section>
      )}

      <View style={styles.footer}>
        {subscription.isAvailable ? (
          <FaithButton
            label={model.requiresSignIn ? 'Sign in to restore purchases' : 'Restore purchases'}
            variant="ghost"
            onPress={() => void restore()}
            isLoading={flow.busy === 'restore'}
            isDisabled={flow.busy !== null}
            accessibilityHint="Unlocks Plus if you subscribed before with this store account"
          />
        ) : null}
        <LegalFooter
          disclosure={isPlus ? null : model.disclosure}
          onOpenTerms={() => void openLegal('terms')}
          onOpenPrivacy={() => void openLegal('privacy')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: 12, marginTop: 20 },
  footer: { marginTop: 28, gap: 12 },
});
