/**
 * Which local tables sync, in which order, and with which columns.
 * Local and server tables share names and snake_case column names
 * (supabase/migrations/20261111000110_sync_mirrors.sql).
 */
import { getTableConfig, type SQLiteTable } from 'drizzle-orm/sqlite-core';

import * as schema from '@/db/schema';
import type { EntityType } from '@/db/schema';

export interface SyncTableConfig {
  entityType: EntityType;
  /** Local and server table name. */
  table: string;
  /** Columns exchanged with the server (local columns minus device-only ones). */
  syncedColumns: readonly string[];
  /** Columns that only make sense on this device; never pushed, preserved on pull. */
  deviceLocalColumns: readonly string[];
  /** false for set-like tables without id/version locally (entity_tags). */
  versioned: boolean;
}

/** Parents before children so pulled rows find their foreign keys. */
const ORDER: readonly [EntityType, SQLiteTable][] = [
  ['sermon_series', schema.sermonSeries],
  ['sermon', schema.sermons],
  ['sermon_recording', schema.sermonRecordings],
  ['transcript', schema.transcripts],
  ['sermon_recap', schema.sermonRecaps],
  ['sermon_bookmark', schema.sermonBookmarks],
  ['sermon_note', schema.sermonNotes],
  ['highlight', schema.highlights],
  ['saved_verse', schema.savedVerses],
  ['verse_note', schema.verseNotes],
  ['collection', schema.collections],
  ['collection_item', schema.collectionItems],
  ['journal_entry', schema.journalEntries],
  ['prayer_entry', schema.prayerEntries],
  ['prayer_update', schema.prayerUpdates],
  ['action_item', schema.actionItems],
  ['scripture_reference', schema.scriptureReferences],
  ['entity_link', schema.entityLinks],
  ['tag', schema.tags],
  ['entity_tag', schema.entityTags],
  ['plan_progress', schema.planProgress],
];

const DEVICE_LOCAL_COLUMNS = new Set(['reminder_notification_id', 'local_file_name']);

/** Timestamps the server stores as timestamptz; normalised back to `toISOString()` on pull. */
export const TIMESTAMP_COLUMNS: readonly string[] = ['created_at', 'updated_at', 'deleted_at'];

function buildConfig(entityType: EntityType, table: SQLiteTable): SyncTableConfig {
  const config = getTableConfig(table);
  const columns = config.columns.map((column) => column.name);
  return {
    entityType,
    table: config.name,
    syncedColumns: columns.filter((name) => !DEVICE_LOCAL_COLUMNS.has(name)),
    deviceLocalColumns: columns.filter((name) => DEVICE_LOCAL_COLUMNS.has(name)),
    versioned: columns.includes('id') && columns.includes('version'),
  };
}

export const SYNC_TABLES: readonly SyncTableConfig[] = ORDER.map(([type, table]) => buildConfig(type, table));

const BY_ENTITY = new Map(SYNC_TABLES.map((config) => [config.entityType, config]));

export function tableForEntity(entityType: EntityType): SyncTableConfig {
  const config = BY_ENTITY.get(entityType);
  if (!config) throw new Error(`No sync table for ${entityType}`);
  return config;
}

/** Natural unique keys enforced locally (besides the primary key); used to resolve collisions. */
export const NATURAL_KEYS: Partial<Record<string, { columns: readonly string[]; caseInsensitive?: boolean }>> = {
  highlights: { columns: ['verse_id'] },
  collection_items: { columns: ['collection_id', 'entity_type', 'entity_id'] },
  entity_links: { columns: ['from_type', 'from_id', 'to_type', 'to_id'] },
  tags: { columns: ['name'], caseInsensitive: true },
};

/** Outbox key for an entity tag: `<entityType>:<entityId>:<tagId>` (see features/tags). */
export interface EntityTagKey {
  entity_type: string;
  entity_id: string;
  tag_id: string;
}

export function parseEntityTagKey(key: string): EntityTagKey | null {
  const parts = key.split(':');
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) return null;
  return { entity_type: parts[0], entity_id: parts[1], tag_id: parts[2] };
}

export function formatEntityTagKey(key: EntityTagKey): string {
  return `${key.entity_type}:${key.entity_id}:${key.tag_id}`;
}
