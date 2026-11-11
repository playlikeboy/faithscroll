import { router, type Href } from 'expo-router';

/**
 * Close the current sheet/modal, then open `href` on the root stack, so the next
 * screen is a normal pushed screen rather than nested inside the sheet.
 */
export function leaveSheetTo(href: Href): void {
  if (router.canGoBack()) router.back();
  router.push(href);
}
