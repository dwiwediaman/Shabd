"""Stream a Hindi corpus from Hugging Face and produce a frequency CSV
for downstream akshara-distribution analysis.

Per Phase 0.4 sourcing decision: the raw corpus is used for FREQUENCY
ANALYSIS ONLY. We extract statistics (a transformation, not a copy) and
discard the corpus. Only the derived word list is shipped — and that's
re-validated as an independent compilation.

Usage:
    python phase0_stream_corpus.py --max-tokens 1000000 --out raw_freq.csv

Defaults to wikimedia/wikipedia/20231101.hi (no auth, parquet, public).
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
import time
from collections import Counter
from pathlib import Path

try:
    from datasets import load_dataset
except ImportError:
    sys.stderr.write("Install: pip install datasets\n")
    sys.exit(1)


# Devanagari blocks
DEVANAGARI_RANGE = (0x0900, 0x097F)
DEVANAGARI_EXT = (0xA8E0, 0xA8FF)
JOINERS = {0x200C, 0x200D}


def is_devanagari_token(token: str) -> bool:
    if not token:
        return False
    for ch in token:
        cp = ord(ch)
        in_main = DEVANAGARI_RANGE[0] <= cp <= DEVANAGARI_RANGE[1]
        in_ext = DEVANAGARI_EXT[0] <= cp <= DEVANAGARI_EXT[1]
        if not (in_main or in_ext or cp in JOINERS):
            return False
    return True


def tokenize(text: str) -> list[str]:
    """Split on whitespace + common punctuation, keep Devanagari-only tokens."""
    raw = re.split(r"[\s।.,!?:;\"'()\[\]{}॥\-—–…]+", text)
    return [t for t in raw if is_devanagari_token(t) and len(t) >= 2]


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--dataset", default="wikimedia/wikipedia")
    p.add_argument("--config", default="20231101.hi")
    p.add_argument("--max-tokens", type=int, default=1_000_000)
    p.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).parent.parent
        / "research"
        / "word_pool_feasibility_data"
        / "raw_frequencies.csv",
    )
    p.add_argument("--progress-every", type=int, default=50_000)
    args = p.parse_args()

    args.out.parent.mkdir(parents=True, exist_ok=True)

    print(
        f"Streaming {args.dataset} ({args.config}), target {args.max_tokens:,} tokens",
        file=sys.stderr,
    )
    start = time.time()
    ds = load_dataset(args.dataset, args.config, streaming=True)
    split_name = list(ds.keys())[0]
    stream = ds[split_name]

    counts: Counter[str] = Counter()
    total_tokens = 0
    docs_seen = 0
    last_report = 0

    for doc in stream:
        text = doc.get("text", "")
        if not text:
            continue
        docs_seen += 1
        for token in tokenize(text):
            counts[token] += 1
            total_tokens += 1

        if total_tokens - last_report >= args.progress_every:
            elapsed = time.time() - start
            rate = total_tokens / elapsed if elapsed > 0 else 0
            print(
                f"  {total_tokens:>9,} tokens / {len(counts):>7,} unique / "
                f"{docs_seen:>5,} docs / {elapsed:6.1f}s / {rate:8.0f} tok/s",
                file=sys.stderr,
            )
            last_report = total_tokens

        if total_tokens >= args.max_tokens:
            break

    elapsed = time.time() - start
    print(
        f"\nFinished: {total_tokens:,} tokens, {len(counts):,} unique types, "
        f"{docs_seen:,} docs, {elapsed:.1f}s",
        file=sys.stderr,
    )

    # Write CSV: word,frequency, sorted by frequency desc
    print(f"Writing → {args.out}", file=sys.stderr)
    with args.out.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        for word, freq in counts.most_common():
            w.writerow([word, freq])
    print(
        f"Saved {len(counts):,} types to {args.out} ({args.out.stat().st_size:,} bytes)",
        file=sys.stderr,
    )

    return 0


if __name__ == "__main__":
    sys.exit(main())
