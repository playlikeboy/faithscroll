/**
 * Hand-written types for the tables created by the backend-auth migrations
 * (`supabase/migrations/20261111000100_core.sql`, `…000110_sync_mirrors.sql`).
 * plus `subscriptions` / `has_active_plus` from `…000300_billing.sql`.
 * Keep in sync with the SQL. Regenerate-able with `supabase gen types typescript` once a project
 * is linked; the AI tables (…000200_ai.sql) are typed by the AI service layer instead.
 * Generated `search_vector` columns are omitted (never selected by the app).
 */

type Timestamp = string;

/** Columns every sync mirror carries in addition to its own fields. */
type MirrorRowColumns = {
  user_id: string;
  created_at: Timestamp;
  updated_at: Timestamp;
  deleted_at: Timestamp | null;
  version: number;
  server_updated_at: Timestamp;
};

type MirrorInsertColumns = {
  user_id?: string;
  created_at?: Timestamp;
  updated_at?: Timestamp;
  deleted_at?: Timestamp | null;
  version?: number;
};

type Mirror<Own extends { id: string }, OptionalOnInsert extends keyof Own = never> = {
  Row: Own & MirrorRowColumns;
  Insert: Omit<Own, OptionalOnInsert> & Partial<Pick<Own, OptionalOnInsert>> & MirrorInsertColumns;
  Update: Partial<Own> & MirrorInsertColumns;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string | null; avatar_url: string | null; created_at: Timestamp; updated_at: Timestamp };
        Insert: { id: string; display_name?: string | null; avatar_url?: string | null; created_at?: Timestamp; updated_at?: Timestamp };
        Update: { display_name?: string | null; avatar_url?: string | null };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          user_id: string;
          theme_preference: string;
          scripture_size_index: number;
          translation_id: string;
          reading_goal: string | null;
          daily_reminder_time: string | null;
          daily_reminder_enabled: boolean;
          recording_consent_at: Timestamp | null;
          ai_processing_consent_at: Timestamp | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          user_id: string;
          theme_preference?: string;
          scripture_size_index?: number;
          translation_id?: string;
          reading_goal?: string | null;
          daily_reminder_time?: string | null;
          daily_reminder_enabled?: boolean;
          recording_consent_at?: Timestamp | null;
          ai_processing_consent_at?: Timestamp | null;
        };
        Update: Partial<Database['public']['Tables']['user_preferences']['Insert']>;
        Relationships: [];
      };
      /** Plus entitlement mirrored from RevenueCat (migration 20261111000300_billing.sql). Read-only for users. */
      subscriptions: {
        Row: {
          user_id: string;
          entitlement: string;
          product_id: string | null;
          store: string | null;
          environment: string | null;
          period_type: string | null;
          expires_at: Timestamp | null;
          last_event_id: string | null;
          last_event_at: Timestamp | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          user_id: string;
          entitlement?: string;
          product_id?: string | null;
          store?: string | null;
          environment?: string | null;
          period_type?: string | null;
          expires_at?: Timestamp | null;
          last_event_id?: string | null;
          last_event_at?: Timestamp | null;
        };
        Update: Partial<Database['public']['Tables']['subscriptions']['Insert']>;
        Relationships: [];
      };
      highlights: Mirror<{ id: string; verse_id: number; color: string }>;
      saved_verses: Mirror<{ id: string; start_verse_id: number; end_verse_id: number }>;
      verse_notes: Mirror<{ id: string; start_verse_id: number; end_verse_id: number; content: string }, 'content'>;
      collections: Mirror<{ id: string; title: string; description: string | null }, 'description'>;
      collection_items: Mirror<
        { id: string; collection_id: string; entity_type: string; entity_id: string; sort_order: number },
        'sort_order'
      >;
      sermon_series: Mirror<
        { id: string; title: string; description: string | null; speaker: string | null; church: string | null },
        'description' | 'speaker' | 'church'
      >;
      sermons: Mirror<
        {
          id: string;
          title: string;
          speaker: string | null;
          church: string | null;
          series_id: string | null;
          sermon_date: string | null;
          main_passage: string | null;
          main_passage_start_verse_id: number | null;
          main_passage_end_verse_id: number | null;
        },
        'speaker' | 'church' | 'series_id' | 'sermon_date' | 'main_passage' | 'main_passage_start_verse_id' | 'main_passage_end_verse_id'
      >;
      sermon_recordings: Mirror<
        {
          id: string;
          sermon_id: string;
          title: string | null;
          mime_type: string;
          duration_ms: number;
          size_bytes: number | null;
          status: string;
          cloud_status: string;
          cloud_path: string | null;
          started_at: string | null;
          ended_at: string | null;
        },
        'title' | 'mime_type' | 'duration_ms' | 'size_bytes' | 'status' | 'cloud_status' | 'cloud_path' | 'started_at' | 'ended_at'
      >;
      sermon_bookmarks: Mirror<
        {
          id: string;
          sermon_id: string;
          recording_id: string | null;
          position_ms: number;
          note: string | null;
          reference: string | null;
          start_verse_id: number | null;
          end_verse_id: number | null;
        },
        'recording_id' | 'note' | 'reference' | 'start_verse_id' | 'end_verse_id'
      >;
      sermon_notes: Mirror<{ id: string; sermon_id: string; content: string; sort_order: number }, 'content' | 'sort_order'>;
      transcripts: Mirror<
        {
          id: string;
          sermon_id: string;
          recording_id: string | null;
          remote_job_id: string | null;
          language: string | null;
          status: string;
          text: string | null;
          error_code: string | null;
          edited_at: string | null;
        },
        'recording_id' | 'remote_job_id' | 'language' | 'status' | 'text' | 'error_code' | 'edited_at'
      >;
      sermon_recaps: Mirror<
        {
          id: string;
          sermon_id: string;
          transcript_id: string | null;
          remote_job_id: string | null;
          status: string;
          content_json: string | null;
          provider: string | null;
          model: string | null;
          error_code: string | null;
          generated_at: string | null;
          edited_at: string | null;
        },
        'transcript_id' | 'remote_job_id' | 'status' | 'content_json' | 'provider' | 'model' | 'error_code' | 'generated_at' | 'edited_at'
      >;
      scripture_references: Mirror<
        {
          id: string;
          source_type: string;
          source_id: string;
          start_verse_id: number;
          end_verse_id: number;
          reference_text: string;
          position_ms: number | null;
          origin: string;
        },
        'position_ms' | 'origin'
      >;
      journal_entries: Mirror<
        { id: string; title: string; content: string; entry_type: string; prompt: string | null; entry_date: string },
        'title' | 'content' | 'entry_type' | 'prompt'
      >;
      prayer_entries: Mirror<
        {
          id: string;
          title: string;
          content: string;
          category: string | null;
          status: string;
          reminder_at: string | null;
          answered_at: string | null;
        },
        'content' | 'category' | 'status' | 'reminder_at' | 'answered_at'
      >;
      prayer_updates: Mirror<{ id: string; prayer_id: string; content: string; status_change: string | null }, 'status_change'>;
      action_items: Mirror<
        {
          id: string;
          title: string;
          notes: string | null;
          source_type: string;
          source_id: string | null;
          due_at: string | null;
          reminder_at: string | null;
          completed_at: string | null;
        },
        'notes' | 'source_type' | 'source_id' | 'due_at' | 'reminder_at' | 'completed_at'
      >;
      entity_links: Mirror<{ id: string; from_type: string; from_id: string; to_type: string; to_id: string }>;
      tags: Mirror<{ id: string; name: string }>;
      entity_tags: Mirror<{ id: string; entity_type: string; entity_id: string; tag_id: string }, 'id'>;
      plan_progress: Mirror<
        {
          id: string;
          plan_id: string;
          status: string;
          started_at: string;
          paused_at: string | null;
          completed_at: string | null;
          reminder_time: string | null;
        },
        'status' | 'paused_at' | 'completed_at' | 'reminder_time'
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      /** Service role only (EXECUTE is not granted to app users). */
      has_active_plus: { Args: { p_user_id: string }; Returns: boolean };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type PublicTables = Database['public']['Tables'];
export type TableName = keyof PublicTables;
export type TableRow<T extends TableName> = PublicTables[T]['Row'];
