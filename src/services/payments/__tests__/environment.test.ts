import * as WebBrowser from 'expo-web-browser';
import { NativeModules, Platform } from 'react-native';

import { getLegalUrl, openLegalDocument } from '@/features/subscriptions/legal-links';
import { getAnalyticsUrl, getAppInfo, getSentryDsn } from '@/services/monitoring/config';
import { getRevenueCatApiKey, isNativePurchasesAvailable } from '@/services/payments/environment';

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(async () => ({ type: 'opened' })) }));

const ENV_KEYS = [
  'EXPO_PUBLIC_REVENUECAT_IOS_KEY',
  'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY',
  'EXPO_PUBLIC_SENTRY_DSN',
  'EXPO_PUBLIC_ANALYTICS_URL',
  'EXPO_PUBLIC_PRIVACY_URL',
  'EXPO_PUBLIC_TERMS_URL',
] as const;
const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
const originalOS = Platform.OS;

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  Object.defineProperty(Platform, 'OS', { value: originalOS });
  delete (NativeModules as Record<string, unknown>).RNPurchases;
});

test('RevenueCat keys are read per platform and trimmed', () => {
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = '  appl_key  ';
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY = '';

  expect(getRevenueCatApiKey('ios')).toBe('appl_key');
  expect(getRevenueCatApiKey('android')).toBeNull();
  expect(getRevenueCatApiKey('web')).toBeNull();
});

test('native purchases are only available on iOS/Android with the native module', () => {
  Object.defineProperty(Platform, 'OS', { value: 'ios' });
  expect(isNativePurchasesAvailable()).toBe(false);

  (NativeModules as Record<string, unknown>).RNPurchases = {};
  expect(isNativePurchasesAvailable()).toBe(true);

  Object.defineProperty(Platform, 'OS', { value: 'web' });
  expect(isNativePurchasesAvailable()).toBe(false);
});

test('monitoring endpoints must be https URLs', () => {
  process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://public@o0.ingest.sentry.io/1';
  process.env.EXPO_PUBLIC_ANALYTICS_URL = 'http://insecure.example.com';

  expect(getSentryDsn()).toBe('https://public@o0.ingest.sentry.io/1');
  expect(getAnalyticsUrl()).toBeNull();
  expect(getAppInfo()).toEqual({ version: expect.any(String), platform: Platform.OS });
});

test('legal documents open hosted https URLs only', async () => {
  process.env.EXPO_PUBLIC_PRIVACY_URL = 'https://faithscroll.app/privacy';
  delete process.env.EXPO_PUBLIC_TERMS_URL;

  expect(getLegalUrl('privacy')).toBe('https://faithscroll.app/privacy');
  expect(getLegalUrl('terms')).toBeNull();
  await expect(openLegalDocument('privacy')).resolves.toBe(true);
  expect(jest.mocked(WebBrowser.openBrowserAsync)).toHaveBeenCalledWith('https://faithscroll.app/privacy');
  await expect(openLegalDocument('terms')).resolves.toBe(false);
});

test('a browser failure is reported as not opened', async () => {
  process.env.EXPO_PUBLIC_PRIVACY_URL = 'https://faithscroll.app/privacy';
  jest.mocked(WebBrowser.openBrowserAsync).mockRejectedValueOnce(new Error('no browser'));

  await expect(openLegalDocument('privacy')).resolves.toBe(false);
});
