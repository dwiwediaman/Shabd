class_name HinglishTransliterator extends RefCounted
## HinglishTransliterator — Roman → Devanagari conversion with auto-commit
## and disambiguation candidates.
##
## Per Phase 0.6 input-speed strategy:
##   - User types Roman ("mu" then "l") → engine auto-commits "मु" to next
##     tile when next base-consonant arrives
##   - For ambiguous mappings (~20% of common words), surface 3-candidate
##     suggestion strip; user taps to commit
##
## Canonical mapping table is loaded from data/hinglish_canonical.json
## (curated in Phase 0; native-speaker review pending pre-launch).

const CANONICAL_MAP_PATH: String = "res://data/hinglish_canonical.json"

var _canonical: Dictionary = {}
var _loaded: bool = false


func _init() -> void:
	_load_canonical()


func _load_canonical() -> void:
	if not FileAccess.file_exists(CANONICAL_MAP_PATH):
		push_warning("HinglishTransliterator: canonical map missing")
		return
	var f: FileAccess = FileAccess.open(CANONICAL_MAP_PATH, FileAccess.READ)
	var content: String = f.get_as_text()
	f.close()
	var parsed: Variant = JSON.parse_string(content)
	if parsed is Dictionary:
		_canonical = parsed
		_loaded = true


## Transliterate one Roman input chunk into the most likely Devanagari akshara.
## Returns a Dictionary with:
##   { "akshara": "मु", "candidates": ["मु", "मू"], "confident": true }
##
## A "confident" result has only the canonical entry — auto-commit can fire.
## A non-confident result has multiple candidates — show suggestion strip.
func transliterate_chunk(roman: String) -> Dictionary:
	var key: String = roman.to_lower().strip_edges()
	if _canonical.has(key):
		var entry: Dictionary = _canonical[key]
		var candidates: Array = entry.get("candidates", [entry.get("canonical", "")])
		return {
			"akshara": entry.get("canonical", ""),
			"candidates": candidates,
			"confident": candidates.size() <= 1,
		}
	# No canonical entry — return empty with the raw input as fallback so the
	# UI can show "?" tile or prompt the user to backspace.
	return {
		"akshara": "",
		"candidates": [],
		"confident": false,
	}


## Detect if a roman string ends in a base-consonant boundary, which is the
## auto-commit trigger. Pattern: a base consonant Roman char (b, c, d, f, g,
## h, j, k, l, m, n, p, q, r, s, t, v, w, x, y, z, plus capitals for retroflex)
## without a trailing vowel modifier suggests the previous akshara is complete.
##
## This is a simple heuristic; the canonical map disambiguates the rest.
static func is_consonant_boundary(roman: String) -> bool:
	if roman.is_empty():
		return false
	var last: String = roman[roman.length() - 1]
	# Vowel chars don't trigger commit; consonant-only does
	return not _is_vowel(last)


static func _is_vowel(ch: String) -> bool:
	var vowels: String = "aeiou"
	return vowels.contains(ch.to_lower())


## Returns true if the canonical map loaded successfully.
func is_loaded() -> bool:
	return _loaded
