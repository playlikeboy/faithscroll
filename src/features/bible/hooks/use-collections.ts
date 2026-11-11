import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from '@/db/client';
import type { LinkableType } from '@/db/schema';

import {
  listAllCollectionItems,
  listCollectionIdsContaining,
  listCollections,
  type CollectionRow,
} from '../annotations/collections';

export interface CollectionWithCount extends CollectionRow {
  itemCount: number;
}

/** Live collections with their live item counts. */
export function useCollections(): { collections: readonly CollectionWithCount[]; isLoading: boolean; error: Error | undefined } {
  const collections = useLiveQuery(listCollections(db));
  const items = useLiveQuery(listAllCollectionItems(db));

  const withCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items.data) counts.set(item.collectionId, (counts.get(item.collectionId) ?? 0) + 1);
    return collections.data.map((collection) => ({ ...collection, itemCount: counts.get(collection.id) ?? 0 }));
  }, [collections.data, items.data]);

  return {
    collections: withCounts,
    isLoading: collections.updatedAt === undefined && !collections.error,
    error: collections.error ?? items.error,
  };
}

/** Live set of collection ids containing an entity (empty while `entityId` is null). */
export function useCollectionIdsContaining(entityType: LinkableType, entityId: string | null): ReadonlySet<string> {
  const { data } = useLiveQuery(listCollectionIdsContaining(db, entityType, entityId ?? ''), [entityType, entityId]);
  return useMemo(() => new Set(entityId ? data.map((row) => row.collectionId) : []), [data, entityId]);
}
