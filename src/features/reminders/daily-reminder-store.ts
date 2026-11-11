import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Bookkeeping for the daily reading reminder: which OS notification is scheduled and for what time.
 * The user's choice itself (enabled + "HH:mm") lives in `usePreferences`.
 */
export interface DailyReminderState {
  notificationId: string | null;
  /** "HH:mm" the scheduled notification fires at. */
  scheduledTime: string | null;
  setScheduled: (notificationId: string, scheduledTime: string) => void;
  clearScheduled: () => void;
}

export const useDailyReminderStore = create<DailyReminderState>()(
  persist(
    (set) => ({
      notificationId: null,
      scheduledTime: null,
      setScheduled: (notificationId, scheduledTime) => set({ notificationId, scheduledTime }),
      clearScheduled: () => set({ notificationId: null, scheduledTime: null }),
    }),
    {
      name: 'faithscroll.reminders.daily',
      version: 1,
      storage: createJSONStorage(() => Storage),
      partialize: (state) => ({ notificationId: state.notificationId, scheduledTime: state.scheduledTime }),
    },
  ),
);

interface HydratableStore {
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (listener: () => void) => () => void;
  };
}

/** Resolves once a persisted Zustand store has loaded from disk. */
export function whenHydrated(store: HydratableStore): Promise<void> {
  if (store.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = store.persist.onFinishHydration(() => {
      unsubscribe();
      resolve();
    });
  });
}
