import { useCallback, useState } from 'react';

import type { AppDatabase } from '@/db/types';
import { logger } from '@/lib/logger';
import { nowIso } from '@/lib/time';
import { track } from '@/services/monitoring/analytics';
import { getAppInfo } from '@/services/monitoring/config';

import { buildExport, exportFileName, summarizeExport } from './build-export';
import { ExportError, shareExportFile } from './export-file';
import { deleteAllLocalData } from './wipe-local-data';

export type ActionStatus =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'done'; message: string }
  | { kind: 'error'; message: string };

const IDLE: ActionStatus = { kind: 'idle' };

/** Build the JSON export and open the share sheet. */
export function useExportData(db: AppDatabase) {
  const [status, setStatus] = useState<ActionStatus>(IDLE);

  const exportData = useCallback(async () => {
    setStatus({ kind: 'working' });
    try {
      const exportedAt = nowIso();
      const { version, platform } = getAppInfo();
      const document = buildExport(db, { exportedAt, appVersion: version, platform });
      await shareExportFile(JSON.stringify(document, null, 2), exportFileName(exportedAt));
      track({ name: 'data_exported' });
      setStatus({ kind: 'done', message: `Export ready: ${summarizeExport(document.counts)}.` });
    } catch (error) {
      logger.error('Data export failed', error, { code: error instanceof ExportError ? error.code : 'unknown' });
      const message =
        error instanceof ExportError && error.code === 'sharing_unavailable'
          ? 'Sharing isn’t available on this device, so the export can’t be saved.'
          : 'We couldn’t create your export. Your data is safe on this device — please try again.';
      setStatus({ kind: 'error', message });
    }
  }, [db]);

  return { status, exportData };
}

/** Delete everything on this device (after the screen's two-step confirmation). */
export function useDeleteLocalData(db: AppDatabase) {
  const [status, setStatus] = useState<ActionStatus>(IDLE);

  const deleteAll = useCallback(async () => {
    setStatus({ kind: 'working' });
    const { failedSteps } = await deleteAllLocalData(db);
    if (failedSteps.length === 0) {
      setStatus({ kind: 'done', message: 'Everything on this device has been deleted.' });
      return;
    }
    setStatus({
      kind: 'error',
      message:
        'Some data couldn’t be deleted. Please try again; if it keeps happening, deleting the app removes everything stored on this device.',
    });
  }, [db]);

  return { status, deleteAll };
}
