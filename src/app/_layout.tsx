import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme as NavigationTheme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { Appearance } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ErrorState, Screen } from '@/components/ui';
import { db } from '@/db/client';
import migrations from '@/db/migrations/migrations';
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
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
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

export default function RootLayout() {
  const fontsReady = useFaithFonts();
  const { success: migrated, error: migrationError } = useMigrations(db, migrations);
  const hydrated = usePreferencesHydrated();
  const themePreference = usePreferences((s) => s.themePreference);
  const navigationTheme = useNavigationTheme();
  const { scheme } = useTheme();

  useEffect(() => {
    Appearance.setColorScheme(themePreference === 'system' ? 'unspecified' : themePreference);
  }, [themePreference]);

  const ready = fontsReady && hydrated && (migrated || migrationError !== undefined);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

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

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={navigationTheme}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          {migrationError ? <DatabaseErrorScreen error={migrationError} /> : <RootStack />}
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
