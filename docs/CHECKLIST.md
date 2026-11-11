# Faithscroll build checklist

Tracks the PRD (v1.0, 10 Nov 2026) phase by phase. Each item is one commit.
`[x]` done and committed, `[~]` code written but needs a real device / credentials to verify, `[ ]` not started.

## Phase 0 — Foundation

- [x] 0.1 Scaffold Expo SDK 58 app (Expo Router, TypeScript, React 19.3, RN 0.88)
- [x] 0.2 Project config: app identity, bundle id, line endings, test runner
- [x] 0.3 Design tokens (Paper/Forest/Sage/Sand/Gold, dark mode) + Literata font
- [x] 0.4 Base UI components (FaithText, FaithButton, IconButton, Card, EmptyState, Screen)
- [x] 0.5 Navigation shell: Today / Bible / Sermons / Journal / Library tabs + Settings
- [ ] 0.6 Bible data pipeline: World English Bible (public domain) → bundled `bible.db` with FTS5
- [x] 0.7 Local user database: Drizzle schema + migrations (expo-sqlite)
- [ ] 0.8 Supabase: Postgres schema, RLS policies, storage bucket, typed client
- [ ] 0.9 Auth: Sign in with Apple + email (optional; app works signed-out)
- [ ] 0.10 Privacy policy + terms drafts

## Phase 1 — Scripture experience

- [ ] 1.1 Bible repository (books, chapters, verses, reference parsing)
- [ ] 1.2 Book / chapter selector (testament, searchable)
- [ ] 1.3 Chapter reader (serif type, paragraphs, headings, prev/next, text size, persisted position)
- [ ] 1.4 Verse action sheet (highlight, note, bookmark, collection, study, related, share, reflect)
- [ ] 1.5 Highlights, saved verses, verse notes, collections
- [ ] 1.6 Today screen (greeting, Verse of the Day, continue reading, reflection, quick actions, recent)
- [ ] 1.7 Discover feed (finite topic sessions, save, study)
- [ ] 1.8 Bible search (word, phrase, reference, book, topic)
- [ ] 1.9 Basic study panel (cross-references, context; no AI)
- [ ] 1.10 Onboarding (intro, reading goal, reminder time; no permission prompts)

## Phase 2 — Sermon experience

- [ ] 2.1 Sermon library + series (speaker, church, series, passage, tags)
- [ ] 2.2 Create / edit sermon (minimal form, React Hook Form + Zod)
- [ ] 2.3 Recording (expo-audio, pause/resume, background, lock screen, consent)
- [ ] 2.4 Recording recovery after interruption / crash
- [ ] 2.5 Timestamp bookmarks (haptics, note, Bible reference)
- [ ] 2.6 Audio player (speed, skip, seek to bookmark)
- [ ] 2.7 Sermon notes editor (headings, lists, bold/italic, scripture + timestamp refs, autosave)

## Phase 3 — Connected reflection

- [ ] 3.1 Journal (entry types, prompts, tags, autosave)
- [ ] 3.2 Entity links (journal ↔ verses ↔ sermons ↔ prayers ↔ action items)
- [ ] 3.3 Prayer journal (status, updates, linked passage)
- [ ] 3.4 Library (all sections, collections, action items)
- [ ] 3.5 Universal search across personal content
- [ ] 3.6 Reminders (prayer + reading) via expo-notifications
- [ ] 3.7 Reading plans (P1)

## Phase 4 — AI intelligence (server-side only)

- [ ] 4.1 Edge Function gateway: auth, entitlement, quota, provider abstraction
- [ ] 4.2 Consent + resumable audio upload to private bucket
- [ ] 4.3 Transcription job + transcript screen (timestamped, editable)
- [ ] 4.4 Scripture reference extraction (validated against bible.db)
- [ ] 4.5 Sermon recap (structured JSON schema, editable, regenerable)
- [ ] 4.6 Deep Study + AI study assistant (cited, uncertainty-aware)
- [ ] 4.7 Usage limits surfaced in UI

## Phase 5 — Monetization and release

- [ ] 5.1 RevenueCat integration + entitlements
- [ ] 5.2 Paywall + Restore Purchases
- [ ] 5.3 Offline outbox + Supabase sync with conflict handling
- [ ] 5.4 Data export
- [ ] 5.5 Account deletion + per-item deletion of cloud copies
- [ ] 5.6 Sentry crash reporting (no personal content in events)
- [ ] 5.7 Privacy-safe analytics event schema
- [ ] 5.8 EAS build profiles + App Store checklist

## Phase 6 — Widgets, publish, builds (added 11 Nov 2026)

- [ ] 6.1 Home-screen widgets: Verse of the Day + continue reading (iOS, Android)
- [ ] 6.2 Push repository to a git remote
- [ ] 6.3 EAS Build: Android APK (preview profile) for sharing
- [ ] 6.4 EAS Build: iOS production build + EAS Submit to App Store Connect / TestFlight

## Release gates that need you (not code)

- Bible translation licences beyond WEB
- Supabase project URL / anon key, OpenAI key (server secret), RevenueCat keys, Sentry DSN
- Apple Developer account, bundle id, Sign in with Apple capability
- Real-iPhone testing of background recording and interruptions
- Expo account (`eas login`) for EAS builds; GitHub (or other) remote for `git push`
