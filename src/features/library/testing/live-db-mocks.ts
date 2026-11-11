/**
 * Test-only helpers for screens that read through `useLiveData` / `useLiveQuery`.
 * Usage in a test file:
 *
 *   jest.mock('expo-sqlite', () => require('@/features/library/testing/live-db-mocks').expoSqliteMock);
 *   jest.mock('@/db/client', () => ({ db: require('@/db/testing/create-test-db').createTestDb() }));
 *   …
 *   act(() => notifyTables('plan_progress'));
 */
type ChangeListener = (event: { tableName: string }) => void;

const listeners = new Set<ChangeListener>();

export const expoSqliteMock = {
  addDatabaseChangeListener: (listener: ChangeListener) => {
    listeners.add(listener);
    return { remove: () => listeners.delete(listener) };
  },
};

/** Simulate expo-sqlite change events after a write in a test. */
export function notifyTables(...tableNames: string[]): void {
  for (const tableName of tableNames) {
    for (const listener of [...listeners]) listener({ tableName });
  }
}
