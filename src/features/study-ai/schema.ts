/**
 * Deep Study (PRD §6.2F) and the passage assistant (§6.2G) — structured AI output.
 *
 * Every section states its `kind` ('text' = what the passage / established textual information
 * says; 'interpretation' = explanation, application or theology) and its `sources`, so the UI can
 * keep interpretation visibly apart from Scripture. Original-language notes are only allowed when
 * they are grounded in lexical data we supplied (`enforceGrounding`).
 */
import { z } from 'zod';

import type { ParseResult } from '@/features/recap/schema';

const MAX_BODY = 4_000;
const MAX_ITEMS = 12;

const text = (max: number) => z.string().transform((value) => value.trim().slice(0, max));
const nullableText = (max: number) =>
  z
    .string()
    .nullable()
    .transform((value) => {
      const trimmed = value?.trim().slice(0, max) ?? '';
      return trimmed.length > 0 ? trimmed : null;
    });
const capped = <T extends z.ZodType>(item: T) => z.array(item).transform((items) => items.slice(0, MAX_ITEMS));

export const SOURCE_TYPES = ['passage', 'scripture', 'lexical_data', 'historical_scholarship', 'tradition'] as const;
export type StudySourceType = (typeof SOURCE_TYPES)[number];

export const CONTENT_KINDS = ['text', 'interpretation'] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

const sourceSchema = z.object({
  type: z.enum(SOURCE_TYPES),
  /** A Scripture reference when the source is a passage; verified on device. */
  reference: nullableText(80),
  label: text(200),
});

const sectionSchema = z.object({
  body: text(MAX_BODY),
  kind: z.enum(CONTENT_KINDS),
  sources: capped(sourceSchema),
});

const keyWordsSchema = z.object({
  kind: z.enum(CONTENT_KINDS),
  sources: capped(sourceSchema),
  items: capped(z.object({ term: text(80), explanation: text(600) })),
});

const originalLanguageSchema = z.object({
  kind: z.enum(CONTENT_KINDS),
  sources: capped(sourceSchema),
  items: capped(
    z.object({
      term: text(80),
      original: text(80),
      transliteration: text(80),
      language: z.enum(['hebrew', 'aramaic', 'greek']),
      gloss: text(300),
    }),
  ),
});

const relatedScriptureSchema = z.object({
  kind: z.enum(CONTENT_KINDS),
  sources: capped(sourceSchema),
  items: capped(z.object({ reference: text(80), connection: text(600) })),
});

const theologySchema = sectionSchema.extend({
  /** How different Christian traditions read the passage, presented fairly. */
  perspectives: capped(z.object({ tradition: text(80), view: text(800) })),
});

export const deepStudySchema = z.object({
  passage: text(80),
  overview: sectionSchema,
  /** Advanced-only sections are null in Basic mode. */
  historical_background: sectionSchema.nullable(),
  literary_context: sectionSchema.nullable(),
  simple_explanation: sectionSchema,
  key_words: keyWordsSchema,
  original_language: originalLanguageSchema.nullable(),
  related_scripture: relatedScriptureSchema,
  theological_significance: theologySchema.nullable(),
  practical_application: sectionSchema,
  reflection_questions: capped(text(400)).transform((items) => items.filter((item) => item.length > 0)),
  uncertainty_note: nullableText(800),
});

export type DeepStudy = z.output<typeof deepStudySchema>;
export type StudySource = z.output<typeof sourceSchema>;
export type StudySection = z.output<typeof sectionSchema>;
export type StudyMode = 'basic' | 'advanced';

export type DeepStudySectionKey = Exclude<keyof DeepStudy, 'passage' | 'uncertainty_note'>;

export const DEEP_STUDY_SECTIONS: readonly { key: DeepStudySectionKey; title: string }[] = [
  { key: 'overview', title: 'Overview' },
  { key: 'historical_background', title: 'Historical background' },
  { key: 'literary_context', title: 'Literary & biblical context' },
  { key: 'simple_explanation', title: 'Simple explanation' },
  { key: 'key_words', title: 'Key words' },
  { key: 'original_language', title: 'Original language' },
  { key: 'related_scripture', title: 'Related Scripture' },
  { key: 'theological_significance', title: 'Theological significance' },
  { key: 'practical_application', title: 'Practical application' },
  { key: 'reflection_questions', title: 'Reflection questions' },
];

export const askAnswerSchema = z.object({
  answer: text(6_000).refine((value) => value.length > 0, 'answer is empty'),
  kind: z.enum(['text', 'interpretation', 'mixed']),
  citations: capped(z.object({ reference: text(80), note: nullableText(300) })),
  uncertainty: nullableText(800),
  /** True when the question touches contested doctrine or pastoral care. */
  suggest_pastor: z.boolean(),
});

export type AskAnswer = z.output<typeof askAnswerSchema>;

function parseWith<T>(schema: z.ZodType<T>, raw: unknown): ParseResult<T> {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return { success: false, error: 'invalid_json' };
    }
  }
  const parsed = schema.safeParse(value);
  if (parsed.success) return { success: true, data: parsed.data };
  const first = parsed.error.issues[0];
  return { success: false, error: first ? `${first.path.join('.') || 'root'}: ${first.message}` : 'invalid_output' };
}

export function parseDeepStudyOutput(raw: unknown): ParseResult<DeepStudy> {
  return parseWith(deepStudySchema, raw);
}

export function parseAskAnswer(raw: unknown): ParseResult<AskAnswer> {
  return parseWith(askAnswerSchema, raw);
}

/**
 * PRD §6.2F: "AI must not invent Greek/Hebrew meanings". Original-language content survives only
 * when lexical data was supplied with the request AND the section cites it.
 */
export function enforceGrounding(study: DeepStudy, { hasLexicalData }: { hasLexicalData: boolean }): DeepStudy {
  const section = study.original_language;
  if (!section) return study;
  const citesLexicon = section.sources.some((source) => source.type === 'lexical_data');
  if (hasLexicalData && citesLexicon && section.items.length > 0) return study;
  return { ...study, original_language: null };
}

/** Sections that have content, in editorial order. */
export function visibleSections(study: DeepStudy): { key: DeepStudySectionKey; title: string }[] {
  return DEEP_STUDY_SECTIONS.filter(({ key }) => {
    const value = study[key];
    if (value === null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if ('items' in value) return value.items.length > 0;
    return value.body.length > 0;
  });
}
