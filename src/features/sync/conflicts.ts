/**
 * Reviewing copies kept by sync conflicts. "Keep this device's version" just marks the conflict
 * resolved (the local copy already won). "Use the other version" copies the other device's content
 * onto the local row as a new local edit, which then syncs everywhere.
 */
import { sql } from 'drizzle-orm';

import { enqueueChange } from '@/db/mutations';
import type { EntityType } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import { nowIso } from '@/lib/time';

import { readRow, updateRow, type LocalRow } from './local-store';
import { tableForEntity } from './tables';

export interface ConflictRecord {
  id: string;
  entityType: EntityType;
  entityId: string;
  createdAt: string;
  local: LocalRow;
  remote: LocalRow;
}

const ENTITY_LABELS: Record<EntityType, string> = {
  highlight: 'Highlight',
  saved_verse: 'Saved verse',
  verse_note: 'Bible note',
  collection: 'Collection',
  collection_item: 'Collection item',
  sermon_series: 'Sermon series',
  sermon: 'Sermon',
  sermon_recording: 'Recording',
  sermon_bookmark: 'Sermon bookmark',
  sermon_note: 'Sermon note',
  transcript: 'Transcript',
  sermon_recap: 'Sermon recap',
  scripture_reference: 'Scripture reference',
  journal_entry: 'Journal entry',
  prayer_entry: 'Prayer',
  prayer_update: 'Prayer update',
  action_item: 'Action',
  entity_link: 'Link',
  tag: 'Tag',
  entity_tag: 'Tag',
  plan_progress: 'Reading plan',
};

export function entityLabel(entityType: EntityType): string {
  return ENTITY_LABELS[entityType] ?? 'Item';
}

const PREVIEW_COLUMNS = ['title', 'name', 'content', 'text', 'note', 'notes', 'reference_text', 'main_passage', 'color', 'status'];
const PREVIEW_LENGTH = 90;

/** A short, on-device-only preview of a copy (never logged or sent anywhere). */
export function previewOf(row: LocalRow): string {
  if (row.deleted_at) return 'Deleted';
  for (const column of PREVIEW_COLUMNS) {
    const value = row[column];
    if (typeof value === 'string' && value.trim().length > 0) {
      const text = value.replace(/\s+/g, ' ').trim();
      return text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH - 1)}…` : text;
    }
  }
  return 'No text';
}

function parse(json: string): LocalRow {
  try {
    const value = JSON.parse(json) as unknown;
    return value && typeof value === 'object' ? (value as LocalRow) : {};
  } catch {
    return {};
  }
}

export function listOpenConflicts(db: AppDatabase): ConflictRecord[] {
  return db
    .all<{ id: string; entity_type: EntityType; entity_id: string; created_at: string; local_json: string; remote_json: string }>(
      sql`SELECT id, entity_type, entity_id, created_at, local_json, remote_json FROM sync_conflicts
          WHERE resolved_at IS NULL ORDER BY created_at DESC`,
    )
    .map((row) => ({
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      createdAt: row.created_at,
      local: parse(row.local_json),
      remote: parse(row.remote_json),
    }));
}

function markResolved(db: AppDatabase, conflictId: string): void {
  db.run(sql`UPDATE sync_conflicts SET resolved_at = ${nowIso()} WHERE id = ${conflictId}`);
}

export function keepLocalVersion(db: AppDatabase, conflictId: string): void {
  markResolved(db, conflictId);
}

const NOT_COPIED = new Set(['id', 'version', 'created_at', 'updated_at']);

/** Returns false when the local row no longer exists (the conflict is then just dismissed). */
export function applyOtherVersion(db: AppDatabase, conflict: ConflictRecord): boolean {
  const config = tableForEntity(conflict.entityType);
  return db.transaction((tx) => {
    const local = config.versioned ? readRow(tx, config, conflict.entityId) : undefined;
    if (!local) {
      markResolved(tx, conflict.id);
      return false;
    }
    const values: LocalRow = {};
    for (const column of config.syncedColumns) {
      if (!NOT_COPIED.has(column) && column in conflict.remote) values[column] = conflict.remote[column] ?? null;
    }
    const remoteVersion = Number(conflict.remote.version ?? 0);
    values.version = Math.max(Number(local.version), Number.isFinite(remoteVersion) ? remoteVersion : 0) + 1;
    values.updated_at = nowIso();
    updateRow(tx, config.table, conflict.entityId, values);
    enqueueChange(tx, conflict.entityType, conflict.entityId, 'upsert');
    markResolved(tx, conflict.id);
    return true;
  });
}
