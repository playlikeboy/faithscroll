import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export const EXPORTS_FOLDER = 'exports';

export class ExportError extends Error {
  constructor(
    readonly code: 'sharing_unavailable' | 'write_failed',
    message: string,
  ) {
    super(message);
    this.name = 'ExportError';
  }
}

function exportsDirectory(): Directory {
  return new Directory(Paths.cache, EXPORTS_FOLDER);
}

/** Remove earlier export files so personal data doesn't linger in the cache. */
export function clearExportFiles(): void {
  const directory = exportsDirectory();
  if (directory.exists) directory.delete();
}

/**
 * Write the export to the cache and open the share sheet (Files, AirDrop, email…).
 * The previous export is removed first; the newest stays until the next export or a data wipe,
 * because the receiving app may still be reading it after the sheet closes (Android).
 */
export async function shareExportFile(json: string, fileName: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new ExportError('sharing_unavailable', 'Sharing isn’t available on this device.');
  }

  let file: File;
  try {
    clearExportFiles();
    const directory = exportsDirectory();
    directory.create({ intermediates: true, idempotent: true });
    file = new File(directory, fileName);
    file.create({ overwrite: true });
    await file.write(json);
  } catch (error) {
    throw new ExportError('write_failed', error instanceof Error ? error.message : 'write failed');
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle: 'Export your Faithscroll data',
  });
}
