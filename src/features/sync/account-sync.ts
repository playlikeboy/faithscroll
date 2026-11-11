/** Sync housekeeping around account deletion (used by the Account screen). */
import { useSyncStore } from './store';

export { prepareLocalDataForNextAccount } from './engine';

/** After account deletion (either path): turn sync off and forget the sync status. */
export function resetSyncAfterAccountDeletion(): void {
  const store = useSyncStore.getState();
  store.setCloudSyncEnabled(false);
  store.resetSyncStatus();
}
