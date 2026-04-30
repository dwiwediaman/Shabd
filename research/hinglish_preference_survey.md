# Phase 0.1 — Hinglish vs Devanagari Preference Survey

**Status:** Template. Survey not yet distributed.

**Decision gate:**
- If Hinglish-only ≥75% of respondents → ship Hinglish-first, Devanagari toggle in v1.1
- If Devanagari ≥50% → ship both surfaces at v1.0
- If split is messy (no clear majority) → default to both surfaces

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
