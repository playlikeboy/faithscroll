/**
 * Device-side verification of study output: every Scripture reference (related passages, section
 * sources, answer citations) must exist in the local Bible or it is removed.
 */
import { createReferenceChecker, filterValidReferences, type ReferenceChecker } from '@/services/ai/validation';

import { enforceGrounding, type AskAnswer, type DeepStudy, type StudySource } from './schema';

export interface StudyValidationReport {
  droppedReferences: number;
}

type SectionWithSources = { sources: StudySource[] };

async function validateSources<T extends SectionWithSources>(
  section: T,
  checker: ReferenceChecker,
): Promise<{ section: T; dropped: number }> {
  const withReference = section.sources.filter((source) => source.reference !== null);
  const withoutReference = section.sources.filter((source) => source.reference === null);
  const result = await filterValidReferences(
    withReference,
    (source) => source.reference ?? '',
    (source, ref) => ({ ...source, reference: ref.reference }),
    checker,
  );
  return { section: { ...section, sources: [...result.items, ...withoutReference] }, dropped: result.dropped };
}

async function validateNullable<T extends SectionWithSources>(
  section: T | null,
  checker: ReferenceChecker,
): Promise<{ section: T | null; dropped: number }> {
  if (!section) return { section: null, dropped: 0 };
  return validateSources(section, checker);
}

export async function validateDeepStudy(
  study: DeepStudy,
  { hasLexicalData, checker = createReferenceChecker() }: { hasLexicalData: boolean; checker?: ReferenceChecker },
): Promise<{ study: DeepStudy; report: StudyValidationReport }> {
  const grounded = enforceGrounding(study, { hasLexicalData });

  const related = await filterValidReferences(
    grounded.related_scripture.items,
    (item) => item.reference,
    (item, ref) => ({ ...item, reference: ref.reference }),
    checker,
  );

  const [overview, history, literary, simple, keyWords, original, relatedSection, theology, application] = await Promise.all([
    validateSources(grounded.overview, checker),
    validateNullable(grounded.historical_background, checker),
    validateNullable(grounded.literary_context, checker),
    validateSources(grounded.simple_explanation, checker),
    validateSources(grounded.key_words, checker),
    validateNullable(grounded.original_language, checker),
    validateSources({ ...grounded.related_scripture, items: related.items }, checker),
    validateNullable(grounded.theological_significance, checker),
    validateSources(grounded.practical_application, checker),
  ]);

  const dropped =
    related.dropped +
    [overview, history, literary, simple, keyWords, original, relatedSection, theology, application].reduce(
      (sum, part) => sum + part.dropped,
      0,
    );

  return {
    study: {
      ...grounded,
      overview: overview.section,
      historical_background: history.section,
      literary_context: literary.section,
      simple_explanation: simple.section,
      key_words: keyWords.section,
      original_language: original.section,
      related_scripture: relatedSection.section,
      theological_significance: theology.section,
      practical_application: application.section,
    },
    report: { droppedReferences: dropped },
  };
}

export async function validateAskAnswer(
  answer: AskAnswer,
  checker: ReferenceChecker = createReferenceChecker(),
): Promise<{ answer: AskAnswer; report: StudyValidationReport }> {
  const citations = await filterValidReferences(
    answer.citations,
    (citation) => citation.reference,
    (citation, ref) => ({ ...citation, reference: ref.reference }),
    checker,
  );
  return { answer: { ...answer, citations: citations.items }, report: { droppedReferences: citations.dropped } };
}
