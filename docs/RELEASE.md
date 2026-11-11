# Faithscroll — release guide (EAS Build & Submit)

Step by step from a clean checkout to an Android APK you can share and an iOS build on TestFlight / the App
Store. Commands use `npx eas-cli@latest` so no global install is needed (`eas` below means that).

## 0. What you need

| Need | Free? | Required for |
|---|---|---|
| Expo account | Free | Every EAS build |
| **Apple Developer Program** ($99/year) | **Paid** | Any iOS build that runs on a real iPhone (development, preview/ad hoc, production), TestFlight, App Store, Sign in with Apple, in-app purchases |
| — | Free | iOS **simulator** builds (`development-simulator` profile) |
| Google Play Console ($25 once) | Paid | Publishing on Google Play and testing Play Billing (subscriptions) |
| — | Free | Building and side-loading the Android **APK** (`preview` profile) |
| Supabase, RevenueCat, Sentry projects | Free tiers | Accounts/sync/AI, subscriptions, crash reports (all optional — the app degrades gracefully) |

## 1. Log in and link the project

```bash
npx eas-cli@latest login
npx eas-cli@latest init          # already done: app.json has extra.eas.projectId and owner "playlikeboy"
npx eas-cli@latest whoami
```

## 2. Configuration and secrets

Only **public** values go into the app (`EXPO_PUBLIC_*`). Create them as EAS environment variables for each
environment the build profiles use (`development`, `preview`, `production` — see `eas.json`):

```bash
# repeat per environment: --environment development|preview|production
eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co
eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon or publishable key>
eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value appl_...
eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --value goog_...
eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_SENTRY_DSN --value https://...ingest.sentry.io/...
eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_PRIVACY_URL --value https://<your-site>/privacy
eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_TERMS_URL --value https://<your-site>/terms
# optional, only if you run an analytics collector:
eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_ANALYTICS_URL --value https://<collector>/v1/events
eas env:list --environment production
```

Every variable is optional: without Supabase the app is local-only; without RevenueCat keys the paywall says
subscriptions aren't available; without a DSN crash reporting is off.

**Server secrets never go into EAS or the app** — they are Supabase function secrets (step 3).

### Sentry source maps

The EAS environments already define `SENTRY_DISABLE_AUTO_UPLOAD=true`, so builds succeed without Sentry
credentials. To upload source maps for readable production stack traces:

1. Create the Sentry org/project and put their slugs in `app.json` → `@sentry/react-native` plugin
   (`organization`, `project`; currently placeholders).
2. `eas env:create --environment production --visibility secret --name SENTRY_AUTH_TOKEN --value <token>`
3. Delete (or set to `false`) `SENTRY_DISABLE_AUTO_UPLOAD` in the **production** environment.
4. Use `getSentryExpoConfig` from `@sentry/react-native/metro` in `metro.config.js` (keep the existing `sql`/`db`
   extensions).
5. In Sentry → Project Settings → Security & Privacy, enable **Prevent Storing of IP Addresses** and the default
   data scrubbers (the app already strips content; this is defence in depth).

## 3. Backend (Supabase)

```bash
npx supabase@latest login
npx supabase@latest link --project-ref <ref>
npx supabase@latest db push                                   # applies supabase/migrations/*
npx supabase@latest functions deploy delete-account
npx supabase@latest functions deploy <each ai-* function>      # see docs/AI.md
npx supabase@latest functions deploy revenuecat-webhook --no-verify-jwt
npx supabase@latest secrets set REVENUECAT_WEBHOOK_AUTH="<long random string>"
# plus the AI secrets from docs/AI.md (e.g. OPENAI_API_KEY)
```

`revenuecat-webhook` must run **without** JWT verification (RevenueCat can't send a Supabase JWT); it checks the
`Authorization` header against `REVENUECAT_WEBHOOK_AUTH` instead. Optionally schedule
`select public.billing_purge_events(90);` daily with pg_cron.

## 4. Subscriptions (RevenueCat + stores)

1. App Store Connect: create the app record (bundle id `app.faithscroll.ios`), the subscription group
   **Faithscroll Plus** and products `faithscroll_plus_monthly` / `faithscroll_plus_yearly`
   (details in `docs/APP_STORE.md`). Sign the Paid Applications agreement and complete tax/banking.
2. Google Play Console (if publishing on Play): subscription `faithscroll_plus` with base plans `monthly`, `yearly`.
3. RevenueCat: create a project with an App Store app (+ In-App Purchase key / App Store Connect API key) and a
   Play Store app (+ service-account credentials). Create entitlement **`plus`**, import and attach the products,
   create offering **`default`** (mark *Current*) with Monthly and Annual packages. Copy the public SDK keys into
   the EAS variables above.
4. RevenueCat → Integrations → Webhooks: URL `https://<ref>.supabase.co/functions/v1/revenuecat-webhook`,
   Authorization header value = the exact `REVENUECAT_WEBHOOK_AUTH` string. Send a test event — it should return 200
   (`{"result":"ignored","reason":"test"}`).

The app logs RevenueCat in with the Supabase user id, so purchases follow the account and reach
`public.subscriptions`, which the AI functions read through `public.has_active_plus()`.

## 5. Android APK (share with anyone)

```bash
eas build -p android --profile preview
```

The `preview` profile builds an **APK** (`buildType: apk`) with internal distribution. When it finishes, EAS
prints an install link/QR code; open it on an Android phone and allow installing from that source.

Notes: Play Billing only works for apps installed from Google Play, so in a side-loaded APK the paywall reports
that plans aren't available — every free feature works. For a Play release use
`eas build -p android --profile production` (AAB) and `eas submit -p android --profile production` after placing
the Play service-account JSON at `./secrets/google-play-service-account.json` (keep `secrets/` out of git).

## 6. iOS build → TestFlight → App Store (paid Apple account)

```bash
eas build -p ios --profile production       # EAS creates/manages certificates & provisioning (log in with your Apple ID)
eas submit -p ios --profile production      # uploads the latest build to App Store Connect
# or in one go:
eas build -p ios --profile production --auto-submit
```

Before the first submit, replace the placeholders in `eas.json` → `submit.production.ios`:
`ascAppId` (App Store Connect → App Information → Apple ID, a number) and `appleTeamId`
(developer.apple.com → Membership).

TestFlight: after processing (~10–30 min) the build appears in App Store Connect → TestFlight. Add yourself under
**Internal Testing**; external testers need a short Beta App Review. Test purchases in TestFlight use the sandbox
(no real charge).

App Store: fill in the listing, App Privacy, subscriptions and review notes from `docs/APP_STORE.md`, choose the
build, and submit for review.

### Other iOS profiles

- `development` — dev client on a registered iPhone (`eas device:create` first; paid account).
- `development-simulator` — dev client for the iOS Simulator (no paid account needed).
- `preview` — internal (ad hoc) build for registered devices (paid account; `eas device:create`).

## 7. Versions

`eas.json` uses `appVersionSource: "remote"`: EAS stores and auto-increments the build number (iOS) / version
code (Android) for `production` builds. Set the starting values once with `eas build:version:set` if needed.
Bump the user-facing `version` in `app.json` for each release.

Over-the-air updates (`expo-updates` is installed) are not configured yet; run `eas update:configure` when you
want them, and never ship native changes via OTA.

## 8. Before every release

```bash
npm run typecheck
npm run lint
npm test
npx expo-doctor
```

Then on physical devices: background/locked recording, interruptions (calls, Siri), transcription retry, export,
delete all local data, account deletion, purchase / restore / cancel / expiry in sandbox.
