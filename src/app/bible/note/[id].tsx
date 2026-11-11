import { useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

import { PassageNotFound } from '@/components/bible/passage-not-found';
import { VerseNoteScreen } from '@/components/bible/verse-note-screen';

const noteIdSchema = z.string().trim().min(1).max(64);

export default function VerseNoteRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const parsed = noteIdSchema.safeParse(Array.isArray(id) ? id[0] : id);
  if (!parsed.success) {
    return <PassageNotFound title="We couldn't find that note" message="The link may be incomplete." />;
  }
  return <VerseNoteScreen noteId={parsed.data} />;
}
