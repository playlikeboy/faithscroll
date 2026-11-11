import { useLocalSearchParams } from 'expo-router';

import { PassagePicker } from '@/components/bible/passage-picker';
import { parseVerseRangeParams } from '@/features/bible/reader/params';

/** Modal opened by `usePassagePicker()`. `?requestId=&title=&start=&end=`. */
export default function PassagePickerScreen() {
  const params = useLocalSearchParams<{ requestId?: string; title?: string; start?: string; end?: string }>();
  const initial = params.start ? parseVerseRangeParams({ start: params.start, end: params.end })?.range : null;
  const title = typeof params.title === 'string' && params.title.trim() ? params.title.slice(0, 60) : undefined;
  return <PassagePicker requestId={params.requestId ?? null} title={title} initial={initial} />;
}
