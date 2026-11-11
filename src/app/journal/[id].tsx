import { useLocalSearchParams } from 'expo-router';

import { JournalEditorScreen } from '@/components/journal/journal-editor-screen';
import type { JournalPrefill } from '@/features/journal/prefill';

const NO_PREFILL: JournalPrefill = { entryType: null, prompt: null, passage: null, links: [] };

export default function JournalEntryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entryId = Array.isArray(id) ? id[0] : id;
  return <JournalEditorScreen key={entryId} entryId={entryId ?? ''} prefill={NO_PREFILL} />;
}
