This is **Faithscroll**, an Expo/React Native app (iOS first, Android also built): Bible reading, sermon recording and notes, journaling and prayer in one private, connected library. Prioritize mobile-first patterns, performance, accessibility and privacy.

## Faithscroll essentials

- Product spec: `docs/PRD.md`. Progress: `docs/CHECKLIST.md`. Conventions, file layout and route map: `docs/AGENT_GUIDE.md`.
- **Local-first data.** User data lives in expo-sqlite via Drizzle (`src/db/schema.ts`). Repository functions take the database as a parameter (`fn(db: AppDatabase, …)`). Every write to a syncable table calls `enqueueChange()` in the same transaction; edits use `touch()`, deletes are soft (`tombstone()`), and reads filter `deleted_at IS NULL`. Change the schema only with `npm run db:generate`.
- **Bible text** comes from the bundled read-only `assets/bible/bible.db` (World English Bible, public domain). Verses are integer ids: `book * 1_000_000 + chapter * 1_000 + verse`.
- **UI** uses `@/components/ui` and theme tokens from `@/theme` (no hard-coded colours). Scripture uses the Literata serif; AI-generated content always sits in `Card tone="ai"` with a visible label.
- **Privacy.** Never log or track user content (prayers, notes, journal, transcripts, search queries). No secrets in the app; AI keys live only in Supabase Edge Function secrets. Cloud features must degrade gracefully when `getSupabase()` returns null.
- **Tests.** Jest 30 + jest-expo. Repository tests use a real in-memory SQLite DB (`createTestDb()`); React Native Testing Library 14's `render`/`fireEvent` are async. Run `npm test` (uses `--forceExit`), `npm run typecheck`, `npm run lint` before finishing.
- **Git.** Conventional commits (`feat:`, `fix:`, …), one commit per completed change, authored as `playlikeboy`.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
