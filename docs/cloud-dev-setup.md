# Cloud Dev Setup — Zero Local Install Workflow

This project is configured for **fully cloud-based development**. You don't need to install Godot, Android SDK, JDK, or adb on your local machine. Everything runs in the browser via GitHub Codespaces + GitHub Actions + Firebase Test Lab.

---

## Architecture

```
┌─────────────────────────┐    push     ┌──────────────────────┐
│ GitHub Codespaces       │ ──────────► │ GitHub Actions       │
│ (browser-based VS Code  │             │ - Build Android AAB  │
│  with Godot 4.5 inside  │             │ - Run unit tests     │
│  via noVNC at :6080)    │             │ - Upload artifact    │
└─────────────────────────┘             └──────────┬───────────┘
                                                   │ AAB
                                                   ▼
                                        ┌──────────────────────┐
                                        │ Firebase Test Lab    │
                                        │ (real Android devices│
                                        │  in Google's cloud,  │
                                        │  free tier 5/day)    │
                                        └──────────┬───────────┘
                                                   │ smoke results
                                                   ▼
                                        ┌──────────────────────┐
                                        │ Play Console         │
                                        │ Internal Testing     │
                                        │ (install on your own │
                                        │  phone via Play Store)│
                                        └──────────────────────┘
```

**Local install required: nothing.** The only thing on your laptop is a web browser.

---

## One-time setup

### 1. GitHub repo

Create an **empty private repo** on github.com (e.g. `rahul-d-dp/shabd`). Do not initialize with README — we already have one.

```bash
cd shabd/
git remote add origin git@github.com:<your-username>/shabd.git
git branch -M main
git commit -m "Phase 0 setup: dev container, CI, artifact templates"
git push -u origin main
```

### 2. Repository secrets

Add these in GitHub → Settings → Secrets and variables → Actions:

| Secret | What it is | How to get it |
|---|---|---|
| `FIREBASE_PROJECT_ID` | Firebase project name (e.g. `shabd-game`) | Create at console.firebase.google.com |
| `FIREBASE_SERVICE_ACCOUNT` | Service account JSON for Test Lab access | Firebase console → Project settings → Service accounts → Generate new private key |
| `ANDROID_KEYSTORE_BASE64` | Release signing keystore (base64-encoded) | `keytool -genkey -v -keystore shabd.keystore ...`; then `base64 -i shabd.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password | Set when generating |
| `ANDROID_KEY_ALIAS` | Key alias inside keystore | Set when generating |
| `ANDROID_KEY_PASSWORD` | Key password | Set when generating |

(The keystore secrets are only needed when you start signing release builds — Phase 4+. They can wait until then.)

### 3. Open the Codespace

GitHub repo → green "Code" button → "Codespaces" tab → "Create codespace on main".

The Dockerfile builds on first launch (~5–8 min once). Subsequent opens are <30 seconds.

When the container is ready:
- VS Code opens in your browser
- The Godot Editor is accessible via noVNC at port 6080 — click the "Ports" panel in VS Code, find port 6080 labeled "Godot Editor (noVNC)", click the globe icon to open in browser tab
- A terminal at `/workspaces/shabd` is your project root

### 4. Launch Godot Editor in browser

In the VS Code terminal:

```bash
cd /workspaces/shabd
godot --editor --path .
```

The Godot Editor will open inside the noVNC tab (the port-6080 browser tab). Latency is ~50–200ms — fully usable for scene editing, slower than native but workable.

---

## Daily workflow

```
1. github.com/<you>/shabd/codespaces — open existing or create
2. Edit GDScript in VS Code (browser)
3. Compose scenes in Godot Editor (browser, noVNC tab)
4. Test in Godot Editor's Play button (runs in noVNC)
5. Commit & push from VS Code terminal
6. Wait ~3–5 min for GitHub Actions to build AAB
7. AAB artifact downloadable from the Actions run page
8. Firebase Test Lab smoke runs automatically on successful build
9. Upload AAB to Play Console Internal Testing track
10. Install on your own phone via Play Store (Internal Testing link)
```

---

## When you actually need a real phone in your hand

For Phase 0.6 input-speed benchmark, you DO need testers using real phones. The pipeline:

1. Build AAB in CI
2. Upload to Play Console Internal Testing
3. Add tester emails (12 testers, the Phase 0.5 closed-test cohort)
4. Testers install via opt-in link in Play Store on their phone
5. App uploads input timing telemetry to Firestore
6. You query Firestore from a Cloud Function or Codespace terminal to get aggregate timing data

This pattern works for all benchmarks and bug reports — testers' real-device data flows back to you via Firestore, no adb required.

---

## Cost / quota

| Service | Free tier | Above tier |
|---|---|---|
| GitHub Codespaces | 60 hr/month (2-core, 4 GB) | $0.18/hr |
| GitHub Actions | 2000 min/month for private repos | $0.008/min |
| Firebase Test Lab | 5 physical + 10 virtual tests/day (Spark) | Blaze plan billed per device-min |
| Firebase Auth/Firestore/Storage | Spark free up to ~50K MAU | Blaze pay-as-you-go |
| Play Console | $25 one-time account fee | — |

For a 5–10 hr/week project: 20–40 hr/month Codespaces use, well within the 60-hr free tier. Actions: each AAB build is ~3–5 min, so 50–100 builds/month = 250–500 min, well within the 2000-min free tier.

**Realistic spend for the first year: $25** (Play Console).

---

## Trade-offs vs local install

| Dimension | Cloud-first (this setup) | Local install |
|---|---|---|
| Setup time | ~10 min one-time (Codespace first-run) | ~30 min one-time (install Godot, JDK, SDK) |
| Iteration speed (edit → see change) | 50–200 ms in noVNC + ~30 s for Play test | <30 ms native |
| Build cycle | ~3–5 min in CI per build | ~30–90 s local export |
| Device testing | Firebase Test Lab + Play Internal Track (~5 min per cycle) | adb install (~15 s per cycle) |
| Local disk usage | 0 | ~2–4 GB |
| Cost | $0 within free tiers | $0 |
| Works on ChromeBook / iPad | Yes | No |
| Offline work | No | Yes |

The cloud setup loses ~3–4× iteration speed but gains zero-local-install. For a 5–10 hr/week project, the iteration-speed loss is acceptable.

---

## Fallback: if Codespaces is unavailable

The same `.devcontainer/` works with local Docker (`Dev Containers` extension in VS Code). If you ever decide to install Docker Desktop locally, you get the full cloud setup running on your laptop with no other installs.

If even that's too much, the very last fallback is the local Godot.app drag-drop install (Option 1 from earlier discussion). The .devcontainer/ stays in the repo unused — no harm.

---

## What this setup does NOT cover

- **Live device debugging.** If something only reproduces on a specific device, you'll need that device in hand or use Firebase Test Lab's debug session feature.
- **Performance profiling on device.** Godot's built-in profiler runs in the editor; for on-device profiling, you need adb or rely on Crashlytics/Firebase Performance.
- **Push notifications testing.** Requires a real device + Firebase Cloud Messaging setup. Out of scope for v1.0.

These limitations are acceptable for v1.0 (no real-time multiplayer, no push notifications, performance is dominated by frame timing not network).
