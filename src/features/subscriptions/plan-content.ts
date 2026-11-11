/**
 * What stays free, what Plus adds, and the AI/storage limits — shown BEFORE purchase (PRD §14).
 * Keep the numbers in sync with the server quotas (`DEFAULT_LIMITS` in
 * supabase/functions/_shared/quota.ts; overridable with the AI_LIMITS_JSON secret) and the cloud
 * audio retention (`ai_expired_audio`, 30 days).
 */
import type { SubscriptionSnapshot } from '@/services/payments/entitlement';
import type { PlanOption } from '@/services/payments/offerings';

export interface FeatureLine {
  title: string;
  detail?: string;
}

export const FREE_FOREVER: readonly FeatureLine[] = [
  { title: 'Read the Bible', detail: 'The full World English Bible, search, daily verse and discovery' },
  { title: 'Highlights, saved verses and notes', detail: 'Collections and Bible notes, as many as you like' },
  { title: 'Journal and prayer journal', detail: 'Unlimited entries, linked to Scripture and sermons' },
  { title: 'Sermon notes and recordings', detail: 'Record on your device, bookmark moments, take notes' },
  { title: 'Reading plans and gentle reminders' },
];

export const PLUS_ADDS: readonly FeatureLine[] = [
  { title: 'Deeper AI study', detail: 'Advanced Deep Study and many more questions about a passage' },
  { title: 'More sermon transcription', detail: 'Turn more recordings into searchable, timestamped transcripts' },
  { title: 'Full sermon recaps', detail: 'Summaries, Scripture mentioned, discussion questions and actions' },
  { title: 'Cloud backup and sync', detail: 'Your notes, journal and prayers on all your devices' },
];

export interface LimitRow {
  feature: string;
  free: string;
  plus: string;
}

/** Monthly allowances. Must match `DEFAULT_LIMITS` in supabase/functions/_shared/quota.ts. */
export const MONTHLY_LIMITS: readonly LimitRow[] = [
  { feature: 'Sermon transcription', free: '60 minutes', plus: '20 hours' },
  { feature: 'Sermon recaps', free: '2', plus: '40' },
  { feature: 'Deep Study', free: '10', plus: '300' },
  { feature: 'Questions to the study assistant', free: '30', plus: '600' },
];

export const LIMIT_NOTES: readonly string[] = [
  'Advanced Deep Study is included with Plus. Basic Deep Study is available to everyone.',
  'Allowances reset on the first day of each month (UTC). Unused allowance doesn’t roll over.',
  'Audio you choose to transcribe is uploaded privately and deleted from our servers after 30 days. Your recording stays on your device.',
  'AI features need an internet connection and an account. Nothing is sent to AI unless you ask.',
];

export const DOWNGRADE_PROMISE =
  'If Plus ends, nothing is deleted. Your journal, prayers, notes, highlights and saved verses stay yours, and reading Scripture is always free.';

export function ctaLabel(option: PlanOption): string {
  if (option.trialLabel) return `Start ${option.trialLabel}`;
  return `Subscribe for ${option.priceString} ${option.periodLabel}`;
}

const STORE_NAMES: Record<string, string> = {
  APP_STORE: 'App Store',
  MAC_APP_STORE: 'App Store',
  PLAY_STORE: 'Google Play',
  PROMOTIONAL: 'a promotional grant',
};

export function storeName(store: string | null): string {
  return (store && STORE_NAMES[store]) || 'your app store';
}

/** Auto-renewal disclosure required next to the purchase button. */
export function billingDisclosure(option: PlanOption, platformStore: 'App Store' | 'Google Play'): string {
  const price = `${option.priceString} ${option.periodLabel}`;
  const start = option.trialLabel ? `${capitalize(option.trialLabel)}, then ${price}.` : `${price}.`;
  return (
    `${start} Payment is charged to your ${platformStore} account. The subscription renews automatically ` +
    `unless you cancel at least 24 hours before the end of the current period. Manage or cancel anytime in your ` +
    `${platformStore} account settings.`
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export interface SubscriptionSummary {
  planLabel: string;
  detail: string;
  warning: string | null;
}

/** Human description of the current subscription for the settings screen and paywall. */
export function describeSubscription(snapshot: SubscriptionSnapshot): SubscriptionSummary {
  const warning = snapshot.hasBillingIssue
    ? `There’s a problem with your payment method. Update it in ${storeName(snapshot.store)} to keep Plus.`
    : null;

  if (!snapshot.isPlus) {
    const detail = snapshot.expiresAt
      ? `Plus ended on ${formatDate(snapshot.expiresAt)}. Everything you created is still here.`
      : 'You’re using Faithscroll’s free features.';
    return { planLabel: 'Free', detail, warning };
  }

  const planLabel = snapshot.isTrial ? 'Faithscroll Plus · free trial' : 'Faithscroll Plus';
  if (!snapshot.expiresAt) return { planLabel, detail: 'Active.', warning };
  const date = formatDate(snapshot.expiresAt);
  const detail = snapshot.willRenew
    ? `Renews on ${date} through ${storeName(snapshot.store)}.`
    : `Ends on ${date}. You keep Plus until then, and nothing is deleted afterwards.`;
  return { planLabel, detail, warning };
}

const SOURCE_PATTERN = /^[a-z0-9_-]{1,40}$/;

/** Paywall `?source=` is analytics-only: accept short identifiers, never free text. */
export function normalizePaywallSource(raw: unknown): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return 'unknown';
  const lower = value.toLowerCase();
  return SOURCE_PATTERN.test(lower) ? lower : 'unknown';
}
