import { emptyDraftItem, EDIT_SPECS, fromDraft, toDraft } from '../edit';
import { parseRecapOutput, RECAP_SECTIONS, type SermonRecap } from '../schema';
import { recapFixture } from '@/features/study-ai/testing/fixtures';

function recap(): SermonRecap {
  const parsed = parseRecapOutput(recapFixture());
  if (!parsed.success) throw new Error(parsed.error);
  return {
    ...parsed.data,
    scripture_references: [{ ...parsed.data.scripture_references[0], startVerseId: 40018021, endVerseId: 40018022 }],
  };
}

describe('recap section editing', () => {
  test('every section round-trips unchanged when nothing is edited', () => {
    const original = recap();
    for (const { key } of RECAP_SECTIONS) {
      expect(fromDraft(original, key, toDraft(original, key))).toEqual(original);
    }
  });

  test('editing a main point keeps its timestamps', () => {
    const original = recap();
    const [point] = toDraft(original, 'main_points');
    const edited = fromDraft(original, 'main_points', [{ ...point, values: { heading: ' New heading ', description: 'Desc' } }]);
    expect(edited.main_points).toEqual([{ heading: 'New heading', description: 'Desc', timestamps: [65, 300.5] }]);
    expect(original.main_points[0].heading).toBe('Forgiveness is limitless');
  });

  test('adds and removes questions and actions, dropping blank ones', () => {
    const original = recap();
    const questions = [...toDraft(original, 'discussion_questions'), { ...emptyDraftItem('discussion_questions'), values: { text: 'New?' } }, emptyDraftItem('discussion_questions')];
    expect(fromDraft(original, 'discussion_questions', questions).discussion_questions).toEqual(['Who do you find hard to forgive?', 'New?']);

    const actions = [{ ...emptyDraftItem('action_items'), values: { title: 'Pray daily', description: ' ' } }];
    expect(fromDraft(original, 'action_items', actions).action_items).toEqual([{ title: 'Pray daily', description: null }]);
  });

  test('Scripture references can be removed but not edited or added', () => {
    const original = recap();
    expect(EDIT_SPECS.scripture_references).toMatchObject({ editable: false, addLabel: null });
    expect(fromDraft(original, 'scripture_references', []).scripture_references).toEqual([]);
  });

  test('moments keep their timestamp and the summary can be cleared', () => {
    const original = recap();
    const [moment] = toDraft(original, 'important_moments');
    expect(fromDraft(original, 'important_moments', [{ ...moment, values: { description: 'Edited' } }]).important_moments).toEqual([
      { description: 'Edited', timestamp: 410 },
    ]);
    expect(fromDraft(original, 'summary', [{ ...toDraft(original, 'summary')[0], values: { text: '' } }]).summary).toBe('');
  });
});
