import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { JournalEditorScreen } from '@/components/journal/journal-editor-screen';
import { parseJournalPrefill } from '@/features/journal/prefill';

/** `journal/new?type=&prompt=&start=&end=&sermonId=&actionItemId=` */
export default function NewJournalEntryRoute() {
  const params = useLocalSearchParams();
  const [prefill] = useState(() => parseJournalPrefill(params));
  return <JournalEditorScreen prefill={prefill} />;
}
