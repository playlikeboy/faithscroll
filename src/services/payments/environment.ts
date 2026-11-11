import { NativeModules, Platform } from 'react-native';

/** RevenueCat entitlement identifier for "Faithscroll Plus" (configure the same id in the dashboard). */
export const PLUS_ENTITLEMENT_ID = 'plus';

/**
 * Public RevenueCat SDK key for the given platform, or null when not configured.
 * `process.env.EXPO_PUBLIC_*` must be read with dot access so Expo inlines it at build time.
 */
export function getRevenueCatApiKey(os: string = Platform.OS): string | null {
  let key: string | undefined;
  if (os === 'ios') key = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
  else if (os === 'android') key = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
  const trimmed = key?.trim();
  return trimmed ? trimmed : null;
}

/**
 * True only in a native iOS/Android build that includes the RevenueCat module.
 * False in Expo Go (RevenueCat would fall back to a mock "preview" mode), on web and in Jest.
 */
export function isNativePurchasesAvailable(): boolean {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  return NativeModules.RNPurchases != null;
}
