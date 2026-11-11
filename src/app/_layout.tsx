import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  DarkTheme,
  DefaultTheme,
  router,
  Stack,
  ThemeProvider,
  usePathname,
  type Theme as NavigationTheme,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Appearance, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ErrorState, Screen } from '@/components/ui';
import { prepareDatabase } from '@/db/client';
import { useDatabaseMigrations } from '@/db/migrate';
import { prepareBibleDatabase } from '@/features/bible/db/connection';
import { initNotifications } from '@/features/reminders/notifications';
import { initSync } from '@/features/sync/init';
import { syncVerseWidget } from '@/features/widgets/sync-verse-widget';
import { logger } from '@/lib/logger';
import { initMonitoring } from '@/services/monitoring/init';
import { initPayments } from '@/services/payments/init';
import { usePreferences, usePreferencesHydrated } from '@/stores/preferences';
import { useTheme } from '@/theme';
import { useFaithFonts } from '@/theme/fonts';

void SplashScreen.preventAutoHideAsync();
initMonitoring();
initPayments();
// Copy the bundled Bible (~13 MB) on first launch before the reader needs it; queries retry on failure.
prepareBibleDatabase().catch((error: unknown) => logger.error('Preparing the Bible database failed', error));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 60_000 } },
});

function useNavigationTheme(): NavigationTheme {
  const { scheme, colors } = useTheme();
  return useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primaryText,
        background: colors.background,
        card: colors.background,
        text: colors.text,
        border: colors.border,
        notification: colors.recording,
      },
    };
  }, [scheme, colors]);
}

function RootStack() {
  const { colors, fonts } = useTheme();
  const onboardingCompleted = usePreferences((s) => s.onboardingCompleted);
  const pathname = usePathname();

  // The Protected guard alone falls back to an arbitrary first route; send first-run users to onboarding.
  useEffect(() => {
    if (!onboardingCompleted && !pathname.startsWith('/onboarding')) router.replace('/onboarding');
  }, [onboardingCompleted, pathname]);

  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: 'minimal',
        headerShadowVisible: false,
        headerTintColor: colors.primaryText,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontFamily: fonts.serifMedium, color: colors.text },
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Protected guard={!onboardingCompleted}>
        <Stack.Screen name="onboarding/index" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={onboardingCompleted}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Home' }} />
      </Stack.Protected>

      {/* Sheets & modals: presentation must be declared here, before the screen mounts. */}
      <Stack.Screen
        name="bible/verse-actions"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.5, 0.92],
          sheetGrabberVisible: true,
          sheetCornerRadius: 24,
          headerShown: false,
        }}
      />
      <Stack.Screen name="bible/books" options={{ presentation: 'modal', title: 'Books' }} />
      <Stack.Screen name="bible/passage-picker" options={{ presentation: 'modal', title: 'Choose a passage' }} />
      <Stack.Screen name="links/picker" options={{ presentation: 'modal', title: 'Link' }} />
      <Stack.Screen
        name="sermons/record/[id]"
        options={{ presentation: 'fullScreenModal', headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen name="paywall" options={{ presentation: 'modal', headerShown: false }} />
    </Stack>
  );
}

function DatabaseErrorScreen({ error }: { error: Error }) {
  return (
    <Screen title="Faithscroll">
      <ErrorState
        title="We couldn't open your library"
        message={`Your notes are safe on this device, but the database failed to start. Please restart the app. (${error.message})`}
      />
    </Screen>
  );
}

interface DatabaseState {
  isReady: boolean;
  error: Error | null;
}

/** Waits for `prepareDatabase()` (immediate on native; warms the SQLite worker on web). */
function useDatabaseReady(): DatabaseState {
  const [state, setState] = useState<DatabaseState>({ isReady: false, error: null });
  useEffect(() => {
    let isActive = true;
    // Web: SQLite runs in one shared worker and sync calls time out while it is busy, so let the
    // one-off 13 MB Bible copy finish before opening the user database. Native opens instantly.
    const bibleFirst =
      Platform.OS === 'web' ? prepareBibleDatabase().catch(() => undefined) : Promise.resolve();
    bibleFirst.then(prepareDatabase).then(
      () => isActive && setState({ isReady: true, error: null }),
      (error: unknown) => isActive && setState({ isReady: false, error: error instanceof Error ? error : new Error(String(error)) }),
    );
    return () => {
      isActive = false;
    };
  }, []);
  return state;
}

/** Runs migrations, then starts background services and shows the app (or a database error). */
function MigratedApp() {
  const { success: migrated, error: migrationError } = useDatabaseMigrations();

  useEffect(() => {
    if (migrated || migrationError) void SplashScreen.hideAsync();
  }, [migrated, migrationError]);

  // Background services start only after the local database is migrated.
  useEffect(() => {
    if (!migrated) return undefined;
    const stopNotifications = initNotifications();
    const stopSync = initSync();
    void syncVerseWidget();
    return () => {
      stopNotifications();
      stopSync();
    };
  }, [migrated]);

  if (migrationError) return <DatabaseErrorScreen error={migrationError} />;
  if (!migrated) return null;
  return <RootStack />;
}

export default function RootLayout() {
  const fontsReady = useFaithFonts();
  const hydrated = usePreferencesHydrated();
  const database = useDatabaseReady();
  const themePreference = usePreferences((s) => s.themePreference);
  const navigationTheme = useNavigationTheme();
  const { scheme } = useTheme();

  useEffect(() => {
    // Not implemented by react-native-web; the web preview simply follows the system theme.
    if (typeof Appearance.setColorScheme !== 'function') return;
    Appearance.setColorScheme(themePreference === 'system' ? 'unspecified' : themePreference);
  }, [themePreference]);

  useEffect(() => {
    if (database.error) void SplashScreen.hideAsync();
  }, [database.error]);

  if (!fontsReady || !hydrated || (!database.isReady && !database.error)) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={navigationTheme}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          {database.error ? <DatabaseErrorScreen error={database.error} /> : <MigratedApp />}
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
