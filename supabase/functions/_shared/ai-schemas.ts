/**
 * JSON Schemas for OpenAI Responses API structured outputs (`text.format.type = "json_schema"`,
 * `strict: true`). Strict mode rules: every property is required, every object sets
 * `additionalProperties: false`, optional values are expressed as `["type", "null"]`.
 *
 * The device re-validates every result with the matching Zod schema:
 * recap → src/features/recap/schema.ts, study/ask → src/features/study-ai/schema.ts.
 * A parity test (src/services/ai/__tests__/server-schemas.test.ts) keeps them aligned.
 */

type JsonSchema = Record<string, unknown>;

const str = (description?: string): JsonSchema => (description ? { type: 'string', description } : { type: 'string' });
const nullableStr = (description?: string): JsonSchema =>
  description ? { type: ['string', 'null'], description } : { type: ['string', 'null'] };
const arrayOf = (items: JsonSchema, description?: string): JsonSchema =>
  description ? { type: 'array', items, description } : { type: 'array', items };

function object(properties: Record<string, JsonSchema>): JsonSchema {
  return { type: 'object', additionalProperties: false, required: Object.keys(properties), properties };
}

function nullable(schema: JsonSchema): JsonSchema {
  return { anyOf: [schema, { type: 'null' }] };
}

// ---------------------------------------------------------------------------------------------
// Sermon recap
// ---------------------------------------------------------------------------------------------

const seconds = 'Seconds from the start of the recording, taken from the [mm:ss] markers in the transcript.';

export const RECAP_SCHEMA: JsonSchema = object({
  title: str('A short neutral title describing the sermon’s theme.'),
  summary: str('3–6 sentence summary of what the speaker said. Report, do not quote or embellish.'),
  main_points: arrayOf(
    object({
      heading: str(),
      description: str(),
      timestamps: arrayOf({ type: 'number' }, seconds),
    }),
  ),
  scripture_references: arrayOf(
    object({
      reference: str('A Bible reference exactly as "Book Chapter:Verse(-Verse)", e.g. "Romans 8:28".'),
      timestamp: { type: ['number', 'null'], description: `${seconds} Null when unknown.` },
      context: nullableStr('Why the passage was mentioned, in your own words.'),
    }),
  ),
  important_moments: arrayOf(
    object({
      description: str('What happened at this moment, described (not quoted).'),
      timestamp: { type: ['number', 'null'], description: `${seconds} Null when unknown.` },
    }),
  ),
  discussion_questions: arrayOf(str()),
  action_items: arrayOf(
    object({
      title: str('A concrete, gentle practical step ("Live It Out").'),
      description: nullableStr(),
    }),
  ),
  reflection_questions: arrayOf(str()),
});

// ---------------------------------------------------------------------------------------------
// Deep Study
// ---------------------------------------------------------------------------------------------

const KIND: JsonSchema = {
  type: 'string',
  enum: ['text', 'interpretation'],
  description: '"text" = what the passage or established textual/historical information says; "interpretation" = explanation, theology or application.',
};

const SOURCE: JsonSchema = object({
  type: {
    type: 'string',
    enum: ['passage', 'scripture', 'lexical_data', 'historical_scholarship', 'tradition'],
  },
  reference: nullableStr('Bible reference when type is passage or scripture, otherwise null.'),
  label: str('Short human-readable description of the source.'),
});

const section = (): JsonSchema => object({ body: str(), kind: KIND, sources: arrayOf(SOURCE) });

export const STUDY_SCHEMA: JsonSchema = object({
  passage: str('The passage reference being studied.'),
  overview: section(),
  historical_background: nullable(section()),
  literary_context: nullable(section()),
  simple_explanation: section(),
  key_words: object({
    kind: KIND,
    sources: arrayOf(SOURCE),
    items: arrayOf(object({ term: str('An English word from the passage.'), explanation: str() })),
  }),
  original_language: nullable(
    object({
      kind: KIND,
      sources: arrayOf(SOURCE),
      items: arrayOf(
        object({
          term: str(),
          original: str(),
          transliteration: str(),
          language: { type: 'string', enum: ['hebrew', 'aramaic', 'greek'] },
          gloss: str(),
        }),
      ),
    }),
  ),
  related_scripture: object({
    kind: KIND,
    sources: arrayOf(SOURCE),
    items: arrayOf(object({ reference: str('Bible reference, e.g. "Romans 5:8".'), connection: str() })),
  }),
  theological_significance: nullable(
    object({
      body: str(),
      kind: KIND,
      sources: arrayOf(SOURCE),
      perspectives: arrayOf(object({ tradition: str(), view: str() })),
    }),
  ),
  practical_application: section(),
  reflection_questions: arrayOf(str()),
  uncertainty_note: nullableStr('Anything uncertain or debated about this passage, or null.'),
});

// ---------------------------------------------------------------------------------------------
// Passage assistant
// ---------------------------------------------------------------------------------------------

export const ASK_SCHEMA: JsonSchema = object({
  answer: str(),
  kind: { type: 'string', enum: ['text', 'interpretation', 'mixed'] },
  citations: arrayOf(object({ reference: str('Bible reference supporting a factual claim.'), note: nullableStr() })),
  uncertainty: nullableStr('What is uncertain or debated, or null.'),
  suggest_pastor: { type: 'boolean', description: 'True for contested doctrine or personal pastoral matters.' },
});

export const SCHEMAS = {
  recap: { name: 'sermon_recap', schema: RECAP_SCHEMA },
  study: { name: 'deep_study', schema: STUDY_SCHEMA },
  ask: { name: 'passage_answer', schema: ASK_SCHEMA },
} as const;

export type GenerationTask = keyof typeof SCHEMAS;
