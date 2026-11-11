import { useLocalSearchParams } from 'expo-router';

import { LinkPickerScreen } from '@/components/links/link-picker-screen';

/** Modal (presentation declared in the root layout). Opened via `useLinkPicker()`. */
export default function LinkPickerRoute() {
  const params = useLocalSearchParams();
  return <LinkPickerScreen params={params} />;
}
