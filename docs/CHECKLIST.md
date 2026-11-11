# Faithscroll build checklist

Tracks the PRD (v1.0, 10 Nov 2026) phase by phase. Each item is one or more commits.
`[x]` built, tested and committed · `[~]` built and unit-tested, still needs credentials, deployment or a real device to verify · `[ ]` not started.

Verification on 11 Nov 2026: 149 test suites / 1,390 tests passing, `tsc --noEmit` clean, `expo lint` clean.

## Phase 0 — Foundation

- [x] 0.1 Scaffold Expo SDK 58 app (Expo Router, TypeScript, React 19.3, RN 0.88)
- [x] 0.2 Project config: app identity, bundle id, line endings, test runner
- [x] 0.3 Design tokens (Paper/Forest/Sage/Sand/Gold, dark mode, WCAG-tested) + Literata font
- [x] 0.4 Base UI components (FaithText, FaithButton, IconButton, Card, EmptyState, Screen…)
- [x] 0.5 Navigation shell: Today / Bible / Sermons / Journal / Library tabs + Settings
- [x] 0.6 Bible data pipeline: World English Bible → bundled `bible.db` (FTS5 + OpenBible cross-references)
- [x] 0.7 Local user database: Drizzle schema + migrations (expo-sqlite)
- [~] 0.8 Supabase: Postgres schema, RLS, storage bucket, typed client — migrations written, not yet pushed
- [~] 0.9 Auth: Sign in with Apple + email code — needs Supabase providers configured + device test
- [x] 0.10 Privacy policy + terms drafts (require legal review before launch)

## Phase 1 — Scripture experience

- [x] 1.1 Bible repository + reference parsing/formatting/detection (written and spoken forms)
- [x] 1.2 Book / chapter selector (testament, searchable)
- [x] 1.3 Chapter reader (serif type, paragraphs, poetry, prev/next, text size, saved position)
- [x] 1.4 Verse action sheet (highlight, note, bookmark, collection, study, related, share, reflect)
- [x] 1.5 Highlights, saved verses, verse notes, collections
- [x] 1.6 Today screen (greeting, Verse of the Day, continue reading, reflection, quick actions, recent)
- [x] 1.7 Discover feed (finite topic sessions, save, study)
- [x] 1.8 Bible search (word, phrase, reference, book, topic)
- [x] 1.9 Basic study panel (context, cross-references, notes; no AI)
- [x] 1.10 Onboarding (intro, reading goal, reminder time; no permission prompts)

## Phase 2 — Sermon experience

- [x] 2.1 Sermon library + series
- [x] 2.2 Create / edit sermon (React Hook Form + Zod)
- [~] 2.3 Recording (consent, background, lock screen, 10-minute crash-safe parts) — needs iPhone test
- [~] 2.4 Recording recovery after interruption / termination — needs device test
- [x] 2.5 Timestamp bookmarks (haptics, note, Bible reference)
- [x] 2.6 Audio player (gapless parts, speed, ±15 s, seek, `?t=` deep links)
- [x] 2.7 Notes editor (headings, lists, bold/italic/highlight, timestamp + Scripture tokens, autosave)

## Phase 3 — Connected reflection

- [x] 3.1 Journal (entry types, prompts, tags, autosave)
- [x] 3.2 Entity links (journal ↔ verses ↔ sermons ↔ prayers ↔ action items)
- [x] 3.3 Prayer journal (status, updates, linked passage, reminders cleared when answered)
- [x] 3.4 Library (all sections, collections, action items)
- [x] 3.5 Universal search across personal content
- [~] 3.6 Reminders (prayer, reading, plans, actions) — notification delivery needs a device
- [x] 3.7 Reading plans (John 21, Psalms 30, Bible in a year, gratitude, hope)

## Phase 4 — AI intelligence (server-side only)

Needs `supabase db push`, deployed functions and an `OPENAI_API_KEY` secret (see docs/AI.md).

- [~] 4.1 Edge Function gateway: auth, entitlement, quota, provider abstraction
- [~] 4.2 Consent + resumable audio upload to private bucket
- [~] 4.3 Transcription job + transcript screen (timestamped, editable)
- [~] 4.4 Scripture reference extraction (validated against bible.db)
- [~] 4.5 Sermon recap (structured JSON schema, editable, regenerable)
- [~] 4.6 Deep Study + AI study assistant (cited, interpretation labelled)
- [~] 4.7 Usage limits surfaced in UI

## Phase 5 — Monetization and release

- [~] 5.1 RevenueCat integration + entitlements — needs RevenueCat keys + store products
- [x] 5.2 Paywall + Restore Purchases
- [~] 5.3 Offline outbox + Supabase sync with conflict preservation — needs deployed backend
- [x] 5.4 Data export
- [~] 5.5 Account deletion + cloud copy deletion — needs deployed `delete-account` function
- [~] 5.6 Sentry crash reporting (content scrubbed) — needs DSN
- [x] 5.7 Privacy-safe analytics event schema (validated, opt-out)
- [x] 5.8 EAS build profiles + App Store checklist (docs/RELEASE.md, docs/APP_STORE.md)

## Phase 6 — Widgets, publish, builds (added 11 Nov 2026)

- [~] 6.1 Home-screen widget: iOS Verse of the Day (small, medium, lock screen) — needs an iOS build; Android widget not yet built
- [x] 6.2 Push repository to GitHub
- [ ] 6.3 EAS Build: Android APK (preview profile) for sharing
- [ ] 6.4 EAS Build: iOS production build + EAS Submit to App Store Connect / TestFlight

## Release gates that need you (not code)

- Supabase: `npx supabase login` → link → `db push`, deploy functions, set secrets, enable Apple + email-code auth (docs/BACKEND.md)
- OpenAI API key (server secret), RevenueCat keys + App Store / Play products, Sentry DSN
- Apple Developer account (bundle id `app.faithscroll.ios`, App Group for the widget, Sign in with Apple)
- Hosted privacy policy and terms URLs; legal review of the drafts
- Real-iPhone testing of background recording, interruptions and widgets
- Bible translation licences beyond WEB
