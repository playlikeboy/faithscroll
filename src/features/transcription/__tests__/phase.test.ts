import { transcriptionPhase } from '../phase';
import type { TranscriptRow } from '../repository';

const row = (overrides: Partial<TranscriptRow>): TranscriptRow => ({
  id: 't',
  sermonId: 's',
  recordingId: null,
  remoteJobId: null,
  language: null,
  status: 'pending',
  text: null,
  errorCode: null,
  editedAt: null,
  createdAt: '',
  updatedAt: '',
  deletedAt: null,
  version: 1,
  ...overrides,
});

describe('transcriptionPhase', () => {
  test('an upload in flight wins over the stored status', () => {
    const upload = { phase: 'uploading' as const, partIndex: 0, partCount: 1, fraction: 0.2 };
    expect(transcriptionPhase(row({ status: 'uploading' }), upload)).toEqual({ kind: 'uploading', upload });
  });

  test('maps stored statuses', () => {
    expect(transcriptionPhase(null, null)).toEqual({ kind: 'idle' });
    expect(transcriptionPhase(row({ status: 'uploading' }), null)).toEqual({ kind: 'interrupted' });
    expect(transcriptionPhase(row({ status: 'processing', remoteJobId: 'j' }), null)).toEqual({ kind: 'processing' });
    expect(transcriptionPhase(row({ status: 'processing' }), null)).toEqual({ kind: 'interrupted' });
    expect(transcriptionPhase(row({ status: 'completed' }), null)).toEqual({ kind: 'completed' });
    expect(transcriptionPhase(row({ status: 'failed', errorCode: 'offline' }), null)).toEqual({ kind: 'failed', errorCode: 'offline' });
    expect(transcriptionPhase(row({ status: 'failed' }), null)).toEqual({ kind: 'failed', errorCode: 'server' });
  });
});
