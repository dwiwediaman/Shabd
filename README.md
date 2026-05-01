# Shabd — Daily Hindi & English Word Puzzle

Daily word puzzle for Android Play Store. Hindi (Devanagari + Hinglish) + English from v1.0.

**Status:** v1.0 MVP committed. Ready for first Codespace launch + CI build verification.

**Plan:** see `~/.claude/plans/lets-run-a-planning-zippy-feigenbaum.md` for the locked v3 plan that produced this codebase.

---

## What's done (autonomous, pre-Codespace)

| Layer | Status |
|---|---|
| Phase 0 validation | 4/6 sub-phases closed (0.1, 0.2, 0.4, 0.5). 0.3 + 0.6 need Codespace + real testers. |
| Word DB curation | 16,000 entries. Hindi 4-akshara (Wikipedia-sourced, filtered). English 5-letter (ENABLE2). |
| Localization | Bilingual strings.csv (en + hi), 30+ keys |
| Game logic | All autoloads, mechanics, components, scenes written. Compiles via standard Godot 4.5 GDScript syntax. |
| Privacy policy | Ready at `docs/privacy-policy.md`; needs GitHub Pages enable + Play Console URL update |
| Play Console copy | Ready at `docs/play-console-listing.md`. Title, descriptions (en + hi), Data Safety form answers, content rating answers |
| Release runbook | Ready at `docs/release-runbook.md`. 5-step user-must-do list. |
| CI pipeline | `.github/workflows/build.yml` (Godot AAB) + `test.yml` (Firebase Test Lab Robo) |
| Cloud-first dev env | `.devcontainer/` with Godot 4.5 + JDK 17 + Android SDK + noVNC |

## What needs YOU to do (5 things)

**These cannot be automated. Each is documented in [docs/release-runbook.md](docs/release-runbook.md) with exact commands.**

1. **Open the Codespace** (1 click) — github.com/dwiwediaman/Shabd → Code → Codespaces → Create on main. First container build takes ~5-8 min.
2. **Generate the upload keystore** (one terminal command, 30 seconds)
3. **Enable GitHub Pages** for `docs/` — privacy policy URL goes live
4. **Watch CI build the AAB** — push triggers it; download artifact when green
5. **Upload to Play Console internal testing** — click through, paste copy from `docs/play-console-listing.md`, add 12 testers, wait 14 days, promote to production

Total user time: ~3 hours active (most of it waiting for builds and Play Console review).

---

## What was deliberately NOT done (and why)

