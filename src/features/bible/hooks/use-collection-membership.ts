import { useCallback, useState } from 'react';

import { db } from '@/db/client';
import type { LinkableType } from '@/db/schema';
import { getErrorMessage, logger } from '@/lib/logger';
import { track } from '@/services/monitoring/analytics';

import { addToCollection, createCollection, removeFromCollection } from '../annotations/collections';
import { saveVerseRange } from '../annotations/saved-verses';
import type { CollectionTarget } from '../reader/params';
import { useCollectionIdsContaining, useCollections } from './use-collections';
import { useRangeAnnotations } from './use-range-annotations';

/** Validation messages from the repository are written for people; anything else is unexpected and logged. */
function friendly(error: unknown, fallback: string): string {
  const message = getErrorMessage(error);
  if (/name|collection no longer/i.test(message)) return message;
  logger.error('Collection update failed', error);
  return fallback;
}

/** Collections with membership for one target, plus add/remove/create actions. */
export function useCollectionMembership(target: CollectionTarget) {
  const { collections, isLoading } = useCollections();
  const isRange = target.kind === 'range';
  const rangeAnnotations = useRangeAnnotations(isRange ? target.startVerseId : 0, isRange ? target.endVerseId : 0);
  const entityType: LinkableType = isRange ? 'saved_verse' : target.entityType;
  const entityId = isRange ? (rangeAnnotations.savedVerse?.id ?? null) : target.entityId;
  const memberIds = useCollectionIdsContaining(entityType, entityId);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /** The id to store in collection_items; saving the range first when needed. */
  const ensureEntityId = useCallback((): string => {
    if (!isRange) return target.entityId;
    const wasSaved = !!rangeAnnotations.savedVerse;
    const id = saveVerseRange(db, target.startVerseId, target.endVerseId);
    if (!wasSaved) track({ name: 'verse_saved' });
    return id;
  }, [isRange, target, rangeAnnotations.savedVerse]);

  const toggle = useCallback(
    (collectionId: string) => {
      try {
        setErrorMessage(null);
        if (entityId && memberIds.has(collectionId)) removeFromCollection(db, collectionId, entityType, entityId);
        else addToCollection(db, collectionId, entityType, ensureEntityId());
      } catch (error) {
        setErrorMessage(friendly(error, 'We couldn’t update that collection. Please try again.'));
      }
    },
    [entityId, entityType, memberIds, ensureEntityId],
  );

  /** Create a collection and add the target to it. Returns true on success. */
  const create = useCallback(
    (title: string): boolean => {
      try {
        setErrorMessage(null);
        const collectionId = createCollection(db, { title });
        addToCollection(db, collectionId, entityType, ensureEntityId());
        return true;
      } catch (error) {
        setErrorMessage(friendly(error, 'We couldn’t create that collection. Please try again.'));
        return false;
      }
    },
    [entityType, ensureEntityId],
  );

  return { collections, isLoading, memberIds, toggle, create, errorMessage };
}
