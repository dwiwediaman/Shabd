# Shabd — Daily Hindi/English Word Puzzle

Daily word puzzle for Android Play Store. Hindi (Devanagari + Hinglish) + English from v1.0.

**Status:** Phase 0 (pre-dev validation). No production code yet.

**Dev environment: cloud-first. Zero local installs.** GitHub Codespaces (Godot in browser via noVNC) + GitHub Actions (Android AAB builds) + Firebase Test Lab (real-device testing). See [docs/cloud-dev-setup.md](docs/cloud-dev-setup.md).

**Quick start:** open this repo on github.com → green "Code" button → "Codespaces" → "Create codespace on main". First build takes ~5–8 min; subsequent opens are <30 s.

## Phase 0 (current)

Six validation artifacts must be produced in [research/](research/) before any production code starts. Each has a hard decision-gate:

| # | Artifact | Decision gate |
|---|---|---|
| 0.1 | `hinglish_preference_survey.md` | If Hinglish-only ≥75% → ship Hinglish-first; if Devanagari ≥50% → ship both |
| 0.2 | `hindi_akshara_spec.md` | Akshara segmentation rules + native-speaker concordance on 30 sample words |
| 0.3 | `godot_poc_findings.md` | Godot 4.5 conjunct rendering + plugin co-existence + Google Sign-In round-trip on 3 device tiers |
| 0.4 | `word_db_sourcing.md` | TDIL CDK (Hindi) + TWL06 (English) license confirmation |
| 0.5 | `word_pool_feasibility.md` | If common 4-akshara pool <1500 → pivot to variable 4-5 grid |
| 0.6 | `hinglish_input_speed_benchmark.md` | If Hinglish median >8s/akshara → defer Hinglish to v1.1 |

**Phase 0 budget:** 4–5 weeks. No production code starts until all six artifacts are written and gates pass.

## Engine + Stack

- **Engine:** Godot 4.5
- **Identity:** Google Sign-In via Firebase Auth (deferred prompt after first 7-day streak)
- **Cloud:** Firebase Firestore (streak/state) + Cloud Functions (server-time verification)
- **Ads:** AdMob + AppLovin MAX mediation, rewarded only at v1.0
- **Analytics:** Firebase Analytics + Crashlytics + Remote Config
- **CI:** GitHub Actions, Godot headless GUT runner

## Folder layout

```
shabd/
├── research/               Phase 0 outputs (this is what's active right now)
├── scenes/                 Godot scenes (created in Month 1)
├── scripts/                GDScript modules
│   ├── autoload/           game_state, word_db, seed_engine, ads_manager, cloud_save
│   └── mechanics/          puzzle_mechanic interface + wordle_mechanic implementation
├── data/                   words.sqlite, hinglish_canonical.json, localization
├── assets/                 fonts, audio, themes, icons
├── android/build/          Android export config
└── .github/workflows/      CI
```

## Costs

- **Required upfront:** $25 (Play Store account). Everything else free-tier.
- **Year-1 expected spend:** ~$25.
- **Recurring infra at indie scale:** $0/month up to ~50K MAU.
