# Faithscroll — Product Requirements Document (v1.0, 10 Nov 2026)

Category: Bible, Religion, Lifestyle, Productivity · Platform: iOS (Expo + React Native); Android APK also requested ·
Business model: freemium + optional auto-renewable subscription · Market: global.

## 1. Summary

A personal spiritual companion connecting Bible reading, Bible study, sermon notes, audio recordings, personal
journaling and prayer. Promise: **Read deeply. Listen carefully. Reflect meaningfully.** Differentiator: a connected
spiritual journal that remembers relationships between passages, sermons, prayers, notes and reflections.
Experience must stay personal, calm, private and distraction-free.

## 2. Goals / non-goals

Goals: engaging (not mindless) Scripture reading; effortless sermon recording & organisation; contextual study tools;
encourage reflection over collecting; searchable connected history; essentials free.
Non-goals: social network, church management, replacing pastors, public sermon distribution, infinite entertainment
feed, AI claiming to speak for God, generic Notion clone.

## 3. Personas

A. Daily Scripture reader — needs Verse of the Day, reading plans, smooth reader, highlights & notes, simple
explanations, daily reflection prompts. B. Sermon note-taker — recording, timestamped bookmarks, structured notes,
transcription, summaries, action points. C. Reflective Christian — journal & prayer journal linked to Scripture,
prompts, searchable history, privacy. Initial focus A + B; C connects them.

## 5. Core experience

Tabs: **Today · Bible · Sermons · Journal · Library**. Settings/account from the profile/avatar area.
Loop: discover passage → read in context → study panel → highlight/save → reflect → connect to sermon/prayer →
revisit later → choose a practical action. Natural, never forced.

## 6. Functional requirements

### 6.1 Today (P0)
A. Time-aware greeting, current date, optional daily intention. B. Verse of the Day: reference, text, translation
label; save, share, study. C. Continue reading: last book/chapter, progress, Resume. D. Daily reflection prompt
(e.g. "What has been on your heart lately?") — short reflection, optionally attach a passage. E. Quick actions:
Read the Bible, Start a sermon, New journal entry, Write a prayer. F. Recent activity: last passage, last sermon,
recent journal entry, pending prayer or action item.
Acceptance: useful offline; resume reading in one tap; save VOTD; quick actions open correct flows; no intrusive
streak warnings or engagement prompts.

### 6.2 Bible reader (P0) — central feature
A. Navigation: Old/New Testament, searchable book selector; testament → book → chapter → verse.
B. Reading: clean continuous chapter view; large comfortable serif type; readable line spacing; chapter headings;
paragraphs; verse numbers; translation shown clearly; prev/next chapter; adjustable text size; light/dark/system;
persistent reading position.
C. Tap a verse → bottom sheet: Highlight, Add note, Bookmark, Add to collection, Open study, Find related verses,
Share verse, Start a reflection.
D. Discover feed: vertical stream of verse cards (verse, reference, small contextual explanation, topic, Save,
Open study). Topics: Faith, Hope, Love, Forgiveness, Wisdom, Patience, Courage, Peace, Gratitude, Purpose.
**Finite** discovery sessions with a clear path into chapter reading; never reward endless swiping.
E. Search by word, phrase, reference, book, topic; results show reference, translation, contextual preview
(e.g. "Faith without works", "Romans 8:28", "Forgiveness", "Peace", "Love your enemies").
F. Study panel (Deep Study): overview, historical background, literary & biblical context, simple explanation, key
words, original-language info **only when reliably available**, related Scripture, theological significance,
practical application, reflection questions. Basic and Advanced modes. AI must not invent Greek/Hebrew meanings.
Every study identifies sources and distinguishes established textual information from interpretation.
G. AI study assistant: ask about the selected passage ("What does this mean?", "What happened before?",
"Explain simpler"). Must use the passage as context, preserve meaning, cite references for factual claims,
acknowledge uncertainty, present denominational differences fairly, never fabricate quotations, never claim divine
messages. All Bible versions displayed must be licensed.

