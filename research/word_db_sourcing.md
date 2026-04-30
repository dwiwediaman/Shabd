# Phase 0.4 — Word DB Sourcing Decision

**Status:** License verification done (web research, 2026-05-01). **Material finding:** the v3 plan's TDIL CDK assumption is incorrect; TDIL resources appear to be research-only. Revised sourcing strategy below.

**Last updated:** 2026-05-01

---

## Decision (revised 2026-05-01)

**Hindi:**
- **Primary approach: Hand-curated word list from native-speaker compilation, cross-referenced against public-domain dictionaries.** A list of common words is a list of FACTS (the words exist in the language); individual common-vocabulary entries are not copyrightable. A compilation with original selection has minimal copyright exposure when (a) the input is multiple sources, (b) the curation involves native-speaker judgment, (c) entries are common vocabulary not unique creative selections.
- **Frequency analysis:** run `scripts/phase0_corpus_analysis.py` on **OSCAR Hindi subset** (CC0 packaging) for *frequency analysis only* — do NOT ship the corpus, only the derived word list. The script's output (frequency-ranked common words) is a derivative work but the word list itself consists of un-copyrightable language facts.
- **Native-speaker QA:** the 10-hour native-speaker review at the daily-pool tier-1 (1000 words) is the tier where compilation-originality is established.
- **REJECTED sources** (with reasons documented below).

**English:**
- **Primary:** ENABLE2 / Collins Scrabble Words. ENABLE2 is public domain; SOWPODS is permissive.
- **Reference benchmark:** Wordle's published answer pool (~2,309 common 5-letter words) and guess pool (~12,953 valid 5-letter words). **Do NOT copy** — use only as a sanity-check on size.

---

## Why Wiktionary is OFF the table

Hindi Wiktionary is licensed under **CC-BY-SA 3.0**. The ShareAlike clause is the killer:

> If you remix, transform, or build upon the material, you must distribute your contributions under the same license as the original.

A curated word database derived from Wiktionary IS a "remix/transform/build upon." Bundling that DB inside an Android APK distributes it. Under CC-BY-SA, the entire derivative product (the DB at minimum, arguably the APK) must be released under CC-BY-SA. This means:

1. Competitors can legally extract `data/words.sqlite` from the published APK on day 1
2. Any cosmetic IAP / premium positioning is undermined because the core data is freely redistributable
3. Source attribution requirements are non-trivial (must credit Wiktionary contributors visibly)

**Verdict:** Do not derive any shipped data from Wiktionary. It can be used as a one-time validation aid in the curation tool (Wiktionary lookups during manual review) but never embedded.

---

## REJECTED sources and why

### TDIL CDK — research-only, NOT commercial **[v3 plan assumption was wrong]**

The Technology Development for Indian Languages (TDIL) initiative under MeitY publishes corpora through tdil-dc.in. **The v3 plan assumed these were commercial-friendly. They are not.**

[SRC: observed, web search 2026-05-01] Hindi corpora on TDIL-DC (Hindi Speech Corpus, Hindi Monolingual Text Corpus ILCI-II, Hindi-Marathi General Text Corpus, etc.) are tagged with license type **"Research"**. Direct fetch of the resource detail pages failed (TLS cert error), but multiple search results confirm the "Research" tag.

Some TDIL resources are also marked **CC BY-SA 2.0** — same ShareAlike contamination problem as Wiktionary.

Verdict: TDIL CDK cannot be used as a derivation source for a commercial-distributed APK. It can only be used if you contact TDIL/MeitY directly to negotiate a commercial license (likely fee, likely months of paperwork).

### Hindi Wiktionary — CC-BY-SA 3.0, ShareAlike contaminates

Already documented in v2: SA clause forces the entire derivative work (the word DB, arguably the APK) to be released under CC-BY-SA. Competitors can legally extract on day 1.

### AI4Bharat IndicNLP Corpus — CC BY-NC-SA 4.0, double blocker

