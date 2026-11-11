# Faithscroll Privacy Policy

> **DRAFT — REQUIRES LEGAL REVIEW before publication.** This draft describes the data flows actually
> implemented in the app (November 2026). Placeholders are marked `[…]`. Have a qualified lawyer review it
> for every market you launch in (e.g. GDPR/UK GDPR, India DPDP Act 2023, US state laws, COPPA).

**Last updated:** [date of publication]

Faithscroll ("the app") is developed and operated by **Shaswat Raj** ("we", "us").
Contact: **[privacy contact email]** · [postal address, if required in your jurisdiction].

## The short version

- **Private by default.** Your journal, prayers, notes, highlights, sermon notes and recordings are stored on
  your device. Nothing is public. Nothing is shared unless you choose to share it.
- **Data leaves your device only when you ask:** when you sign in to back up and sync, when you choose to
  transcribe a recording, or when you use an AI study or recap feature.
- **No ads, no ad trackers, no selling of data.** Your private content is never used to train AI models.
- **You are in control.** Export everything, delete everything on your device, or delete your account — all
  inside the app.

## 1. Information stored only on your device

Unless you sign in or use a cloud feature, the following stays on your device and we never receive it:
Bible reading progress and history, highlights, saved verses, Bible notes, collections, sermons and sermon notes,
bookmarks, audio recordings, journal entries, prayers and prayer updates, action items, tags, reading plans,
reminders and app settings.

Reminders are scheduled locally on your device; we do not use push notification servers.

## 2. Information we process when you use optional features

| When | What | Why | Where |
|---|---|---|---|
| You create an account (Sign in with Apple or email code) | Email address (or Apple's private relay address), account id, sign-in timestamps | To create and secure your account | Supabase (our backend provider) |
| You are signed in (backup & sync) | The personal content listed in section 1 except audio recordings, your app preferences and consent timestamps | To back up your content and keep your devices in sync | Supabase |
| You choose **Transcribe** for a recording | The audio file, uploaded to a private storage bucket | To create a transcript | Supabase storage; OpenAI (transcription) |
| You use AI study, Ask, Deep Study or a sermon recap | The Bible passage and the text needed for the request (e.g. your question, a transcript or your sermon notes) | To generate the result you asked for | Supabase Edge Functions; OpenAI |
| You use AI features | Monthly usage counts and job status (not the content) | To apply fair-use limits | Supabase |
| You subscribe to Faithscroll Plus | Purchase and subscription status, product, store, expiry; your account id | To unlock Plus and restore it on your devices | Apple App Store / Google Play (payment); RevenueCat (subscription status); Supabase |
| The app crashes or hits an error | Crash report: error type and stack trace, device model, OS and app version | To find and fix bugs | Sentry |
| You leave "Share anonymous usage statistics" on | Counts of actions such as "opened a chapter" or "created a journal entry", app version, platform, a random install id | To understand which features help people | [analytics provider, if enabled] |

**AI processing happens only after you tap the action and confirm.** Recording consent and AI processing consent
are separate. We never upload recordings silently.

### What we never collect

We do not collect your contacts, precise location, photos, advertising identifiers, or browsing history. Crash
reports and usage statistics are filtered before they leave your device so that they do not contain your journal,
prayer, note, transcript or search text; request bodies, on-screen text and console output are removed.

## 3. Sensitive information

Your journal, prayers and notes may reveal your religious or philosophical beliefs, health or other sensitive
matters. We process this content only to provide the features you choose (sync, transcription, AI study), only
after you sign in or explicitly request the feature, and we never use it for advertising, profiling or model
training. **[Legal review: confirm the lawful basis — e.g. explicit consent under GDPR Art. 9(2)(a) — and the
consent wording shown at sign-in/sync and before AI processing.]**

## 4. How we use information

To provide and secure the app and your account; to sync and back up your content; to perform transcription and AI
features you request; to manage subscriptions; to fix crashes; and (if enabled) to understand aggregate feature
usage. We do not sell or rent personal information and do not use it for targeted advertising.

## 5. Service providers (processors)

| Provider | Role | Notes |
|---|---|---|
| Supabase | Database, authentication, file storage, server functions | Data protected by row-level security; region: [project region] |
| OpenAI | Transcription and AI text generation (API) | Under OpenAI's API terms, API data is not used to train models by default; OpenAI may retain API data for a limited period (currently up to 30 days) for abuse monitoring. [Legal review: confirm current terms / zero-retention options] |
| RevenueCat | Subscription management | Receives purchase receipts and your account id; device-identifier collection is turned off |
| Apple, Google | App distribution and payments | Governed by their own privacy policies |
| Sentry | Crash reporting | No user id or default personal data is sent; [enable "Prevent storing IP addresses" in Sentry settings] |
| [Analytics provider] | Aggregate usage statistics (only if configured) | Random install id, no account id, no content |

## 6. Retention

- **On your device:** until you delete it, use "Delete all data on this device", or uninstall the app.
- **Synced content and account data:** until you delete the item or your account. Deleting your account removes
  your account and associated cloud data. [Legal review: backup retention period of the hosting provider.]
- **Audio uploaded for transcription:** deleted from our storage after 30 days (or earlier if you delete it).
- **AI job records:** finished jobs and their stored results are purged after 30 days.
- **Subscription status:** kept while your account exists.
- **Crash reports:** [Sentry retention, e.g. 90 days].
- **Usage statistics:** [retention period].

## 7. Your choices and rights

- **Export:** Settings → Your data → Export my data (a JSON file of all your personal content).
- **Delete on this device:** Settings → Your data → Delete all data on this device.
- **Delete your account:** Settings → Account → Delete account (removes your cloud data).
- **Usage statistics:** turn off at any time in Settings → Your data.
- **Subscriptions:** manage or cancel in your App Store or Google Play account.

Depending on where you live you may have rights to access, correct, delete, restrict or object to processing, to
data portability, and to withdraw consent at any time. Contact us at [privacy contact email]. You may also
complain to your local data-protection authority.

## 8. Security

Encryption in transit (TLS), private storage buckets, per-user row-level security, server-side secrets, and
restricted service roles. No method of transmission or storage is completely secure.

## 9. Children

Faithscroll is not directed to children under [13/16 — confirm per market]. If you believe a child has given us
personal information, contact us and we will delete it.

## 10. International transfers

Our providers may process data outside your country. [Legal review: transfer mechanisms such as Standard
Contractual Clauses; India DPDP cross-border rules.]

## 11. Changes

We will post changes here and update the date above. Material changes will be highlighted in the app.

## 12. Contact

Shaswat Raj — [privacy contact email].
