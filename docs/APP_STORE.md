# Faithscroll — App Store listing & review kit

Everything to paste into App Store Connect (and Google Play Console). Data-flow answers match the code as of
November 2026; re-check them whenever a feature starts sending new data off the device.

## Identity

| Field | Value |
|---|---|
| App name | **Faithscroll** (check trademark availability before launch) |
| Subtitle (≤ 30) | **Bible, Sermons & Journal** |
| Bundle id / package | `app.faithscroll.ios` / `app.faithscroll.android` |
| Primary category | Reference · Secondary: Lifestyle (Book is an alternative) |
| Age rating | 4+ (no objectionable content; user content is private, no social features) |
| Copyright | © 2026 Shaswat Raj |
| Privacy Policy URL | `EXPO_PUBLIC_PRIVACY_URL` — host `docs/legal/privacy-policy.md` (after legal review) |
| Terms of Use (EULA) | Host `docs/legal/terms.md` and set it as the custom EULA, or keep Apple's standard EULA and link it in the description |
| Support URL | [support page or mailto link] |

## Promotional text (≤ 170, editable without review)

Read Scripture, capture sermons, and keep your reflections and prayers connected — privately, on your device.

## Description

One peaceful place for your Bible, sermons, notes and prayers. Read Scripture, capture meaningful moments from
sermons, and keep your personal reflections connected.

READ DEEPLY
• The World English Bible in a calm, beautiful reader with adjustable text and dark mode
• Highlights, saved verses, Bible notes and collections
• Search by word, phrase, reference or topic
• Verse of the Day and gentle, finite discovery by topic
• Reading plans that never make you feel behind

LISTEN CAREFULLY
• Record sermons on your device — even with the screen locked
• Bookmark meaningful moments with a tap and jump back to them later
• Take structured notes while you listen
• Optional transcription and recaps: summary, Scripture mentioned, discussion questions and practical actions

REFLECT MEANINGFULLY
• A private journal with prompts, linked to passages, sermons and prayers
• A prayer journal to keep your prayers close and remember answered ones
• One connected history: find every note, sermon and prayer about "forgiveness"

GO DEEPER
• Study a passage: context, background, key words and reflection questions
• Ask questions about a passage and get answers that cite Scripture and acknowledge uncertainty
• AI content is clearly labelled and kept separate from the Bible text

PRIVATE BY DEFAULT
• Your content stays on your device unless you sign in to sync or choose an AI feature
• No ads. No ad trackers. Your private content is never used to train AI
• Export or delete your data any time

FAITHSCROLL PLUS (optional subscription)
Reading, the journal, the prayer journal, sermon notes and on-device recordings are free. Plus adds advanced
study, more transcription and full recaps, and cloud backup & sync. Limits are shown before you subscribe.
Payment is charged to your Apple ID. Subscriptions renew automatically unless cancelled at least 24 hours before
the end of the period; manage them in your App Store account settings.
Terms of Use: [terms URL] · Privacy Policy: [privacy URL]

## Keywords (≤ 100 characters, comma-separated, no spaces)

`notes,prayer,devotional,scripture,church,study,verse,reading plan,christian,faith,recorder,daily`

(96 characters. Words already in the name/subtitle — Bible, sermons, journal — are indexed from there, so they are
not repeated. Re-count after edits.)

## What's New (1.0)

Welcome to Faithscroll — your Bible, sermons, notes and prayers in one peaceful place.

## Screenshots (6.9" and 6.5" iPhone; PRD §18)

