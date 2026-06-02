# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Shabd — Claude operating notes

> Short, project-specific rules. Read this before doing anything substantive.

## What this is
Daily Hindi+English word puzzle (Wordle-style). Vite + vanilla JS + Capacitor → Android.
Repo: `dwiwediaman/Shabd`, branch `main`. Package `in.shabd.game`.

## Build = GitHub Actions only
No local Java/Android Studio. To ship a build:

```bash
npm run test:ci                                                    # always run locally first
git commit -am "..."                                               # commit
git remote set-url origin https://$(gh auth token)@github.com/dwiwediaman/Shabd.git
git push
git remote set-url origin https://github.com/dwiwediaman/Shabd.git
gh workflow run build.yml --ref main
gh run watch <run-id> --exit-status
gh run download <run-id> --dir /tmp/aab
```

The artifact folder is named `shabd-vNN-{sha}` — that `NN` is the **actual versionCode**. Save the AAB:

```bash
cp /tmp/aab/*/app-release.aab releases/vcNN-vY.Z.aab
```

**AABs always go in `releases/`** — never on Desktop.

## versionCode is automatic
CI uses `git rev-list --count HEAD` with `fetch-depth: 0`. Each commit = new versionCode. **Don't bump manually.** Don't write back to repo.

## Play Console upload split
Chrome extension blocks JS-driven AAB upload. Workflow:
1. User uploads AAB manually
2. User says "uploaded"
3. Claude handles release notes (must use `<en-US>...</en-US>` language tags) + Next/Save/Send

## Test before push, always
```bash
npm run test:ci          # Vitest unit tests (required — same as CI)
npm run test:e2e         # Playwright E2E tests against Vite dev server
npm run test:e2e:ui      # Playwright interactive UI mode (local dev only)
```
CI runs `test:ci` — failing Vitest tests block the AAB build. Playwright tests run locally only (not wired to CI yet).

**Single test file:**
```bash
npx vitest run src/test/gameState.test.js          # one Vitest file
npx playwright test e2e/settings.spec.js           # one Playwright file
npx playwright test --grep "Hard Mode"             # filter by name
```

**E2E layout:**
```
e2e/helpers.js           ← bootApp(), typeWord(), pressKey(), todayIST()
e2e/navigation.spec.js   ← menu → screen → back for every screen
e2e/settings.spec.js     ← toggles, language switch, hard-mode lock, header gap
e2e/puzzle.spec.js       ← keyboard input, tile coloring, EN + HI modes
playwright.config.js     ← Pixel 5 viewport, Vite dev server
```

Playwright mocks nothing — Capacitor APIs gracefully no-op in browser (`isNativePlatform()` → false), so the full app boots as-is.

## File map
```
src/main.js                   ← entry, splash, first-launch tutorial routing
src/screens/                  ← mainMenu, dailyPuzzle, stats, settings, howToPlay, archive, squads
src/components/               ← keyboard, router, tileGrid
src/game/                     ← gameState, seedEngine, wordleMechanic, transliterator, wordDb, shareImage, score
src/cloud/                    ← api.js, auth.js, config.js (LS_KEYS), squads.js, sync.js
src/migrations.js             ← runs at boot (after wordDb loaded); migrates legacy archive sessions
src/deepLink.js               ← shabd:// deep-link handler factory (testable; registered pre-boot)
src/notifications.js          ← daily reminder scheduling via Capacitor LocalNotifications
src/feedback.js               ← in-app feedback flow
src/updateCheck.js            ← @capawesome/capacitor-app-update check on boot
src/i18n.js                   ← EN + HI strings
src/style.css                 ← single sectioned stylesheet
src/test/                     ← only game logic + i18n tested. screens/components 0% covered.
android/app/build.gradle      ← versionCode/versionName (CI overwrites versionCode)
.github/workflows/build.yml   ← Android AAB build CI
.github/workflows/deploy-worker.yml ← Cloudflare Worker auto-deploy on push
releases/                     ← all AABs go here, named vcXX-vY.Z.aab
workers/                      ← Cloudflare Worker backend (see below)
```

