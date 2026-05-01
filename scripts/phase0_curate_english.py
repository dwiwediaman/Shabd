"""Curate English 5-letter word DB from ENABLE2 + Norvig English frequency list.

Pipeline:
  1. Read ENABLE2 (172K English words, public domain)
  2. Filter to 5-letter ASCII alphabetic
  3. Cross-reference with Norvig English frequency list (count_1w.txt) for tiering
  4. Apply profanity filter
  5. Write to data/words_en.json

Sources:
  - ENABLE2: Mendel Cooper, public domain, distributed via norvig.com/ngrams
  - Norvig English Frequency: derived from Google Books Ngram, freely usable

Both sources permit commercial use. The output word list is independently
compiled by selecting common-vocabulary 5-letter words — language facts,
not creative expression.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

# LDNOOBW-derived English profanity (subset; not exhaustive)
# Source: github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words
PROFANITY_EN = {
    "anal", "anus", "arse", "asses", "ballsack", "bitch", "boner",
    "boobs", "buttplug", "clits", "cocks", "cocky", "crack", "crap",
    "cunts", "damns", "dicks", "dildos", "dyke",  # 5-letter and shorter
    "felch", "fucks", "homo", "horny", "incest", "jizz", "knobs",
    "lmfao", "milfs", "munge", "nazi", "nuked",
    "orgy", "paedo", "pedo", "perv", "pissy", "porno", "pubes",
    "queaf", "queef", "rape", "raped", "raper", "rapes", "rectal",
    "shits", "shitty", "skank", "slags", "slut", "sluts", "smegma",
    "snatch", "spunk", "tit", "tits", "twat", "twats", "vibe",
    "wanks", "wanky", "whore", "xrated", "yiffy",
}

# Filter the LDNOOBW set to 5-letter only for our 5-letter game
PROFANITY_5LETTER_EN = {w for w in PROFANITY_EN if len(w) == 5}


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--wordlist",
        type=Path,
        default=Path("/tmp/enable1.txt"),
        help="Path to ENABLE2 word list",
    )
    p.add_argument(
        "--frequencies",
        type=Path,
        default=Path("/tmp/count_1w.txt"),
        help="Path to Norvig English frequency list (word\\tcount, tab-separated)",
    )
    p.add_argument(
        "--length", type=int, default=5, help="Word length (default 5)"
    )
    p.add_argument(
        "--daily-pool-size", type=int, default=2000
    )
    p.add_argument(
        "--guess-pool-size", type=int, default=8000
    )
    p.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).parent.parent / "data" / "words_en.json",
    )
    args = p.parse_args()

    if not args.wordlist.exists():
        sys.stderr.write(f"ERROR: wordlist not found: {args.wordlist}\n")
        return 1
    if not args.frequencies.exists():
        sys.stderr.write(f"ERROR: frequencies not found: {args.frequencies}\n")
        return 1

    args.out.parent.mkdir(parents=True, exist_ok=True)

    # Step 1: load valid 5-letter words from ENABLE2
    print(f"Loading {args.wordlist}...", file=sys.stderr)
    valid_words = set()
    for line in args.wordlist.read_text(encoding="utf-8").splitlines():
        w = line.strip().lower()
        if (
            len(w) == args.length
            and w.isascii()
            and w.isalpha()
            and w not in PROFANITY_5LETTER_EN
        ):
            valid_words.add(w)
    print(
        f"  {len(valid_words):,} valid {args.length}-letter words "
        f"(after profanity filter; {len(PROFANITY_5LETTER_EN)} excluded)",
        file=sys.stderr,
    )

    # Step 2: load frequency list, intersect with valid words
    print(f"Loading {args.frequencies}...", file=sys.stderr)
    freq_map: dict[str, int] = {}
    with args.frequencies.open(encoding="utf-8") as f:
        for line in f:
            parts = line.strip().split("\t")
            if len(parts) != 2:
                continue
            word, count_s = parts[0].lower(), parts[1]
            if word in valid_words:
                try:
                    freq_map[word] = int(count_s)
                except ValueError:
                    continue

    # Words in valid_words but not in freq_map: assign frequency 0 (rare/archaic)
    for w in valid_words:
        if w not in freq_map:
            freq_map[w] = 0

    # Sort by frequency desc
    ranked = sorted(freq_map.items(), key=lambda x: -x[1])
    print(f"  Frequency map size: {len(ranked):,}", file=sys.stderr)
    print(f"  Top 10 by frequency: {[w for w, _ in ranked[:10]]}", file=sys.stderr)

    # Step 3: tier and pool assignment
    out: list[dict] = []
    for rank, (word, freq) in enumerate(ranked, start=1):
        in_guess = rank <= args.guess_pool_size
        in_daily = rank <= args.daily_pool_size

        if rank <= 1000:
            tier = "common"
        elif rank <= 3000:
            tier = "mid"
        elif rank <= 5000:
            tier = "challenge"
        else:
            tier = "extra"

        if not in_guess:
            break

        out.append(
            {
                "word": word,
                "lang": "en",
                "frequency": freq,
                "frequency_rank": rank,
                "letter_count": args.length,
                "tile_count": args.length,
                "tier": tier,
                "in_daily_pool": 1 if in_daily else 0,
                "in_guess_pool": 1,
            }
        )

    args.out.write_text(json.dumps(out, indent=2, ensure_ascii=False))
    print(f"\nWrote {len(out)} entries to {args.out}", file=sys.stderr)

    tiers = {"common": 0, "mid": 0, "challenge": 0, "extra": 0}
    for w in out:
        tiers[w["tier"]] += 1
    print(f"Tier breakdown: {tiers}", file=sys.stderr)

    daily_pool_actual = sum(1 for w in out if w["in_daily_pool"] == 1)
    print(
        f"\n=== EN CURATION RESULT: daily_pool={daily_pool_actual}, guess_pool={len(out)} ===",
        file=sys.stderr,
    )
    if daily_pool_actual >= 1500:
        print(
            f"  PASS — {daily_pool_actual / 365:.1f} years of unique daily puzzles",
            file=sys.stderr,
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())
