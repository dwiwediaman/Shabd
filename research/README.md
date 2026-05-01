# Phase 0 — Pre-Dev Validation

Six artifacts must be produced here before any production code starts. Each has a hard decision-gate that determines whether the plan proceeds as-designed or pivots.

## Status

| # | Artifact | Status | Decision |
|---|---|---|---|
| 0.1 | [hinglish_preference_survey.md](hinglish_preference_survey.md) | not started | — |
| 0.2 | [hindi_akshara_spec.md](hindi_akshara_spec.md) | not started | — |
| 0.3 | [godot_poc_findings.md](godot_poc_findings.md) | not started | — |
| 0.4 | [word_db_sourcing.md](word_db_sourcing.md) | not started | — |
| 0.5 | [word_pool_feasibility.md](word_pool_feasibility.md) | not started | — |
| 0.6 | [hinglish_input_speed_benchmark.md](hinglish_input_speed_benchmark.md) | not started | — |

## Suggested order

1. **0.4 first** (1 hour) — confirm word DB licenses; cheap insurance against finding fatal CC-BY-SA contamination late
2. **0.1 in parallel** (1–2 weeks while survey runs) — distribute Google Form, collect 100 responses
3. **0.3 PoC** (3–4 days) — bootstrap Godot 4.5, render Devanagari, smoke-test plugins. This unblocks 0.6.
4. **0.5** (1 day) — corpus analysis on TDIL CDK to verify 4-akshara pool feasibility
5. **0.2** (1 day spec + native-speaker review) — formalize akshara segmentation rules
6. **0.6** (1 day on PoC + 5 testers) — measure Hinglish input speed against 8s/akshara threshold

Phase 0 closes when all six artifacts are written and decision-gates pass.

## Templates

Each artifact starts from a template — see the Phase 0 spec in the project's internal planning notes for what each must contain.