### 6.3 Sermons (P0) — most memorable feature
A. Library: title, speaker, church, series, date, main passage, tags, recording, notes, transcript, AI recap,
action items (e.g. "The Power of Forgiveness", Pastor John, series "Living With Grace", Grace Community Church,
8 Nov 2026, Matthew 18:21-35).
B. Create: only title required (or automatic default title); speaker, church, series, date, passage optional and
completable later. Minimal friction.
C. Recording (P0): start, pause/resume, stop; live elapsed time; waveform or indicator; persistent recording state;
background recording; continues when locked; local persistence; recovery after interruption where possible;
playback with speed controls, skip back/forward; delete and rename recordings. Obvious red recording indicator and
an accessible Stop.
D. Timestamp bookmarks (from Sermon Notes): while recording or playing tap Bookmark → timestamp, optional note,
optional Bible reference, created date. Tapping a bookmark plays from that moment.
E. Notes editor: headings, paragraphs, bullet & numbered lists, bold, italic, highlight, Scripture references,
timestamp references, autosave locally while typing.
F. Transcription: user taps Transcribe → explanation of cloud processing + consent → confirm → upload to private
storage → job → transcript saved → Scripture references extracted → user can review/correct. Preserve timestamps,
show status, retry after network failure, clear errors, never upload silently.
G. AI recap (paid; manual notes stay free): 1 summary, 2 main points, 3 Scripture mentioned (+timestamps),
4 important moments (+timestamps), 5 discussion questions, 6 "Live It Out" action items, 7 personal reflection
questions. Editable/deletable. Derived only from the user's recording or notes; must not invent statements and
attribute them to the speaker.
H. Series: group sermons; series page shows title, description, speaker, sermon count, timeline, Bible books
discussed (combined series recap later).

### 6.4 Journal (P0)
Types: daily reflection, Bible study notes, sermon reflection, prayer, gratitude, personal thoughts. Editor: title,
rich text, date/time, tags, linked verses, linked sermon, linked prayers, optional prompt, autosave, search & filter.
Prompts: What stood out to me today? What am I learning? What am I struggling with? What am I grateful for? What do
I want to remember? What action can I take? Private by default. Entries link to multiple verses, sermons, prayers,
previous entries, action items.

### 6.5 Prayer journal (P0 basic)
Title, description, date added, category, optional linked passage, reminder date, status (Praying, Ongoing,
Answered, Archived), updates when something changes. Never treat unanswered prayers as failures; no guilt-based
notifications.

### 6.6 Library (P0)
Saved verses, highlights, Bible notes, sermons, series, journal entries, prayers, collections, action items.
Universal search across personal content (e.g. "forgiveness" → Matthew 18, saved verses, a sermon, journal entry,
prayer, action items). MVP: reliable text search + relational links (semantic search later).

### 6.7 Reading plans (P1)
e.g. John in 21 days, Psalms 30 days, Bible in one year, 7 days of gratitude, 7 days of hope. Start, pause, resume,
track completed readings, change reminders. Never make the user feel unsuccessful for missing a day.

## 7. AI
| Feature | Priority |
|---|---|
| Explain Scripture, Deep Study, Sermon transcription, Sermon recap, Scripture extraction, Reflection prompts | P0 |
| Connected search, Series recap | P1 |
| Ask my spiritual journal | P2 |

Architecture: never expose provider keys in the app; route all AI through an authenticated backend; validate
subscription entitlement + usage limits; structured JSON outputs; store model/provider id + generation status;
users can regenerate, edit, delete. Example recap schema:
`{ title, summary, main_points:[{heading, description, timestamps:[sec]}], scripture_references:[{reference,
timestamp}], discussion_questions:[], action_items:[] }` (example, not hard-coded).
Theological integrity: welcoming across Christian traditions; distinguish text from interpretation; don't present
contested doctrine as universal; cite references; no invented quotations; no prophetic/divine-authority claims;
encourage consulting trusted pastors for important doctrinal questions.

## 8. Screens
Welcome, Onboarding (reading goals, reminder preference), Today, Bible home (Read, Discover, Search), Book selector,
Chapter reader, Verse action sheet, Deep Study, AI study, Sermon library, Create sermon, Recording (timer, waveform,
bookmark, stop), Sermon editor, Audio player (play, pause, seek, bookmarks), Transcript, Sermon recap, Journal home
(timeline), Journal editor (text, links, tags), Prayer home, Prayer detail (status, updates), Library, Universal
search, Settings (account, privacy, subscription, preferences).

