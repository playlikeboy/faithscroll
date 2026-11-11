import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as Sharing from 'expo-sharing';

import { journalEntries } from '@/db/schema';
import { createTestDb } from '@/db/testing/create-test-db';
import { confirmDeleteAllLocalData } from '@/features/export/confirm-delete';
import { ExportError, shareExportFile } from '@/features/export/export-file';
import { useDeleteLocalData, useExportData } from '@/features/export/use-data-actions';
import { deleteAllLocalData } from '@/features/export/wipe-local-data';
import { track } from '@/services/monitoring/analytics';

const mockFiles: { uri: string; written: string | null }[] = [];

jest.mock('expo-file-system', () => ({
  Paths: { document: 'file:///doc', cache: 'file:///cache' },
  Directory: jest.fn().mockImplementation((base: string, name: string) => ({
    uri: `${base}/${name}`,
    exists: false,
    delete: jest.fn(),
    create: jest.fn(),
  })),
  File: jest.fn().mockImplementation((directory: { uri: string }, name: string) => {
    const file = {
      uri: `${directory.uri}/${name}`,
      written: null as string | null,
      create: jest.fn(),
      write: jest.fn(async (content: string) => {
        file.written = content;
      }),
    };
    mockFiles.push(file);
    return file;
  }),
}));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => undefined) }));
jest.mock('@/services/monitoring/analytics', () => ({ track: jest.fn() }));
jest.mock('@/features/export/wipe-local-data', () => ({ deleteAllLocalData: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  mockFiles.length = 0;
});

describe('shareExportFile', () => {
  test('writes JSON to the cache and opens the share sheet', async () => {
    await shareExportFile('{"ok":true}', 'faithscroll-export-2026-11-11.json');

    expect(mockFiles[0]).toMatchObject({
      uri: 'file:///cache/exports/faithscroll-export-2026-11-11.json',
      written: '{"ok":true}',
    });
    expect(jest.mocked(Sharing.shareAsync)).toHaveBeenCalledWith(
      'file:///cache/exports/faithscroll-export-2026-11-11.json',
      expect.objectContaining({ mimeType: 'application/json', UTI: 'public.json' }),
    );
  });

  test('fails clearly when sharing is unavailable', async () => {
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValueOnce(false);

    await expect(shareExportFile('{}', 'x.json')).rejects.toEqual(expect.any(ExportError));
    expect(jest.mocked(Sharing.shareAsync)).not.toHaveBeenCalled();
  });
});

describe('useExportData', () => {
  test('exports, tracks a content-free event and summarizes', async () => {
    const db = createTestDb();
    db.insert(journalEntries).values({ id: 'j1', content: 'A private thought', entryDate: '2026-11-11' }).run();
    const { result } = await renderHook(() => useExportData(db));

    await act(async () => {
      await result.current.exportData();
    });

    expect(result.current.status).toEqual({ kind: 'done', message: 'Export ready: 1 journal entry.' });
    expect(jest.mocked(track)).toHaveBeenCalledWith({ name: 'data_exported' });
    const exported = JSON.parse(mockFiles[0]?.written ?? '{}');
    expect(exported.data.journalEntries[0].content).toBe('A private thought');
  });

  test('shows a friendly error when sharing is unavailable', async () => {
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValueOnce(false);
    const { result } = await renderHook(() => useExportData(createTestDb()));

    await act(async () => {
      await result.current.exportData();
    });

    expect(result.current.status).toEqual({ kind: 'error', message: expect.stringMatching(/Sharing isn’t available/) });
    expect(jest.mocked(track)).not.toHaveBeenCalled();
  });
});

describe('useDeleteLocalData', () => {
  test('reports success', async () => {
    jest.mocked(deleteAllLocalData).mockResolvedValue({ failedSteps: [] });
    const { result } = await renderHook(() => useDeleteLocalData(createTestDb()));

    await act(async () => {
      await result.current.deleteAll();
    });

    expect(result.current.status).toMatchObject({ kind: 'done' });
  });

  test('reports partial failure', async () => {
    jest.mocked(deleteAllLocalData).mockResolvedValue({ failedSteps: ['recordings'] });
    const { result } = await renderHook(() => useDeleteLocalData(createTestDb()));

    await act(async () => {
      await result.current.deleteAll();
    });

    expect(result.current.status).toMatchObject({ kind: 'error' });
  });
});

describe('confirmDeleteAllLocalData', () => {
  type AlertButtons = { text?: string; onPress?: () => void }[];
  const pressButton = (callIndex: number, text: string) => {
    const buttons = jest.mocked(Alert.alert).mock.calls[callIndex]?.[2] as AlertButtons;
    buttons.find((button) => button.text === text)?.onPress?.();
  };

  test('requires two explicit confirmations', () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const onConfirmed = jest.fn();

    confirmDeleteAllLocalData(onConfirmed);
    expect(onConfirmed).not.toHaveBeenCalled();

    pressButton(0, 'Continue');
    expect(onConfirmed).not.toHaveBeenCalled();

    pressButton(1, 'Delete everything');
    expect(onConfirmed).toHaveBeenCalledTimes(1);
  });

  test('cancelling at the first step does nothing', () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const onConfirmed = jest.fn();

    confirmDeleteAllLocalData(onConfirmed);
    pressButton(0, 'Cancel');

    expect(jest.mocked(Alert.alert)).toHaveBeenCalledTimes(1);
    expect(onConfirmed).not.toHaveBeenCalled();
  });
});
