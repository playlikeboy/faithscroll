import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { formatTime, isValidTime } from '@/features/onboarding/reminder-time';
import type { ThemePreference } from '@/stores/preferences';

export const THEME_CHOICES: readonly { value: ThemePreference; title: string; description: string }[] = [
  { value: 'system', title: 'System', description: 'Match your device setting' },
  { value: 'light', title: 'Light', description: 'Warm paper tones' },
  { value: 'dark', title: 'Dark', description: 'Easy on the eyes at night' },
];

export function themeLabel(preference: ThemePreference): string {
  return THEME_CHOICES.find((choice) => choice.value === preference)?.title ?? 'System';
}

export function reminderSummary(time: string | null, enabled: boolean): string {
  if (!enabled || !isValidTime(time)) return 'Off';
  return `Daily at ${formatTime(time)}`;
}

export function formatVersion(version: string | null | undefined, build: string | null | undefined): string {
  const base = version?.trim() || '1.0.0';
  return build ? `${base} (${build})` : base;
}

/** "1.0.0 (1)" from the app config (expo-constants). */
export function appVersionLabel(): string {
  const config = Constants.expoConfig;
  const build = Platform.OS === 'ios' ? config?.ios?.buildNumber : config?.android?.versionCode?.toString();
  return formatVersion(config?.version, build ?? null);
}
