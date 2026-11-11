/**
 * Keeps the server's strict JSON Schemas (structured outputs) and the device's Zod schemas aligned.
 */
import { ASK_SCHEMA, RECAP_SCHEMA, STUDY_SCHEMA } from '../../../../supabase/functions/_shared/ai-schemas';
import { parseRecapOutput, sermonRecapSchema } from '@/features/recap/schema';
import { askAnswerSchema, deepStudySchema, parseAskAnswer, parseDeepStudyOutput } from '@/features/study-ai/schema';
import { askAnswerFixture, deepStudyFixture, recapFixture } from '@/features/study-ai/testing/fixtures';

type Schema = Record<string, unknown>;

/** Walk every object node and assert OpenAI strict-mode rules. */
function assertStrict(schema: Schema, path = '$'): void {
  if (Array.isArray(schema.anyOf)) {
    (schema.anyOf as Schema[]).forEach((option, i) => assertStrict(option, `${path}.anyOf[${i}]`));
    return;
  }
  if (schema.type === 'object') {
    const properties = schema.properties as Record<string, Schema>;
    expect({ path, additionalProperties: schema.additionalProperties }).toEqual({ path, additionalProperties: false });
    expect({ path, required: [...(schema.required as string[])].sort() }).toEqual({ path, required: Object.keys(properties).sort() });
    Object.entries(properties).forEach(([key, child]) => assertStrict(child, `${path}.${key}`));
  }
  if (schema.type === 'array') assertStrict(schema.items as Schema, `${path}[]`);
}

function depth(schema: Schema): number {
  if (Array.isArray(schema.anyOf)) return Math.max(...(schema.anyOf as Schema[]).map(depth));
  if (schema.type === 'object') {
    return 1 + Math.max(0, ...Object.values(schema.properties as Record<string, Schema>).map(depth));
  }
  if (schema.type === 'array') return depth(schema.items as Schema);
  return 0;
}

describe('structured-output schemas', () => {
  test.each([
    ['recap', RECAP_SCHEMA],
    ['study', STUDY_SCHEMA],
    ['ask', ASK_SCHEMA],
  ])('%s schema follows strict-mode rules and nesting limits', (_name, schema) => {
    expect((schema as Schema).type).toBe('object');
    assertStrict(schema as Schema);
    expect(depth(schema as Schema)).toBeLessThanOrEqual(10);
  });

  test('top-level properties match the Zod schemas', () => {
    expect(Object.keys(RECAP_SCHEMA.properties as object).sort()).toEqual(Object.keys(sermonRecapSchema.shape).sort());
    expect(Object.keys(STUDY_SCHEMA.properties as object).sort()).toEqual(Object.keys(deepStudySchema.shape).sort());
    expect(Object.keys(ASK_SCHEMA.properties as object).sort()).toEqual(Object.keys(askAnswerSchema.shape).sort());
  });

  test('outputs shaped like the JSON Schemas pass device validation', () => {
    expect(parseRecapOutput(recapFixture()).success).toBe(true);
    expect(parseDeepStudyOutput(deepStudyFixture()).success).toBe(true);
    expect(parseAskAnswer(askAnswerFixture()).success).toBe(true);
  });
});
