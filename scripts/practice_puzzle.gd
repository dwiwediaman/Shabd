extends Control
## PracticePuzzle — unlimited-play mode. Same mechanic as DailyPuzzle but
## the target word is randomly chosen each session (not date-keyed).
##
## v1.0 ships practice as a feature; if post-launch analytics show it
## cannibalizes daily-appointment behavior (>20% drop in daily-attempt
## rate among practice users), v1.1 will add friction:
## "Practice unlocked after today's daily."

@onready var tile_grid: Control = %TileGrid
@onready var keyboard: Control = %Keyboard
@onready var status_label: Label = %StatusLabel
@onready var new_game_button: Button = %NewGameButton
@onready var back_button: Button = %BackButton

var _mechanic: WordleMechanic = WordleMechanic.new()
var _puzzle: PuzzleMechanic.PuzzleData
var _history: Array[PuzzleMechanic.GuessResult] = []
var _current_guess: String = ""
var _is_complete: bool = false
var _games_completed: int = 0


func _ready() -> void:
	_start_new_game()
	if back_button:
		back_button.pressed.connect(_on_back)
	if new_game_button:
		new_game_button.pressed.connect(_start_new_game)


func _start_new_game() -> void:
	_history.clear()
	_current_guess = ""
	_is_complete = false

	var lang: String = GameState.current_lang
	var random_seed: int = randi() & 0x7FFFFFFFFFFFFFFF
	_puzzle = _mechanic.generate(random_seed, lang)

	if status_label:
		status_label.text = "Practice  •  %s" % lang.to_upper()
	if new_game_button:
		new_game_button.visible = false


func _on_back() -> void:
	if _games_completed > 0:
		Analytics.log_practice_session(GameState.current_lang, _games_completed)
	get_tree().change_scene_to_file("res://scenes/main_menu.tscn")
