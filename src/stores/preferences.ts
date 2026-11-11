import { useSyncExternalStore } from 'react';
import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_SCRIPTURE_SIZE_INDEX, SCRIPTURE_SIZES } from '@/theme/typography';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ReadingGoal = 'daily_chapter' | 'few_times_week' | 'explore' | 'sermons';

export interface PreferencesState {
  themePreference: ThemePreference;
  scriptureSizeIndex: number;
  translationId: string;
  readingGoal: ReadingGoal | null;
  /** Preferred daily reminder time "HH:mm" chosen in onboarding/settings. Scheduling happens elsewhere. */
  dailyReminderTime: string | null;
  dailyReminderEnabled: boolean;
  onboardingCompleted: boolean;
  /** Today's optional intention, keyed by local date so it resets daily. */
  dailyIntention: { date: string; text: string } | null;
  /** When the user acknowledged the recording-consent explanation (ISO), or null. */
  recordingConsentAt: string | null;
  /** When the user first acknowledged the cloud AI processing disclosure (ISO), or null. */
  aiProcessingConsentAt: string | null;

  setThemePreference: (value: ThemePreference) => void;
  setScriptureSizeIndex: (value: number) => void;
  setReadingGoal: (value: ReadingGoal | null) => void;
  setDailyReminder: (time: string | null, enabled: boolean) => void;
  completeOnboarding: () => void;
  setDailyIntention: (value: { date: string; text: string } | null) => void;
  acknowledgeRecordingConsent: () => void;
  acknowledgeAiProcessingConsent: () => void;
  resetPreferences: () => void;
}

const defaults = {
  themePreference: 'system' as ThemePreference,
  scriptureSizeIndex: DEFAULT_SCRIPTURE_SIZE_INDEX,
  translationId: 'WEB',
  readingGoal: null,
  dailyReminderTime: null,
  dailyReminderEnabled: false,
  onboardingCompleted: false,
  dailyIntention: null,
  recordingConsentAt: null,
  aiProcessingConsentAt: null,
};

function clampSizeIndex(value: number): number {
  return Math.min(SCRIPTURE_SIZES.length - 1, Math.max(0, Math.round(value)));
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      ...defaults,
      setThemePreference: (themePreference) => set({ themePreference }),
      setScriptureSizeIndex: (value) => set({ scriptureSizeIndex: clampSizeIndex(value) }),
      setReadingGoal: (readingGoal) => set({ readingGoal }),
      setDailyReminder: (dailyReminderTime, dailyReminderEnabled) => set({ dailyReminderTime, dailyReminderEnabled }),
      completeOnboarding: () => set({ onboardingCompleted: true }),
      setDailyIntention: (dailyIntention) => set({ dailyIntention }),
      acknowledgeRecordingConsent: () => set({ recordingConsentAt: new Date().toISOString() }),
      acknowledgeAiProcessingConsent: () => set({ aiProcessingConsentAt: new Date().toISOString() }),
      resetPreferences: () => set({ ...defaults }),
    }),
    {
      name: 'faithscroll.preferences',
      version: 1,
      storage: createJSONStorage(() => Storage),
      partialize: (state) => ({
        themePreference: state.themePreference,
        scriptureSizeIndex: state.scriptureSizeIndex,
        translationId: state.translationId,
        readingGoal: state.readingGoal,
        dailyReminderTime: state.dailyReminderTime,
        dailyReminderEnabled: state.dailyReminderEnabled,
        onboardingCompleted: state.onboardingCompleted,
        dailyIntention: state.dailyIntention,
        recordingConsentAt: state.recordingConsentAt,
        aiProcessingConsentAt: state.aiProcessingConsentAt,
      }),
    },
  ),
);

function subscribeHydration(onChange: () => void): () => void {
  const unsubscribeStart = usePreferences.persist.onHydrate(onChange);
  const unsubscribeFinish = usePreferences.persist.onFinishHydration(onChange);
  return () => {
    unsubscribeStart();
    unsubscribeFinish();
  };
}

/** True once persisted preferences have been loaded from disk. */
export function usePreferencesHydrated(): boolean {
  return useSyncExternalStore(subscribeHydration, () => usePreferences.persist.hasHydrated());
}
