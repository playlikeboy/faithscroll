import type { TranscriptRow } from './repository';
import type { InFlightUpload } from './upload-store';

export type TranscriptionPhase =
  | { kind: 'idle' }
  | { kind: 'uploading'; upload: InFlightUpload }
  /** The app stopped during an upload (row still `uploading`, nothing in flight). */
  | { kind: 'interrupted' }
  | { kind: 'processing' }
  | { kind: 'completed' }
  | { kind: 'failed'; errorCode: string };

export function transcriptionPhase(transcript: TranscriptRow | null, upload: InFlightUpload | null | undefined): TranscriptionPhase {
  if (upload) return { kind: 'uploading', upload };
  if (!transcript) return { kind: 'idle' };
  switch (transcript.status) {
    case 'completed':
      return { kind: 'completed' };
    case 'failed':
      return { kind: 'failed', errorCode: transcript.errorCode ?? 'server' };
    case 'queued':
    case 'processing':
      return transcript.remoteJobId ? { kind: 'processing' } : { kind: 'interrupted' };
    case 'uploading':
    case 'pending':
      return { kind: 'interrupted' };
  }
}
