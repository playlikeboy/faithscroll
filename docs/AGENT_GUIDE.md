# Faithscroll — guide for parallel build agents

Ten agents work **at the same time in the same working tree and the same `node_modules`**.
These rules exist so nobody overwrites, breaks or commits someone else's work. Read all of it.

## Environment (Windows, Git Bash)

Node and git are installed but NOT on the shell PATH. Prefix every Bash command with:

```bash
export PATH="/c/Users/BIT/AppData/Local/Microsoft/WinGet/Packages/OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe/node-v24.20.0-win-x64:/c/Program Files/Git/cmd:$PATH"; cd /c/Users/BIT/Desktop/projects/faithscroll
```

Stack: Expo SDK 58, React Native 0.88, React 19.3, TypeScript 6 (strict), Expo Router 58 (`src/app`),
expo-sqlite + Drizzle ORM 0.45, Zustand 5, TanStack Query 5, React Hook Form + Zod 4, Supabase JS 2,
Jest 30 + jest-expo + @testing-library/react-native **v14 (render/fireEvent are async — `await` them)**.

Expo APIs change every SDK. Before using an Expo API, check the v58 docs
(`https://docs.expo.dev/versions/v58.0.0/sdk/<module>/`) or the installed `.d.ts` in `node_modules`.

## Hard rules

1. **Only touch files you own** (see ownership table). Read anything; write only your paths.
2. **Never install, remove or upgrade packages.** Every dependency the PRD needs is already installed
   (see `package.json`). If you truly need another one, stop that sub-task and report it in your final message.
3. **Never edit shared foundation files:** `package.json`, `package-lock.json`, `app.json`, `tsconfig.json`,
   `babel.config.js`, `metro.config.js`, `jest.setup.ts`, `src/app/_layout.tsx`, `src/app/(tabs)/_layout.tsx`,
   `src/db/**` (schema/migrations/client), `src/theme/**`, `src/components/ui/**`, `src/stores/preferences.ts`,
   `src/lib/**`, `docs/CHECKLIST.md`, `docs/AGENT_GUIDE.md`. Need a change there? Report it at the end.
   (Exception: you may *add* new files under `src/lib/` only if your ownership table row says so — none do.)
4. **Contract stubs** (files whose header says `CONTRACT STUB — owned by <you>`): replace the
   implementation, but keep every exported name and signature compatible — other agents code against them.
   You may add exports. If you don't own a stub, import it and trust its signature even if it is still a no-op.
5. **No `console.log`.** Use `logger` from `@/lib/logger`. Never log or send user content
   (prayers, journal text, notes, transcripts, search queries) to analytics or logs.
6. **No secrets in the app.** Only `EXPO_PUBLIC_*` public values. AI keys live in Supabase Edge Function secrets.
7. Files ≤ 400 lines typical, 800 max. Functions small. Immutable updates. Explicit error handling with
   user-friendly messages (`ErrorState`, inline text) — never swallow errors silently.
