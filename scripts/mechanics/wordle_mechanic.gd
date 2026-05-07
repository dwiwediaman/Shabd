class_name WordleMechanic extends PuzzleMechanic
## WordleMechanic — classic Wordle-pattern (Hindi 4-akshara or English 5-letter).
##
## Per-language tile unit:
##   - hi: akshara (Devanagari grapheme cluster)
##   - en: ASCII letter
##
## Deterministic per (seed, lang). The seed comes from SeedEngine.

const MAX_GUESSES: int = 6
const TILES_HI: int = 4
const TILES_EN: int = 5

# Tier weights for daily-pool selection: 70% common, 20% mid, 10% challenge
const TIER_WEIGHTS: Dictionary = {
	"common": 70,
	"mid": 20,
	"challenge": 10,
}


func generate(seed: int, lang: String) -> PuzzleMechanic.PuzzleData:
	# Pick tier deterministically using upper bits of seed
	var tier_roll: int = (seed >> 32) % 100
	var tier: String = "common"
	if tier_roll >= TIER_WEIGHTS["common"]:
		tier = "mid"
		if tier_roll >= TIER_WEIGHTS["common"] + TIER_WEIGHTS["mid"]:
			tier = "challenge"

	# Pick word from tier using lower bits of seed
	var pool: Array = WordDB.get_daily_pool(lang, tier)
	if pool.is_empty():
		push_error("Empty daily pool for lang=%s tier=%s; falling back to common" % [lang, tier])
		pool = WordDB.get_daily_pool(lang, "common")
	if pool.is_empty():
		push_error("WordDB has no entries for lang=%s" % lang)
		return null

	var index: int = (seed & 0xFFFFFFFF) % pool.size()
	var word_entry: Dictionary = pool[index]
	var target: String = word_entry["word"]

	var pd: PuzzleMechanic.PuzzleData = PuzzleMechanic.PuzzleData.new()
	pd.target = target
	pd.tile_count = TILES_HI if lang == "hi" else TILES_EN
	pd.max_guesses = MAX_GUESSES
	pd.lang = lang
	pd.puzzle_index = SeedEngine.get_puzzle_index()
	pd.meta = {"tier": tier, "freq_rank": word_entry.get("frequency_rank", -1)}
	return pd


func validate_guess(input: String, puzzle: PuzzleMechanic.PuzzleData) -> PuzzleMechanic.GuessResult:
	var result: PuzzleMechanic.GuessResult = PuzzleMechanic.GuessResult.new()
	result.input = input

	# Per-language tile breakdown
	var input_tiles: Array[String] = _split_into_tiles(input, puzzle.lang)
	var target_tiles: Array[String] = _split_into_tiles(puzzle.target, puzzle.lang)

	# Length check
	if input_tiles.size() != puzzle.tile_count:
		result.is_valid = false
		result.rejection_reason = "wrong_length"
		result.per_tile_state = []
		result.is_correct = false
		return result

	# Pool membership check
	var normalized: String = _normalize(input, puzzle.lang)
	if not WordDB.is_valid_guess(normalized, puzzle.lang):
		result.is_valid = false
		result.rejection_reason = "not_in_dictionary"
		result.per_tile_state = []
		result.is_correct = false
		return result

	# Compute per-tile state with two-pass algorithm (Wordle-correct)
	result.is_valid = true
	result.per_tile_state = _compute_tile_states(input_tiles, target_tiles)
	result.is_correct = result.per_tile_state.all(func(s): return s == PuzzleMechanic.TILE_STATE_CORRECT)
	return result


func render_share_grid(puzzle: PuzzleMechanic.PuzzleData, history: Array) -> String:
	# Emoji grid format: matches Wordle's share style
	#   "Shabd HI #042 4/6"
	#   "🟨⬜⬜⬜"
	#   "🟩🟨⬜⬜"
	#   "🟩🟩🟩🟩"
	var attempts: int = history.size()
	var solved_in: String = "%d/%d" % [attempts, puzzle.max_guesses]
	if attempts > 0 and not history[attempts - 1].is_correct:
		solved_in = "X/%d" % puzzle.max_guesses

	var lang_label: String = puzzle.lang.to_upper()
	var lines: PackedStringArray = []
	lines.append("Shabd %s #%d %s" % [lang_label, puzzle.puzzle_index, solved_in])
	for guess in history:
		var row: String = ""
		for state in guess.per_tile_state:
			match state:
				PuzzleMechanic.TILE_STATE_CORRECT:
					row += "🟩"
				PuzzleMechanic.TILE_STATE_PRESENT:
					row += "🟨"
				PuzzleMechanic.TILE_STATE_ABSENT:
					row += "⬜"
				_:
					row += "⬛"
		lines.append(row)
	lines.append("")
	lines.append("Play at: github.com/dwiwediaman/Shabd")
	return "\n".join(lines)


# ---------------------------------------------------------------------------
# Internal helpers

func _split_into_tiles(word: String, lang: String) -> Array[String]:
	if lang == "en":
		# ASCII per-letter
		var out: Array[String] = []
		for ch in word:
			out.append(ch.to_lower())
		return out
	else:
		# Devanagari akshara segmentation via Godot 4.5 String.graphemes API.
		# Falls back to per-codepoint if API not available.
		return _split_aksharas(word)


func _split_aksharas(word: String) -> Array[String]:
	# Godot 4.5 Strings have no graphemes() / has_method (Object-only). Build
	# clusters manually by attaching combining marks to the preceding base.
	var out: Array[String] = []
	var current: String = ""
	for codepoint in word:
		if _is_combining_mark(codepoint):
			current += codepoint
		else:
			if not current.is_empty():
				out.append(current)
			current = codepoint
	if not current.is_empty():
		out.append(current)
	return out


func _is_combining_mark(ch: String) -> bool:
	if ch.is_empty():
		return false
	var cp: int = ch.unicode_at(0)
	# Devanagari dependent vowel signs + virama + nukta + anusvara/visarga
	return (
		cp >= 0x093A and cp <= 0x094F  # matras + virama
	) or cp == 0x093C or cp == 0x094D or (
		cp >= 0x0951 and cp <= 0x0957
	) or cp == 0x0902 or cp == 0x0903 or cp == 0x0900 or (
		cp == 0x200C or cp == 0x200D  # ZWJ/ZWNJ
	)


func _normalize(word: String, lang: String) -> String:
	if lang == "en":
		return word.to_lower().strip_edges()
	return word.strip_edges()


func _compute_tile_states(input_tiles: Array[String], target_tiles: Array[String]) -> Array[int]:
	# Two-pass algorithm so a letter that appears once in the target but
	# twice in the guess yields exactly one yellow + one grey, matching Wordle.
	var n: int = target_tiles.size()
	var states: Array[int] = []
	states.resize(n)

	# Pass 1: greens
	var target_remaining: Dictionary = {}  # tile -> count
	for i in range(n):
		if input_tiles[i] == target_tiles[i]:
			states[i] = PuzzleMechanic.TILE_STATE_CORRECT
		else:
			states[i] = PuzzleMechanic.TILE_STATE_ABSENT
			target_remaining[target_tiles[i]] = target_remaining.get(target_tiles[i], 0) + 1

	# Pass 2: yellows
	for i in range(n):
		if states[i] == PuzzleMechanic.TILE_STATE_CORRECT:
			continue
		var t: String = input_tiles[i]
		if target_remaining.get(t, 0) > 0:
			states[i] = PuzzleMechanic.TILE_STATE_PRESENT
			target_remaining[t] -= 1

	return states
