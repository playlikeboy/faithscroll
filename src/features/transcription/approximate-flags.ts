/**
 * Whether a transcript's timestamps were estimated (the transcription model returned text without
 * timestamps). The shared schema has no column for this yet, so it is kept as a device-local hint.
 */
import Storage from 'expo-sqlite/kv-store';
import { useEffect, useState } from 'react';

import { logger } from '@/lib/logger';

const key = (transcriptId: string) => `faithscroll.transcript.approximate.${transcriptId}`;

export async function setTimestampsApproximate(transcriptId: string, approximate: boolean): Promise<void> {
  try {
    if (approximate) await Storage.setItem(key(transcriptId), '1');
    else await Storage.removeItem(key(transcriptId));
  } catch (error) {
    logger.warn('Could not store transcript timestamp hint', { message: error instanceof Error ? error.message : 'unknown' });
  }
}

export async function areTimestampsApproximate(transcriptId: string): Promise<boolean> {
  try {
    return (await Storage.getItem(key(transcriptId))) === '1';
  } catch {
    return false;
  }
}

export function useTimestampsApproximate(transcriptId: string | null, version: number): boolean {
  const [state, setState] = useState<{ id: string; approximate: boolean } | null>(null);
  useEffect(() => {
    if (!transcriptId) return undefined;
    let active = true;
    void areTimestampsApproximate(transcriptId).then((approximate) => {
      if (active) setState({ id: transcriptId, approximate });
    });
    return () => {
      active = false;
    };
  }, [transcriptId, version]);
  return state !== null && state.id === transcriptId && state.approximate;
}
