import { useRouter, type Href } from 'expo-router';
import { StyleSheet } from 'react-native';

import { FaithText, ListRow, Screen } from '@/components/ui';
import { useSession } from '@/features/auth/use-session';
import { scriptureSizeLabel } from '@/features/settings/scripture-size';
import { appVersionLabel, reminderSummary, themeLabel } from '@/features/settings/summaries';
import { useEntitlements } from '@/features/subscriptions/use-entitlements';
import { usePreferences } from '@/stores/preferences';

import { ReadingGoalRow } from './reading-goal-row';
import { SettingsGroup } from './settings-group';

/** Routes owned by other agents (library, backend-auth, monetization). */
const SETTINGS_ROUTES = {
  appearance: '/settings/appearance' as Href,
  reminders: '/settings/reminders' as Href,
  account: '/settings/account' as Href,
  subscription: '/settings/subscription' as Href,
  data: '/settings/data' as Href,
  about: '/settings/about' as Href,
};

export function SettingsScreen() {
  const router = useRouter();
  const themePreference = usePreferences((s) => s.themePreference);
  const sizeIndex = usePreferences((s) => s.scriptureSizeIndex);
  const readingGoal = usePreferences((s) => s.readingGoal);
  const setReadingGoal = usePreferences((s) => s.setReadingGoal);
  const reminderTime = usePreferences((s) => s.dailyReminderTime);
  const reminderEnabled = usePreferences((s) => s.dailyReminderEnabled);
  const { userId } = useSession();
  const { isPlus } = useEntitlements();

  return (
    <Screen edges={[]}>
      <SettingsGroup title="Preferences">
        <ListRow
          icon="textSize"
          title="Appearance"
          subtitle={`${themeLabel(themePreference)} · ${scriptureSizeLabel(sizeIndex)} text`}
          onPress={() => router.push(SETTINGS_ROUTES.appearance)}
        />
        <ListRow
          icon="bell"
          title="Reminders"
          subtitle={reminderSummary(reminderTime, reminderEnabled)}
          onPress={() => router.push(SETTINGS_ROUTES.reminders)}
        />
        <ReadingGoalRow goal={readingGoal} onChange={setReadingGoal} />
      </SettingsGroup>

      <SettingsGroup
        title="Account"
        footer="An account is optional. Faithscroll works fully on this device; sign in for sync and AI features.">
        <ListRow
          icon="person"
          title="Account"
          subtitle={userId ? 'Signed in' : 'Not signed in'}
          onPress={() => router.push(SETTINGS_ROUTES.account)}
        />
        <ListRow
          icon="sparkles"
          title="Subscription"
          subtitle={isPlus ? 'Faithscroll Plus' : 'Free'}
          onPress={() => router.push(SETTINGS_ROUTES.subscription)}
        />
      </SettingsGroup>

      <SettingsGroup title="Privacy">
        <ListRow
          icon="lock"
          title="Your data & privacy"
          subtitle="Export or delete what's stored on this device"
          onPress={() => router.push(SETTINGS_ROUTES.data)}
        />
        <ListRow icon="info" title="About" subtitle="Licences, attribution and terms" onPress={() => router.push(SETTINGS_ROUTES.about)} />
      </SettingsGroup>

      <FaithText variant="caption" align="center" style={styles.version}>
        Faithscroll {appVersionLabel()}
      </FaithText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  version: { marginTop: 32 },
});
