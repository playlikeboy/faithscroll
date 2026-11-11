import { router, Stack } from 'expo-router';

import { EmptyState, Screen } from '@/components/ui';
import { bibleRoutes } from '@/features/bible/reader/routes';

export interface PassageNotFoundProps {
  title?: string;
  message?: string;
}

/** Friendly state for invalid or malformed Bible links (deep links included). */
export function PassageNotFound({
  title = "We couldn't find that passage",
  message = 'The link may be incomplete. Choose a book and chapter to keep reading.',
}: PassageNotFoundProps) {
  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: 'Bible' }} />
      <EmptyState
        icon="bible"
        title={title}
        message={message}
        actionLabel="Browse books"
        onAction={() => router.replace(bibleRoutes.books())}
      />
    </Screen>
  );
}