## 9. Flows
A First run: calm intro → understand Bible, Sermons, Journal, Prayer → choose reading goal → choose reminder time or
skip → Today → read the daily passage immediately → offer account creation for sync & AI but allow local use first.
**No microphone or notification permission prompts during onboarding** — ask only when a feature is activated.
B Reading: Bible → book/chapter → read → tap verse → Study → save → start reflection → save journal entry.
C Sermon: Sermons → New → optional metadata → recording permission & consent explanation → Start → notes while
listening → bookmark moments → stop & save → open sermon → Transcript or Generate Recap.
D Post-sermon: recap → summary → timestamps → detected Scripture → select action item → add to journal → optional
reminder → revisit from Today or Library.

## 10. Design
Feel: a beautiful personal reading journal, not social media. Peaceful, editorial, warm, premium, minimal,
thoughtful, trustworthy, personal. Generous spacing, strong typography, subtle animation. Avoid excessive gradients,
glassmorphism, neon, crowded cards, gamification.
Palette: Paper #F6F3EC, Surface #FFFFFF, Ink #242923, Forest #203B32 (brand), Sage #A4B5A2, Sand #E8DFD1,
Gold #C4A16A, Muted #77796F, Dark bg #111914, Dark surface #1C2821 (tokens in `src/theme/colors.ts`).
Type: Literata (display & Scripture), iOS system sans (UI), tabular numerals for timestamps. Sizes: title 30–34,
section 21–24, Scripture 20–23, body 16–17, secondary 13–14, caption 12. Scripture line height 1.5–1.65×.
Dynamic Type where practical.
Components: FaithButton, IconButton, ScriptureCard, VerseRow, VerseActionSheet, ReadingProgress, SermonCard,
RecordingIndicator, RecordingWaveform, AudioPlayer, TimestampBookmark, ScriptureReferenceChip, JournalEntryCard,
PrayerCard, StudySection, DailyReflectionCard, EmptyState, PaywallSheet.
Motion: smooth transitions, bottom sheets, gentle highlight feedback, small haptics for bookmarks, animated recording
waveform; no constant animation or scroll-triggered effects while reading; respect Reduce Motion.
Screens: Today warm with greeting, featured passage, one primary action, compact recent activity. Bible clean
serif reader. Discover full-width verse cards, restrained texture, not an ad feed. Sermons editorial library,
prominent New Sermon. Recording: prominent elapsed time, waveform, bookmark, note editor, persistent stop.
Journal: private notebook, dated entries, tags, connected references. Study: editorial document, collapsible
sections; **AI content visually distinct from Scripture**.

## 11. Technology (installed)
Expo SDK 58, TypeScript, RN 0.88, React 19.3, Expo Router, StyleSheet + tokens, Reanimated, Gesture Handler,
expo-audio, expo-sqlite, Drizzle, expo-secure-store, React Hook Form + Zod, TanStack Query, Zustand, expo-image,
expo-notifications, expo-haptics, expo-font, EAS Build/Update. Backend: Supabase (Postgres, Auth with Sign in with
Apple + email, Storage, Edge Functions, RLS, generated types, queue-based worker, Postgres full-text search).
AI: OpenAI Audio Transcription API, OpenAI Responses API with JSON-schema structured outputs, licensed Bible text,
configurable provider layer. Payments: RevenueCat + StoreKit. Monitoring: Sentry + privacy-focused analytics
(never prayer/notes/transcript/journal content).
Recording strategy: record with expo-audio → app document storage → metadata & bookmarks in SQLite → user chooses
AI processing → private authenticated (resumable) upload → background transcription → save transcript/recap →
user may keep or delete cloud copy. Background recording must be configured and tested on real iPhones.

## 12. Data
Relational (not one JSON blob). Core tables: profiles, user_preferences, bible_translations, bible_books,
bible_verses, reading_progress, highlights, saved_verses, collections, sermons, sermon_recordings, sermon_bookmarks,
sermon_notes, transcripts, transcript_segments, scripture_references, journal_entries, prayer_entries, action_items,
tags, entity_tags, ai_jobs, subscriptions. Stable ids, timestamps, indexes, ownership constraints.
Offline: SQLite persistence; Bible text cached locally per licence; drafts & notes save locally; recordings stay on
device by default; local outbox; sync to Supabase when online; conflict resolution with version metadata and
explicit rules — **never silently overwrite the user's latest text**.

