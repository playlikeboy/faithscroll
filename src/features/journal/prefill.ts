/**
 * Journal editor prefill (route params → validated values) and draft helpers.
 * `journal/new?type=&prompt=&start=&end=&sermonId=&actionItemId=`
 */
import { getBook } from '@/features/bible/books';
import { fromVerseId } from '@/features/bible/verse-id';
import type { EntityRef } from '@/features/links/resolve';

import type { JournalEntryChanges, PassageIds } from './repository';
import { isJournalEntryType, JOURNAL_PROMPTS, type JournalEntryType } from './types';

export interface JournalPrefill {
  entryType: JournalEntryType | null;
  prompt: string | null;
  passage: PassageIds | null;
  links: EntityRef[];
}

export interface JournalDraft {
  title: string;
  content: string;
  entryType: JournalEntryType;
  /** YYYY-MM-DD */
  entryDate: string;
  prompt: string | null;
}

type RawParams = Record<string, string | string[] | undefined>;

const MAX_PROMPT_LENGTH = 200;
const ID_PATTERN = /^[\w-]{1,64}$/;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseVerseId(raw: string | undefined): number | null {
  if (!raw || !/^\d{1,9}$/.test(raw)) return null;
  const id = Number(raw);
  const { bookId, chapter, verse } = fromVerseId(id);
  const book = getBook(bookId);
  if (!book || chapter < 1 || chapter > book.chapters || verse < 1) return null;
  return id;
}

/** `start`/`end` verse-id params → an ordered range; end defaults to start. */
export function parsePassageParams(start: string | undefined, end: string | undefined): PassageIds | null {
  const startId = parseVerseId(start);
  if (startId === null) return null;
  const endId = parseVerseId(end) ?? startId;
  return { startVerseId: Math.min(startId, endId), endVerseId: Math.max(startId, endId) };
}

function parseId(raw: string | undefined): string | null {
  return raw && ID_PATTERN.test(raw) ? raw : null;
}

function inferType(passage: PassageIds | null, sermonId: string | null): JournalEntryType | null {
  if (sermonId) return 'sermon_reflection';
  if (passage) return 'bible_study';
  return null;
}

export function parseJournalPrefill(params: RawParams): JournalPrefill {
  const type = single(params.type);
  const prompt = (single(params.prompt) ?? '').trim().slice(0, MAX_PROMPT_LENGTH);
  const passage = parsePassageParams(single(params.start), single(params.end));
  const sermonId = parseId(single(params.sermonId));
  const actionItemId = parseId(single(params.actionItemId));

  const links: EntityRef[] = [
    ...(sermonId ? [{ type: 'sermon' as const, id: sermonId }] : []),
    ...(actionItemId ? [{ type: 'action_item' as const, id: actionItemId }] : []),
  ];

  return {
    entryType: isJournalEntryType(type) ? type : inferType(passage, sermonId),
    prompt: prompt || null,
    passage,
    links,
  };
}

/** Insert a reflection prompt as a heading at the end of the body. */
export function appendPrompt(content: string, prompt: string): string {
  const body = content.trimEnd();
  return `${body}${body ? '\n\n' : ''}## ${prompt}\n`;
}

function isPromptHeading(line: string, extraPrompt: string | null): boolean {
  const match = /^#{1,3}\s+(.*)$/.exec(line.trim());
  if (!match) return false;
  const text = (match[1] ?? '').trim();
  return JOURNAL_PROMPTS.includes(text) || (extraPrompt !== null && text === extraPrompt.trim());
}

/** True once the user has written something of their own (title, or body beyond inserted prompts). */
export function hasMeaningfulContent(draft: Pick<JournalDraft, 'title' | 'content' | 'prompt'>): boolean {
  if (draft.title.trim()) return true;
  return draft.content
    .split('\n')
    .some((line) => line.trim().length > 0 && !isPromptHeading(line, draft.prompt));
}

export function toDraftChanges(draft: JournalDraft): Required<JournalEntryChanges> {
  return {
    title: draft.title,
    content: draft.content,
    entryType: draft.entryType,
    entryDate: draft.entryDate,
    prompt: draft.prompt?.trim() || null,
  };
}
