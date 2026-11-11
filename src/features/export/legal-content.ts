/**
 * Plain-language privacy explanation and attributions shown in Settings → Your data / About.
 * The full documents live in docs/legal (hosted at EXPO_PUBLIC_PRIVACY_URL / EXPO_PUBLIC_TERMS_URL).
 */

export interface InfoBlock {
  title: string;
  body: string;
}

export const PRIVACY_PROMISES: readonly InfoBlock[] = [
  {
    title: 'Private by default',
    body: 'Your journal, prayers, notes, highlights and recordings are stored on this device. Nothing is public, and nothing is shared unless you choose to share it.',
  },
  {
    title: 'What leaves your device, and when',
    body: 'Only when you ask: audio you choose to transcribe and text you send to AI study or recaps go to our servers and our AI provider to produce a result; if you sign in, your notes, journal and prayers sync to your account so they are backed up and on all your devices.',
  },
  {
    title: 'Never used for ads or training',
    body: 'Faithscroll has no ad trackers. Your private content is never sold and never used to train AI models.',
  },
  {
    title: 'Crash reports and usage statistics',
    body: 'If the app crashes, a report without your content helps us fix it. Usage statistics only count actions like “opened a chapter” — never what you wrote, prayed, recorded or searched. You can turn statistics off below.',
  },
];

export interface Attribution {
  title: string;
  body: string;
  url?: string;
}

export const ATTRIBUTIONS: readonly Attribution[] = [
  {
    title: 'World English Bible (WEB)',
    body: 'Scripture quotations are from the World English Bible (WEB), which is in the public domain. “World English Bible” is a trademark of eBible.org.',
    url: 'https://ebible.org/web/',
  },
  {
    title: 'Cross references from OpenBible.info',
    body: 'Related verses use cross references from OpenBible.info, licensed under CC BY 4.0 (creativecommons.org/licenses/by/4.0). Filtered to the most-voted references per verse.',
    url: 'https://www.openbible.info/labs/cross-references/',
  },
  {
    title: 'Open-source software',
    body: 'Faithscroll is built with open-source software including React Native, Expo, Drizzle ORM, Zustand, TanStack Query, Zod, Supabase and Sentry, used under their licences (mostly MIT, Apache-2.0 and BSD).',
  },
];

export const PRIVACY_POLICY_SUMMARY =
  'Faithscroll collects as little as possible. Your content stays on your device unless you sign in to sync or choose an AI feature. ' +
  'You can export everything or delete it at any time in Settings → Your data, and delete your account in Settings → Account.';

export const TERMS_SUMMARY =
  'Faithscroll is offered for personal, non-commercial use. AI study and recaps can be wrong; they are aids, not authorities — check Scripture and talk with trusted pastors about important questions. ' +
  'Only record sermons where you are allowed to. Subscriptions renew automatically until cancelled in your App Store or Google Play account.';
