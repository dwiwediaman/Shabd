# Phase 0.3 — Godot + Devanagari + Plugin Smoke-Test PoC

**Status:** Not started. Executes in **cloud-first workflow**: GitHub Codespaces (Godot in browser via noVNC) + GitHub Actions (Android AAB builds) + Firebase Test Lab (real-device testing in Google's cloud). No local installs required. See [docs/cloud-dev-setup.md](../docs/cloud-dev-setup.md).

---

## Goals

This PoC is a **throwaway Godot 4.5 project** that proves three load-bearing technical assumptions BEFORE production code begins:

1. **Devanagari conjunct rendering works** in Godot 4.5 on real Android devices (not just emulator)
2. **Plugin co-existence** doesn't break Gradle dependency resolution
3. **Google Sign-In + Firestore round-trip** survives uninstall / re-sign-in / state restore

Decision-gates baked in: any failure routes to a documented fallback so the production plan adapts.

---

## Setup checklist (cloud-first)

- [ ] Push repo to GitHub (private OK; Actions free tier allows it)
- [ ] Open Codespace on `main` — Dockerfile auto-installs Godot 4.5 + JDK 17 + Android SDK on first build (~5–8 min once, then cached)
- [ ] Click forwarded port 6080 ("Godot Editor (noVNC)") to open the editor in a browser tab
- [ ] Configure repo secrets per [docs/cloud-dev-setup.md](../docs/cloud-dev-setup.md): `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT`
- [ ] Create Firebase project at console.firebase.google.com (free Spark tier)
- [ ] Enroll in Firebase Test Lab (auto-enabled with project)

**No local installs. No physical devices required for Phase 0.3.** Real-device testing happens via Firebase Test Lab in Google's cloud.

---

## Test 1 — Devanagari conjunct rendering

**Setup:** Godot scene with `Label` and `RichTextLabel` nodes, each rendering a list of 20 conjunct-heavy Hindi words. Run inside the Codespace's noVNC-hosted Godot Editor; build AAB via CI; install via Firebase Test Lab to capture screenshots from real devices.

**Test words (covering all major conjunct families):**
```
क्ष  ज्ञ  त्र  श्र  द्व  द्य  द्ध  त्त  ट्ठ  क्क
न्य  न्द  म्ब  ल्ल  व्य  ष्ट  स्थ  स्त  ह्म  क्त
```

Plus full words containing these:
```
क्षमा    ज्ञान    त्रिकोण    श्रद्धा    विद्या
युद्ध    सत्ता    चट्टान    अक्क    अन्य
ब्रह्म   चित्त    हस्त    स्थान    रास्ता
```

**Pass criteria:**
- Each conjunct renders as ONE visual glyph (not separated codepoints) on Firebase Test Lab device matrix (Pixel 5 / Pixel 6 / Pixel 8 minimum, plus 1 Samsung if available)
- Akshara boundaries (computed via Python `regex.findall(r'\X', word)` in `scripts/phase0_corpus_analysis.py`) match what Godot's HarfBuzz reports cluster-wise
- No glyph fallback to Tofu boxes (□) on any tested device (verified via Test Lab Robo screenshots)

**Pass result:** Godot text-based DB approach is viable. Proceed.

**Fail mode:** Cross-tile fragmentation, broken conjuncts, or missing glyphs on any device.
**Fallback:** Switch to **sprite-atlas approach** — pre-render all valid Hindi words to PNGs at build time using a known-good shaper (Pango or system Android TextView), bundle the atlas in the APK, render via Sprite2D nodes. This changes `word_db.gd` from text-based to image-based lookup. Adds ~50-100MB to APK.

---

## Test 2 — Plugin co-existence smoke

**Setup:** A minimal `build.gradle` that pulls in:
- Godot Android template (4.5)
- AdMob plugin (`godot-sdk-integrations/godot-admob` v6.0+)
- AppLovin MAX adapter
- Firebase Analytics + Crashlytics + Firestore + Auth (BoM-managed)
- Play Games Services Sign-In (or just Firebase Auth Google provider — choose based on plugin maturity)
- Play Billing Library (even though no IAP at v1.0, having it linked verifies compat for v1.1)

**Pass criteria:**
- `gradle assembleRelease` succeeds with no dependency-resolution conflicts
- Final AAB is < 50MB (target) or documented at actual size
- App installs + launches on all 3 test devices
- Logcat shows no SDK init crashes for 60 seconds idle

**Pass result:** Plugin stack is compatible. Proceed.

**Fail mode:** Gradle conflict (e.g., `play-services-ads` version mismatch), runtime SDK crash on init.
**Fallback:** (a) Pin specific versions documented in Godot mobile community forum; (b) drop AppLovin MAX and use AdMob-only at v1.0 (lower revenue but viable); (c) use Cocos Creator or Unity as engine fallback (last resort, restarts most of plan).

---

## Test 3 — Google Sign-In + Firestore round-trip

**Setup:** Add a button "Sign In with Google" + a counter that increments on tap and writes to Firestore at `/users/{uid}/counter`.

**Test sequence (cloud-first):**
1. Build AAB via CI (`.github/workflows/build.yml`)
2. Upload to Play Console Internal Testing track
3. Install on your own Android phone via Play Store internal testing link (one-time auth via Google account that signs in to Play Store)
4. Tap Sign In → complete Google OAuth flow → tap counter 5 times → verify Firestore doc shows `counter: 5`
5. Uninstall via Play Store
6. Reinstall via Play Store internal testing link
7. Sign in with same Google account → verify counter restores to 5

For full automation: Test Lab's Robo test can do steps 4–7 except the sign-in flow (Robo can't authenticate Google accounts in the test environment). So sign-in test is manual on your own phone; everything else automates via Test Lab.

