/**
 * In-flight uploads per sermon, so progress survives leaving and re-opening the transcript screen
 * while the JS runtime is alive. Abort controllers live outside React state.
 */
import { create } from 'zustand';

import type { UploadProgress } from './actions';

export interface InFlightUpload extends UploadProgress {
  phase: 'uploading' | 'starting';
}

interface UploadStoreState {
  bySermon: Record<string, InFlightUpload>;
  begin: (sermonId: string) => void;
  progress: (sermonId: string, progress: UploadProgress) => void;
  starting: (sermonId: string) => void;
  end: (sermonId: string) => void;
}

const controllers = new Map<string, AbortController>();

export const useTranscriptionUploads = create<UploadStoreState>()((set) => ({
  bySermon: {},
  begin: (sermonId) =>
    set((state) => ({ bySermon: { ...state.bySermon, [sermonId]: { phase: 'uploading', partIndex: 0, partCount: 1, fraction: 0 } } })),
  progress: (sermonId, progress) =>
    set((state) => ({ bySermon: { ...state.bySermon, [sermonId]: { phase: 'uploading', ...progress } } })),
  starting: (sermonId) =>
    set((state) => {
      const current = state.bySermon[sermonId];
      return current ? { bySermon: { ...state.bySermon, [sermonId]: { ...current, phase: 'starting', fraction: 1 } } } : state;
    }),
  end: (sermonId) =>
    set((state) => {
      const { [sermonId]: _removed, ...rest } = state.bySermon;
      return { bySermon: rest };
    }),
}));

export function registerUploadController(sermonId: string): AbortController {
  controllers.get(sermonId)?.abort();
  const controller = new AbortController();
  controllers.set(sermonId, controller);
  return controller;
}

export function releaseUploadController(sermonId: string, controller: AbortController): void {
  if (controllers.get(sermonId) === controller) controllers.delete(sermonId);
}

export function cancelTranscriptionUpload(sermonId: string): void {
  controllers.get(sermonId)?.abort();
}
