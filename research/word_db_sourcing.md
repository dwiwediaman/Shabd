# Phase 0.4 — Word DB Sourcing Decision

**Status:** Draft (desk research). Final license confirmation pending download + verification of TDIL CDK access.

**Last updated:** 2026-04-30

---

## Decision

**Hindi:**
- **Primary:** TDIL Common Data Kit (CDK), Government of India (Technology Development for Indian Languages)
- **Secondary supplement:** Manual curation from Hindi Wikipedia article-frequency rankings + HindiCorp common-word lists
- **REJECTED:** Hindi Wiktionary

**English:**
- **Primary:** ENABLE / TWL06 / Collins Scrabble Words (any of these is fine)
- **Reference benchmark:** Wordle's published answer pool (~2,309 common 5-letter words) and guess pool (~12,953 valid 5-letter words)

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

## Why TDIL CDK works

The Technology Development for Indian Languages (TDIL) initiative under MeitY (Ministry of Electronics and IT, Govt of India) publishes the **Common Data Kit (CDK)** through the TDIL Data Centre.

**Licensing:** TDIL data products are released under permissive licenses suitable for commercial use. Specifically:
- Most CDK datasets are tagged "for research, development, and commercial use" with citation/attribution
- No ShareAlike contamination — derivative works can be proprietary
- Indian developers have additional governance clarity since TDIL is a domestic source

**[VERIFY BEFORE EMBEDDING]** Confirm exact license text on the specific corpus file downloaded. TDIL has multiple datasets; license text varies by package.

**Access:** https://tdil-dc.in/ — registration may be required. Govt portal occasionally has uptime issues.

**What we need from CDK:**
- Hindi monolingual corpus (raw text)
- Frequency-ranked word list (or we build it from the corpus)
- ~50K+ unique Hindi words minimum (we filter down to 2K daily-pool + 8K guess-pool)

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

## Curation plan

### Hindi (35 hrs total)

| Phase | Effort | Output |
|---|---|---|
| Acquire TDIL CDK + Wikipedia article-freq corpus | 2 hrs | Raw text corpus, ~10M tokens |
| Tokenize + akshara-segment + frequency-rank | 4 hrs (Python script) | Frequency-ranked list, top 50K |
| Filter to 4-akshara (or 5 per Phase 0.5) | 2 hrs | Candidate pool, ~5K–8K |
| Tier-tag (`common`/`mid`/`challenge`) | 3 hrs | Tagged candidate pool |
| Profanity + sensitivity filter | 4 hrs | Cleaned candidate pool |
| Manual spot-check on tier-1 (top 1000) | 10 hrs | Reviewed daily-pool tier 1 |
| Native-speaker QA on tier-1 | 10 hrs | Final daily-pool tier 1 (1000 words) |

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

- [ ] Verify TDIL CDK exact license text on the specific corpus we download
- [ ] Decide if Hindi Wikipedia article-frequency corpus alone is sufficient (skip TDIL if access is friction)
- [ ] Confirm Google Books Ngram English data is freely usable for commercial frequency tiering (it is, per Google's terms — verify)
- [ ] Choose profanity wordlist source for Hindi (LDNOOBW has limited Hindi coverage; may need manual list)
