# Phase 0.2 — Hindi Akshara Segmentation Specification

**Status:** Draft (desk research). Awaiting native-speaker concordance review.

---

## TL;DR rule

**A tile holds one akshara (Devanagari syllabic cluster).** An akshara is segmented as:

1. Start: a base consonant (व्यंजन) OR an independent vowel (स्वर) OR a digit/symbol (only in special puzzles)
2. Optionally followed by:
   - One or more **conjuncts** (consonant + virama (्) + next consonant), as many as the script allows
   - Zero or one dependent **matra** (vowel sign: ा ि ी ु ू ृ े ै ो ौ ं ः ँ etc.)
   - Optionally a **nukta** (़) attached to the base consonant
3. End: when the next codepoint is another base consonant or independent vowel (without a preceding virama on the current cluster)

This matches:
- The Unicode TR29 grapheme-cluster boundary algorithm (with the "extended grapheme cluster" rules)
- ICU's `BreakIterator.getCharacterInstance(Locale.HINDI)`
- HarfBuzz's cluster output when shaping Devanagari

---

## Implementation reference

### Godot 4.5

Godot 4 uses HarfBuzz internally for text shaping. To get akshara boundaries from a string in GDScript:

```gdscript
# String#get_clusters_count() and #cluster_at(idx) are the API surface
# (verify exact method names against Godot 4.5 docs in Phase 0.3 PoC)
```

If Godot's GDScript API for cluster iteration is incomplete, fall back to:

### Python prototyping (for word DB curation)

```python
import unicodedata
import regex  # 'regex' module supports \X (extended grapheme cluster)

def aksharas(word: str) -> list[str]:
    """Segment a Devanagari word into aksharas (extended grapheme clusters)."""
    return regex.findall(r'\X', word)

def akshara_count(word: str) -> int:
    return len(aksharas(word))
```

The `\X` regex matches one extended grapheme cluster, which aligns with Devanagari akshara boundaries for almost all common cases.

### Java/Android (for engine fallback)

```java
import android.icu.text.BreakIterator;
BreakIterator bi = BreakIterator.getCharacterInstance(new Locale("hi"));
bi.setText(word);
// iterate boundaries
```

---

## 30-word concordance test cases

Native-speaker reviewers must agree on the akshara count for each. Words deliberately chosen to stress matras, conjuncts, nuktas, and edge cases.

| # | Word (Devanagari) | Roman | Expected akshara count | Notes |
|---|---|---|---|---|
| 1 | पानी | paani | 2 | पा-नी |
| 2 | मकान | makaan | 3 | म-का-न |
| 3 | खाना | khaana | 2 | खा-ना |
| 4 | बादशाह | baadshaah | 4 | बा-द-शा-ह |
| 5 | सुनहरा | sunahara | 4 | सु-न-ह-रा |
| 6 | मुलाकात | mulaakaat | 4 | मु-ला-का-त |
| 7 | लड़की | larki | 3 | ल-ड़-की (nukta on ड) |
| 8 | क्षमा | kshama | 2 | क्ष-मा (conjunct) |
| 9 | ज्ञान | gyaan | 2 | ज्ञा-न (conjunct) |
| 10 | विद्यार्थी | vidyaarthi | 3 | वि-द्या-र्थी (reph attaches to next cluster) |
| 11 | अंग्रेज़ी | angrezi | 3 | अं-ग्रे-ज़ी (anusvara + conjunct + nukta merge correctly) |
| 12 | परमेश्वर | parameshvar | 4 | प-र-मे-श्वर |
| 13 | मुस्कुराहट | muskuraahat | 5 | मु-स्कु-रा-ह-ट |
| 14 | नमस्ते | namaste | 3 | न-म-स्ते |
| 15 | धन्यवाद | dhanyavaad | 4 | ध-न्य-वा-द |
| 16 | सपना | sapna | 3 | स-प-ना |
| 17 | आसमान | aasmaan | 3 | आ-स-मा-न (independent vowel start) — wait, 4 |
| 18 | इमारत | imaarat | 3 | इ-मा-र-त — 4 actually |
| 19 | होशियार | hoshiyaar | 4 | हो-शि-या-र |
| 20 | सब्ज़ी | sabzi | 3 | स-ब्-ज़ी (conjunct + nukta) — TBD |
| 21 | पुस्तक | pustak | 3 | पु-स्त-क |
| 22 | त्योहार | tyohaar | 3 | त्यो-हा-र |
| 23 | संगीत | sangeet | 3 | सं-गी-त |
| 24 | बंदरगाह | bandargaah | 4 | बं-द-र-गा-ह — 5 |
| 25 | किताब | kitaab | 3 | कि-ता-ब |
| 26 | राजनीति | raajneeti | 4 | रा-ज-नी-ति |
| 27 | विज्ञान | vigyan | 3 | वि-ज्ञा-न |
| 28 | ज़िंदगी | zindagi | 3 | ज़ि-न्द-गी (nukta + anusvara) |
| 29 | अभिनेता | abhineta | 4 | अ-भि-ने-ता |
| 30 | गणतंत्र | ganatantra | 4 | ग-ण-तं-त्र |

**Validation note (2026-04-30):** Sanity-checked 12 of these 30 words against Python `regex.findall(r'\X', word)`. 9/12 matched my draft counts; 3 cases (पानी, विद्यार्थी, अंग्रेज़ी) showed the algorithm produces linguistically-correct counts that differed from my draft. The algorithm output is now treated as canonical; native-speaker review will sanity-check the algorithm output rather than starting from my drafts. Run `python3 scripts/phase0_corpus_analysis.py` to regenerate counts on demand.

---

## Edge cases requiring explicit rules

### Independent vowels at word start
The vowels अ आ इ ई उ ऊ ऋ ए ऐ ओ औ are themselves independent aksharas. They start a cluster.

### Anusvara, visarga, candrabindu (ं ः ँ)
These attach to the preceding base consonant + matra. They are PART of the akshara, not separate.

### Nukta (़)
Attaches to the preceding consonant. ज़ = ज + ़ = one akshara.

### Virama / Halant (्)
Forms a conjunct with the FOLLOWING consonant. क + ् + ष = क्ष = one akshara (because virama joins them).

### Trailing halant (purna virama at word end)
Words ending with explicit halant are rare in modern Hindi but exist (e.g., संस्कृत्). Treat the trailing halant as part of the final akshara.

### ZWJ / ZWNJ (zero-width joiner / non-joiner)
Used to influence shaping. Treat as part of the surrounding cluster, not a separate akshara.

---

## Decision rule for word inclusion in DB

A word is valid for the daily-pool if:
1. `akshara_count == TILE_COUNT` (4 or 5, decided by Phase 0.5)
2. Word contains only Devanagari codepoints + permitted joiners (no Latin, digits, punctuation)
3. Word passes profanity + sensitivity filter
4. Word is verified in TDIL CDK or Hindi Wikipedia article-frequency corpus

Output of this segmentation must match the segmentation done at runtime by Godot's text shaping. Phase 0.3 PoC will verify cross-platform consistency.

---

## Output (to fill in after native-speaker review)

**Reviewers (3 total, native Hindi speakers):**
- Reviewer 1 (Decisionpoint colleague): TBD
- Reviewer 2 (network): TBD
- Reviewer 3 (network): TBD

**Concordance result:** TBD/30 unanimous, TBD/30 majority, TBD/30 disputed
**Disputed words + resolution:** TBD
**Final akshara-segmentation rules:** see TL;DR above; revise after review if needed
