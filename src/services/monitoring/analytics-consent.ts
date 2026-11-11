import { useSyncExternalStore } from 'react';
import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { newId } from '@/lib/ids';

/**
 * The user's analytics choice (Settings → Your data) and a random install id that is not tied to
 * the account or the device. The id is cleared on opt-out and replaced when local data is deleted.
 */
export interface AnalyticsConsentState {
  enabled: boolean;
  installId: string | null;
  setEnabled: (enabled: boolean) => void;
  /** Returns the install id, creating one if needed. */
  ensureInstallId: () => string;
  resetInstallId: () => void;
}

export const useAnalyticsConsent = create<AnalyticsConsentState>()(
  persist(
    (set, get) => ({
      enabled: true,
      installId: null,
      setEnabled: (enabled) => set({ enabled, installId: enabled ? get().installId : null }),
      ensureInstallId: () => {
        const existing = get().installId;
        if (existing) return existing;
        const created = newId();
        set({ installId: created });
        return created;
      },
      resetInstallId: () => set({ installId: null }),
    }),
    {
      name: 'faithscroll.analytics',
      version: 1,
      storage: createJSONStorage(() => Storage),
      partialize: (state) => ({ enabled: state.enabled, installId: state.installId }),
    },
  ),
);

function subscribeHydration(onChange: () => void): () => void {
  const unsubscribeStart = useAnalyticsConsent.persist.onHydrate(onChange);
  const unsubscribeFinish = useAnalyticsConsent.persist.onFinishHydration(onChange);
  return () => {
    unsubscribeStart();
    unsubscribeFinish();
  };
}

export function isAnalyticsConsentHydrated(): boolean {
  return useAnalyticsConsent.persist.hasHydrated();
}

/** True once the stored choice has loaded (avoid showing a wrong toggle state on first frame). */
export function useAnalyticsConsentHydrated(): boolean {
  return useSyncExternalStore(subscribeHydration, isAnalyticsConsentHydrated);
}
