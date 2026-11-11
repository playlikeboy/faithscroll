# Faithscroll

**Read deeply. Listen carefully. Reflect meaningfully.**

Faithscroll is a calm, private spiritual companion for iPhone (Android build also supported). It brings
Bible reading, verse-level study, sermon recording and notes, journaling and prayer into one connected
personal library, so that what you read, hear and write stays linked and easy to revisit.

> **Status:** in active development (pre-release). Progress is tracked phase by phase in
> [docs/CHECKLIST.md](docs/CHECKLIST.md); the full product spec is in [docs/PRD.md](docs/PRD.md).

## Features

| Area | What it does |
|---|---|
| **Today** | Time-aware greeting, Verse of the Day, continue reading, a daily reflection prompt, quick actions and recent activity. No streaks, no guilt. |
| **Bible** | Offline reader for the World English Bible with editorial serif typography, headings, paragraphs and poetry; highlights, notes, bookmarks and collections; full-text and reference search; a finite Discover feed by topic; cross-references and a basic study panel. |
| **Sermons** | Library and series, a minimal create form, background recording that keeps going on the lock screen, one-tap timestamp bookmarks, notes with tappable `[mm:ss]` timestamps and Scripture references, and a player with speed and skip controls. |
| **Journal & prayer** | Private journal with entry types, prompts, tags and links to passages, sermons, prayers and action items; a prayer journal with statuses, updates and gentle reminders. |
| **Library** | Every saved verse, highlight, note, sermon, entry, prayer, collection and action item in one place, with universal search across all personal content. |
| **Reading plans** | John in 21 days, Psalms in 30 days, Bible in one year and short themed plans, with progress shown as "Day 5 of 21", never as missed days. |
| **AI (optional)** | Sermon transcription, structured sermon recaps, Deep Study and passage Q&A, all through an authenticated backend, only after explicit consent, with AI content kept visually separate from Scripture. |
| **Sync & account (optional)** | Sign in with Apple or email, local-first sync with conflict preservation, data export and in-app account deletion. |

## Principles

- **Private by default.** Everything lives on the device first. Nothing leaves it unless you choose sync or an AI feature.
- **No hidden recording.** Recording consent and cloud-processing consent are separate, explicit steps.
- **No content in analytics.** Prayers, notes, journal text, transcripts and search queries are never logged or tracked.
- **Calm by design.** No gamification, infinite feeds or guilt-based notifications.
- **Honest AI.** AI content cites references, separates text from interpretation and never claims to speak for God.

## Tech stack

| Layer | Technology |
|---|---|
| App | Expo SDK 58, React Native 0.88, React 19.3, TypeScript 6 (strict) |
| Navigation | Expo Router (file-based, native tabs and form sheets) |
| Local data | expo-sqlite + Drizzle ORM (user data), bundled read-only `bible.db` with SQLite FTS5 |
| State & forms | Zustand, TanStack Query, React Hook Form + Zod |
| Audio | expo-audio (background recording and playback) |
| Backend | Supabase: Postgres with Row Level Security, Auth (Apple + email), Storage, Edge Functions |
| AI | OpenAI transcription + structured outputs behind a provider-agnostic Edge Function layer |
| Payments | RevenueCat + StoreKit |
| Monitoring | Sentry (content scrubbed), privacy-safe event analytics |
| Builds | EAS Build, EAS Submit, EAS Update |
| Tests | Jest 30 + jest-expo, React Native Testing Library 14, real in-memory SQLite (better-sqlite3) |

## Getting started

### Prerequisites

- Node.js 20 or newer (developed on Node 24) and npm
- An iPhone with a [development build](https://docs.expo.dev/develop/development-builds/introduction/), or the
  iOS Simulator on a Mac. Expo Go can't run several native modules this app uses (background audio,
  RevenueCat, widgets).
