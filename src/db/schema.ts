/**
 * Local (on-device) database schema — the single source of truth for user data.
 *
 * Conventions
 * - IDs are client-generated UUID strings (`newId()`), stable across devices for sync.
 * - Timestamps are ISO-8601 strings (UTC).
 * - Bible verses are referenced by integer verse ids: book * 1_000_000 + chapter * 1_000 + verse
 *   (see `src/features/bible/verse-id.ts`). Ranges use start/end ids (inclusive).
 * - User-content tables carry `updated_at`, `deleted_at` (soft-delete tombstone for sync)
 *   and `version` (incremented on every local edit; used for conflict detection).
 * - Every write to a syncable table should also enqueue a row in `outbox`
 *   (see `src/db/mutations.ts`).
 */
import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const nowIso = () => new Date().toISOString();

const syncColumns = () => ({
  createdAt: text('created_at').notNull().$defaultFn(nowIso),
  updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
  deletedAt: text('deleted_at'),
  version: integer('version').notNull().default(1),
});

export const ENTITY_TYPES = [
  'highlight',
  'saved_verse',
  'verse_note',
  'collection',
  'collection_item',
  'sermon_series',
  'sermon',
  'sermon_recording',
  'sermon_bookmark',
  'sermon_note',
  'transcript',
  'sermon_recap',
  'scripture_reference',
  'journal_entry',
  'prayer_entry',
  'prayer_update',
  'action_item',
  'entity_link',
  'tag',
  'entity_tag',
  'plan_progress',
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/** Entity types that can be linked to each other, tagged, or placed in a collection. */
export const LINKABLE_TYPES = [
  'sermon',
  'sermon_series',
  'journal_entry',
  'prayer_entry',
  'action_item',
  'verse_note',
  'saved_verse',
] as const;
export type LinkableType = (typeof LINKABLE_TYPES)[number];

// ---------------------------------------------------------------------------
// Bible reading & annotations
// ---------------------------------------------------------------------------

/** One row per translation: where the reader last was. */
export const readingProgress = sqliteTable('reading_progress', {
  translationId: text('translation_id').primaryKey(),
  bookId: integer('book_id').notNull(),
  chapter: integer('chapter').notNull(),
  verse: integer('verse').notNull().default(1),
  scrollOffset: real('scroll_offset').notNull().default(0),
  updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
});

/** Append-only log of chapters opened/finished; powers recent activity, plans and stats. */
export const readingHistory = sqliteTable(
  'reading_history',
  {
    id: text('id').primaryKey(),
    translationId: text('translation_id').notNull(),
    bookId: integer('book_id').notNull(),
    chapter: integer('chapter').notNull(),
    readAt: text('read_at').notNull().$defaultFn(nowIso),
  },
  (t) => [index('reading_history_read_at_idx').on(t.readAt)],
);

export const HIGHLIGHT_COLOR_VALUES = ['gold', 'sage', 'sky', 'rose'] as const;

export const highlights = sqliteTable(
  'highlights',
  {
    id: text('id').primaryKey(),
    verseId: integer('verse_id').notNull(),
    color: text('color', { enum: HIGHLIGHT_COLOR_VALUES }).notNull(),
    ...syncColumns(),
  },
  (t) => [uniqueIndex('highlights_verse_idx').on(t.verseId)],
);

/** Saved / bookmarked verse ranges. Collections reference these via `collection_items`. */
export const savedVerses = sqliteTable(
  'saved_verses',
  {
    id: text('id').primaryKey(),
    startVerseId: integer('start_verse_id').notNull(),
    endVerseId: integer('end_verse_id').notNull(),
    ...syncColumns(),
  },
  (t) => [index('saved_verses_start_idx').on(t.startVerseId)],
);

export const verseNotes = sqliteTable(
  'verse_notes',
  {
    id: text('id').primaryKey(),
    startVerseId: integer('start_verse_id').notNull(),
    endVerseId: integer('end_verse_id').notNull(),
    /** Markdown-lite content (see `src/components/editor`). */
    content: text('content').notNull().default(''),
    ...syncColumns(),
  },
  (t) => [index('verse_notes_start_idx').on(t.startVerseId)],
);

export const collections = sqliteTable('collections', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  ...syncColumns(),
});

