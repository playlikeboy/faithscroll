/**
 * Plays a sermon's recording parts back to back as one timeline (gapless expo-audio playlist).
 * Positions are always on the sermon timeline (see `timeline.ts`).
 */
import { useAudioPlaylist, useAudioPlaylistStatus, type AudioPlaylist } from 'expo-audio';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { enablePlaybackAudioMode } from '@/features/recording/audio-mode';
import { logger } from '@/lib/logger';

import { clampPosition, locate, nextRate, type Timeline } from './timeline';

const UPDATE_INTERVAL_MS = 250;
const END_TOLERANCE_MS = 500;

export interface PlayerMetadata {
  title: string;
  artist: string | null;
}

export interface SermonPlayer {
  positionMs: number;
  totalMs: number;
  isPlaying: boolean;
  isBuffering: boolean;
  rate: number;
  partIndex: number;
  play: () => Promise<void>;
  pause: () => void;
  toggle: () => void;
  seekTo: (positionMs: number, options?: { play?: boolean }) => Promise<void>;
  skip: (deltaMs: number) => void;
  cycleRate: () => void;
}

// Writes to the native shared object live outside the component (React Compiler treats hook results as immutable).
function applyRate(playlist: AudioPlaylist, rate: number): void {
  try {
    playlist.playbackRate = rate;
  } catch (error) {
    logger.warn('Could not set playback rate', { message: error instanceof Error ? error.message : 'unknown' });
  }
}

function showOnLockScreen(playlist: AudioPlaylist, metadata: PlayerMetadata): void {
  try {
    playlist.setActiveForLockScreen(true, { title: metadata.title, artist: metadata.artist ?? undefined });
  } catch (error) {
    logger.warn('Lock screen controls unavailable', { message: error instanceof Error ? error.message : 'unknown' });
  }
}

export function useSermonPlayer(timeline: Timeline, metadata: PlayerMetadata): SermonPlayer {
  const sources = useMemo(() => timeline.parts.map((part) => ({ uri: part.uri, name: metadata.title })), [timeline, metadata.title]);
  const playlist = useAudioPlaylist({ sources, updateInterval: UPDATE_INTERVAL_MS, loop: 'none' });
  const status = useAudioPlaylistStatus(playlist);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    applyRate(playlist, rate);
  }, [playlist, rate]);

  useEffect(
    () => () => {
      try {
        playlist.clearLockScreenControls();
      } catch {
        // already released
      }
    },
    [playlist],
  );

  const partIndex = Math.min(Math.max(0, status.currentIndex), Math.max(0, timeline.parts.length - 1));
  const part = timeline.parts[partIndex];
  const positionMs = part ? clampPosition(part.offsetMs + Math.round(status.currentTime * 1000), timeline.totalMs) : 0;

  const seekTo = useCallback(
    async (target: number, options: { play?: boolean } = {}) => {
      const location = locate(timeline, target);
      if (!location) return;
      try {
        if (location.index !== playlist.currentIndex) playlist.skipTo(location.index);
        await playlist.seekTo(location.localMs / 1000);
        if (options.play) {
          await enablePlaybackAudioMode();
          showOnLockScreen(playlist, metadata);
          playlist.play();
        }
      } catch (error) {
        logger.error('Seek failed', error);
      }
    },
    [playlist, timeline, metadata],
  );

  const play = useCallback(async () => {
    if (timeline.parts.length === 0) return;
    const atEnd = positionMs >= timeline.totalMs - END_TOLERANCE_MS;
    if (atEnd) {
      await seekTo(0, { play: true });
      return;
    }
    try {
      await enablePlaybackAudioMode();
    } catch (error) {
      logger.error('Could not configure audio for playback', error);
    }
    showOnLockScreen(playlist, metadata);
    applyRate(playlist, rate);
    playlist.play();
  }, [playlist, positionMs, timeline, seekTo, metadata, rate]);

  const pause = useCallback(() => playlist.pause(), [playlist]);
  const toggle = useCallback(() => (status.playing ? pause() : void play()), [status.playing, pause, play]);
  const skip = useCallback((deltaMs: number) => void seekTo(clampPosition(positionMs + deltaMs, timeline.totalMs)), [seekTo, positionMs, timeline.totalMs]);
  const cycleRate = useCallback(() => setRate((current) => nextRate(current)), []);

  return {
    positionMs,
    totalMs: timeline.totalMs,
    isPlaying: status.playing,
    isBuffering: status.isBuffering,
    rate,
    partIndex,
    play,
    pause,
    toggle,
    seekTo,
    skip,
    cycleRate,
  };
}
