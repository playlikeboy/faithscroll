import { useLocalSearchParams } from 'expo-router';

import { PrayerEditorScreen } from '@/components/prayers/prayer-editor-screen';
import type { PrayerPrefill } from '@/features/prayers/use-prayer-editor';

const NO_PREFILL: PrayerPrefill = { passage: null };

export default function PrayerRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const prayerId = Array.isArray(id) ? id[0] : id;
  return <PrayerEditorScreen key={prayerId} prayerId={prayerId ?? ''} prefill={NO_PREFILL} />;
}