- An [Expo account](https://expo.dev/signup) for cloud builds (`npx eas-cli@latest login`)

### Install and run

```bash
npm install
npx expo start
```

For a development build on a device:

```bash
npx eas-cli@latest build --profile development --platform ios
```

### Environment variables

The app runs fully offline without any configuration; cloud features switch on when their keys are present.
Copy `.env.example` to `.env` and fill in what you need. Only `EXPO_PUBLIC_*` values reach the app bundle.

| Variable | Used for |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Accounts, sync, AI features |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | Faithscroll Plus subscriptions |
| `EXPO_PUBLIC_SENTRY_DSN` | Crash reporting |
| `EXPO_PUBLIC_ANALYTICS_URL` | Optional privacy-safe analytics endpoint |
| `EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_TERMS_URL` | Hosted legal pages |

AI provider keys (for example `OPENAI_API_KEY`) are **server-side Edge Function secrets** and must never be put in
the app. See [docs/BACKEND.md](docs/BACKEND.md) and [docs/AI.md](docs/AI.md).

### Scripts

| Command | What it does |
|---|---|
| `npm start` | Start the Expo dev server |
| `npm test` | Run the Jest suite |
| `npm run test:coverage` | Tests with coverage report |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (`eslint-config-expo`) |
| `npm run db:generate` | Generate a Drizzle migration after editing `src/db/schema.ts` |
| `node scripts/bible/build-bible-db.mjs` | Rebuild the bundled Bible database from source |

## Project structure

```text
src/
├── app/            Expo Router routes: (tabs)/, bible/, sermons/, journal/, prayers/, library/,
│                   plans/, study/, settings/, auth/, onboarding/, paywall
├── components/     UI kit (ui/) and feature components (bible/, sermons/, editor/, …)
├── features/       Domain logic, repositories and hooks per feature
├── db/             Drizzle schema, migrations, client, outbox helpers, SQLite test harness
├── services/       Supabase, AI, uploads, payments, monitoring
├── stores/         Zustand stores (preferences)
├── theme/          Colour tokens (WCAG-tested), typography, spacing, fonts
└── lib/            ids, time formatting, logger
assets/bible/       Bundled read-only Bible database
scripts/bible/      Bible database build pipeline
supabase/           Postgres migrations (RLS) and Edge Functions
docs/               PRD, checklist, architecture, backend, AI, release and legal docs
```

## Architecture in brief

- **Local-first.** User data lives in on-device SQLite. Every change is recorded in an outbox in the same transaction;
  when sync is enabled, the sync engine pushes the outbox and pulls remote changes. Conflicting edits are kept side by
  side and never silently overwritten.
- **Bible text** ships with the app as a read-only database with a full-text index, so reading and search work offline.
- **AI** runs only in Supabase Edge Functions, after authentication, entitlement and quota checks. Outputs use JSON
  schemas, and Scripture references are validated against the local Bible before they are shown.
- **Recordings** stay on the device. Audio is uploaded to a private bucket only when the user asks for a transcript,
  and the cloud copy can be deleted.

## Builds and release

EAS profiles live in `eas.json`: `development` (dev client), `preview` (Android APK and internal iOS builds) and
`production` (store builds). Step-by-step instructions are in [docs/RELEASE.md](docs/RELEASE.md), and App Store
metadata and privacy answers are in [docs/APP_STORE.md](docs/APP_STORE.md).

```bash
npx eas-cli@latest build --platform android --profile preview      # shareable APK
npx eas-cli@latest build --platform ios --profile production       # App Store build
npx eas-cli@latest submit --platform ios                           # upload to App Store Connect
```

## Documentation

| Document | Contents |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Product requirements |
| [docs/CHECKLIST.md](docs/CHECKLIST.md) | Build progress by phase |
| [docs/AGENT_GUIDE.md](docs/AGENT_GUIDE.md) | Conventions, file ownership and route map |
| [docs/BACKEND.md](docs/BACKEND.md) | Supabase setup, sync and conflict design |
| [docs/AI.md](docs/AI.md) | AI architecture, prompts, schemas and limits |
| [docs/RELEASE.md](docs/RELEASE.md) | EAS builds, TestFlight and App Store submission |
| [docs/APP_STORE.md](docs/APP_STORE.md) | Store listing, screenshots and privacy labels |
| [docs/legal/](docs/legal/) | Privacy policy and terms drafts, Bible and data attributions |

## Scripture and content licensing

Faithscroll ships the **World English Bible**, which is in the public domain. Cross-reference data comes from
[OpenBible.info](https://www.openbible.info/labs/cross-references/) under CC BY. Additional translations will be
added only after commercial licences are secured; no Bible text is scraped from other services.

## License

Copyright © 2026 Shaswat Raj. All rights reserved. This is proprietary software. See [LICENSE](LICENSE).