8. Accessibility: every control has `accessibilityRole` + label; icon-only buttons need `accessibilityLabel`;
   44pt targets; Dynamic Type (don't fix heights that clip text); don't convey meaning by colour alone.
9. Calm product tone (PRD §10): no streak guilt, no gamification, no engagement nagging.

## Git protocol (shared working tree — follow exactly)

Commit after **every** completed sub-task (the user asked for this). Only ever commit your own paths:

```bash
git add -- <your paths…>
git commit -m "feat(<area>): <what>" -- <your paths…>
```

- NEVER use `git add -A`, `git add .`, `git commit -a`, `git stash`, `git reset`, `git checkout -- …`,
  `git rebase`, `git push`, or anything that rewrites history or touches other agents' files.
- If git reports `index.lock` exists, another agent is committing — simply run the same command again.
- Conventional commit types: feat, fix, test, refactor, docs, chore.

## Verification (scope to your files — others are mid-edit)

```bash
npx tsc --noEmit 2>&1 | grep -E "<your path prefixes>"     # must print nothing for your files
npx eslint <your paths>                                     # 0 errors
npx jest <your test paths> --forceExit                      # green
```

Ignore type errors in files you don't own (another agent is working). Jest needs `--forceExit`.

## Architecture & conventions

- **Routes are thin.** `src/app/**` files wire params → hooks → components that live in
  `src/features/<area>/` (logic, repositories, hooks) and `src/components/<area>/` (presentational UI).
- **UI kit:** `@/components/ui` — `Screen`, `FaithText` (variants: display, title, heading, body, bodySerif,
  secondary, caption, label, scripture), `FaithButton`, `IconButton`, `Icon` (curated SF/Material map in
  `icon.tsx`; for an icon that's missing, use `SymbolView` from `expo-symbols` directly with `{ ios, android }`),
  `Card` (tone `ai` marks AI content), `Chip`, `ListRow`, `TextField`, `Section`, `Divider`,
  `EmptyState`, `LoadingState`, `ErrorState`. Theme via `useTheme()` / `useThemedStyles(factory)` from `@/theme`.
  Never hard-code colours — use theme tokens (highlight colours: `colors.highlight.gold|sage|sky|rose`).
- **Scripture vs AI:** Scripture uses `FaithText variant="scripture"` (Literata serif). AI-generated
  content always sits in `Card tone="ai"` with a visible "AI-generated" label (Icon `sparkles`).
- **Local database:** `src/db/schema.ts` is the shared contract (28 tables). Repository functions take the DB
  as a parameter: `export function listX(db: AppDatabase, …)` (`AppDatabase` from `@/db/types`), and hooks pass
  `db` from `@/db/client`. For reactive reads use `useLiveQuery` from `drizzle-orm/expo-sqlite`.
  IDs: `newId()` from `@/lib/ids`. Times: `nowIso()`, `toLocalDateString()`, `formatDuration()` from `@/lib/time`.
  - Every insert/update/delete of a syncable row must, **in the same `db.transaction`**, call
    `enqueueChange(db, '<entity_type>', id, 'upsert' | 'delete')` from `@/db/mutations`.
  - Edits: `.set({ ...changes, ...touch(table.version) })`. Deletes of user content are soft:
    `.set(tombstone(table.version))`; always filter `isNull(table.deletedAt)` when reading.
  - Bible verses are integers (`toVerseId` / `idsToRange` in `@/features/bible/verse-id`); ranges are inclusive.
- **Tests:** repository tests use a real in-memory SQLite DB with migrations applied:
  `const db = createTestDb()` from `@/db/testing/create-test-db`. Never import `@/db/client` in tests
  (it opens the native DB) — mock it with `jest.mock('@/db/client', () => ({ db: {} }))` if a module imports it.
  Component tests: `await render(...)`, `await fireEvent.press(...)`, query by role/label. Aim for ≥ 80 % coverage
  of your logic. Write the test first where practical (RED → GREEN).
- **Preferences:** `usePreferences` (`@/stores/preferences`) holds theme, scripture size, translation, reading goal,
  daily reminder time, onboarding flag, daily intention, recording/AI consent timestamps. Feature-local UI state
  goes in your own small Zustand store inside your feature folder.
- **Analytics:** `track({ name: … })` from `@/services/monitoring/analytics` (typed events, no content).
- **Entitlements:** `useEntitlements()` from `@/features/subscriptions/use-entitlements` (`isPlus`).
- **Supabase:** `getSupabase()` returns `null` when not configured — every cloud feature must degrade gracefully
  ("Sign in to use …" / "Cloud features aren't set up") and the app must stay fully usable offline.
- **Notifications:** use `@/features/reminders/notifications` (never call expo-notifications directly elsewhere).
- **Sheets/modals:** presentation is declared in `src/app/_layout.tsx` for these route names only:
  `bible/verse-actions` (form sheet), `bible/books`, `bible/passage-picker`, `links/picker`, `paywall` (modals),
  `sermons/record/[id]` (full-screen, swipe-dismiss disabled). Every other route is a normal pushed screen with the
  native header (set its title with `<Stack.Screen options={{ title }} />` inside the screen).

## Route map (create only routes you own; link freely to the others)

| Route (file under `src/app/`) | Owner |
|---|---|
| `(tabs)/index.tsx` Today, `onboarding/**`, `discover/index.tsx`, `discover/[topicId].tsx`, `settings/index.tsx`, `settings/appearance.tsx` | today |
| `(tabs)/bible.tsx`, `bible/read/[bookId]/[chapter].tsx` (`?verse=` scrolls to a verse), `bible/books.tsx`, `bible/search.tsx`, `bible/verse-actions.tsx` (`?start=&end=` verse ids), `bible/passage-picker.tsx`, `bible/study/[verseId].tsx` (`?end=`), `bible/note/[id].tsx`, `bible/collections-picker.tsx` | bible-ui |
| `(tabs)/sermons.tsx`, `sermons/new.tsx`, `sermons/[id]/index.tsx`, `sermons/[id]/edit.tsx`, `sermons/record/[id].tsx`, `sermons/series/index.tsx`, `sermons/series/[id].tsx` | sermons |
| `sermons/[id]/transcript.tsx`, `sermons/[id]/recap.tsx`, `study/ask.tsx` (`?start=&end=`), `study/deep.tsx` (`?start=&end=`) | ai |
| `(tabs)/journal.tsx`, `journal/new.tsx` (`?type=&prompt=&start=&end=&sermonId=&actionItemId=`), `journal/[id].tsx`, `prayers/index.tsx`, `prayers/new.tsx` (`?start=&end=`), `prayers/[id].tsx`, `links/picker.tsx` | journal |
| `(tabs)/library.tsx`, `library/highlights.tsx`, `library/saved.tsx`, `library/notes.tsx`, `library/collections/index.tsx`, `library/collections/[id].tsx`, `library/actions.tsx`, `search.tsx` (universal), `plans/index.tsx`, `plans/[planId].tsx`, `settings/reminders.tsx` | library |
| `auth/sign-in.tsx`, `settings/account.tsx` | backend-auth |
| `paywall.tsx` (`?source=`), `settings/subscription.tsx`, `settings/data.tsx` (export / delete local data), `settings/about.tsx` (licences, attribution, privacy policy, terms) | monetization |

## Ownership (write access)

| Agent | Paths |
|---|---|
| bible-data | `scripts/bible/**`, `assets/bible/**`, `src/features/bible/{repository,reference,curated}.ts`, `src/features/bible/data/**`, `src/features/bible/db/**`, `src/features/bible/__tests__/{reference,repository,curated,data}*.test.ts`, `docs/legal/bible-sources.md` |
| bible-ui | the bible-ui routes above, `src/components/bible/**`, `src/features/bible/use-passage-picker.ts`, `src/features/bible/reader/**`, `src/features/bible/annotations/**`, `src/features/bible/hooks/**`, `src/features/study/**` |
| today | the today routes above, `src/features/{today,discover,onboarding,settings}/**`, `src/components/{today,discover,onboarding,settings}/**` |
| editor | `src/components/editor/**`, `src/features/editor/**` |
| sermons | the sermons routes above, `src/features/{sermons,recording,audio}/**`, `src/components/sermons/**` |
| journal | the journal routes above, `src/features/{journal,prayers,links,tags}/**`, `src/components/{journal,prayers,links}/**` |
| library | the library routes above, `src/features/{library,search,reminders,plans}/**`, `src/components/{library,plans}/**` |
| backend-auth | `supabase/config.toml`, `supabase/migrations/20261111000100_*.sql` … `000199`, `supabase/functions/delete-account/**`, `supabase/functions/_shared/auth.ts`, `src/services/supabase/**`, `src/features/{auth,sync}/**`, `src/app/auth/**`, `src/app/settings/account.tsx`, `.env.example`, `docs/BACKEND.md` |
| ai | `supabase/migrations/20261111000200_*.sql` … `000299`, `supabase/functions/ai-*/**`, `supabase/functions/_shared/{ai,openai,bible,quota}*.ts`, `src/services/{ai,upload}/**`, `src/features/{transcription,recap,study-ai}/**`, `src/components/ai/**`, the ai routes above, `docs/AI.md` |
| monetization | `supabase/migrations/20261111000300_*.sql` … `000399`, `supabase/functions/revenuecat-webhook/**`, `src/services/{payments,monitoring}/**`, `src/features/{subscriptions,export}/**`, `src/components/paywall/**`, the monetization routes above, `eas.json`, `docs/legal/{privacy-policy,terms}.md`, `docs/APP_STORE.md`, `docs/RELEASE.md` |

## Final message (your deliverable to the orchestrator)

Report: what you built (files), commits made, test/typecheck status, anything stubbed or not done,
**requests for shared-file changes** (exact diff you need), and anything that needs a real device or credentials.
