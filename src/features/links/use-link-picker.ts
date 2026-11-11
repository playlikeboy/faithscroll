/**
 * Open the `links/picker` modal and await the chosen item.
 *
 *   const pickLink = useLinkPicker();
 *   const target = await pickLink({ exclude: { type: 'journal_entry', id }, title: 'Link to…' });
 *   if (target) createLink(db, { type: 'journal_entry', id }, target);
 */
import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';

import { newId } from '@/lib/ids';

import { openLinkRequest, toLinkPickerParams, type LinkPickerOptions, type LinkTarget } from './link-picker-registry';

export type { LinkPickerOptions, LinkTarget } from './link-picker-registry';

export function useLinkPicker(): (options?: LinkPickerOptions) => Promise<LinkTarget | null> {
  const router = useRouter();
  return useCallback(
    (options: LinkPickerOptions = {}) => {
      const requestId = newId();
      const result = openLinkRequest(requestId);
      router.push({ pathname: '/links/picker', params: toLinkPickerParams(requestId, options) } as Href);
      return result;
    },
    [router],
  );
}
