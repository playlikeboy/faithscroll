/**
 * Sermon recap (PRD §6.3G, §7): the structured, user-editable output of the recap job.
 *
 * The server asks the model for exactly this shape via JSON-schema structured outputs
 * (`supabase/functions/_shared/ai-schemas.ts`); this Zod schema re-validates it on device and is
 * also used to read the user's edited copy back from `sermon_recaps.content_json`.
 * Timestamps are seconds from the start of the sermon timeline (all recording parts).
 */
import { z } from 'zod';

const MAX_TEXT = 2_000;
const MAX_SUMMARY = 4_000;
const MAX_ITEMS = 12;
const MAX_TIMESTAMPS = 6;

/** Trimmed text, truncated rather than rejected (models occasionally over-run). */
const text = (max: number) => z.string().transform((value) => value.trim().slice(0, max));

const nullableText = (max: number) =>
  z
    .string()
    .nullable()
    .transform((value) => {
      const trimmed = value?.trim().slice(0, max) ?? '';
      return trimmed.length > 0 ? trimmed : null;
    });

const seconds = z.number().refine(Number.isFinite, 'timestamp must be a finite number');

/** Array of items; blank items are removed and the list is capped. */
function list<T extends z.ZodType>(item: T, isBlank: (value: z.output<T>) => boolean) {
  return z.array(item).transform((items) => items.filter((value) => !isBlank(value)).slice(0, MAX_ITEMS));
}

const mainPointSchema = z.object({
  heading: text(200),
  description: text(MAX_TEXT),
  timestamps: z.array(seconds).transform((values) => values.slice(0, MAX_TIMESTAMPS)),
});

const scriptureReferenceSchema = z.object({
  reference: text(80),
  timestamp: seconds.nullable(),
  context: nullableText(400),
  /** Added on device after the reference is verified against the local Bible. */
  startVerseId: z.number().int().optional(),
  endVerseId: z.number().int().optional(),
});

const momentSchema = z.object({
  description: text(MAX_TEXT),
  timestamp: seconds.nullable(),
});

const actionItemSchema = z.object({
  title: text(200),
  description: nullableText(MAX_TEXT),
});

export const sermonRecapSchema = z.object({
  title: text(200),
  summary: text(MAX_SUMMARY),
  main_points: list(mainPointSchema, (p) => p.heading.length === 0 && p.description.length === 0),
  scripture_references: list(scriptureReferenceSchema, (r) => r.reference.length === 0),
  important_moments: list(momentSchema, (m) => m.description.length === 0),
  discussion_questions: list(text(500), (q) => q.length === 0),
  action_items: list(actionItemSchema, (a) => a.title.length === 0),
  reflection_questions: list(text(500), (q) => q.length === 0),
});

export type SermonRecap = z.output<typeof sermonRecapSchema>;
export type RecapMainPoint = SermonRecap['main_points'][number];
export type RecapScriptureReference = SermonRecap['scripture_references'][number];
export type RecapMoment = SermonRecap['important_moments'][number];
export type RecapActionItem = SermonRecap['action_items'][number];

export type RecapSectionKey = Exclude<keyof SermonRecap, 'title'>;

export interface RecapSectionInfo {
  key: RecapSectionKey;
  title: string;
}

/** The seven recap sections in display order (PRD §6.3G). */
export const RECAP_SECTIONS: readonly RecapSectionInfo[] = [
  { key: 'summary', title: 'Summary' },
  { key: 'main_points', title: 'Main points' },
  { key: 'scripture_references', title: 'Scripture mentioned' },
  { key: 'important_moments', title: 'Important moments' },
  { key: 'discussion_questions', title: 'Discussion questions' },
  { key: 'action_items', title: 'Live It Out' },
  { key: 'reflection_questions', title: 'Personal reflection' },
];

export type ParseResult<T> = { success: true; data: T } | { success: false; error: string };

/** Parse model output (object or JSON string) into a recap. Never throws. */
export function parseRecapOutput(raw: unknown): ParseResult<SermonRecap> {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return { success: false, error: 'invalid_json' };
    }
  }
  const parsed = sermonRecapSchema.safeParse(value);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { success: false, error: first ? `${first.path.join('.') || 'recap'}: ${first.message}` : 'invalid_recap' };
  }
  return { success: true, data: parsed.data };
}

/** Read a recap stored in `sermon_recaps.content_json`; null when absent or unreadable. */
export function parseStoredRecap(json: string | null | undefined): SermonRecap | null {
  if (!json) return null;
  const result = parseRecapOutput(json);
  return result.success ? result.data : null;
}

export function serializeRecap(recap: SermonRecap): string {
  return JSON.stringify(recap);
}

export function emptyRecap(): SermonRecap {
  return {
    title: '',
    summary: '',
    main_points: [],
    scripture_references: [],
    important_moments: [],
    discussion_questions: [],
    action_items: [],
    reflection_questions: [],
  };
}

export function isRecapEmpty(recap: SermonRecap): boolean {
  return (
    recap.summary.length === 0 &&
    RECAP_SECTIONS.every((section) => {
      const value = recap[section.key];
      return Array.isArray(value) ? value.length === 0 : true;
    })
  );
}