Capture on a light-theme device with realistic sample content (never real personal prayers). Caption in
Literata over the Paper (#F6F3EC) background; one idea per frame.

| # | Caption | Screen | Content to stage |
|---|---|---|---|
| 1 | Your faith, all in one place | Today | Greeting, Verse of the Day, continue reading John 3, one recent sermon |
| 2 | Read Scripture beautifully | Bible reader | Psalm 23 or John 1, a gold highlight, comfortable text size |
| 3 | Go deeper into every verse | Deep Study | Romans 8:28 study with sections and the "AI-generated" label visible |
| 4 | Never lose a meaningful sermon moment | Recording | Elapsed time, waveform, two bookmarks, notes |
| 5 | Turn sermons into lasting insights | Sermon recap | "The Power of Forgiveness" — summary, Scripture mentioned, action items |
| 6 | A journal connected to Scripture | Journal entry | Reflection linked to Matthew 18:21-35 and the sermon |
| 7 | Keep your prayers close | Prayers | A few prayers with Praying / Answered status |

Optional: one dark-mode frame of the reader. App preview video is optional (15–30 s, no audio required).

## App Privacy ("nutrition label")

Answer **"Yes, we collect data"**. Tracking: **No** (no data is used for tracking; no ATT prompt).

| Data type | Collected when | Linked to user | Used for tracking | Purposes |
|---|---|---|---|---|
| Contact Info → Email Address | User creates an account (email code or Sign in with Apple, incl. relay address) | Yes | No | App Functionality |
| User Content → Other User Content | Signed-in sync of journal, prayers, notes, sermons; text sent to AI study/recaps | Yes | No | App Functionality |
| User Content → Audio Data | User chooses Transcribe (stored up to 30 days) | Yes | No | App Functionality |
| Identifiers → User ID | Account id (also the RevenueCat app user id) | Yes | No | App Functionality |
| Purchases → Purchase History | Plus subscription status (RevenueCat, server mirror) | Yes | No | App Functionality |
| Diagnostics → Crash Data | Sentry crash reports (scrubbed, no user id) | No | No | App Functionality |
| Diagnostics → Performance Data | Sentry traces (5% sample, URLs without queries) | No | No | App Functionality |
| Usage Data → Product Interaction | **Only if `EXPO_PUBLIC_ANALYTICS_URL` is set**; random install id, user can opt out | No | No | Analytics |
| Sensitive Info | Synced journal/prayer content can reveal religious beliefs — **recommended to declare** (conservative; confirm with legal) | Yes | No | App Functionality |

Not collected: location, contacts, photos, browsing/search history (search runs on device), health, financial
info (Apple/Google handle payment), advertising data, device ID (RevenueCat device-identifier collection is off;
if you prefer to be conservative about the analytics install id, also declare Identifiers → Device ID, Not linked,
Analytics).

Google Play **Data safety** uses the same facts: data encrypted in transit; users can request deletion (in-app
account deletion); no data shared with third parties for their own purposes (processors only).

## Other declarations

- **Encryption:** `ITSAppUsesNonExemptEncryption = false` (already set via `ios.config.usesNonExemptEncryption`).
- **Microphone:** permission text is in `app.json` (expo-audio plugin); asked only when the user starts recording.
- **Background audio:** `UIBackgroundModes: audio` is used for sermon recording that continues while locked —
  mention it in review notes.
- **Sign in with Apple:** enabled; required because email sign-in is offered.
- **Account deletion:** in-app (Settings → Account → Delete account), satisfies guideline 5.1.1(v).
- **AI disclosure:** AI features are opt-in, labelled "AI-generated", and explained before any upload.
- **Scripture licence:** World English Bible — public domain; OpenBible.info cross references — CC BY (credited in
  Settings → About).

## Subscriptions (App Store Connect → Subscriptions)

| Item | Value |
|---|---|
| Subscription group | **Faithscroll Plus** (one level) |
| Monthly product id | `faithscroll_plus_monthly` — reference name "Plus Monthly" — $3.99 (India ₹199) |
| Yearly product id | `faithscroll_plus_yearly` — reference name "Plus Yearly" — $29.99 (India ₹1,499) |
| Introductory offer (experiment) | Free trial, 1 week, on the yearly product, new subscribers only |
| Display name | Faithscroll Plus |
| Description (≤ 55) | Deeper study, more transcription, recaps and sync |
| Review screenshot | The paywall (`/paywall`) showing plans, limits, Restore Purchases, Terms & Privacy links |
| Review notes | "Plus unlocks advanced AI study, higher transcription/recap limits and cloud sync. Free features remain free." |

Google Play: one subscription `faithscroll_plus` with base plans `monthly` and `yearly` (+ optional free-trial
offer on `yearly`).

RevenueCat: entitlement **`plus`** (exact id used by the app and the webhook); attach both products on both stores;
offering **`default`** marked *Current*, with packages **Monthly** (`$rc_monthly`) and **Annual** (`$rc_annual`).
The paywall shows a trial only when the store reports one the user is eligible for.

## App Review notes (paste into "Notes")

```
Faithscroll works without an account. Most features are local to the device.

Demo path (no sign-in needed):
1. Complete the short onboarding (reading goal, reminder optional — no permission prompts).
2. Today → "Read the Bible" → John 3. Tap verse 16 → Highlight / Add note / Open study.
3. Sermons → New sermon → Start recording (microphone permission is requested here, with an explanation).
   Recording continues while the screen is locked (UIBackgroundModes: audio). Tap Bookmark, then Stop.
4. Journal → New entry; Prayers → New prayer.
5. Settings → Your data: export data, privacy explanation, delete all local data.
6. Settings → About: licences and attributions.

AI and Plus (requires an account):
- Sign in with Apple (any Apple ID) from Settings → Account.
- Open a sermon with a recording → Transcribe (shows an upload/consent explanation first),
  or open a passage → Deep Study / Ask.
- Settings → Subscription → See Faithscroll Plus shows the paywall; purchases use the sandbox.
- Restore Purchases is on the paywall and in Settings → Subscription.
- Account deletion: Settings → Account → Delete account.

AI output is labelled "AI-generated" and kept visually separate from Scripture. Bible text: World English Bible
(public domain).
```

If App Review asks for credentials, create a dedicated review account and provide a Sign in with Apple-free path
(e.g. an email inbox you control) — email sign-in uses one-time codes.

## Pre-submission checklist (PRD §18)

- [ ] Trademark search for "Faithscroll"; bundle id registered; Sign in with Apple capability on the App ID
- [ ] Icon (1024×1024, no alpha) and screenshots for 6.9"/6.5"
- [ ] Privacy policy and terms hosted (after legal review); URLs set in App Store Connect and as
      `EXPO_PUBLIC_PRIVACY_URL` / `EXPO_PUBLIC_TERMS_URL`
- [ ] App Privacy answers entered as above
- [ ] Subscriptions created, priced, with review screenshot; "Paid Applications" agreement, tax and banking done
- [ ] RevenueCat products/entitlement/offering configured; webhook delivering to Supabase (test event returns 200)
- [ ] Microphone text reviewed; background recording tested on a physical iPhone (lock screen, calls, interruptions)
- [ ] AI disclosures and consent screens verified; account deletion tested end to end
- [ ] Restore Purchases tested (fresh install, second device); expiry/cancel tested in sandbox
- [ ] Review notes and demo path verified on the exact build submitted