export const collectionItems = sqliteTable(
  'collection_items',
  {
    id: text('id').primaryKey(),
    collectionId: text('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    entityType: text('entity_type', { enum: LINKABLE_TYPES }).notNull(),
    entityId: text('entity_id').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    ...syncColumns(),
  },
  (t) => [
    index('collection_items_collection_idx').on(t.collectionId),
    uniqueIndex('collection_items_unique_idx').on(t.collectionId, t.entityType, t.entityId),
  ],
);

// ---------------------------------------------------------------------------
// Sermons
// ---------------------------------------------------------------------------

export const sermonSeries = sqliteTable('sermon_series', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  speaker: text('speaker'),
  church: text('church'),
  ...syncColumns(),
});

export const sermons = sqliteTable(
  'sermons',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    speaker: text('speaker'),
    church: text('church'),
    seriesId: text('series_id').references(() => sermonSeries.id, { onDelete: 'set null' }),
    /** Calendar date, YYYY-MM-DD. */
    sermonDate: text('sermon_date'),
    /** Human-readable main passage, e.g. "Matthew 18:21-35". */
    mainPassage: text('main_passage'),
    mainPassageStartVerseId: integer('main_passage_start_verse_id'),
    mainPassageEndVerseId: integer('main_passage_end_verse_id'),
    ...syncColumns(),
  },
  (t) => [index('sermons_date_idx').on(t.sermonDate), index('sermons_series_idx').on(t.seriesId)],
);

export const RECORDING_STATUSES = ['recording', 'paused', 'saved', 'interrupted', 'failed'] as const;
export const CLOUD_STATUSES = ['local', 'uploading', 'uploaded', 'upload_failed', 'cloud_deleted'] as const;

export const sermonRecordings = sqliteTable(
  'sermon_recordings',
  {
    id: text('id').primaryKey(),
    sermonId: text('sermon_id')
      .notNull()
      .references(() => sermons.id, { onDelete: 'cascade' }),
    title: text('title'),
    /**
     * File name relative to the app's document directory recordings folder.
     * Never store absolute paths: the iOS container path changes between installs.
     */
    localFileName: text('local_file_name'),
    mimeType: text('mime_type').notNull().default('audio/mp4'),
    durationMs: integer('duration_ms').notNull().default(0),
    sizeBytes: integer('size_bytes'),
    status: text('status', { enum: RECORDING_STATUSES }).notNull().default('recording'),
    cloudStatus: text('cloud_status', { enum: CLOUD_STATUSES }).notNull().default('local'),
    cloudPath: text('cloud_path'),
    startedAt: text('started_at'),
    endedAt: text('ended_at'),
    ...syncColumns(),
  },
  (t) => [index('sermon_recordings_sermon_idx').on(t.sermonId)],
);

export const sermonBookmarks = sqliteTable(
  'sermon_bookmarks',
  {
    id: text('id').primaryKey(),
    sermonId: text('sermon_id')
      .notNull()
      .references(() => sermons.id, { onDelete: 'cascade' }),
    recordingId: text('recording_id').references(() => sermonRecordings.id, { onDelete: 'cascade' }),
    positionMs: integer('position_ms').notNull(),
    note: text('note'),
    reference: text('reference'),
    startVerseId: integer('start_verse_id'),
    endVerseId: integer('end_verse_id'),
    ...syncColumns(),
  },
  (t) => [index('sermon_bookmarks_recording_idx').on(t.recordingId, t.positionMs)],
);

export const sermonNotes = sqliteTable(
  'sermon_notes',
  {
    id: text('id').primaryKey(),
    sermonId: text('sermon_id')
      .notNull()
      .references(() => sermons.id, { onDelete: 'cascade' }),
    /** Markdown-lite content; may contain `[mm:ss]` timestamp tokens and Scripture references. */
    content: text('content').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    ...syncColumns(),
  },
  (t) => [index('sermon_notes_sermon_idx').on(t.sermonId)],
);

export const AI_STATUSES = ['pending', 'uploading', 'queued', 'processing', 'completed', 'failed'] as const;

export const transcripts = sqliteTable(
  'transcripts',
  {
    id: text('id').primaryKey(),
    sermonId: text('sermon_id')
      .notNull()
      .references(() => sermons.id, { onDelete: 'cascade' }),
    recordingId: text('recording_id').references(() => sermonRecordings.id, { onDelete: 'set null' }),
    /** Server-side ai_jobs id. */
    remoteJobId: text('remote_job_id'),
    language: text('language'),
    status: text('status', { enum: AI_STATUSES }).notNull().default('pending'),
    text: text('text'),
    errorCode: text('error_code'),
    editedAt: text('edited_at'),
    ...syncColumns(),
  },
  (t) => [index('transcripts_sermon_idx').on(t.sermonId)],
);

