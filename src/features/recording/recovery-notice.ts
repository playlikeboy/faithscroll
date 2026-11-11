import type { RecoveryResult } from './recover-recordings';

export interface RecoveryNoticeData {
  kind: 'recovered' | 'lost';
  title: string;
  message: string;
  /** A sermon to open, when exactly one was affected. */
  sermonId: string | null;
}

/** Gentle, non-alarming wording for what crash recovery found (null when nothing happened). */
export function recoveryNoticeFor(result: RecoveryResult | null): RecoveryNoticeData | null {
  if (!result || result.recovered + result.failed === 0) return null;
  const sermonId = result.sermonIds.length === 1 ? result.sermonIds[0] : null;
  if (result.recovered > 0) {
    const tail = result.failed > 0 ? ' A few final moments couldn’t be saved.' : '';
    return {
      kind: 'recovered',
      title: 'We kept your recording',
      message: `Faithscroll closed while you were recording. Everything up to that moment is saved with the sermon.${tail}`,
      sermonId,
    };
  }
  return {
    kind: 'lost',
    title: 'A recording was interrupted',
    message: 'Faithscroll closed while you were recording, and the last few minutes couldn’t be saved. Earlier parts and your notes are safe.',
    sermonId,
  };
}
