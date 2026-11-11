CREATE TABLE `action_items` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`notes` text,
	`source_type` text DEFAULT 'manual' NOT NULL,
	`source_id` text,
	`due_at` text,
	`reminder_at` text,
	`reminder_notification_id` text,
	`completed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `action_items_source_idx` ON `action_items` (`source_type`,`source_id`);--> statement-breakpoint
CREATE TABLE `collection_items` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `collection_items_collection_idx` ON `collection_items` (`collection_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `collection_items_unique_idx` ON `collection_items` (`collection_id`,`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `entity_links` (
	`id` text PRIMARY KEY NOT NULL,
	`from_type` text NOT NULL,
	`from_id` text NOT NULL,
	`to_type` text NOT NULL,
	`to_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `entity_links_from_idx` ON `entity_links` (`from_type`,`from_id`);--> statement-breakpoint
CREATE INDEX `entity_links_to_idx` ON `entity_links` (`to_type`,`to_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `entity_links_unique_idx` ON `entity_links` (`from_type`,`from_id`,`to_type`,`to_id`);--> statement-breakpoint
CREATE TABLE `entity_tags` (
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`entity_type`, `entity_id`, `tag_id`),
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `entity_tags_tag_idx` ON `entity_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `highlights` (
	`id` text PRIMARY KEY NOT NULL,
	`verse_id` integer NOT NULL,
	`color` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `highlights_verse_idx` ON `highlights` (`verse_id`);--> statement-breakpoint
CREATE TABLE `journal_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`entry_type` text DEFAULT 'personal' NOT NULL,
	`prompt` text,
	`entry_date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `journal_entries_date_idx` ON `journal_entries` (`entry_date`);--> statement-breakpoint
CREATE TABLE `outbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`operation` text NOT NULL,
	`created_at` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text
);
--> statement-breakpoint
CREATE INDEX `outbox_entity_idx` ON `outbox` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `plan_day_completions` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_progress_id` text NOT NULL,
	`day` integer NOT NULL,
	`completed_at` text NOT NULL,
	FOREIGN KEY (`plan_progress_id`) REFERENCES `plan_progress`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plan_day_unique_idx` ON `plan_day_completions` (`plan_progress_id`,`day`);--> statement-breakpoint
CREATE TABLE `plan_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`started_at` text NOT NULL,
	`paused_at` text,
	`completed_at` text,
	`reminder_time` text,
	`reminder_notification_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `prayer_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`category` text,
	`status` text DEFAULT 'praying' NOT NULL,
	`reminder_at` text,
	`reminder_notification_id` text,
	`answered_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `prayer_entries_status_idx` ON `prayer_entries` (`status`);--> statement-breakpoint
CREATE TABLE `prayer_updates` (
	`id` text PRIMARY KEY NOT NULL,
	`prayer_id` text NOT NULL,
	`content` text NOT NULL,
	`status_change` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`prayer_id`) REFERENCES `prayer_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `prayer_updates_prayer_idx` ON `prayer_updates` (`prayer_id`);--> statement-breakpoint
CREATE TABLE `reading_history` (
	`id` text PRIMARY KEY NOT NULL,
	`translation_id` text NOT NULL,
	`book_id` integer NOT NULL,
	`chapter` integer NOT NULL,
	`read_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reading_history_read_at_idx` ON `reading_history` (`read_at`);--> statement-breakpoint
CREATE TABLE `reading_progress` (
	`translation_id` text PRIMARY KEY NOT NULL,
	`book_id` integer NOT NULL,
	`chapter` integer NOT NULL,
	`verse` integer DEFAULT 1 NOT NULL,
	`scroll_offset` real DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `saved_verses` (
	`id` text PRIMARY KEY NOT NULL,
	`start_verse_id` integer NOT NULL,
	`end_verse_id` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `saved_verses_start_idx` ON `saved_verses` (`start_verse_id`);--> statement-breakpoint
CREATE TABLE `scripture_references` (
	`id` text PRIMARY KEY NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`start_verse_id` integer NOT NULL,
	`end_verse_id` integer NOT NULL,
	`reference_text` text NOT NULL,
	`position_ms` integer,
	`origin` text DEFAULT 'user' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `scripture_references_source_idx` ON `scripture_references` (`source_type`,`source_id`);--> statement-breakpoint
CREATE INDEX `scripture_references_verse_idx` ON `scripture_references` (`start_verse_id`);--> statement-breakpoint
CREATE TABLE `sermon_bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`sermon_id` text NOT NULL,
	`recording_id` text,
	`position_ms` integer NOT NULL,
	`note` text,
	`reference` text,
	`start_verse_id` integer,
	`end_verse_id` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`sermon_id`) REFERENCES `sermons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recording_id`) REFERENCES `sermon_recordings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sermon_bookmarks_recording_idx` ON `sermon_bookmarks` (`recording_id`,`position_ms`);--> statement-breakpoint
CREATE TABLE `sermon_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`sermon_id` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`sermon_id`) REFERENCES `sermons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sermon_notes_sermon_idx` ON `sermon_notes` (`sermon_id`);--> statement-breakpoint
CREATE TABLE `sermon_recaps` (
	`id` text PRIMARY KEY NOT NULL,
	`sermon_id` text NOT NULL,
	`transcript_id` text,
	`remote_job_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`content_json` text,
	`provider` text,
	`model` text,
	`error_code` text,
	`generated_at` text,
	`edited_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`sermon_id`) REFERENCES `sermons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transcript_id`) REFERENCES `transcripts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `sermon_recaps_sermon_idx` ON `sermon_recaps` (`sermon_id`);--> statement-breakpoint
CREATE TABLE `sermon_recordings` (
	`id` text PRIMARY KEY NOT NULL,
	`sermon_id` text NOT NULL,
	`title` text,
	`local_file_name` text,
	`mime_type` text DEFAULT 'audio/mp4' NOT NULL,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`size_bytes` integer,
	`status` text DEFAULT 'recording' NOT NULL,
	`cloud_status` text DEFAULT 'local' NOT NULL,
	`cloud_path` text,
	`started_at` text,
	`ended_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`sermon_id`) REFERENCES `sermons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sermon_recordings_sermon_idx` ON `sermon_recordings` (`sermon_id`);--> statement-breakpoint
CREATE TABLE `sermon_series` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`speaker` text,
	`church` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sermons` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`speaker` text,
	`church` text,
	`series_id` text,
	`sermon_date` text,
	`main_passage` text,
	`main_passage_start_verse_id` integer,
	`main_passage_end_verse_id` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`series_id`) REFERENCES `sermon_series`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `sermons_date_idx` ON `sermons` (`sermon_date`);--> statement-breakpoint
CREATE INDEX `sermons_series_idx` ON `sermons` (`series_id`);--> statement-breakpoint
CREATE TABLE `sync_conflicts` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`local_json` text NOT NULL,
	`remote_json` text NOT NULL,
	`resolved_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_idx` ON `tags` (lower("name"));--> statement-breakpoint
CREATE TABLE `transcript_segments` (
	`id` text PRIMARY KEY NOT NULL,
	`transcript_id` text NOT NULL,
	`start_ms` integer NOT NULL,
	`end_ms` integer NOT NULL,
	`text` text NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`transcript_id`) REFERENCES `transcripts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `transcript_segments_transcript_idx` ON `transcript_segments` (`transcript_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `transcripts` (
	`id` text PRIMARY KEY NOT NULL,
	`sermon_id` text NOT NULL,
	`recording_id` text,
	`remote_job_id` text,
	`language` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`text` text,
	`error_code` text,
	`edited_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`sermon_id`) REFERENCES `sermons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recording_id`) REFERENCES `sermon_recordings`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `transcripts_sermon_idx` ON `transcripts` (`sermon_id`);--> statement-breakpoint
CREATE TABLE `verse_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`start_verse_id` integer NOT NULL,
	`end_verse_id` integer NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verse_notes_start_idx` ON `verse_notes` (`start_verse_id`);