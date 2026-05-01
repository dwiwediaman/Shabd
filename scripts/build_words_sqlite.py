"""Build the shippable words.sqlite from curated JSON files.

Reads:
  - data/words_hi.json (output of phase0_curate_hindi.py)
  - data/words_en.json (output of phase0_curate_english.py)

Writes:
  - data/words.sqlite (read-only, bundled in APK)

Schema is forward-compatible (schema_version table) so v1.x migrations
can extend without breaking existing user installs.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path


SCHEMA = """
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL,
    lang TEXT NOT NULL CHECK (lang IN ('hi', 'en')),
    akshara_count INTEGER,
    letter_count INTEGER,
    tile_count INTEGER NOT NULL,
    frequency INTEGER NOT NULL DEFAULT 0,
    frequency_rank INTEGER NOT NULL,
    tier TEXT NOT NULL CHECK (tier IN ('common', 'mid', 'challenge', 'extra')),
    in_daily_pool INTEGER NOT NULL DEFAULT 0,
    in_guess_pool INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_words_lang_daily_tier
    ON words (lang, in_daily_pool, tier, frequency_rank);

CREATE INDEX IF NOT EXISTS idx_words_lang_guess_word
    ON words (lang, in_guess_pool, word);

CREATE UNIQUE INDEX IF NOT EXISTS idx_words_word_lang
    ON words (word, lang);
"""


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--hi", type=Path, default=Path(__file__).parent.parent / "data" / "words_hi.json"
    )
    p.add_argument(
        "--en", type=Path, default=Path(__file__).parent.parent / "data" / "words_en.json"
    )
    p.add_argument(
        "--out", type=Path, default=Path(__file__).parent.parent / "data" / "words.sqlite"
    )
    args = p.parse_args()

    if args.out.exists():
        args.out.unlink()

    conn = sqlite3.connect(args.out)
    conn.executescript(SCHEMA)
    conn.execute("INSERT INTO schema_version (version) VALUES (?)", (1,))

    total = 0
    for path in [args.hi, args.en]:
        if not path.exists():
            print(f"WARN: {path} not found; skipping", file=sys.stderr)
            continue
        entries = json.loads(path.read_text(encoding="utf-8"))
        for e in entries:
            conn.execute(
                """INSERT OR REPLACE INTO words
                   (word, lang, akshara_count, letter_count, tile_count,
                    frequency, frequency_rank, tier, in_daily_pool, in_guess_pool)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    e["word"],
                    e["lang"],
                    e.get("akshara_count"),
                    e.get("letter_count"),
                    e["tile_count"],
                    e["frequency"],
                    e["frequency_rank"],
                    e["tier"],
                    e["in_daily_pool"],
                    e["in_guess_pool"],
                ),
            )
            total += 1
        print(f"  Loaded {len(entries)} from {path.name}", file=sys.stderr)

    conn.commit()

    # Sanity report
    cur = conn.cursor()
    cur.execute(
        "SELECT lang, COUNT(*), SUM(in_daily_pool), SUM(in_guess_pool) FROM words GROUP BY lang"
    )
    print("\nFinal DB stats:", file=sys.stderr)
    print(f"  {'lang':<6}{'total':>10}{'daily_pool':>14}{'guess_pool':>14}", file=sys.stderr)
    for row in cur.fetchall():
        print(f"  {row[0]:<6}{row[1]:>10}{row[2]:>14}{row[3]:>14}", file=sys.stderr)

    cur.execute("SELECT lang, tier, COUNT(*) FROM words GROUP BY lang, tier ORDER BY lang, tier")
    print(f"\nTier breakdown:", file=sys.stderr)
    for row in cur.fetchall():
        print(f"  {row[0]:<6}{row[1]:<14}{row[2]:>6}", file=sys.stderr)

    conn.close()
    size_kb = args.out.stat().st_size / 1024
    print(f"\nWrote {total} total rows → {args.out} ({size_kb:.1f} KB)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
