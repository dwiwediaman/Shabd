# Phase 0.6 — Hinglish Input-Speed Benchmark

**Status:** Awaiting Phase 0.3 PoC completion (this benchmark runs ON the PoC build).

---

## Goal

Measure whether the Hinglish input gesture (auto-commit-on-next-base-consonant + suggestion strip fallback) is fast enough to maintain daily-appointment behavior.

**Threshold:** median time-to-complete-guess in steady state ≤ **8 seconds per akshara**.

If above threshold, the input UX is too slow — daily-appointment behavior collapses, daily share rate drops, retention falls. We then either redesign the input or defer Hinglish to v1.1 (ship Devanagari + English at v1.0).

---

## Method

### Build a benchmark mode in the Phase 0.3 PoC

Add a "Speed test" scene to the throwaway PoC:
- 10 puzzles in sequence, all 4-akshara, common-tier
- Same 10 words for every tester (controlled comparison)
- Each tester uses BOTH Hinglish keyboard AND Devanagari keyboard (within-subject design)
- Order randomized to avoid learning-curve bias on the second mode
- Per-puzzle timer logs:
  - Puzzle start (first key press)
  - Each tile commit (auto-commit fires OR suggestion-strip tap)
  - Guess submit
  - End-of-puzzle (win or 6-guess loss)

### Recruit 5 testers

- 2 Devanagari-fluent + Hinglish-comfortable (control group: shows Devanagari speed baseline)
- 3 Hinglish-only (target group: the harder UX case)

Recruit via personal network. Brief: "Try this puzzle game, give honest feedback on input feel."

### Steady-state measurement window

Discard puzzles 1–3 (learning curve). Use puzzles 4–10 for the median.

Compute:
- Median time-to-complete-guess (first key to submit)
- Median time-per-akshara = (time-to-complete-guess) / 4
- Suggestion-strip tap rate (how often did auto-commit guess wrong?)
- Backspace-akshara rate (how often did the user delete and retry?)

---

## Decision gate

| Median time-per-akshara | Decision |
|---|---|
| ≤ 6 seconds | Excellent. Hinglish UX is competitive. Ship as planned. |
| 6–8 seconds | Acceptable. Document, ship, monitor in closed test (month 5). |
| 8–10 seconds | Marginal. Iterate: improve auto-commit accuracy (bigger canonical map), reduce suggestion-strip taps, retest. |
| > 10 seconds | Hinglish UX is broken. Either redesign (e.g., commit-on-explicit-tap-only, simpler keyboard) or defer to v1.1. |

Suggestion-strip tap rate >30% indicates the canonical mapping table needs more entries (more common ambiguities resolved). Add and retest.

---

## Output (to fill in after benchmark runs)

**Date:** TBD
**PoC version:** TBD (commit hash)
**Tester cohort:**

| Tester | Devanagari-fluent? | Smartphone | Notes |
|---|---|---|---|
| 1 | TBD | TBD | TBD |
| 2 | TBD | TBD | TBD |
| 3 | TBD | TBD | TBD |
| 4 | TBD | TBD | TBD |
| 5 | TBD | TBD | TBD |

**Per-tester results (steady state, puzzles 4–10):**

| Tester | Hinglish median (s/akshara) | Devanagari median (s/akshara) | Suggestion-strip tap rate | Backspace-akshara rate |
|---|---|---|---|---|
| 1 | TBD | TBD | TBD | TBD |
| 2 | TBD | TBD | TBD | TBD |
| 3 | TBD | TBD | TBD | TBD |
| 4 | TBD | TBD | TBD | TBD |
| 5 | TBD | TBD | TBD | TBD |

**Aggregate:**
- Hinglish median across all testers: TBD
- Devanagari median across all testers: TBD
- Hinglish-only testers' median (the harder cohort): TBD

**Qualitative feedback (free text from testers):** TBD

**Decision:** TBD (per gate rules above)