## Cloud backend (workers/)
Hono-based Cloudflare Worker backed by D1 (SQLite). Deployed automatically when `workers/` changes are pushed to `main`.

Key endpoints: `POST /auth/google`, `POST /sync/push`, `GET /sync/pull`, `POST /scores/submit`, `GET|POST /squads/*`.

Local dev:
```bash
cd workers && npm run dev      # wrangler dev at localhost:8787
npm run db:migrate:local       # apply new SQL migrations locally
npm run db:migrate:remote      # apply to production D1
npm run db:console:remote -- "SELECT count(*) FROM users"
npm run tail                   # live log tail
```

`regen-pools` runs automatically as `predeploy` — don't skip it manually.

**LS_KEYS** in `src/cloud/config.js` is the single registry of everything we write to localStorage for cloud state. Always add new keys there. The `lastBackfillAt` key is intentionally versioned (`_v2`) — bump the suffix to force a one-time full re-push on all clients.

**Anti-cheat**: `/sync/push` validates sessions server-side. Archive plays must never touch leaderboard scores — check `mode === 'daily'` before calling `submitScore()`.

## Test coverage is misleading
The 96%+ stat covers only files that have tests. **Screens & components are 0%.** Real codebase coverage ~30%. Bugs that hurt users live in screen code (dense input arrays, share gestures, stale UI state). When user asks about quality/coverage, surface this honestly.

## Known gotchas

**1. Share gesture window**
`navigator.share()` MUST be called synchronously in the tap handler. Async work (canvas, blob, font loading) before `share()` blows the user-gesture window → falls back to text-only on Android. Pre-render canvas+blob during win/loss animations and cache it. `shareImage()` consumes the cache instantly.

**2. Hint dense array**
Don't use sparse arrays for `currentInput`. Always `new Array(tileCount).fill('')`, then `findIndex(c => c === '' && !hintedPositions.has(i))` for next-empty. Backspace uses reverse-scan skipping hint positions.

**3. Hindi keyboard modes**
`settings.kbMode` ∈ `'hinglish' | 'devanagari'`. Different keyboards. Hard mode + hint logic must work identically across both.

**4. Time / IST**
`getISTDate()` is the single source of truth for "today". Never use `new Date()` directly for puzzle date — IST timezone matters.

**5. Archive vs daily**
Archive plays should NOT affect streak/stats (competitive integrity). When adding scoring logic, check `mode === 'daily'` before mutating those.

## Don't ask, just do
14+ builds shipped, CI/CD configured, keystore in CI secrets, Play Console app exists, store assets in `store-assets/`. The user gets frustrated when asked about things already set up. Just execute.

## When asked for an audit / feedback
- Read screens, grep coverage, check edge cases — don't speculate
- Tier issues by severity (Critical / High / Medium / Low)
- Cite file paths and line numbers
- End with an actionable offer ("Want me to fix X now?"), not vague commentary

## Status (2026-05-11, audited live in Play Console)
- Latest AAB: `releases/vc47-v1.4.aab` — UPLOADED + IN REVIEW
- Closed testing: **6/12 testers**; need 6 more + 14-day clock for production unlock

**✅ Already done in Play Console — don't ask:**
- Privacy policy, Data Safety, Content rating, all 10 policy declarations
- Default store listing LIVE — app name, short + full description (1196 chars, EN+HI)
- Feature graphic (1024×500), app icon (512×512), 3 phone screenshots

**❌ Actually missing:**
- Tablet screenshots (non-blocking for closed testing)
- 1+ more phone screenshot for "promotion eligible" (have 3, need 4)
- 6 more testers for production unlock

**Tech debt:**
- **URGENT — Node.js 20 actions deprecated June 2, 2026** (6 days away). CI uses `checkout@v4`, `setup-node@v4` etc. — these will break. Upgrade to `@v5` equivalents before that date.
- Integration tests for screens (0% coverage on src/screens, src/components)
- Crash reporting — no Sentry/Crashlytics