## 13. Privacy & compliance
Private by default; no public sharing without explicit action; no ad trackers; no AI processing without user action
and disclosure; no hidden recording; clear deletion; secure auth; strict RLS.
Audio consent: before recording explain the mic captures audio and users must comply with recording laws, speaker
consent and church policies. Before cloud transcription explain the upload. Recording consent and processing
consent are separate.
Deletion: recording, transcript, journal entry, sermon; export personal data; delete account (in-app); revoke
connected services. Data protection: TLS, private buckets, RLS, server-side secrets, restricted service roles,
retention/deletion policies for audio and AI jobs. AI privacy: disclose third-party processing; never train on
private data without separate explicit consent.
Scripture licensing is a launch gate: start with a verified public-domain translation; never scrape YouVersion,
Bible Gateway or others; sermon recordings/transcripts private unless the user has rights and explicitly shares.

## 14. Monetization
Free: Bible reading, one translation, basic search, discovery, daily verse, highlights & saved verses, unlimited
journal, prayer journal, manual sermon notes, local recordings, basic sermon library, limited AI study credits,
limited transcription & recap allowance.
Plus: advanced AI study, deeper study, more transcription, full recaps, advanced sermon search, cloud backup &
sync, more translations when licensed, advanced plans, series recaps, expanded AI reflection tools.
Prices (hypotheses): $3.99/mo, $29.99/yr; India ₹199/mo, ₹1,499/yr; 7-day trial as an experiment.
Rules: never block reading saved Scripture after expiry; never delete notes on downgrade; journal & prayer always
available; explain AI/storage limits before purchase; Restore Purchases easy to find; Apple IAP for digital features.

## 15. Metrics
North Star: weekly meaningful reflection sessions per active user (read + save reflection; complete a study;
record & save sermon notes; review recap & select an action; write/update a prayer). Track onboarding completion,
first reading, first verse saved, first journal entry, first sermon recorded, transcription completion rate,
weekly meaningful sessions, D7/D30, conversion, renewal. Never capture raw prayer text, reflections, Bible notes,
audio, transcripts, or private spiritual questions.

## 16. Phases & exclusions
P0 Foundation · P1 Scripture · P2 Sermons · P3 Connected reflection · P4 AI · P5 Monetization & release.
v1.0 exclusions: social/community feed, public comments, church admin, group chat, web version, Apple Watch,
live streaming, AI worship music, many unlicensed translations, complex semantic graph, public sermon sharing.
(User later added: home-screen widgets and an Android APK.)

## 17. Quality
Responsive navigation; cached Scripture loads immediately; never block UI during AI processing; progress for long
uploads/transcription; paginate large transcript & library queries. Recording reliability: background, lock
screen, calls & audio interruptions, recover from termination/low battery, clear active state, avoid loss on crash.
Accessibility: VoiceOver labels, Dynamic Type, contrast, 44pt targets, reduced motion, screen-reader-friendly
Bible navigation, explicit recording/upload states.
Test matrix: Bible online/offline/navigation; study references & errors; recording foreground/background/locked;
audio play/pause/seek/interruption; bookmark timestamps; notes autosave & restart recovery; transcription retries &
failures; AI structured output & fabricated-reference checks; sync offline/conflicts; privacy refusal/deletion/export;
purchases buy/restore/expiry/cancel.

## 18. App Store
Name Faithscroll; subtitle "Bible, Sermons & Journal". Description opening: "One peaceful place for your Bible,
sermons, notes and prayers. Read Scripture, capture meaningful moments from sermons, and keep your personal
reflections connected." Screenshots: 1 Your faith, all in one place (Today) · 2 Read Scripture beautifully ·
3 Go deeper into every verse · 4 Never lose a meaningful sermon moment · 5 Turn sermons into lasting insights ·
6 A journal connected to Scripture · 7 Keep your prayers close. Checklist: trademark, bundle id, icon, screenshots,
privacy policy URL, terms URL, privacy declarations, mic permission text, AI disclosures, account deletion,
subscription terms, Restore Purchases, review notes/sample data, physical-device recording tests, Bible licences.

## 19. Risks
Translation copyright → licences first. Audio upload cost → local recording + quotas. Long recordings failing →
resumable uploads + background processing. Hallucinations → reference validation + user correction. Sensitive data
→ private by default. Battery → efficient formats. Oversized MVP → strict priorities. Sync conflicts → versioning.
Recording consent laws → consent flow. Low differentiation → focus on connected history.
