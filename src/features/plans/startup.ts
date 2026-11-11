import { db } from '@/db/client';

import { reconcilePlanReminders } from './plan-service';

/** Loaded lazily by `initNotifications` so the reminders contract never opens the database on import. */
export function reconcilePlanRemindersOnStartup(): Promise<void> {
  return reconcilePlanReminders(db);
}
