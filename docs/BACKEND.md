# Faithscroll backend: Supabase, accounts and cloud sync

Faithscroll is local-first. Every feature works offline and signed out. Supabase adds three optional things:

- **Accounts:** Sign in with Apple (iOS) or an emailed one-time code.
- **Cloud backup & sync:** Faithscroll Plus only. Changes are copied privately between the user's devices.
- **Server-side AI and billing:** AI routes through Edge Functions (see `docs/AI.md`); billing mirrors RevenueCat (see `docs/RELEASE.md`).

| Piece | Where |
|---|---|
| Core schema: profiles, preferences, helper triggers | `supabase/migrations/20261111000100_core.sql` |
| Sync mirror tables, RLS, cursor indexes, full-text search | `supabase/migrations/20261111000110_sync_mirrors.sql` |
| Account deletion function | `supabase/functions/delete-account/` |
| Shared JWT/CORS helpers | `supabase/functions/_shared/auth.ts` |
| App client (keychain session storage) | `src/services/supabase/` |
| Sign-in, session, account screen, deletion | `src/features/auth/`, `src/app/auth/sign-in.tsx`, `src/app/settings/account.tsx` |
| Sync engine | `src/features/sync/` |

## 1. Setup

You need a Supabase account, the Supabase CLI (`npx supabase …` works without installing it), and the
Apple Developer account that owns the bundle id `app.faithscroll.ios`.

### 1.1 Create and link the project

1. The project already exists: ref **`ymqbbpiymkrpwhpguvkm`**, URL `https://ymqbbpiymkrpwhpguvkm.supabase.co`. This ref is also `project_id` in `supabase/config.toml`. For a new environment, create another project at <https://supabase.com/dashboard> and keep its database password.
2. Link this repository and apply every migration (backend, AI and billing, in filename order):
   ```bash
   npx supabase login
   npx supabase link --project-ref ymqbbpiymkrpwhpguvkm
   npx supabase db push
   ```
3. Check **Database → Tables**. Every table should show RLS enabled.

For local development, `npx supabase start` runs the whole stack in Docker. It uses `supabase/config.toml`. Sign-in codes appear in Inbucket at <http://127.0.0.1:54324>.

### 1.2 Email one-time codes

Dashboard → **Authentication**:

1. **Sign In / Providers → Email**: enable it. Set the OTP length to 6 and the expiry to 900 seconds.
2. **Emails → Templates**: the app verifies a code in-app and never opens links. Put the code in both the **Magic Link** template and the **Confirm signup** template:
   ```html
   <h2>Your Faithscroll sign-in code</h2>
   <p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
   <p>It expires in 15 minutes. If you didn't ask for it, you can ignore this email.</p>
   ```
3. **Emails → SMTP Settings**: configure your own SMTP provider before launch. The built-in sender is heavily rate-limited.
4. **URL Configuration**: set the Site URL to `faithscroll://`. Redirects are never used.

### 1.3 Sign in with Apple (native, iOS)

1. Apple Developer → Identifiers → `app.faithscroll.ios`: enable **Sign in with Apple**. EAS sets the entitlement because `app.json` has `usesAppleSignIn: true`.
2. Supabase → **Authentication → Sign In / Providers → Apple**: enable it.
   - **Client IDs**: `app.faithscroll.ios`. Add any development-build bundle ids, comma-separated. Add `host.exp.Exponent` only if you test in Expo Go, which Faithscroll does not support.
   - **Secret Key**: leave it empty. A secret is only needed for web or Android OAuth flows, and Faithscroll uses neither.
3. Nonce handling: the app sends Apple the SHA-256 of a random nonce and sends Supabase the raw nonce. Supabase checks the token's nonce claim, so keep nonce checks enabled.
4. Apple shares the user's name only on the first authorisation. The app saves it with `auth.updateUser`, and a trigger copies it into `profiles.display_name`.

