import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { PrayerEditorScreen } from '@/components/prayers/prayer-editor-screen';
import { parsePassageParams } from '@/features/journal/prefill';

/** `prayers/new?start=&end=` (verse ids) */
export default function NewPrayerRoute() {
  const { start, end } = useLocalSearchParams<{ start?: string; end?: string }>();
  const [prefill] = useState(() => ({ passage: parsePassageParams(start, end) }));
  return <PrayerEditorScreen prefill={prefill} />;
}
