/**
 * Everything connected to one item — attached passages, linked items and tags — in display form.
 * Also builds the same view for "pending" connections of an item that hasn't been saved yet
 * (e.g. a new journal entry prefilled from a verse or a sermon).
 */
import type { LinkableType } from '@/db/schema';
import type { AppDatabase } from '@/db/types';
import type { PassageIds } from '@/features/journal/repository';
import { listAllTags, listTagsForEntity, type Tag, type TagWithCount } from '@/features/tags/repository';

import { describeVerseRange } from './reference-text';
import { listLinks } from './repository';
import { entityKey, resolveEntities, type EntityRef } from './resolve';
import { listScriptureReferences, type ReferenceSourceType } from './scripture-references';

export interface PassageItem {
  /** Scripture reference id, or a `pending:` key before the source exists. */
  key: string;
  referenceText: string;
  startVerseId: number;
  endVerseId: number;
  isPending: boolean;
}

export interface ConnectedItem {
  /** Link id, or a `pending:` key before the source exists. */
  key: string;
  type: LinkableType;
  id: string;
  title: string;
  subtitle: string | null;
  isPending: boolean;
}

export interface Connections {
  passages: PassageItem[];
  links: ConnectedItem[];
  tags: Tag[];
  /** Every tag in the library, for quick suggestions. */
  allTags: TagWithCount[];
}

export interface PendingConnections {
  passages: readonly PassageIds[];
  links: readonly EntityRef[];
}

export const EMPTY_PENDING: PendingConnections = { passages: [], links: [] };

/** Tables whose changes can alter a connections view. */
export const CONNECTION_TABLES = [
  'scripture_references',
  'entity_links',
  'entity_tags',
  'tags',
  'sermons',
  'sermon_series',
  'journal_entries',
  'prayer_entries',
  'action_items',
  'verse_notes',
  'saved_verses',
] as const;

export type ConnectableType = LinkableType & ReferenceSourceType;

export function passageKey(passage: PassageIds): string {
  return `pending:${passage.startVerseId}-${passage.endVerseId}`;
}

export function loadConnections(db: AppDatabase, source: { type: ConnectableType; id: string }): Connections {
  return {
    passages: listScriptureReferences(db, source.type, source.id).map((ref) => ({
      key: ref.id,
      referenceText: ref.referenceText,
      startVerseId: ref.startVerseId,
      endVerseId: ref.endVerseId,
      isPending: false,
    })),
    links: listLinks(db, source).map(({ linkId, ...entity }) => ({ ...entity, key: linkId, isPending: false })),
    tags: listTagsForEntity(db, source.type, source.id),
    allTags: listAllTags(db),
  };
}

export function loadPendingConnections(db: AppDatabase, pending: PendingConnections): Connections {
  const resolved = resolveEntities(db, pending.links);
  return {
    passages: pending.passages.map((passage) => ({
      key: passageKey(passage),
      referenceText: describeVerseRange(passage.startVerseId, passage.endVerseId),
      ...passage,
      isPending: true,
    })),
    links: pending.links.flatMap((ref) => {
      const entity = resolved.get(entityKey(ref));
      return entity ? [{ ...entity, key: `pending:${entityKey(ref)}`, isPending: true }] : [];
    }),
    tags: [],
    allTags: listAllTags(db),
  };
}

/** Keep only pending links whose targets still exist. */
export function existingLinks(db: AppDatabase, links: readonly EntityRef[]): EntityRef[] {
  const resolved = resolveEntities(db, links);
  return links.filter((ref) => resolved.has(entityKey(ref)));
}

export function pendingConnectionsKey(pending: PendingConnections): string {
  return [...pending.passages.map(passageKey), ...pending.links.map(entityKey)].join('|');
}
