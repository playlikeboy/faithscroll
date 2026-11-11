/**
 * Build the recap request from the transcript (preferred, with [mm:ss] markers the model uses for
 * timestamps) or, when there is no transcript, from the user's own notes.
 */
import { formatDuration } from '@/lib/time';
import type { RecapRequest } from '@/services/ai/contracts';

/** Keep well under the server limit (200k chars). */
export const MAX_RECAP_CONTENT_CHARS = 180_000;

export interface RecapSource {
  sermonId: string;
  title: string | null;
  speaker: string | null;
  mainPassage: string | null;
  transcriptId: string | null;
  segments: readonly { startMs: number; text: string }[];
  notes: string | null;
  durationMs: number;
}

/** "[04:32] text" lines; consecutive short segments are kept as they are (one line each). */
export function transcriptToRecapContent(segments: readonly { startMs: number; text: string }[]): string {
  const lines: string[] = [];
  let length = 0;
  for (const segment of segments) {
    const line = `[${formatDuration(segment.startMs)}] ${segment.text.trim()}`;
    if (length + line.length + 1 > MAX_RECAP_CONTENT_CHARS) break;
    lines.push(line);
    length += line.length + 1;
  }
  return lines.join('\n');
}

export type RecapInputResult = { ok: true; request: RecapRequest; transcriptId: string | null } | { ok: false; reason: 'no_content' };

export function buildRecapRequest(source: RecapSource): RecapInputResult {
  const durationSec = source.durationMs > 0 ? Math.round(source.durationMs / 1000) : null;
  const base = { sermonId: source.sermonId, title: source.title, speaker: source.speaker, mainPassage: source.mainPassage };

  if (source.transcriptId && source.segments.length > 0) {
    const content = transcriptToRecapContent(source.segments);
    if (content.trim()) {
      return { ok: true, transcriptId: source.transcriptId, request: { ...base, source: 'transcript', content, durationSec } };
    }
  }

  const notes = source.notes?.trim() ?? '';
  if (notes) {
    // Notes may contain [mm:ss] tokens from the editor, so the recording length still helps.
    return {
      ok: true,
      transcriptId: null,
      request: { ...base, source: 'notes', content: notes.slice(0, MAX_RECAP_CONTENT_CHARS), durationSec },
    };
  }
  return { ok: false, reason: 'no_content' };
}
