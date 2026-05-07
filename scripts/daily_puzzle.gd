extends Control
## DailyPuzzle — the core game scene. Shows the day's puzzle for the
## currently-selected language.
##
## Lifecycle:
##   1. _ready: load today's puzzle for GameState.current_lang
##   2. wire keyboard input to current guess
##   3. on submit: validate, animate tile flips, check win/loss
##   4. on win/loss: show share modal + record streak
##
## All UI nodes are referenced by `unique_name_in_owner` (%-syntax) so the
## scene can be edited in Godot without breaking script bindings.

@onready var tile_grid: Control = %TileGrid
@onready var keyboard: Control = %Keyboard
@onready var status_label: Label = %StatusLabel
@onready var share_button: Button = %ShareButton
@onready var hint_button: Button = %HintButton
@onready var back_button: Button = %BackButton

var _mechanic: WordleMechanic = WordleMechanic.new()
var _puzzle: PuzzleMechanic.PuzzleData
var _history: Array[PuzzleMechanic.GuessResult] = []
var _current_guess: String = ""
var _start_time_ms: int = 0
var _is_complete: bool = false


func _ready() -> void:
	_start_time_ms = Time.get_ticks_msec()

	# Load today's puzzle for current language
	var lang: String = GameState.current_lang
	var seed_info: Dictionary = SeedEngine.today(lang)
	_puzzle = _mechanic.generate(seed_info["seed"], lang)

	if _puzzle == null:
		push_error("DailyPuzzle: puzzle generation failed")
		_show_error("Unable to load today's puzzle. Try restarting.")
		return

	Analytics.log_daily_attempt(lang, _puzzle.puzzle_index)

	if status_label:
		status_label.text = "Shabd %s #%d" % [lang.to_upper(), _puzzle.puzzle_index]

	# Build the empty tile grid for this puzzle's dimensions.
	if tile_grid and tile_grid.has_method("configure"):
		tile_grid.configure(_puzzle.tile_count, _puzzle.max_guesses)

	# Wire UI
	if back_button:
		back_button.pressed.connect(_on_back)
	if share_button:
		share_button.pressed.connect(_on_share)
		share_button.visible = false  # Only after solve
	if hint_button:
		hint_button.pressed.connect(_on_hint)

	if keyboard and keyboard.has_signal("key_pressed"):
		keyboard.connect("key_pressed", _on_key_pressed)
	if keyboard and keyboard.has_signal("submit_pressed"):
		keyboard.connect("submit_pressed", _on_submit)
	if keyboard and keyboard.has_signal("backspace_pressed"):
		keyboard.connect("backspace_pressed", _on_backspace)


func _on_key_pressed(input: String) -> void:
	if _is_complete:
		return
	# Cap input length at tile_count
	var current_tiles: int = _count_tiles(_current_guess)
	if current_tiles >= _puzzle.tile_count:
		return
	_current_guess += input
	_update_grid_preview()


func _on_backspace() -> void:
	if _is_complete:
		return
	if _current_guess.is_empty():
		return
	# Remove one tile-worth from the end (one akshara for hi, one letter for en)
	var tiles: Array[String] = _split_tiles(_current_guess)
	tiles.pop_back()
	_current_guess = "".join(tiles)
	_update_grid_preview()


func _on_submit() -> void:
	if _is_complete or _puzzle == null:
		return
	if _count_tiles(_current_guess) != _puzzle.tile_count:
		_flash_status("Word too short")
		return

	var result: PuzzleMechanic.GuessResult = _mechanic.validate_guess(_current_guess, _puzzle)
	if not result.is_valid:
		_flash_status("Not in word list")
		return

	_history.append(result)
	if tile_grid and tile_grid.has_method("commit_row"):
		tile_grid.commit_row(_history.size() - 1, result.per_tile_state, _split_tiles(_current_guess))

	if result.is_correct:
		_complete(true)
	elif _history.size() >= _puzzle.max_guesses:
		_complete(false)
	else:
		_current_guess = ""


func _on_hint() -> void:
	if _is_complete:
		return
	# Free hint: reveal one not-yet-correctly-placed tile
	# Rewarded hint: same, but consumes a rewarded ad watch
	# TODO: implement hint logic + ad gate
	Analytics.log_hint_used(GameState.current_lang, "free")


func _on_share() -> void:
	if _puzzle == null:
		return
	var text: String = ShareRenderer.render_text(_puzzle, _history)
	ShareRenderer.trigger_share(text)
	Analytics.log_share_tapped(GameState.current_lang, _puzzle.puzzle_index, _history.back().is_correct)


func _on_back() -> void:
	get_tree().change_scene_to_file("res://scenes/main_menu.tscn")


# ---------------------------------------------------------------------------
# Internal

func _complete(won: bool) -> void:
	_is_complete = true
	var ist_date: String = SeedEngine.get_ist_date()
	var elapsed_ms: int = Time.get_ticks_msec() - _start_time_ms
	GameState.record_daily_completion(GameState.current_lang, won, _history.size(), ist_date)

	if won:
		Analytics.log_daily_solved(
			GameState.current_lang, _puzzle.puzzle_index, _history.size(), elapsed_ms
		)
	else:
		Analytics.log_daily_failed(GameState.current_lang, _puzzle.puzzle_index)

	if share_button:
		share_button.visible = true
	if hint_button:
		hint_button.disabled = true

	if status_label:
		status_label.text = (
			"Solved in %d/%d!" % [_history.size(), _puzzle.max_guesses]
			if won
			else "The word was: %s" % _puzzle.target
		)

	# Trigger sign-in prompt if conditions met
	if CloudSave.should_prompt_signin() and not CloudSave.is_signed_in:
		Analytics.log_signin_prompt_shown("post_completion")
		# UI flow: show non-blocking modal "Save streak across devices?"


func _update_grid_preview() -> void:
	if tile_grid and tile_grid.has_method("set_active_row"):
		tile_grid.set_active_row(_history.size(), _split_tiles(_current_guess))


func _flash_status(msg: String) -> void:
	if status_label:
		status_label.text = msg


func _show_error(msg: String) -> void:
	if status_label:
		status_label.text = msg


func _split_tiles(word: String) -> Array[String]:
	# Same logic as WordleMechanic._split_into_tiles, but local to avoid
	# coupling. TODO: move to a shared TileSegmenter helper.
	if GameState.current_lang == "en":
		var out: Array[String] = []
		for ch in word:
			out.append(ch.to_lower())
		return out
	# Hindi: codepoint-by-codepoint with combining-mark attachment.
	# (Earlier code probed for a runtime String.graphemes() — that path was
	# unreachable in Godot 4.5 and tripped a parse error in non-export tools.)
	var out_fb: Array[String] = []
	var current: String = ""
	for codepoint in word:
		var cp: int = codepoint.unicode_at(0) if codepoint.length() > 0 else 0
		var is_combining: bool = (
			(cp >= 0x093A and cp <= 0x094F) or cp == 0x093C or cp == 0x094D
			or (cp >= 0x0951 and cp <= 0x0957)
			or cp == 0x0902 or cp == 0x0903
			or cp == 0x200C or cp == 0x200D
		)
		if is_combining:
			current += codepoint
		else:
			if not current.is_empty():
				out_fb.append(current)
			current = codepoint
	if not current.is_empty():
		out_fb.append(current)
	return out_fb


func _count_tiles(word: String) -> int:
	return _split_tiles(word).size()