[SRC: observed, web search 2026-05-01 — github.com/AI4Bharat/indicnlp_corpus]
- **NC** (NonCommercial) — explicit prohibition on commercial use. A free game with rewarded ads is commercial.
- **SA** (ShareAlike) — same contamination as Wiktionary.

Double blocker. Can be used for academic research only.

### OSCAR Corpus — CC0 packaging, but underlying text is from Common Crawl

[SRC: observed, web fetch 2026-05-01 — oscar-project.org]
- OSCAR's **packaging and annotations** are CC0 (fully permissive, public-domain dedication).
- The actual **text content** is Common Crawl-derived — original publishers retain their copyrights.
- Inria (the host) restricts non-research use of the corpus under French law (TDM/research exception).

Verdict: OSCAR is OK to use for **frequency analysis** (a transformation that produces statistics, not a copy of the text), but **do NOT ship the corpus or any large extract**. The derived frequency-ranked word list itself is a list of language facts, which is not copyrightable.

This is the practical path: download OSCAR Hindi → run `scripts/phase0_corpus_analysis.py` → keep ONLY the output word list (top 5000 frequency-ranked) → discard the corpus → ship the curated word list inside the APK.

### Common Crawl direct — same as OSCAR underlying

Permissive metadata, but text is publishers' copyright. Same conclusion: frequency analysis OK, shipping text not OK.

---

## English word lists

| List | License | Word count (5-letter subset) | Source |
|---|---|---|---|
| **ENABLE2** | Public domain | ~9,000 | Original Mendel Cooper compilation |
| **TWL06** | Free for use, attribution recommended | ~8,938 | Tournament Word List 2006 (NA Scrabble) |
| **Collins Scrabble Words (CSW)** | Free for non-commercial; commercial use needs license | ~12,500 | Collins/HarperCollins |
| **SOWPODS** | Permissive | ~13,000 | Older international Scrabble word list |
| **Wordle reference** | Not redistributable | answers ~2,309 / guesses ~12,953 | Reference only — do not copy |

**Pick:** ENABLE2 + manual filter. Public domain, widest license clarity, sufficient for 5-letter coverage. Approx 5 hours to filter to common-tier (2K) + valid-guess pool (~9K).

**Avoid:** Collins/CSW for commercial use without license. Wordle's pools are NYT property — never copy them.

---

## Curation plan (revised)

### Hindi (40 hrs total — slightly higher than v3's 35hr after license findings)

| Phase | Effort | Output |
|---|---|---|
| Acquire OSCAR Hindi subset (frequency analysis only, NOT shipped) | 2 hrs | Raw text corpus, local-only |
| Tokenize + akshara-segment + frequency-rank | 4 hrs (script ready) | Frequency-ranked candidate list, top 50K |
| Filter to 4-akshara (or 5 per Phase 0.5) | 2 hrs | Candidate pool, ~5K–8K |
| **Independent compilation: cross-reference top 2000 candidates against** native-speaker recall + freely-distributed Hindi educational word lists (school NCERT lists, common-noun textbook lists) | 6 hrs | Re-validated common-vocab pool, original compilation |
| Tier-tag (`common`/`mid`/`challenge`) by frequency rank | 2 hrs | Tagged candidate pool |
| Profanity + sensitivity filter (LDNOOBW Hindi + manual ~200 terms) | 4 hrs | Cleaned candidate pool |
| Manual spot-check on tier-1 (top 1000) | 10 hrs | Reviewed daily-pool tier 1 |
| Native-speaker QA on tier-1 (3 reviewers) | 10 hrs | Final daily-pool tier 1 (1000 words), with reviewer notes establishing original-compilation provenance |

The "independent compilation" step is the key copyright-clearance work. By cross-referencing OSCAR-derived frequency rankings against multiple independent sources + native-speaker judgment, the final list becomes an original compilation rather than a derivative of any single source. Document the sources consulted in `data/words_provenance.md` (which sources, what was cross-referenced, who the reviewers were).

