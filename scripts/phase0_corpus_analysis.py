"""Phase 0.5 — Hindi corpus analysis for word-pool feasibility.

Reads a Hindi corpus (raw text or CSV with `word,frequency`), tokenizes,
akshara-segments via Unicode extended grapheme clusters (\\X regex, the
authoritative Devanagari segmentation), and outputs:

1. Akshara-count distribution histogram
2. Top-N tokens by frequency for each akshara count
3. Filtered candidate pool for the chosen akshara count (default 4)
4. Tier-tagged output (common / mid / challenge) ready to load into words.sqlite

Usage:
    pip install regex
    python phase0_corpus_analysis.py --corpus path/to/corpus.txt --akshara 4
    python phase0_corpus_analysis.py --corpus path/to/freqs.csv --akshara 5 --csv

Output written to research/word_pool_feasibility_data/.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections import Counter
from pathlib import Path

try:
    import regex  # third-party; supports \X
except ImportError:
    sys.stderr.write(
        "ERROR: 'regex' package required.\n  pip install regex\n"
    )
    sys.exit(1)


# Unicode ranges
DEVANAGARI_RANGE = (0x0900, 0x097F)
DEVANAGARI_EXT = (0xA8E0, 0xA8FF)


def is_devanagari_token(token: str) -> bool:
    """Return True if every character is in Devanagari blocks (or ZWJ/ZWNJ)."""
    if not token:
        return False
    for ch in token:
        cp = ord(ch)
        in_main = DEVANAGARI_RANGE[0] <= cp <= DEVANAGARI_RANGE[1]
        in_ext = DEVANAGARI_EXT[0] <= cp <= DEVANAGARI_EXT[1]
        is_joiner = cp in (0x200C, 0x200D)
        if not (in_main or in_ext or is_joiner):
            return False
    return True


def aksharas(word: str) -> list[str]:
    """Segment a Devanagari word into aksharas (extended grapheme clusters).

    \\X is the authoritative Unicode TR29 extended grapheme cluster.
    For Devanagari this matches akshara segmentation in nearly all cases.
    """
    return regex.findall(r"\X", word)


def akshara_count(word: str) -> int:
    return len(aksharas(word))


def load_corpus_text(path: Path) -> Counter[str]:
    """Load raw text corpus, tokenize on whitespace, return frequency Counter."""
    counts: Counter[str] = Counter()
    text = path.read_text(encoding="utf-8")
    # Split on whitespace + punctuation; keep only Devanagari alphabetic tokens
    for raw_token in re.split(r"\s+", text):
        token = raw_token.strip("।.,!?:;\"'()[]{}।॥-—")
        if is_devanagari_token(token):
            counts[token] += 1
    return counts


def load_corpus_csv(path: Path) -> Counter[str]:
    """Load pre-counted frequency CSV: `word,frequency` rows."""
    counts: Counter[str] = Counter()
    with path.open(encoding="utf-8") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 2:
                continue
            word, freq_s = row[0].strip(), row[1].strip()
            if not is_devanagari_token(word):
                continue
            try:
                counts[word] = int(freq_s)
            except ValueError:
                continue
    return counts


def histogram(counts: Counter[str]) -> dict[int, int]:
    """Aksharas-count → number of unique tokens."""
    h: Counter[int] = Counter()
    for word in counts:
        h[akshara_count(word)] += 1
    return dict(sorted(h.items()))


def top_n_by_akshara_count(
    counts: Counter[str], target_aksharas: int, n: int = 10
) -> list[tuple[str, int]]:
    """Return top N most-frequent tokens with the given akshara count."""
    filtered = [
        (word, freq)
        for word, freq in counts.items()
        if akshara_count(word) == target_aksharas
    ]
    filtered.sort(key=lambda x: -x[1])
    return filtered[:n]


def build_tiered_pool(
    counts: Counter[str],
    target_aksharas: int,
    tier_sizes: tuple[int, int, int] = (1000, 2000, 2000),
) -> list[dict]:
    """Build common/mid/challenge tiered pool for the given akshara count."""
    filtered = [
        (word, freq)
        for word, freq in counts.items()
        if akshara_count(word) == target_aksharas
    ]
    filtered.sort(key=lambda x: -x[1])

    common_n, mid_n, challenge_n = tier_sizes
    out = []
    for rank, (word, freq) in enumerate(filtered, start=1):
        if rank <= common_n:
            tier = "common"
        elif rank <= common_n + mid_n:
            tier = "mid"
        elif rank <= common_n + mid_n + challenge_n:
            tier = "challenge"
        else:
            break
        out.append(
            {
                "word": word,
                "frequency": freq,
                "frequency_rank": rank,
                "akshara_count": target_aksharas,
                "tile_count": target_aksharas,
                "tier": tier,
                "lang": "hi",
                "in_daily_pool": 1,
                "in_guess_pool": 1,
            }
        )
    return out


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--corpus", type=Path, required=True, help="Path to corpus file")
    p.add_argument(
        "--csv",
        action="store_true",
        help="Treat corpus as pre-counted CSV (word,frequency)",
    )
    p.add_argument(
        "--akshara",
        type=int,
        default=4,
        help="Target akshara count for daily pool (default 4)",
    )
    p.add_argument(
        "--out-dir",
        type=Path,
        default=Path(__file__).parent.parent
        / "research"
        / "word_pool_feasibility_data",
        help="Output directory",
    )
    args = p.parse_args()

    if not args.corpus.exists():
        sys.stderr.write(f"ERROR: corpus not found: {args.corpus}\n")
        return 1

    args.out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Loading corpus from {args.corpus}...", file=sys.stderr)
    counts = (
        load_corpus_csv(args.corpus) if args.csv else load_corpus_text(args.corpus)
    )
    print(
        f"  {sum(counts.values()):,} total tokens, "
        f"{len(counts):,} unique Devanagari alphabetic tokens",
        file=sys.stderr,
    )

    # Akshara-count histogram
    h = histogram(counts)
    hist_path = args.out_dir / "akshara_count_histogram.json"
    hist_path.write_text(json.dumps(h, indent=2, ensure_ascii=False))
    print(f"  histogram → {hist_path}", file=sys.stderr)
    print("\nAkshara-count distribution (unique tokens):", file=sys.stderr)
    for ac, n in h.items():
        bar = "█" * min(60, n // max(1, max(h.values()) // 60))
        print(f"  {ac:2d} aksharas: {n:7,} {bar}", file=sys.stderr)

    # Top-N samples for visual sanity check
    print(f"\nTop 20 most-frequent {args.akshara}-akshara words:", file=sys.stderr)
    for word, freq in top_n_by_akshara_count(counts, args.akshara, n=20):
        print(f"  {freq:>8,}  {word}", file=sys.stderr)

    # Build tiered pool
    pool = build_tiered_pool(counts, args.akshara)
    pool_path = args.out_dir / f"pool_{args.akshara}akshara.json"
    pool_path.write_text(json.dumps(pool, indent=2, ensure_ascii=False))
    print(f"\nTiered pool ({len(pool)} words) → {pool_path}", file=sys.stderr)

    # Decision gate verdict
    common_count = sum(1 for w in pool if w["tier"] == "common")
    print(
        f"\n=== DECISION GATE: {args.akshara}-akshara common pool size = {common_count} ===",
        file=sys.stderr,
    )
    if common_count >= 1500:
        print(
            f"  PASS — proceed with {args.akshara}-akshara default", file=sys.stderr
        )
    elif common_count >= 800:
        print(
            f"  MARGINAL — consider variable {args.akshara}-{args.akshara+1} grid",
            file=sys.stderr,
        )
    else:
        print(
            f"  FAIL — pool too thin. Re-run with --akshara {args.akshara+1} or pivot",
            file=sys.stderr,
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())
