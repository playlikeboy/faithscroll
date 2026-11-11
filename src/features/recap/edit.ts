/**
 * Pure model for editing one recap section: convert it to editable text fields and back.
 * Timestamps and verified verse ids are carried through unchanged; Scripture references can only
 * be removed (new ones would bypass verification).
 */
import type { RecapSectionKey, SermonRecap } from './schema';

export interface FieldSpec {
  name: string;
  label: string;
  multiline?: boolean;
}

export interface SectionEditSpec {
  fields: FieldSpec[];
  /** Label of the "add" button, or null when items cannot be added. */
  addLabel: string | null;
  /** Whether field values can be edited (false = remove-only). */
  editable: boolean;
}

export interface DraftItem {
  id: string;
  values: Record<string, string>;
  /** The original item, so untouched data (timestamps, verse ids) survives the edit. */
  original: unknown;
}

export const EDIT_SPECS: Record<RecapSectionKey, SectionEditSpec> = {
  summary: { fields: [{ name: 'text', label: 'Summary', multiline: true }], addLabel: null, editable: true },
  main_points: {
    fields: [
      { name: 'heading', label: 'Heading' },
      { name: 'description', label: 'Description', multiline: true },
    ],
    addLabel: 'Add a point',
    editable: true,
  },
  scripture_references: { fields: [{ name: 'reference', label: 'Reference' }], addLabel: null, editable: false },
  important_moments: { fields: [{ name: 'description', label: 'Moment', multiline: true }], addLabel: null, editable: true },
  discussion_questions: { fields: [{ name: 'text', label: 'Question', multiline: true }], addLabel: 'Add a question', editable: true },
  action_items: {
    fields: [
      { name: 'title', label: 'Action' },
      { name: 'description', label: 'Details (optional)', multiline: true },
    ],
    addLabel: 'Add an action',
    editable: true,
  },
  reflection_questions: { fields: [{ name: 'text', label: 'Question', multiline: true }], addLabel: 'Add a question', editable: true },
};

let draftCounter = 0;
const draftId = () => `draft-${(draftCounter += 1)}`;

export function toDraft(recap: SermonRecap, key: RecapSectionKey): DraftItem[] {
  switch (key) {
    case 'summary':
      return [{ id: draftId(), values: { text: recap.summary }, original: null }];
    case 'main_points':
      return recap.main_points.map((p) => ({ id: draftId(), values: { heading: p.heading, description: p.description }, original: p }));
    case 'scripture_references':
      return recap.scripture_references.map((r) => ({ id: draftId(), values: { reference: r.reference }, original: r }));
    case 'important_moments':
      return recap.important_moments.map((m) => ({ id: draftId(), values: { description: m.description }, original: m }));
    case 'action_items':
      return recap.action_items.map((a) => ({ id: draftId(), values: { title: a.title, description: a.description ?? '' }, original: a }));
    case 'discussion_questions':
    case 'reflection_questions':
      return recap[key].map((q) => ({ id: draftId(), values: { text: q }, original: q }));
  }
}

export function emptyDraftItem(key: RecapSectionKey): DraftItem {
  const values = Object.fromEntries(EDIT_SPECS[key].fields.map((field) => [field.name, '']));
  return { id: draftId(), values, original: null };
}

const value = (item: DraftItem, name: string) => (item.values[name] ?? '').trim();

/** Apply edited drafts to the recap (returns a new object). Blank items are dropped. */
export function fromDraft(recap: SermonRecap, key: RecapSectionKey, items: readonly DraftItem[]): SermonRecap {
  switch (key) {
    case 'summary':
      return { ...recap, summary: items[0] ? value(items[0], 'text') : '' };
    case 'main_points':
      return {
        ...recap,
        main_points: items
          .filter((item) => value(item, 'heading') || value(item, 'description'))
          .map((item) => ({
            timestamps: (item.original as SermonRecap['main_points'][number] | null)?.timestamps ?? [],
            heading: value(item, 'heading'),
            description: value(item, 'description'),
          })),
      };
    case 'scripture_references':
      return { ...recap, scripture_references: items.map((item) => item.original as SermonRecap['scripture_references'][number]) };
    case 'important_moments':
      return {
        ...recap,
        important_moments: items
          .filter((item) => value(item, 'description'))
          .map((item) => ({ ...(item.original as SermonRecap['important_moments'][number]), description: value(item, 'description') })),
      };
    case 'action_items':
      return {
        ...recap,
        action_items: items
          .filter((item) => value(item, 'title'))
          .map((item) => ({ title: value(item, 'title'), description: value(item, 'description') || null })),
      };
    case 'discussion_questions':
    case 'reflection_questions':
      return { ...recap, [key]: items.map((item) => value(item, 'text')).filter(Boolean) };
  }
}
