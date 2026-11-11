import { PRAYER_STATUS_DESCRIPTIONS, PRAYER_STATUS_LABELS, PRAYER_STATUS_ORDER, type Prayer, type PrayerStatus } from './types';

export interface PrayerSection {
  status: PrayerStatus;
  title: string;
  description: string;
  data: Prayer[];
}

function sortKey(prayer: Prayer): string {
  return prayer.status === 'answered' ? (prayer.answeredAt ?? prayer.updatedAt) : prayer.updatedAt;
}

/** Praying → Ongoing → Answered → Archived; most recent first within each; empty groups omitted. */
export function groupPrayersByStatus(prayers: readonly Prayer[]): PrayerSection[] {
  return PRAYER_STATUS_ORDER.flatMap((status) => {
    const data = prayers.filter((prayer) => prayer.status === status).sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
    return data.length > 0
      ? [{ status, title: PRAYER_STATUS_LABELS[status], description: PRAYER_STATUS_DESCRIPTIONS[status], data }]
      : [];
  });
}
