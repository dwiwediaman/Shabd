class_name PuzzleMechanic extends RefCounted
## PuzzleMechanic — interface for daily/practice puzzle implementations.
##
## v1.0 has one implementation: WordleMechanic (5-tile word guessing).
## v1.2+ will add: AnagramMechanic ("Akshar"), and possibly others.
## All implementations must:
##   - generate(seed) → PuzzleData (deterministic for the same seed)
##   - validate_guess(input) → GuessResult (fast, offline)
##   - render_share_grid(history) → String (emoji-grid)
##
## Adding a new mechanic: extend this class, register in
## scripts/mechanics/registry.gd. No fork.

const TILE_STATE_EMPTY: int = 0
const TILE_STATE_CORRECT: int = 1   # right letter, right position (🟩)
const TILE_STATE_PRESENT: int = 2   # right letter, wrong position (🟨)
const TILE_STATE_ABSENT: int = 3    # not in word (⬜)

const RESULT_WIN: int = 1
const RESULT_LOSS: int = 2
const RESULT_IN_PROGRESS: int = 0


## PuzzleData: opaque per-mechanic payload describing one puzzle.
##   - target: the word the player must guess
##   - tile_count: 4 (HI) or 5 (EN)
##   - max_guesses: 6
##   - lang: 'hi' or 'en'
##   - puzzle_index: absolute day index (for share-grid headers)
class PuzzleData:
	var target: String
	var tile_count: int
	var max_guesses: int
	var lang: String
	var puzzle_index: int
	var meta: Dictionary  # mechanic-specific extra fields


## GuessResult: per-tile outcome of a guess.
class GuessResult:
	var input: String
	var per_tile_state: Array[int]  # length == tile_count
	var is_valid: bool              # was the guess word in the valid pool?
	var is_correct: bool             # did all tiles return CORRECT?
	var rejection_reason: String     # if not is_valid


## Override in subclasses.
func generate(_seed: int, _lang: String) -> PuzzleData:
	push_error("PuzzleMechanic.generate not implemented")
	return null


func validate_guess(_input: String, _puzzle: PuzzleData) -> GuessResult:
	push_error("PuzzleMechanic.validate_guess not implemented")
	return null


func render_share_grid(_puzzle: PuzzleData, _history: Array) -> String:
	push_error("PuzzleMechanic.render_share_grid not implemented")
	return ""
