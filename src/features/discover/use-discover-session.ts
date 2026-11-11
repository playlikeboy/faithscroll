import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { DiscoverTopic } from '@/features/bible/types';
import { track } from '@/services/monitoring/analytics';
import { usePreferences } from '@/stores/preferences';

import { findTopic, loadSession, type SessionCard } from './session';

export interface DiscoverSession {
  topic: DiscoverTopic | null;
  cards: SessionCard[];
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
}

export function useDiscoverSession(topicId: string | undefined): DiscoverSession {
  const topic = findTopic(topicId);
  const translationId = usePreferences((s) => s.translationId);

  const query = useQuery({
    queryKey: ['discover', 'session', translationId, topic?.id ?? null],
    queryFn: () => (topic ? loadSession(topic) : Promise.resolve([])),
    enabled: topic !== null,
    staleTime: Infinity,
  });

  const startedTopicId = topic?.id;
  useEffect(() => {
    if (startedTopicId) track({ name: 'discover_session_started', topicId: startedTopicId });
  }, [startedTopicId]);

  return {
    topic,
    cards: query.data ?? [],
    isLoading: topic !== null && query.isPending,
    isError: query.isError,
    retry: () => void query.refetch(),
  };
}
