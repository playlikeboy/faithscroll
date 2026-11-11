import { router, useLocalSearchParams } from 'expo-router';

import { BooksBrowser } from '@/components/bible/books-browser';
import { useReadingProgress } from '@/features/bible/hooks/use-reading';
import { bibleRoutes } from '@/features/bible/reader/routes';

/** Books modal. `?replace=1` (opened from the reader) swaps the open chapter instead of stacking another. */
export default function BooksScreen() {
  const { replace } = useLocalSearchParams<{ replace?: string }>();
  const { progress } = useReadingProgress();

  const openChapter = (bookId: number, chapter: number) => {
    const href = bibleRoutes.reader(bookId, chapter);
    if (router.canGoBack()) router.back();
    if (replace === '1') router.replace(href);
    else router.push(href);
  };

  return (
    <BooksBrowser
      onSelectChapter={openChapter}
      currentBookId={progress?.bookId}
      currentChapter={progress?.chapter}
    />
  );
}
