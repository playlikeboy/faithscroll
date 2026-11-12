/**
 * The app-side executor: asset import under a versioned name, validation, one shared connection,
 * query-only mode and recovery from a bad copy. expo-sqlite is mocked (no native module in Jest).
 */
import type { BibleQueryExecutor } from '@/features/bible/db/executor';

const mockImport = jest.fn();
const mockOpen = jest.fn();
const mockLoggerError = jest.fn();
const mockDelete = jest.fn();

jest.mock('expo-sqlite', () => ({
  importDatabaseFromAssetAsync: (...args: unknown[]) => mockImport(...args),
  openDatabaseAsync: (...args: unknown[]) => mockOpen(...args),
  deleteDatabaseAsync: (...args: unknown[]) => mockDelete(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: { debug: jest.fn(), warn: jest.fn(), error: (...args: unknown[]) => mockLoggerError(...args) },
}));

interface FakeDb {
  getFirstAsync: jest.Mock;
  getAllAsync: jest.Mock;
  execAsync: jest.Mock;
  closeAsync: jest.Mock;
}

function fakeDb(schemaVersion: string | null): FakeDb {
  return {
    getFirstAsync: jest.fn(async (sql: string) => {
      if (sql.includes('metadata')) {
        if (schemaVersion === null) throw new Error('file is not a database');
        return { value: schemaVersion };
      }
      return { id: 1 };
    }),
    getAllAsync: jest.fn(async () => [{ id: 1 }]),
    execAsync: jest.fn(async () => undefined),
    closeAsync: jest.fn(async () => undefined),
  };
}

type ExpoExecutorModule = typeof import('@/features/bible/db/expo-executor');

/** Fresh module instance per test (the connection is a module-level singleton). */
async function loadExecutor(): Promise<BibleQueryExecutor> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- dynamic import() is unavailable under jest-expo
  const { createExpoBibleExecutor } = require('@/features/bible/db/expo-executor') as ExpoExecutorModule;
  return createExpoBibleExecutor();
}

beforeEach(() => {
  jest.resetModules();
  mockImport.mockReset().mockResolvedValue(undefined);
  mockOpen.mockReset();
  mockLoggerError.mockReset();
  mockDelete.mockReset().mockRejectedValue(new Error('not found'));
});

test('imports the asset once under a versioned name and shares one query-only connection', async () => {
  const db = fakeDb('2');
  mockOpen.mockResolvedValue(db);
  const executor = await loadExecutor();

  await expect(executor.getAll('SELECT * FROM verses WHERE id = ?', [1])).resolves.toEqual([{ id: 1 }]);
  await expect(executor.getFirst('SELECT 1')).resolves.toEqual({ id: 1 });

  expect(mockImport).toHaveBeenCalledTimes(1);
  expect(mockImport).toHaveBeenCalledWith('bible-web-v2.db', expect.objectContaining({ forceOverwrite: false }));
  expect(mockOpen).toHaveBeenCalledTimes(1);
  expect(db.execAsync).toHaveBeenCalledWith('PRAGMA query_only = ON');
  expect(db.getAllAsync).toHaveBeenCalledWith('SELECT * FROM verses WHERE id = ?', [1]);
});

test('replaces a copy that fails validation', async () => {
  const broken = fakeDb(null);
  const good = fakeDb('2');
  mockOpen.mockResolvedValueOnce(broken).mockResolvedValueOnce(good);
  const executor = await loadExecutor();

  await executor.getAll('SELECT 1');

  expect(broken.closeAsync).toHaveBeenCalled();
  expect(mockImport).toHaveBeenLastCalledWith('bible-web-v2.db', expect.objectContaining({ forceOverwrite: true }));
  expect(good.getAllAsync).toHaveBeenCalled();
});

test('reports a friendly error and retries on the next call', async () => {
  mockOpen.mockResolvedValueOnce(fakeDb('0')).mockResolvedValueOnce(fakeDb('0'));
  const executor = await loadExecutor();

  await expect(executor.getAll('SELECT 1')).rejects.toThrow('The bundled Bible text could not be opened.');
  expect(mockLoggerError).toHaveBeenCalledWith('Could not open the Bible database', expect.any(Error));

  mockOpen.mockResolvedValueOnce(fakeDb('2'));
  await expect(executor.getAll('SELECT 1')).resolves.toEqual([{ id: 1 }]);
});

test('deletes copies left by older app versions after opening', async () => {
  mockOpen.mockResolvedValue(fakeDb('2'));
  const executor = await loadExecutor();

  await executor.getAll('SELECT 1');
  await new Promise((resolve) => setImmediate(resolve));

  expect(mockDelete).toHaveBeenCalledWith('bible-web-v1.db');
  expect(mockDelete).not.toHaveBeenCalledWith('bible-web-v2.db');
});
