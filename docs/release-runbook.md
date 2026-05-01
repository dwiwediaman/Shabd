# Release Runbook — Shabd v1.0 to Play Store

This is the **5-step user-must-do list** to take Shabd from "code in repo" to "live on Play Store internal testing". Each step is documented with exact commands.

**Total wall-clock time:** ~3 hours (most of it waiting for builds and Play Console review).

---

## Pre-flight (one-time, ~30 min)

Before the first release, you need ONE-TIME setup:

### 1.1 GitHub repo secrets

Already partially done. Verify the following secrets exist at https://github.com/dwiwediaman/Shabd/settings/secrets/actions:

| Secret | Purpose |
|---|---|
| `FIREBASE_PROJECT_ID` | `shabd-game` (set) |
| `FIREBASE_SERVICE_ACCOUNT` | JSON contents (set) |
| `ANDROID_UPLOAD_KEYSTORE_BASE64` | Generated below in 1.3 |
| `ANDROID_UPLOAD_KEYSTORE_PASSWORD` | Set when generating keystore |
| `ANDROID_UPLOAD_KEY_ALIAS` | Default: `shabd-upload` |
| `ANDROID_UPLOAD_KEY_PASSWORD` | Same as keystore password is fine |

### 1.2 Privacy policy hosting

The privacy policy at `docs/privacy-policy.md` needs to live at a public URL. We use GitHub Pages:

```bash
# In the Shabd repo settings → Pages:
# - Source: Deploy from branch
# - Branch: main, folder: /docs
# - Click Save

# Then access at:
#   https://dwiwediaman.github.io/Shabd/privacy-policy.html
# (GitHub Pages renders MD as HTML automatically)
```

Update the Play Console listing's Privacy Policy URL field with this URL.

### 1.3 Generate upload keystore (ONE TIME)

This is the keystore that signs your AABs for Play Console upload. Once generated, KEEP THE FILE SAFE — losing it means you can't update the app without contacting Google support.

```bash
# Run in your terminal (NOT in Codespace — keystores should never live in cloud workspaces):
cd ~
keytool -genkey -v \
  -keystore shabd-upload.keystore \
  -alias shabd-upload \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass <your-strong-password> \
  -keypass <your-strong-password> \
  -dname "CN=Rahul Dwiwedi, OU=Personal, O=Personal, L=Mumbai, ST=Maharashtra, C=IN"

# Verify:
keytool -list -keystore shabd-upload.keystore

# Encode for GitHub secrets:
base64 -i shabd-upload.keystore | pbcopy
# → paste into ANDROID_UPLOAD_KEYSTORE_BASE64 secret on GitHub

# Save shabd-upload.keystore to your password manager / encrypted backup.
# DO NOT commit it to git.
```

---

## Per-release (~30 min active, ~3 hr including review)

### Step 1: Build the AAB in CI (~5 min)

Push or trigger the workflow:

```bash
cd shabd/
git push  # if you have local changes
# OR trigger manually:
gh workflow run "Build Android AAB"
```

Watch progress at https://github.com/dwiwediaman/Shabd/actions. The workflow:
1. Installs Godot 4.5
2. Installs Android SDK + JDK 17
3. Decodes the keystore from secrets
4. Runs `godot --export-release "Android" build/shabd.aab`
5. Uploads the AAB as an artifact

When the run is green (~3-5 min), download the AAB:

```bash
gh run download <run-id> -n shabd-aab-<sha>
# AAB lands at ./shabd.aab
```

### Step 2: Smoke-test on Firebase Test Lab (auto, ~5 min)

The `Firebase Test Lab Smoke` workflow auto-triggers when Build succeeds. Watch at the same Actions URL. Robo test runs on Pixel 5 + Pixel 6.

If it fails, check the Firebase console → Test Lab → run logs → fix issues → push again.

### Step 3: Upload to Play Console Internal Testing (~10 min)

1. Open https://play.google.com/console
2. Select Shabd (or create the app if first time — pkg name `in.shabd.game`)
3. **Testing → Internal testing → Create new release**
4. **Upload AAB** — drag the file from step 1
5. **Release name:** `1.0.0-internal.<date>` (e.g., `1.0.0-internal.2026-05-15`)
6. **Release notes:** brief — "Initial internal test build"
7. **Save → Review release → Start rollout to Internal testing**

### Step 4: Add testers (~10 min, first time only)

1. Internal testing → **Testers** tab
2. Create email list "Shabd internal testers"
3. Add 12-16 emails (your account + colleagues + recruited testers)
4. **Copy opt-in URL** — share with testers; they click → opt in → install via Play Store

Wait 14 continuous days from when the testers opt in (Play Console requirement before production access is granted). During this period, push patches to the same internal track.

### Step 5: Promote to production (~30 min, after 14 days)

When ready:
1. Internal testing → release → **Promote release → Production**
2. Choose countries: India only at first (per docs/play-console-listing.md)
3. Fill out:
   - Store listing (paste from `docs/play-console-listing.md`)
   - Data Safety form (answers in same doc)
   - Content Rating questionnaire (answers in same doc)
   - App Content questions (target age, ads, government use)
4. Submit for review

Initial review takes 1-7 days. After approval, the app is live on Play Store in India.

---

## What to monitor in the first 48 hours after launch

- **Crash-free sessions** in Play Console → Vitals (target ≥99%)
- **ANR rate** in Play Console → Vitals (target ≤0.5%)
- **Install rate** vs unique store visitors (Play Console → Store performance)
- **Rating velocity** (Play Console → Ratings) — first 10 ratings determine algorithmic visibility
- **Crashlytics** in Firebase console for stack traces
- **Firebase Analytics** events:
  - `daily_puzzle_attempt` count
  - `share_tapped` count (target ≥10% of solved daily attempts)
  - `language_mode_selected` distribution (validates Phase 0.1 desk research conclusion)

---

## Troubleshooting

### CI build fails with "Godot export templates not found"
The workflow caches templates per Godot version. Clear the cache (Actions → Caches → delete `godot-4.5-stable`) and re-run.

### Test Lab fails "Failed to install APK"
Usually a missing permission in AndroidManifest. Check `export_presets.cfg` has `permissions/internet=true`.

### Play Console rejects "Data Safety form mismatch"
The form must match what the SDKs in your AAB actually do. Re-read `docs/play-console-listing.md` § Data Safety, ensure every "YES" matches a real SDK in your build.

### "Upload key signature mismatch"
Either the keystore in CI doesn't match what Play Console expects, or you're using a different keystore than the original upload. Use the `shabd-upload.keystore` from step 1.3, never generate a new one for an existing app.

---

## Updates

For v1.0.x patches:
1. Bump `version/code` in `export_presets.cfg` (must increment for each upload)
2. Bump `version/name` in `export_presets.cfg`
3. Push → AAB rebuilds → upload to same internal track → 14 days for first time only; subsequent updates can promote in <24 hr

For v1.1+ (e.g., adding IAP, Diwali theme):
- See internal planning notes (Appendix B) for the deferred-features list
- IAP requires LLP/OPC entity registration — see `feedback_india_solo_dev_compliance.md` (cross-cutting memory)
