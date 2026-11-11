import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { StatusMessage, SubscriptionStatusCard } from '@/components/paywall';
import { FaithButton, FaithText, ListRow, Screen, Section } from '@/components/ui';
import { DOWNGRADE_PROMISE, describeSubscription, storeName } from '@/features/subscriptions/plan-content';
import { useSubscriptionStatus } from '@/features/subscriptions/use-entitlements';
import { usePaymentsIdentitySync } from '@/features/subscriptions/use-payments-identity';
import { usePurchaseFlow } from '@/features/subscriptions/use-purchase-flow';
import { openManageSubscriptions, refreshCustomerInfo } from '@/services/payments/purchases';

export default function SubscriptionSettingsScreen() {
  const router = useRouter();
  const { requiresSignIn } = usePaymentsIdentitySync();
  const { isAvailable, status, snapshot } = useSubscriptionStatus();
  const flow = usePurchaseFlow();
  const [manageError, setManageError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refreshCustomerInfo();
    }, []),
  );

  const manage = async () => {
    setManageError(null);
    const opened = await openManageSubscriptions(snapshot.managementUrl);
    if (!opened) {
      setManageError(`We couldn’t open ${storeName(snapshot.store)}. You can manage subscriptions in your store account settings.`);
    }
  };

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: 'Subscription' }} />
      <View style={styles.top}>
        <SubscriptionStatusCard summary={describeSubscription(snapshot)} isPlus={snapshot.isPlus} />
      </View>

      {!isAvailable ? (
        <FaithText variant="secondary" style={styles.note}>
          Subscriptions aren’t available in this version of the app. All free features keep working.
        </FaithText>
      ) : null}
      {status === 'error' ? (
        <FaithText variant="secondary" style={styles.note}>
          We couldn’t check your subscription just now. If you have Plus, it will reappear when you’re back online.
        </FaithText>
      ) : null}

      <Section title="Manage">
        {snapshot.isPlus ? null : (
          <ListRow
            icon="sparkles"
            title="See Faithscroll Plus"
            subtitle="What’s included, limits and prices"
            onPress={() => router.push({ pathname: '/paywall', params: { source: 'settings' } })}
          />
        )}
        {snapshot.isPlus || snapshot.expiresAt ? (
          <ListRow
            icon="settings"
            title="Manage subscription"
            subtitle={`Change or cancel in ${storeName(snapshot.store)}`}
            onPress={() => void manage()}
          />
        ) : null}
        {isAvailable ? (
          <FaithButton
            label={requiresSignIn ? 'Sign in to restore purchases' : 'Restore purchases'}
            variant="secondary"
            onPress={() => (requiresSignIn ? router.push('/auth/sign-in') : void flow.restore())}
            isLoading={flow.busy === 'restore'}
            accessibilityHint="Unlocks Plus if you subscribed before with this store account"
          />
        ) : null}
        <StatusMessage message={manageError ? { tone: 'error', text: manageError } : flow.message} />
      </Section>

      <Section title="Your content is safe">
        <FaithText variant="secondary">{DOWNGRADE_PROMISE}</FaithText>
        <FaithText variant="secondary">
          Subscriptions are billed by Apple or Google. To cancel, use “Manage subscription” at least 24 hours before your
          renewal date. Deleting the app doesn’t cancel a subscription.
        </FaithText>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { marginTop: 12 },
  note: { marginTop: 12 },
});