export const transcriptSegments = sqliteTable(
  'transcript_segments',
  {
    id: text('id').primaryKey(),
    transcriptId: text('transcript_id')
      .notNull()
      .references(() => transcripts.id, { onDelete: 'cascade' }),
    startMs: integer('start_ms').notNull(),
    endMs: integer('end_ms').notNull(),
    text: text('text').notNull(),
    sortOrder: integer('sort_order').notNull(),
  },
  (t) => [index('transcript_segments_transcript_idx').on(t.transcriptId, t.sortOrder)],
);

export const sermonRecaps = sqliteTable(
  'sermon_recaps',
  {
    id: text('id').primaryKey(),
    sermonId: text('sermon_id')
      .notNull()
      .references(() => sermons.id, { onDelete: 'cascade' }),
    transcriptId: text('transcript_id').references(() => transcripts.id, { onDelete: 'set null' }),
    remoteJobId: text('remote_job_id'),
    status: text('status', { enum: AI_STATUSES }).notNull().default('pending'),
    /** JSON matching `SermonRecap` (src/features/recap/schema.ts). User-editable. */
    contentJson: text('content_json'),
    provider: text('provider'),
    model: text('model'),
    errorCode: text('error_code'),
    generatedAt: text('generated_at'),
    editedAt: text('edited_at'),
    ...syncColumns(),
  },
  (t) => [index('sermon_recaps_sermon_idx').on(t.sermonId)],
);

export const REFERENCE_SOURCE_TYPES = [
  'sermon',
  'sermon_note',
  'transcript',
  'sermon_bookmark',
  'journal_entry',
  'prayer_entry',
  'action_item',
] as const;

/** Scripture references detected in or attached to user content. */
export const scriptureReferences = sqliteTable(
  'scripture_references',
  {
    id: text('id').primaryKey(),
    sourceType: text('source_type', { enum: REFERENCE_SOURCE_TYPES }).notNull(),
    sourceId: text('source_id').notNull(),
    startVerseId: integer('start_verse_id').notNull(),
    endVerseId: integer('end_verse_id').notNull(),
    /** Display text, e.g. "Romans 8:28". */
    referenceText: text('reference_text').notNull(),
    /** Position in the recording, when detected from a transcript or bookmark. */
    positionMs: integer('position_ms'),
    /** 'user' when attached manually, 'detected' when extracted automatically. */
    origin: text('origin', { enum: ['user', 'detected'] }).notNull().default('user'),
    ...syncColumns(),
  },
  (t) => [
    index('scripture_references_source_idx').on(t.sourceType, t.sourceId),
    index('scripture_references_verse_idx').on(t.startVerseId),
  ],
);

// ---------------------------------------------------------------------------
// Journal, prayer, actions
// ---------------------------------------------------------------------------

export const JOURNAL_ENTRY_TYPES = [
  'reflection',
  'bible_study',
  'sermon_reflection',
  'prayer',
  'gratitude',
  'personal',
] as const;

export const journalEntries = sqliteTable(
  'journal_entries',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull().default(''),
    content: text('content').notNull().default(''),
    entryType: text('entry_type', { enum: JOURNAL_ENTRY_TYPES }).notNull().default('personal'),
    prompt: text('prompt'),
    /** The day the entry is about (YYYY-MM-DD); defaults to creation day. */
    entryDate: text('entry_date').notNull(),
    ...syncColumns(),
  },
  (t) => [index('journal_entries_date_idx').on(t.entryDate)],
);

export const PRAYER_STATUSES = ['praying', 'ongoing', 'answered', 'archived'] as const;

export const prayerEntries = sqliteTable(
  'prayer_entries',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    content: text('content').notNull().default(''),
    category: text('category'),
    status: text('status', { enum: PRAYER_STATUSES }).notNull().default('praying'),
    reminderAt: text('reminder_at'),
    /** expo-notifications identifier of the scheduled reminder, if any. */
    reminderNotificationId: text('reminder_notification_id'),
    answeredAt: text('answered_at'),
    ...syncColumns(),
  },
  (t) => [index('prayer_entries_status_idx').on(t.status)],
);

