import Constants from 'expo-constants';
import { Platform } from 'react-native';

function httpsUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && /^https:\/\/[^\s]+$/.test(trimmed) ? trimmed : null;
}

/** Sentry DSN (public). Null disables crash reporting. Dot access so Expo inlines it at build time. */
export function getSentryDsn(): string | null {
  return httpsUrl(process.env.EXPO_PUBLIC_SENTRY_DSN);
}

/** Endpoint that receives batched, content-free analytics events. Null = analytics stay on device. */
export function getAnalyticsUrl(): string | null {
  return httpsUrl(process.env.EXPO_PUBLIC_ANALYTICS_URL);
}

export interface AppInfo {
  version: string;
  platform: string;
}

export function getAppInfo(): AppInfo {
  return { version: Constants.expoConfig?.version ?? 'unknown', platform: Platform.OS };
}