### English (5 hrs total)

| Phase | Effort | Output |
|---|---|---|
| Download ENABLE2 + filter 5-letter | 0.5 hrs | ~9K candidate pool |
| Frequency-tier using Google Books Ngram (free) | 1 hr | Tagged candidate pool |
| Filter common-tier to ~2300 (Wordle parity) | 2 hrs | Daily-pool tier 1 |
| Profanity filter (LDNOOBW + manual) | 0.5 hrs | Cleaned daily-pool |
| Spot-check (no native-speaker QA needed for English) | 1 hr | Final pool |

---

## Output schema (target for `data/words.sqlite`)

```sql
CREATE TABLE words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL,                     -- Devanagari for hi, lowercase ASCII for en
    lang TEXT NOT NULL CHECK (lang IN ('hi', 'en')),
    akshara_count INTEGER,                  -- nullable for en (use letter_count instead)
    letter_count INTEGER,                   -- raw codepoints; for en this is the tile count
    tile_count INTEGER NOT NULL,            -- 4 or 5; matches grid columns
    frequency_rank INTEGER NOT NULL,        -- 1 = most common in corpus
    tier TEXT NOT NULL CHECK (tier IN ('common', 'mid', 'challenge')),
    in_daily_pool INTEGER NOT NULL DEFAULT 0,   -- 0 or 1
    in_guess_pool INTEGER NOT NULL DEFAULT 1,   -- 0 or 1
    notes TEXT
);

CREATE INDEX idx_words_lang_tile_pool ON words(lang, tile_count, in_daily_pool);
CREATE INDEX idx_words_lang_guess ON words(lang, in_guess_pool);

CREATE TABLE schema_version (version INTEGER NOT NULL);
INSERT INTO schema_version VALUES (1);
```

Daily seed query (per-language):
```sql
SELECT word FROM words
WHERE lang = ? AND in_daily_pool = 1 AND tier = ?
ORDER BY frequency_rank
LIMIT 1 OFFSET ?;  -- offset = seed_int % tier_size
```

Tier weights for daily selection: 70% common, 20% mid, 10% challenge.

---

## Open items

- [x] Verify TDIL CDK license — DONE 2026-05-01. Result: research-only, not usable. Removed from sources.
- [ ] Download OSCAR Hindi 23.01 subset and run `scripts/phase0_corpus_analysis.py` to produce frequency-ranked candidate list. Local-only; do NOT commit the corpus.
- [ ] Compile `data/words_provenance.md` documenting cross-reference sources (NCERT word lists, native-speaker reviewers, OSCAR frequency derivation) — this artifact is the legal-defense record of original compilation
- [ ] Identify 3 native-speaker reviewers (1 Decisionpoint colleague + 2 network) — same set used for Phase 0.2 akshara concordance
- [ ] Confirm Google Books Ngram English data is freely usable for commercial frequency tiering (Google's stated terms: "Permission is granted for using the data in any way, commercial or otherwise, with no requirement to credit Google" — verify by fetching the current terms before using)
- [ ] Decide profanity wordlist for Hindi (LDNOOBW Hindi extension is patchy; supplement with ~200 hand-curated terms reviewed by native speakers)

## Risk assessment

**Legal risk of approach above:** LOW.
- Frequency analysis is a transformation that extracts statistics, not a copy. Statistical results are not copyrightable.
- Common-vocabulary word lists are facts about the language, not creative expression.
- Independent compilation across multiple sources + native-speaker judgment establishes original work.
- 40-hr curation budget includes the legal-clearance steps.

**Residual risk:** if a single very-distinctive entry from any source ends up in our list AND we got that entry only from that source, there's a remote selection-and-arrangement copyright theory. Mitigation: native-speaker review identifies entries as commonly-known vs source-specific.

**Worst-case mitigation:** if someone challenges, we can re-curate the disputed entries from native-speaker recall alone in <2 hrs, since these are common-vocabulary words. Recoverable.