export const prayerUpdates = sqliteTable(
  'prayer_updates',
  {
    id: text('id').primaryKey(),
    prayerId: text('prayer_id')
      .notNull()
      .references(() => prayerEntries.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    statusChange: text('status_change', { enum: PRAYER_STATUSES }),
    ...syncColumns(),
  },
  (t) => [index('prayer_updates_prayer_idx').on(t.prayerId)],
);

export const ACTION_SOURCE_TYPES = ['sermon', 'sermon_recap', 'journal_entry', 'verse', 'manual'] as const;

export const actionItems = sqliteTable(
  'action_items',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    notes: text('notes'),
    sourceType: text('source_type', { enum: ACTION_SOURCE_TYPES }).notNull().default('manual'),
    sourceId: text('source_id'),
    dueAt: text('due_at'),
    reminderAt: text('reminder_at'),
    reminderNotificationId: text('reminder_notification_id'),
    completedAt: text('completed_at'),
    ...syncColumns(),
  },
  (t) => [index('action_items_source_idx').on(t.sourceType, t.sourceId)],
);

/** Directed link between two pieces of user content (treated as bidirectional by queries). */
export const entityLinks = sqliteTable(
  'entity_links',
  {
    id: text('id').primaryKey(),
    fromType: text('from_type', { enum: LINKABLE_TYPES }).notNull(),
    fromId: text('from_id').notNull(),
    toType: text('to_type', { enum: LINKABLE_TYPES }).notNull(),
    toId: text('to_id').notNull(),
    ...syncColumns(),
  },
  (t) => [
    index('entity_links_from_idx').on(t.fromType, t.fromId),
    index('entity_links_to_idx').on(t.toType, t.toId),
    uniqueIndex('entity_links_unique_idx').on(t.fromType, t.fromId, t.toType, t.toId),
  ],
);

export const tags = sqliteTable(
  'tags',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    ...syncColumns(),
  },
  (t) => [uniqueIndex('tags_name_idx').on(sql`lower(${t.name})`)],
);

export const entityTags = sqliteTable(
  'entity_tags',
  {
    entityType: text('entity_type', { enum: LINKABLE_TYPES }).notNull(),
    entityId: text('entity_id').notNull(),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
  },
  (t) => [primaryKey({ columns: [t.entityType, t.entityId, t.tagId] }), index('entity_tags_tag_idx').on(t.tagId)],
);

// ---------------------------------------------------------------------------
// Reading plans (plan definitions are static data in code)
// ---------------------------------------------------------------------------

export const PLAN_STATUSES = ['active', 'paused', 'completed', 'abandoned'] as const;

export const planProgress = sqliteTable('plan_progress', {
  id: text('id').primaryKey(),
  planId: text('plan_id').notNull(),
  status: text('status', { enum: PLAN_STATUSES }).notNull().default('active'),
  startedAt: text('started_at').notNull().$defaultFn(nowIso),
  pausedAt: text('paused_at'),
  completedAt: text('completed_at'),
  /** Local time HH:mm, or null when reminders are off. */
  reminderTime: text('reminder_time'),
  reminderNotificationId: text('reminder_notification_id'),
  ...syncColumns(),
});

export const planDayCompletions = sqliteTable(
  'plan_day_completions',
  {
    id: text('id').primaryKey(),
    planProgressId: text('plan_progress_id')
      .notNull()
      .references(() => planProgress.id, { onDelete: 'cascade' }),
    day: integer('day').notNull(),
    completedAt: text('completed_at').notNull().$defaultFn(nowIso),
  },
  (t) => [uniqueIndex('plan_day_unique_idx').on(t.planProgressId, t.day)],
);

// ---------------------------------------------------------------------------
// Sync bookkeeping
// ---------------------------------------------------------------------------

/** Pending local changes to push to the server (local-first outbox). */
export const outbox = sqliteTable(
  'outbox',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    entityType: text('entity_type', { enum: ENTITY_TYPES }).notNull(),
    entityId: text('entity_id').notNull(),
    operation: text('operation', { enum: ['upsert', 'delete'] }).notNull(),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
  },
  (t) => [index('outbox_entity_idx').on(t.entityType, t.entityId)],
);

/** Key/value sync cursors, e.g. `pull:journal_entries` -> last server updated_at. */
export const syncState = sqliteTable('sync_state', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
});

/** Copies of user content overwritten during sync conflicts, so nothing is lost silently. */
export const syncConflicts = sqliteTable('sync_conflicts', {
  id: text('id').primaryKey(),
  entityType: text('entity_type', { enum: ENTITY_TYPES }).notNull(),
  entityId: text('entity_id').notNull(),
  localJson: text('local_json').notNull(),
  remoteJson: text('remote_json').notNull(),
  resolvedAt: text('resolved_at'),
  createdAt: text('created_at').notNull().$defaultFn(nowIso),
});