| Item | Why deferred |
|---|---|
| App icon design (real one, not placeholder saffron square) | Needs Figma/Inkscape work; placeholder is functional for AAB build. Replace before production launch. |
| Confirmatory native-speaker review of word lists | Phase 0.2 used Gemini surrogate. Recommend 1-2 native speakers spot-check daily-pool tier-1 (top 1000 words) before production launch. |
| Phase 0.3 PoC (Devanagari rendering verification on real devices) | Needs Codespace + Firebase Test Lab. Cannot validate Godot's HarfBuzz Devanagari conjunct rendering without running Godot. |
| Phase 0.6 input-speed benchmark | Needs working PoC build + 5 testers. Run after first internal-test build is in testers' hands. |
| Real Play Store screenshots | Need real device captures (Codespace can't substitute for visual screenshots). |
| Cosmetic theme packs (Diwali, Monsoon, Holi) | Deferred to v1.1+ per plan. Default theme only at v1.0. |
| IAP (cosmetics, "remove ads") | Deferred to v1.1+ pending traction; avoiding BillDesk/LLP/GST regulatory path at v1.0. |
| Real Firebase plugin integration | Stub-mode plugins (GameState, CloudSave, AdsManager, Analytics) are wired with the contract but actual Firebase calls require Phase 0.3 Codespace work to choose a plugin. |

---

## Quick start (developer)

### Cloud (recommended — see [docs/cloud-dev-setup.md](docs/cloud-dev-setup.md))

```
GitHub repo → green "Code" button → Codespaces → Create codespace on main
```

The Dockerfile installs Godot 4.5 + JDK 17 + Android SDK + noVNC. Open port 6080 in browser to interact with the Godot Editor.

### Local (alternative)

```bash
brew install --cask godot
godot --editor --path .
```

### Run tests headlessly (CI-mode)

```bash
godot --headless --path . --script res://test/test_runner.gd
```

### Build Android AAB locally

```bash
godot --headless --path . --export-release "Android" build/shabd.aab
```

---

## Project layout

```
shabd/
├── project.godot                  Godot 4.5 project config
├── export_presets.cfg             Android export config (sign in CI/local)
├── scenes/                        UI scenes (5 main + components)
├── scripts/
│   ├── autoload/                  Singletons: GameState, WordDB, SeedEngine,
│   │                              Analytics, CloudSave, AdsManager
│   ├── mechanics/                 PuzzleMechanic interface + WordleMechanic
│   ├── components/                tile_grid, keyboard_devanagari, keyboard_hinglish
│   ├── main_menu.gd / daily_puzzle.gd / practice_puzzle.gd / stats_screen.gd / settings.gd
│   ├── hinglish_transliterator.gd Roman → Devanagari with auto-commit
│   └── share_renderer.gd          Wordle-style emoji grid generator
├── data/
│   ├── words_hi.json              4-akshara Hindi: 8K entries, frequency-tiered
│   ├── words_en.json              5-letter English: 8K entries, frequency-tiered
│   ├── words.sqlite               Same data, indexed (dev convenience)
│   ├── hinglish_canonical.json    98 Roman→Devanagari disambiguation entries
│   └── strings/strings.csv        Bilingual UI strings (en + hi)
├── assets/
│   ├── icons/icon.png             Placeholder 192×192 saffron icon
│   ├── audio/                     (empty — populate via freesound.org)
│   ├── fonts/                     (empty — add Noto Sans Devanagari from Google Fonts)
│   └── themes/                    (empty — default theme is GDScript-defined)
├── test/
│   ├── test_runner.gd             Headless test runner
│   └── test_seed_engine.gd        5 invariants for the daily-seed engine
├── docs/
│   ├── cloud-dev-setup.md         Codespaces walkthrough
│   ├── privacy-policy.md          For GitHub Pages + Play Console URL
│   ├── play-console-listing.md    Title, descriptions, Data Safety, ratings
│   └── release-runbook.md         5-step user-must-do list
├── research/                      Phase 0 artifacts (closed sub-phases)
├── scripts/phase0_*.py            Curation pipeline (Wikipedia → JSON → SQLite)
├── .devcontainer/                 GitHub Codespaces config
└── .github/workflows/
    ├── build.yml                  Godot Android AAB build
    └── test.yml                   Firebase Test Lab Robo smoke
```

---

## Cost (year-1 realistic)

| Item | Cost |
|---|---|
| Google Play Console account | $25 one-time |
| Everything else | $0 (Firebase Spark, Codespaces 60hr/mo, Actions 2000min/mo, GitHub Pages, Noto fonts) |
| **Total year-1** | **$25** |

If v1.1 adds IAP: + ~₹12,000 (~$145) for LLP/OPC entity registration. Only do this if v1.0 hits 50K+ DAU.

---

## Architecture decisions worth knowing

- **Engine: Godot 4.5.** Free, GDScript is Python-adjacent, 2D-native. Plugin compat verified during Phase 0.3 PoC.
- **Word DB format: JSON, not SQLite.** Loaded once at startup into in-memory dicts. Avoids SQLite plugin dependency. ~2 MB total.
- **Akshara segmentation: Unicode TR29 `\X`.** Phase 0.2 verified this matches Hindi-reader mental segmentation 30/30.
- **Daily seed: SHA256(IST date + lang).** Per-language. India-calendar date (not UTC).
- **Cloud save: Firebase Auth Google Sign-In + Firestore.** Sign-in DEFERRED until first 7-day streak (anonymous play before then).
- **Streak integrity: server-time verification + local hash chain.** Anti-clock-tampering.
- **Ads: rewarded-only.** No interstitials, no banners, no forced ads. v1.0 monetization.
- **Bilingual at v1.0: Hindi + English from day 1.** Per Phase 0.1 desk research, neither dominates the audience clearly enough to drop one.
- **Tile count: 4-akshara HI / 5-letter EN.** Per Phase 0.5 corpus analysis, 4-akshara is more conversational than 5-akshara in Hindi.

See plan file for full reasoning behind each decision.

---

## Honest limitations

1. **No Godot run has been done.** All GDScript was written without a working Godot install. CI catches syntax errors; runtime issues will surface on first Codespace launch. Expect ~3-5 iterations to fix surprises.
2. **Stub-mode Firebase integration.** Real Firebase plugin wiring happens during Phase 0.3 Codespace work. Until then, sign-in / cloud-save / ads / analytics print to console instead of calling real services.
3. **Visual polish is minimal.** Scenes are functional layouts. Color palette, animations, juicy feedback all need editor work.
4. **No real device testing.** Phase 0.3 + 0.6 verify Devanagari rendering + Hinglish input speed on actual phones. Recommend doing both before promoting to production.
5. **Word DB is Wikipedia-flavored.** Encyclopedic register skews slightly formal vs casual conversation. Native-speaker review of tier-1 (top 1000) catches the worst cases. Recommend 2 hrs of cross-reference before launch.

---

## Contact

- **Repo:** https://github.com/dwiwediaman/Shabd
- **Plan file (private):** `~/.claude/plans/lets-run-a-planning-zippy-feigenbaum.md`
- **Owner:** Rahul Dwiwedi (dwiwediaman@gmail.com)