Android has no native Apple sign-in, so Android users sign in with an email code.

### 1.4 Edge Functions and secrets

```bash
npx supabase functions deploy delete-account
npx supabase functions deploy revenuecat-webhook --no-verify-jwt   # authenticated by its own secret
npx supabase functions deploy ai-retention --no-verify-jwt          # scheduled; uses AI_RETENTION_SECRET
npx supabase functions deploy ai-study ai-ask ai-transcribe ai-recap ai-job-status

npx supabase secrets set OPENAI_API_KEY=... REVENUECAT_WEBHOOK_AUTH=... AI_RETENTION_SECRET=...
# optional: OPENAI_TEXT_MODEL, OPENAI_TRANSCRIBE_MODEL, AI_PROVIDER, AI_LIMITS_JSON, retention days
```

The Edge Runtime provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` automatically. Never put the service-role key in the app or in `.env*`.

### 1.5 App environment

Copy `.env.example` to `.env.local`, which git ignores, and fill in at least:

```
EXPO_PUBLIC_SUPABASE_URL=https://ymqbbpiymkrpwhpguvkm.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon or publishable key from Project Settings → API Keys>
```

For EAS builds, create the same names as EAS environment variables (`npx eas-cli@latest env:create`) for each environment: development, preview and production. When either value is missing, the app hides cloud features and shows "Cloud features aren't set up".

### 1.6 Smoke test

1. Run a development build on an iPhone and open Settings → Account → Sign in.
2. Sign in with Apple, then sign out and sign in again with an email code.
3. With a Plus sandbox purchase, turn on **Back up and sync**. Write a journal entry. A row should appear in `journal_entries` with your `user_id`.
4. Sign in on a second device and confirm the entry arrives.
5. Edit the same entry on both devices while one is offline, then bring it online. Settings → Account should show "1 item was edited on two devices".
6. Delete the account and confirm the user, its rows and its `sermon-audio/<uid>/` objects are gone.

## 2. Data model and security

- Each **sync mirror** has the same name and the same snake_case columns as its local SQLite table in `src/db/schema.ts`. Every mirror also has:
  - `user_id`, which defaults to `auth.uid()` and cascades on account deletion
  - `created_at`, `updated_at` and `deleted_at`. A non-null `deleted_at` is a tombstone.
  - `version`
  - `server_updated_at`, which a trigger sets on every write and which serves as the pull cursor
- **Device-only columns are not mirrored.** `reminder_notification_id` is a notification id on one phone, and `local_file_name` is a file on one phone. On pull, the device keeps its own values.
- **Not synced:**
  - `reading_progress` and `reading_history`: device reading state, never queued in the outbox
  - `plan_day_completions`: plan progress rows sync, but which days were completed does not
  - `transcript_segments`: transcript text syncs, but timed segments do not
- **RLS** is enabled on every table. Each policy is `(select auth.uid()) = user_id` for select, insert, update and delete, granted to `authenticated` only. `anon` has no table privileges.
- **No cross-table foreign keys on the server.** The device enforces referential integrity, and the server is a per-user replica, so rows can arrive in any order.
- Full-text search uses generated `tsvector` columns with GIN indexes on `journal_entries`, `prayer_entries`, `sermons` and `sermon_notes`. They use the `simple` config, which is language-neutral.

## 3. Sync design (`src/features/sync`)

### When sync runs

`initSync()` runs from the root layout. Supabase token auto-refresh runs whenever the app is in the foreground. Sync itself runs only when all of these are true:

1. Supabase is configured.
2. The user is signed in.
3. The user has turned **Back up and sync** on.
4. Plus is active, mirrored from the payments store. The last known value is kept while RevenueCat is unreachable.

Sync runs on launch, on foreground, every 5 minutes while open, on sign-in, when sync is turned on, and 10 seconds after a local edit. One run happens at a time. A failed run retries with exponential backoff, from 15 seconds up to 15 minutes. These retries also cover reconnecting, because no network-state module is installed.

### Pull and then push

Pull goes first, so a device that has been offline sees other devices' edits before it uploads its own.

**Pull**

- Tables are pulled parents first. Each table is paged by `(server_updated_at, id)`, 200 rows per page.
- Each run starts 60 seconds before the stored cursor. This catches rows whose transaction committed late. Re-applying a row is idempotent.
- Timestamps are normalised back to the device format, `toISOString()`.
- A row whose parent hasn't arrived yet is parked in `sync_state` and retried after each pull. It is dropped after 30 days.

**Push**

- Outbox entries are grouped per entity. The row is read as it is now and upserted in batches of 100.
- A soft delete travels as a tombstone. A row that no longer exists on the device is tombstoned on the server.
- Entity tags use the outbox key `<entityType>:<entityId>:<tagId>` and are hard-deleted locally. The server row is upserted on `(user_id, entity_type, entity_id, tag_id)`, and a delete is recorded as a tombstone.
- A batch with a data error is retried row by row. Rows that fail record `attempts` and `last_error` (an error code only) and back off from 30 seconds up to 6 hours. Network, auth and server errors stop the push and leave the outbox untouched.

### Conflict rule: never silently overwrite the user's latest text

- **Base versions.** For each row, the device stores in `sync_state` the version it last pushed or pulled.
- **Version guard.** A server trigger accepts an update only if its `version` is strictly higher than the stored row's. A stale write is skipped and left out of the upsert's returned rows. The device then fetches the newer server row and applies the rule below.
- **Remote change with no pending local change.** The remote row is applied.
- **Remote change with a pending local change:**
  - If the remote version is at or below the base version, the remote row is this device's own earlier push and is ignored.
  - If the content is identical, nothing is left to push and the pending entry is cleared.
  - Otherwise both copies go to `sync_conflicts`, the local row is kept, and its version is raised above the remote one. The pending push then wins on the server and on every other device. The other copy remains available.
- **Natural-key collisions.** These are rows with different ids for the same thing, for example the same verse highlighted on two devices. The local row is kept and the other copy goes to `sync_conflicts`. If the local duplicate was already deleted, the server row replaces it.
- **Reviewing conflicts.** Settings → Account shows the conflict count and both versions. **Keep this device's** dismisses the other copy. **Use other version** applies the other copy as a new local edit, which then syncs.

### Accounts on one device

The device remembers which user it syncs for. If a different user signs in, cursors and base versions are reset and that user's data is pulled. Rows already uploaded to the previous account are not copied into the new one. Changes still waiting in the outbox are uploaded.

## 4. Account deletion

Settings → Account → **Delete account…** works in two steps:

1. An explanation of what will be deleted, with an optional **Also erase data on this device** switch.
2. A native confirmation.

The app then calls `delete-account`, which:

1. Verifies the JWT. The platform verifies it too, because `verify_jwt = true`.
2. Removes every object under `sermon-audio/<uid>/`, if that bucket exists.
3. Deletes the auth user with the service role. Every user table references `auth.users` with `on delete cascade`, so profiles, preferences, mirrors, AI jobs and subscriptions go with it.

On the device:

- **Erase on:** every local table is wiped, scheduled reminders are cancelled, and `recordings/` is deleted.
- **Erase off:** local data becomes signed-out data again and is queued to upload to whichever account signs in next.

Either way, cloud sync is turned off. Deleting the account does not cancel an App Store or Play subscription, and the screen says so.

## 5. Known limitations

- Plus is enforced for sync on the client only. To enforce it on the server, add a `with check` on the mirror insert and update policies that calls a security-definer helper reading `public.subscriptions`. The billing migration already exposes `has_active_plus` to the service role.
- `user_preferences` exists, but the app does not sync preferences yet.
- Sign out uses `scope: 'local'` and needs a connection. When offline, the user is asked to retry.
