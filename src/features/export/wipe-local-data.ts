/**
 * "Delete all data on this device": removes every personal row, recordings on disk, export files,
 * scheduled reminders and local settings, and signs out on this device so cloud sync can't pull
 * the data straight back. Data already synced to the account is NOT deleted here — that is
 * "Delete account" (Settings → Account).
 */
import { Directory, Paths } from 'expo-file-system';
import Storage from 'expo-sqlite/kv-store';

import {
  actionItems,
  collectionItems,
  collections,
  entityLinks,
  entityTags,
  highlights,
  journalEntries,
  outbox,
  planDayCompletions,
  planProgress,
  prayerEntries,
  prayerUpdates,
  readingHistory,
  readingProgress,
  savedVerses,
  scriptureReferences,
  sermonBookmarks,
  sermonNotes,
  sermonRecaps,
  sermonRecordings,
  sermonSeries,
  sermons,
  syncConflicts,
  syncState,
  tags,
  transcriptSegments,
  transcripts,
  verseNotes,
} from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { signOut } from '@/features/auth/account-actions';
import { RECORDINGS_FOLDER } from '@/features/recording/recording-files';
import { cancelReminder, listScheduledReminderIds } from '@/features/reminders/notifications';
import { logger } from '@/lib/logger';
import { resetAnalyticsIdentity } from '@/services/monitoring/analytics';
import { useAnalyticsConsent } from '@/services/monitoring/analytics-consent';
import { usePreferences } from '@/stores/preferences';

import { clearExportFiles } from './export-file';

/** Children before parents (foreign keys are enforced). */
const USER_TABLES = [
  transcriptSegments,
  sermonRecaps,
  transcripts,
  sermonBookmarks,
  sermonNotes,
  sermonRecordings,
  sermons,
  sermonSeries,
  collectionItems,
  collections,
  prayerUpdates,
  prayerEntries,
  actionItems,
  journalEntries,
  entityTags,
  tags,
  entityLinks,
  scriptureReferences,
  highlights,
  savedVerses,
  verseNotes,
  planDayCompletions,
  planProgress,
  readingHistory,
  readingProgress,
  syncConflicts,
  outbox,
  syncState,
] as const;

/** Where expo-audio writes parts that were never moved into `recordings/` (interrupted sessions). */
const NATIVE_RECORDER_FOLDERS = ['ExpoAudio', 'Audio'] as const;

/** Hard-delete every personal row in one transaction. Nothing is queued for sync. */
export function wipeUserTables(db: AppDatabase): void {
  db.transaction((tx) => {
    for (const table of USER_TABLES) tx.delete(table).run();
  });
}

function deleteRecordingFiles(): void {
  for (const folder of [RECORDINGS_FOLDER, ...NATIVE_RECORDER_FOLDERS]) {
    const directory = new Directory(Paths.document, folder);
    if (directory.exists) directory.delete();
  }
}

async function cancelAllReminders(): Promise<void> {
  const ids = await listScheduledReminderIds();
  await Promise.all(ids.map((id) => cancelReminder(id)));
}

/** Clear app settings; keep the analytics opt-out choice (wiping must never re-enable analytics). */
async function resetLocalSettings(): Promise<void> {
  const analyticsEnabled = useAnalyticsConsent.getState().enabled;
  await Storage.clear();
  resetAnalyticsIdentity();
  useAnalyticsConsent.setState({ enabled: analyticsEnabled, installId: null });
  usePreferences.getState().resetPreferences();
}

export interface WipeResult {
  /** Steps that failed; the rest still ran. Empty on full success. */
  failedSteps: string[];
}

export async function deleteAllLocalData(db: AppDatabase): Promise<WipeResult> {
  const failedSteps: string[] = [];
  const step = async (name: string, run: () => void | Promise<void>) => {
    try {
      await run();
    } catch (error) {
      failedSteps.push(name);
      logger.error('Deleting local data: a step failed', error, { step: name });
    }
  };

  await step('reminders', cancelAllReminders);
  await step('sign_out', async () => {
    const outcome = await signOut();
    if (outcome.status === 'error') throw new Error('sign out failed');
  });
  await step('database', () => wipeUserTables(db));
  await step('recordings', deleteRecordingFiles);
  await step('exports', clearExportFiles);
  // Last: resetting preferences sends the app back to onboarding.
  await step('settings', resetLocalSettings);

  return { failedSteps };
}
