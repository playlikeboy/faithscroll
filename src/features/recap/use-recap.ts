/**
 * Recap screen state: local recap (editable), generation from transcript or notes, job polling,
 * and "Live It Out" → action items.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { db } from '@/db/client';
import { useSession } from '@/features/auth/use-session';
import { useRecordings, useSermon, useSermonNote } from '@/features/sermons/hooks';
import { useDbQuery } from '@/features/sermons/use-db-query';
import { eligibleRecordings, totalDurationMs } from '@/features/transcription/actions';
import { getLatestTranscript, listSegments, type SegmentRow, type TranscriptRow } from '@/features/transcription/repository';
import { logger } from '@/lib/logger';
import { startRecap } from '@/services/ai/api';
import { isTerminalStatus } from '@/services/ai/contracts';
import { isRetryable, toAiServiceError, type AiClientErrorCode } from '@/services/ai/errors';
import { useAiJob } from '@/services/ai/use-ai-job';
import { track } from '@/services/monitoring/analytics';
import { isSupabaseConfigured } from '@/services/supabase/client';

import { applyRecapJob } from './apply';
import { buildRecapRequest } from './build-input';
import {
  addActionItemFromRecap,
  deleteRecap,
  getLatestRecap,
  listRecapActionItems,
  markRecapFailed,
  markRecapRequested,
  readRecapContent,
  updateRecapContent,
  type RecapRow,
} from './repository';
import type { RecapActionItem, SermonRecap } from './schema';
import type { RecapValidationReport } from './validate';

interface RecapView {
  recap: RecapRow | null;
  content: SermonRecap | null;
  transcript: TranscriptRow | null;
  segments: SegmentRow[];
  /** Action items already created from this recap, by title. */
  actionIdsByTitle: Record<string, string>;
}

const EMPTY: RecapView = { recap: null, content: null, transcript: null, segments: [], actionIdsByTitle: {} };
const TABLES = ['sermon_recaps', 'transcripts', 'transcript_segments', 'action_items'];
const appliedJobs = new Set<string>();

function readView(sermonId: string): RecapView {
  const recap = getLatestRecap(db, sermonId);
  const latestTranscript = getLatestTranscript(db, sermonId);
  const transcript = latestTranscript?.status === 'completed' ? latestTranscript : null;
  const actions = recap ? listRecapActionItems(db, recap.id) : [];
  return {
    recap,
    content: readRecapContent(recap),
    transcript,
    segments: transcript ? listSegments(db, transcript.id) : [],
    actionIdsByTitle: Object.fromEntries(actions.map((action) => [action.title, action.id])),
  };
}

export type RecapGate = 'ready' | 'not_configured' | 'signed_out' | 'no_content';

export function useRecap(sermonId: string) {
  const { data: sermon } = useSermon(sermonId);
  const { data: recordings } = useRecordings(sermonId);
  const { data: note } = useSermonNote(sermonId);
  const { data: view } = useDbQuery(() => readView(sermonId), TABLES, sermonId, EMPTY);
  const { userId } = useSession();
  const [startError, setStartError] = useState<AiClientErrorCode | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [report, setReport] = useState<RecapValidationReport | null>(null);

  const durationMs = useMemo(() => totalDurationMs(eligibleRecordings(recordings)), [recordings]);
  const durationSec = durationMs > 0 ? durationMs / 1000 : null;
  const { recap } = view;
  const jobId = recap?.status === 'processing' ? recap.remoteJobId : null;
  const job = useAiJob(jobId);

  const input = useMemo(
    () =>
      buildRecapRequest({
        sermonId,
        title: sermon?.title ?? null,
        speaker: sermon?.speaker ?? null,
        mainPassage: sermon?.mainPassage ?? null,
        transcriptId: view.transcript?.id ?? null,
        segments: view.segments,
        notes: note?.content ?? null,
        durationMs,
      }),
    [sermonId, sermon, view.transcript, view.segments, note, durationMs],
  );

  useEffect(() => {
    const data = job.data;
    if (!data || !recap || data.id !== recap.remoteJobId || !isTerminalStatus(data.status) || appliedJobs.has(data.id)) return;
    appliedJobs.add(data.id);
    applyRecapJob({ db, recapId: recap.id, job: data, durationSec })
      .then((outcome) => {
        if (outcome.status === 'completed') {
          track({ name: 'recap_generated' });
          setReport(outcome.report);
        }
      })
      .catch((error: unknown) => {
        logger.error('Applying a recap failed', error);
        markRecapFailed(db, recap.id, 'server');
      });
  }, [job.data, recap, durationSec]);

  useEffect(() => {
    if (!job.error || !recap || recap.status !== 'processing' || isRetryable(job.error.code)) return;
    markRecapFailed(db, recap.id, job.error.code);
  }, [job.error, recap]);

  const generate = useCallback(async (): Promise<AiClientErrorCode | null> => {
    if (!input.ok) return 'invalid_request';
    setStartError(null);
    setReport(null);
    setIsStarting(true);
    try {
      const { jobId: remoteJobId } = await startRecap(input.request);
      markRecapRequested(db, { sermonId, transcriptId: input.transcriptId, remoteJobId });
      return null;
    } catch (error) {
      const code = toAiServiceError(error).code;
      setStartError(code);
      return code;
    } finally {
      setIsStarting(false);
    }
  }, [input, sermonId]);

  const saveContent = useCallback((next: SermonRecap) => {
    if (recap) updateRecapContent(db, recap.id, next);
  }, [recap]);

  const remove = useCallback(() => {
    if (recap) deleteRecap(db, recap.id);
    setReport(null);
  }, [recap]);

  const addAction = useCallback(
    (item: RecapActionItem): string | null => {
      if (!recap) return null;
      const existing = view.actionIdsByTitle[item.title];
      if (existing) return existing;
      const id = addActionItemFromRecap(db, recap.id, item);
      track({ name: 'action_item_selected' });
      return id;
    },
    [recap, view.actionIdsByTitle],
  );

  const gate: RecapGate = !isSupabaseConfigured() ? 'not_configured' : !userId ? 'signed_out' : !input.ok ? 'no_content' : 'ready';

  return {
    gate,
    recap,
    content: view.content,
    source: input.ok ? input.request.source : null,
    isGenerating: isStarting || recap?.status === 'processing',
    failedCode: startError ?? (recap?.status === 'failed' ? (recap.errorCode ?? 'server') : null),
    report,
    actionIdsByTitle: view.actionIdsByTitle,
    generate,
    saveContent,
    remove,
    addAction,
  };
}

export type RecapController = ReturnType<typeof useRecap>;