**Pass criteria:**
- Sign-in flow completes without crash on all 3 devices
- Firestore writes succeed under cellular + WiFi
- Restore on reinstall preserves the counter value
- Anonymous-auth fallback (if user declines) writes to local SQLite and persists across app restart (but is correctly lost on uninstall)

**Pass result:** Identity + cloud-save architecture is viable. Proceed.

**Fail mode:** Sign-in plugin crashes, Firestore writes fail, or restore-on-reinstall doesn't work.
**Fallback:** **Recovery code** approach — on first significant streak, app generates a 12-character code; user copies it; on new device, paste-restore. Higher friction but works without any third-party identity SDK.

---

## Effort estimate

| Step | Effort |
|---|---|
| Setup (Godot install, JDK, SDK, devices) | 4 hrs |
| Test 1 (rendering) | 4–6 hrs |
| Test 2 (plugin smoke) | 6–10 hrs (this is where most surprises hide) |
| Test 3 (sign-in) | 3–5 hrs |
| Documentation + screenshots | 2 hrs |
| **Total** | **20–30 hrs (~3–4 part-time weeks)** |

This is the most technically risky Phase 0 sub-phase. Budget conservatively.

---

## Output (to fill in after PoC complete)

**Date range:** TBD
**Devices used:** TBD
**Godot version:** TBD
**Test results:**

| Test | Result | Notes |
|---|---|---|
| 1. Devanagari rendering | PASS / FAIL | TBD |
| 2. Plugin co-existence | PASS / FAIL | TBD |
| 3. Sign-in round-trip | PASS / FAIL | TBD |

**Decisions made:**
- Word DB approach: text-based / sprite-atlas / TBD
- Identity provider: Firebase Auth + Google Sign-In / Play Games Services / Recovery codes / TBD
- Engine: Godot 4.5 / Unity (fallback) / TBD

**Plugin compatibility matrix:**

| Plugin | Version | Status |
|---|---|---|
| AdMob (godot-sdk-integrations) | TBD | TBD |
| AppLovin MAX adapter | TBD | TBD |
| Firebase Analytics | TBD | TBD |
| Firebase Crashlytics | TBD | TBD |
| Firebase Firestore | TBD | TBD |
| Firebase Auth (Google Sign-In) | TBD | TBD |
| Play Billing | TBD | TBD |

**APK size measured:** TBD MB
**Issues / surprises:** TBD
**Screenshots from each device:** TBD (saved in `research/poc_screenshots/`)
