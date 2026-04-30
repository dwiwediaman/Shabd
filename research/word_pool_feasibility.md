# Phase 0.5 — Word-Pool Frequency-Distribution Check

**Status:** Script ready. Awaiting TDIL CDK + Hindi Wikipedia corpus download.

---

## Goal

Verify that the **4-akshara default grid** has enough common-vocabulary words to support 5+ years of unique daily puzzles (≥1500 daily-pool words).

If not, we adapt: variable 4–5 akshara grid OR pivot to 5-akshara if its pool is more common-skewed.

---

## Decision gates

| Outcome | Decision |
|---|---|
| 4-akshara common pool ≥ 1500 | Ship 4-akshara default. Done. |
| 4-akshara <1500 BUT 5-akshara ≥1500 | Ship 5-akshara default (re-verify mass-adoption fit) |
| Both <1500 | Variable 4–5 akshara. Grid is fixed at 5 columns; 4-akshara days blank one tile. Cross-day comparability preserved by absolute puzzle index. |
| Both <800 | DOA — Hindi vernacular concept is too constrained. Pivot to English-only at v1.0; Hindi shifts to v1.2+ as add-on. |

---

## Method

1. Fetch Hindi corpus (TDIL CDK monolingual + Hindi Wikipedia article dumps)
2. Tokenize, filter to alphabetic Devanagari tokens only
3. Count token frequency
4. Segment each unique token into aksharas (using the regex `\X` extended grapheme cluster method documented in Phase 0.2)
5. Group by akshara_count
6. For 4-akshara group:
   - Take top 5000 by frequency
   - Remove proper nouns (heuristic: tokens that appear sentence-initially with high ratio)
   - Remove profanity / sensitive vocabulary
   - Output: cleaned 4-akshara common-pool count
7. Repeat for 5-akshara

The script `scripts/phase0_corpus_analysis.py` does steps 2–7 automatically once the corpus is fetched.

---

## Frequency tier thresholds (target)

After cleaning the 4-akshara pool:

| Tier | Definition | Target count | Used for |
|---|---|---|---|
| common | Top 1000 by frequency | 1000 | 70% of daily-puzzle distribution |
| mid | Frequency rank 1001–3000 | 2000 | 20% of daily distribution |
| challenge | Frequency rank 3001–5000 | 2000 | 10% of daily distribution |

Daily-pool runway = 5000 unique words / 365 days = 13.7 years. Comfortable margin even with deduplication.

---

## Profanity + sensitivity filter

- Use community-maintained Hindi profanity list (LDNOOBW Hindi extension if available; otherwise manual curate ~200 terms)
- Religious-sensitivity filter: exclude words tied to specific faiths' deities/scriptures (avoid offending segments of users)
- Politically-sensitive filter: exclude active-political-figure names and recent controversial terms
- Caste-related slurs: hard exclude

---

## Output (to fill in after script runs)

**Corpus used:** TBD (TDIL CDK file name + Wikipedia dump date)
**Total tokens:** TBD
**Unique alphabetic Devanagari tokens:** TBD
**Akshara-count distribution:**

| Akshara count | Unique tokens | % of unique | Tokens in top 5000 by freq |
|---|---|---|---|
| 1 | TBD | TBD | TBD |
| 2 | TBD | TBD | TBD |
| 3 | TBD | TBD | TBD |
| 4 | TBD | TBD | TBD |
| 5 | TBD | TBD | TBD |
| 6+ | TBD | TBD | TBD |

**4-akshara pool after cleaning:** TBD
**5-akshara pool after cleaning:** TBD

**Decision:** TBD (per gate rules above)

**Notes:** TBD
