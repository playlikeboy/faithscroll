import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { sql } from 'drizzle-orm';

import { createTestDb } from '@/db/testing/create-test-db';
import { FREE_SNAPSHOT } from '@/services/payments/entitlement';
import { useEntitlementStore } from '@/services/payments/entitlement-store';

import { resetSyncAfterAccountDeletion } from '../account-sync';
import { SyncSection } from '../components/sync-section';
import { startEntitlementBridge } from '../entitlement-bridge';
import { recordConflict } from '../local-store';
import { classifyRemoteError, cursorFilter } from '../remote';
import { useSyncStore } from '../store';
import { maxTimestamp, shiftBack, toDeviceIso, toMicros } from '../timestamps';
import { formatLastSynced, syncProblemMessage } from '../use-sync-status';

jest.mock('../init', () => ({ syncNow: jest.fn(async () => undefined) }));

function resetStore(overrides: Partial<ReturnType<typeof useSyncStore.getState>> = {}) {
  useSyncStore.setState({
    cloudSyncEnabled: false,
    entitlementActive: false,
    lastSyncedAt: null,
    phase: 'idle',
    problem: null,
    revision: 0,
    ...overrides,
  });
}

describe('SyncSection', () => {
  beforeEach(() => resetStore());

  test('without Plus: explains, disables the switch and links to the paywall', async () => {
    const onOpenPaywall = jest.fn();
    await render(<SyncSection db={createTestDb()} onOpenPaywall={onOpenPaywall} />);

    const toggle = screen.getByRole('switch', { name: 'Back up and sync across devices' });
    expect(toggle.props.disabled).toBe(true);
    expect(screen.getByText(/Part of Faithscroll Plus/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Learn about Faithscroll Plus' }));
    expect(onOpenPaywall).toHaveBeenCalled();
  });

  test('with Plus: turning sync on shows status and lets the user sync now', async () => {
    resetStore({ entitlementActive: true });
    const onSyncNow = jest.fn(async () => undefined);
    await render(<SyncSection db={createTestDb()} onOpenPaywall={jest.fn()} onSyncNow={onSyncNow} />);

    await fireEvent(screen.getByRole('switch', { name: 'Back up and sync across devices' }), 'valueChange', true);
    expect(useSyncStore.getState().cloudSyncEnabled).toBe(true);
    expect(await screen.findByText('Last synced: Not synced yet')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Sync now' }));
    expect(onSyncNow).toHaveBeenCalled();

    await act(async () => useSyncStore.getState().markFailed('offline'));
    expect(screen.getByText(syncProblemMessage('offline'))).toBeTruthy();
  });

  test('shows the conflicts count and lets the user review both versions', async () => {
    resetStore({ entitlementActive: true, cloudSyncEnabled: true });
    const db = createTestDb();
    recordConflict(db, 'journal_entry', 'id-1', { id: 'id-1', title: 'Mine', version: 2 }, { id: 'id-1', title: 'Theirs', version: 2 });
    await render(<SyncSection db={db} onOpenPaywall={jest.fn()} />);

    expect(screen.getByText('1 item was edited on two devices')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Review versions' }));
    expect(screen.getByLabelText('This device: Mine')).toBeTruthy();
    expect(screen.getByLabelText('Other device: Theirs')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: "Keep this device's" }));
    expect(db.get<{ n: number }>(sql`SELECT COUNT(*) AS n FROM sync_conflicts WHERE resolved_at IS NULL`).n).toBe(0);
    expect(screen.queryByText('1 item was edited on two devices')).toBeNull();
  });
});

describe('account deletion', () => {
  test('turns sync off and clears the sync status', () => {
    resetStore({ cloudSyncEnabled: true, entitlementActive: true, lastSyncedAt: '2026-11-11T10:00:00.000Z', problem: 'server' });

    resetSyncAfterAccountDeletion();

    expect(useSyncStore.getState()).toMatchObject({ cloudSyncEnabled: false, lastSyncedAt: null, problem: null });
  });
});

describe('entitlement bridge', () => {
  beforeEach(() => resetStore());

  test('mirrors Plus, keeps the last value while loading, and turns off when payments are unavailable', () => {
    useEntitlementStore.setState({ status: 'ready', snapshot: { ...FREE_SNAPSHOT, isPlus: true, expiresAt: null } });
    const stop = startEntitlementBridge();
    expect(useSyncStore.getState().entitlementActive).toBe(true);

    useEntitlementStore.setState({ status: 'error' });
    expect(useSyncStore.getState().entitlementActive).toBe(true);

    useEntitlementStore.setState({ status: 'ready', snapshot: { ...FREE_SNAPSHOT, isPlus: true, expiresAt: '2000-01-01T00:00:00Z' } });
    expect(useSyncStore.getState().entitlementActive).toBe(false);

    useEntitlementStore.setState({ status: 'unavailable', snapshot: FREE_SNAPSHOT });
    expect(useSyncStore.getState().entitlementActive).toBe(false);
    stop();
  });
});

describe('helpers', () => {
  test('compares Postgres timestamps at microsecond precision', () => {
    expect(toMicros('2026-11-11T10:00:00.000001+00:00') - toMicros('2026-11-11T10:00:00+00:00')).toBe(1);
    expect(toMicros('2026-11-11T12:00:00+02')).toBe(toMicros('2026-11-11T10:00:00Z'));
    expect(maxTimestamp('2026-11-11T10:00:00.12+00:00', '2026-11-11T10:00:00.119999+00:00')).toBe('2026-11-11T10:00:00.12+00:00');
    expect(maxTimestamp(null, 'b')).toBe('b');
    expect(Number.isNaN(toMicros('nope'))).toBe(true);
  });

  test('normalises server timestamps to the device format', () => {
    expect(toDeviceIso('2026-11-11T10:00:00.123456+00:00')).toBe('2026-11-11T10:00:00.123Z');
    expect(toDeviceIso(null)).toBeNull();
    expect(toDeviceIso('not a date')).toBe('not a date');
    expect(shiftBack('2026-11-11T10:01:00+00:00', 60_000)).toBe('2026-11-11T10:00:00.000Z');
  });

  test('builds the compound pull cursor filter', () => {
    expect(cursorFilter({ ts: '2026-11-11T10:00:00.5+00:00', id: 'abc' })).toBe(
      'server_updated_at.gt."2026-11-11T10:00:00.5+00:00",and(server_updated_at.eq."2026-11-11T10:00:00.5+00:00",id.gt.abc)',
    );
  });

  test('classifies Data API errors', () => {
    expect(classifyRemoteError({ code: '' }, 0).kind).toBe('network');
    expect(classifyRemoteError({ code: 'PGRST301' }, 401).kind).toBe('auth');
    expect(classifyRemoteError({ code: '503' }, 503).kind).toBe('server');
    expect(classifyRemoteError({ code: '23502' }, 400)).toMatchObject({ kind: 'rejected', code: '23502' });
  });

  test('formats the last-synced label', () => {
    const now = new Date('2026-11-11T12:00:00');
    expect(formatLastSynced(null, now)).toBe('Not synced yet');
    expect(formatLastSynced(new Date('2026-11-11T11:59:40').toISOString(), now)).toBe('Just now');
    expect(formatLastSynced(new Date('2026-11-11T11:55:00').toISOString(), now)).toBe('5 minutes ago');
    expect(formatLastSynced(new Date('2026-11-11T08:00:00').toISOString(), now)).toMatch(/^Today at/);
    expect(formatLastSynced(new Date('2026-11-10T08:00:00').toISOString(), now)).toMatch(/^Yesterday at/);
  });
});
