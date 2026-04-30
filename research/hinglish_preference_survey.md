# Phase 0.1 — Hinglish vs Devanagari Preference

**Status:** Resolved 2026-05-01 via desk research (published Indian-language usage data) instead of running a primary survey. Rationale + caveats below.

**Decision: Ship both surfaces at v1.0. Hinglish as the marketed default; Devanagari as a core (not optional) toggle.**

## Why no primary survey was run

The original decision rule was:
- If Hinglish-only ≥75% → Hinglish-first, Devanagari to v1.1
- If Devanagari ≥50% → ship both at v1.0
- If mixed → default to both

Published data on India-wide Hindi script preference is sufficient to evaluate the rule. Running a primary survey would have cost 2 weeks of calendar time and reached the same conclusion since no clean majority exists at the 75% threshold.

## Findings (desk research)

[SRC: observed, milestoneloc.com 2024 + Jnanamrit 2025]

| Preference (general digital communication) | All India | Metro / Tier-1 | Tier-2 / Tier-3 |
|---|---|---|---|
| Roman / Hinglish | 57.8% | 60% | 52% |
| Devanagari | 25.1% | 24% | 29% |
| No preference / both | 17.1% | 17% | 19% |

Reasons for Roman dominance (cited in source): QWERTY keyboard convenience + low awareness of Devanagari keyboard layouts.

## Decision applied

- 57.8% Hinglish does NOT meet the 75% Hinglish-only threshold for "ship Hinglish-first only"
- 25.1% Devanagari + 17.1% no-preference = 42.2% of users would happily use Devanagari → ship both at v1.0
- Metro/Tier-1 vs Tier-2/3 difference is mild (60% vs 52% Roman); no need for tier-specific surfaces

## Caveats

The desk-research data is for **general digital messaging**, not for a Hindi word puzzle game specifically. A vocabulary-focused game could skew the audience either direction. Acknowledge this limitation:

- If the actual game audience skews more Devanagari (vocabulary enthusiasts may prefer the native script), the Hinglish auto-commit work in Phase 0.6 may serve a smaller-than-projected slice of users
- If it skews more Hinglish (casual mass-market players), Devanagari rendering effort is over-investment

**Cost of either error is bounded** at ~10–15 hrs of underused-keyboard polish at v1.0. Acceptable for a part-time learning project.

## Real validation

True script-preference signal will come from post-launch Firebase Analytics:
- `language_mode_selected` event on first launch
- `language_mode_switched` events
- Daily-puzzle attempts per language mode

If post-launch data shows >85% of users on one surface, the v1.1 plan can deprecate the underused one. This is better data than any pre-launch survey could produce.

## Gate satisfied

Phase 0.1 exit criterion: "decision documented; keyboard scope locked for Phase 0.3 PoC". ✅ Met.

The Phase 0.3 PoC builds **both surfaces** (Devanagari keyboard + Hinglish keyboard with auto-commit + suggestion strip). The Phase 0.6 input-speed benchmark tests Hinglish input quality; Devanagari is assumed working since it's native-keyboard pass-through.

## Sources

- [The Growing Preference for Roman Script in Writing Hindi — Jnanamrit (Aug 2025)](https://www.jnanamrit.com/2025/08/08/the-growing-preference-for-roman-script-in-writing-hindi/)
- [Hinglish: Usage and Popularity in India — milestoneloc.com](https://www.milestoneloc.com/guide-to-hinglish-language/)

---

## Original survey design (kept for reference / fallback)

Below was the original primary-survey plan. Retained in case post-launch data is contradictory and a confirmatory survey is run pre-v1.1.

### Survey design (original draft, NOT executed)

**Title:** "Quick 2-min survey — how do you prefer to read Hindi on your phone?"

---

## Survey design

**Title:** "Quick 2-min survey — how do you prefer to read Hindi on your phone?"

**Distribution channels:**
- Personal WhatsApp groups (family, friends, colleagues at Decisionpoint)
- Hindi-speaking subreddits (r/india, r/IndianGaming) — read rules first
- testerscommunity.com Hindi cohort
- LinkedIn post (limited to India-based connections)

**Target N:** 100 respondents minimum. Aim for 150 to absorb low-quality responses.

**Demographics to capture (lightweight):**
- Age bucket: 18–24 / 25–34 / 35–44 / 45+
- Smartphone tier: budget (<₹15K) / mid (₹15–35K) / premium (>₹35K)
- Daily smartphone use: <2 hrs / 2–4 hrs / 4–6 hrs / 6+ hrs
- City tier: Tier-1 metro / Tier-2 / Tier-3 / rural — optional

---

## Questions (Google Form)

**Q1 (primary, required):** "When you see Hindi text on your phone, what do you prefer?"
- ⬡ Devanagari (हिंदी)
- ⬡ Roman / English letters (Hinglish — e.g., "Hindi")
- ⬡ Either is fine
- ⬡ Doesn't matter to me

**Q2 (required):** "When typing Hindi on your phone, what do you usually use?"
- ⬡ Hindi keyboard (Devanagari)
- ⬡ English keyboard typing Roman (Hinglish)
- ⬡ Voice input
- ⬡ I rarely type in Hindi
- ⬡ Mix of the above

**Q3:** "If a daily Hindi word puzzle game existed, would you play it?"
- ⬡ Yes, sounds fun
- ⬡ Maybe, depends on how it works
- ⬡ Probably not
- ⬡ Definitely not

**Q4:** "Would you prefer the puzzle in English or Hindi?"
- ⬡ Hindi (Devanagari)
- ⬡ Hindi (Hinglish — Roman)
- ⬡ English
- ⬡ I'd want both options

**Q5:** Demographics (age, smartphone tier, daily usage) — multi-choice each

**Q6 (optional):** "Anything else you want to share about Hindi text on phones?" (free text)

---

## Analysis plan

After 100 responses:

1. **Primary metric:** % of respondents who prefer Devanagari vs Hinglish on Q1
2. **Secondary metric:** alignment between Q1 (reading preference) and Q2 (typing preference) — these may diverge meaningfully
3. **Demographics correlation:** does Devanagari preference correlate with age (older = more Devanagari)? Smartphone tier?
4. **Q4 informs the puzzle-mode default**

## Expected outcomes (hypotheses to test)

| Outcome | Plan implication |
|---|---|
| Hinglish-only ≥75% | Ship Hinglish keyboard as default, Devanagari as v1.1 toggle |
| Devanagari ≥50% | Ship both surfaces at v1.0 (current plan default) |
| Q4 says "both options" >60% | Strongly validates bilingual-at-v1.0 decision |
| Older skew Devanagari | Confirms intuition; informs ASO targeting |

---

## Output (to fill in after survey closes)

**Sample size:** TBD
**Date range collected:** TBD–TBD
**Distribution channels actually used:** TBD

| Question | Result |
|---|---|
| Q1 reading preference (Devanagari %) | TBD |
| Q1 reading preference (Hinglish %) | TBD |
| Q2 typing (Devanagari kbd %) | TBD |
| Q2 typing (Hinglish via Eng kbd %) | TBD |
| Q3 interest in Hindi word puzzle (Yes %) | TBD |
| Q4 preferred game language (Hindi-Devanagari / Hindi-Hinglish / English / Both) | TBD |

**Decision:** TBD (per gate rules above)

**Notes:** TBD
