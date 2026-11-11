import type { Href } from 'expo-router';

/**
 * Links to sermon screens. Built as strings (cast to Href) so they do not depend on the
 * generated typed-routes file being up to date for nested `index` routes.
 */
export function sermonHref(sermonId: string, options: { positionMs?: number; recordingId?: string } = {}): Href {
  const query = new URLSearchParams();
  if (options.positionMs !== undefined) query.set('t', String(Math.max(0, Math.round(options.positionMs))));
  if (options.recordingId) query.set('recordingId', options.recordingId);
  const suffix = query.toString();
  return `/sermons/${encodeURIComponent(sermonId)}${suffix ? `?${suffix}` : ''}` as Href;
}

export function seriesHref(seriesId: string): Href {
  return `/sermons/series/${encodeURIComponent(seriesId)}` as Href;
}

export const SERIES_INDEX_HREF = '/sermons/series' as Href;
