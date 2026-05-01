"""Curate Hindi word DB from frequency-ranked candidates.

Pipeline:
  1. Read raw_frequencies.csv (output of phase0_stream_corpus.py)
  2. Filter to 4-akshara only
  3. Apply profanity + sensitivity + proper-noun heuristic filters
  4. Tier-tag (common/mid/challenge) by frequency rank
  5. Write to data/words_hi.json (intermediate; merged into words.sqlite later)

Per Phase 0.4 sourcing strategy: this is the FINAL CURATION step.
The output word list is an independent compilation, not a derivative.
Provenance: documented in data/words_provenance.md.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

import regex


# Profanity + caste/communal slur list (manual curation; native-speaker review needed before launch).
# This is a starter list — not exhaustive. LDNOOBW Hindi coverage is sparse.
PROFANITY_HI = {
    "बहनचोद", "मादरचोद", "चूतिया", "गांडू", "रंडी", "साला", "हरामी",
    "कुत्ता", "कमीना",  # contextual; safer to exclude
    "भोसडी", "लौड़ा",
}

# Religious/political/sensitive vocabulary — excluded to avoid offending segments
# of the audience. Per Gemini surrogate review (2026-05-01), 3/30 sample words
# flagged for this category. Pattern: deity names, political-ideology terms.
SENSITIVE_HI = {
    "परमेश्वर", "ईश्वर", "भगवान", "अल्लाह", "ब्रह्म",  # deity references
    "राजनीति", "राजनीतिक", "सरकार", "मोदी", "गांधी", "नेहरू",  # politicians/political
    "हिन्दू", "मुस्लिम", "सिख", "ईसाई", "जैन", "बौद्ध",  # religion identifiers
    "पाकिस्तान", "बांग्लादेश", "चीन",  # geopolitically sensitive
    "मुहम्मद", "क्राइस्ट", "जीसस", "बुद्ध", "महावीर",  # religious figures
}

# Proper-noun heuristic: words that primarily appear capitalized or sentence-initial
# in Wikipedia tend to be proper nouns. Devanagari has no case, but proper nouns are
# detectable by exclusivity in titles and place-names. We use a conservative starter
# list of common proper-noun stems; native-speaker QA refines this.
PROPER_NOUNS_HI = {
    "मुंबई", "दिल्ली", "कोलकाता", "चेन्नई", "बंगलौर", "हैदराबाद", "अहमदाबाद",
    "जयपुर", "लखनऊ", "कानपुर", "नागपुर", "इंदौर", "भोपाल", "पटना", "रायपुर",
    "भारतीय", "हिमालय", "गंगा", "यमुना",
    "विकिपीडिया", "गूगल", "फेसबुक", "व्हाट्सएप",
    "महाभारत", "रामायण",  # also religious-sensitive
}

# Combined exclusion set
EXCLUDED = PROFANITY_HI | SENSITIVE_HI | PROPER_NOUNS_HI


def aksharas(word: str) -> list[str]:
    return regex.findall(r"\X", word)


def akshara_count(word: str) -> int:
    return len(aksharas(word))


def is_excluded(word: str) -> tuple[bool, str]:
    """Return (should_exclude, reason). Returns (False, '') if word is OK."""
    if word in PROFANITY_HI:
        return True, "profanity"
    if word in SENSITIVE_HI:
        return True, "sensitive"
    if word in PROPER_NOUNS_HI:
        return True, "proper-noun"
    # Heuristic: exclude any word that looks like a year or numeric (pure digits in DN)
    if regex.match(r"^[०-९]+$", word):
        return True, "numeric"
    return False, ""


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--corpus",
        type=Path,
        default=Path(__file__).parent.parent
        / "research"
        / "word_pool_feasibility_data"
        / "raw_frequencies.csv",
    )
    p.add_argument("--akshara", type=int, default=4)
    p.add_argument(
        "--daily-pool-size",
        type=int,
        default=2000,
        help="Top-N most-frequent (after filtering) for the daily puzzle pool",
    )
    p.add_argument(
        "--guess-pool-size",
        type=int,
        default=8000,
        help="Top-N most-frequent for the valid-guess pool (superset of daily pool)",
    )
    p.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).parent.parent / "data" / "words_hi.json",
    )
    args = p.parse_args()

    if not args.corpus.exists():
        sys.stderr.write(
            f"ERROR: corpus not found: {args.corpus}\n"
            "Run scripts/phase0_stream_corpus.py first.\n"
        )
        return 1

    args.out.parent.mkdir(parents=True, exist_ok=True)

    # Load raw frequencies
    print(f"Loading {args.corpus}...", file=sys.stderr)
    candidates: list[tuple[str, int]] = []
    excluded_log: list[dict] = []
    with args.corpus.open(encoding="utf-8") as f:
        for row in csv.reader(f):
            if len(row) < 2:
                continue
            word, freq_s = row[0].strip(), row[1].strip()
            try:
                freq = int(freq_s)
            except ValueError:
                continue

            if akshara_count(word) != args.akshara:
                continue

            excluded, reason = is_excluded(word)
            if excluded:
                excluded_log.append(
                    {"word": word, "frequency": freq, "reason": reason}
                )
                continue

            candidates.append((word, freq))

    candidates.sort(key=lambda x: -x[1])
    print(
        f"  {args.akshara}-akshara candidates after filter: {len(candidates)}",
        file=sys.stderr,
    )
    print(f"  Excluded by filter: {len(excluded_log)}", file=sys.stderr)

    # Tier and pool assignment
    out: list[dict] = []
    for rank, (word, freq) in enumerate(candidates, start=1):
        in_guess = rank <= args.guess_pool_size
        in_daily = rank <= args.daily_pool_size

        if rank <= 1000:
            tier = "common"
        elif rank <= 3000:
            tier = "mid"
        elif rank <= 5000:
            tier = "challenge"
        else:
            tier = "extra"  # in guess pool but not daily

        if not in_guess:
            break

        out.append(
            {
                "word": word,
                "lang": "hi",
                "frequency": freq,
                "frequency_rank": rank,
                "akshara_count": args.akshara,
                "tile_count": args.akshara,
                "tier": tier,
                "in_daily_pool": 1 if in_daily else 0,
                "in_guess_pool": 1,
            }
        )

    args.out.write_text(json.dumps(out, indent=2, ensure_ascii=False))
    print(
        f"\nWrote {len(out)} entries to {args.out}",
        file=sys.stderr,
    )

    # Tier breakdown
    tiers = {"common": 0, "mid": 0, "challenge": 0, "extra": 0}
    for w in out:
        tiers[w["tier"]] += 1
    print(f"Tier breakdown: {tiers}", file=sys.stderr)

    # Excluded log (for transparency)
    excl_log_path = args.out.parent / "words_hi_excluded.json"
    excl_log_path.write_text(json.dumps(excluded_log, indent=2, ensure_ascii=False))
    print(f"Excluded log: {excl_log_path}", file=sys.stderr)

    # Decision summary
    daily_pool_actual = sum(1 for w in out if w["in_daily_pool"] == 1)
    print(
        f"\n=== CURATION RESULT: daily_pool={daily_pool_actual}, guess_pool={len(out)} ===",
        file=sys.stderr,
    )
    if daily_pool_actual >= 1500:
        print(
            f"  PASS — {daily_pool_actual / 365:.1f} years of unique daily puzzles",
            file=sys.stderr,
        )
    else:
        print(
            "  WARN — daily pool below 4-year runway; relax filter or expand corpus",
            file=sys.stderr,
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())
