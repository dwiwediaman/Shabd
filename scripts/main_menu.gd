extends Control
## MainMenu — root scene shown on app launch.
##
## Shows the day's puzzle status (played / not played) per language,
## a Play Daily button, Practice button, Stats button, and Settings cog.
## Language switcher is in the header.

@onready var play_daily_button: Button = %PlayDailyButton
@onready var play_practice_button: Button = %PlayPracticeButton
@onready var stats_button: Button = %StatsButton
@onready var settings_button: Button = %SettingsButton
@onready var language_button: Button = %LanguageButton
@onready var streak_label: Label = %StreakLabel
@onready var subtitle_label: Label = %SubtitleLabel


func _ready() -> void:
	_refresh_ui()
	if play_daily_button:
		play_daily_button.pressed.connect(_on_play_daily)
	if play_practice_button:
		play_practice_button.pressed.connect(_on_play_practice)
	if stats_button:
		stats_button.pressed.connect(_on_stats)
	if settings_button:
		settings_button.pressed.connect(_on_settings)
	if language_button:
		language_button.pressed.connect(_on_toggle_language)


func _refresh_ui() -> void:
	var lang: String = GameState.current_lang
	var current_streak: int = (
		GameState.current_streak_hi if lang == "hi" else GameState.current_streak_en
	)
	var max_streak: int = (
		GameState.max_streak_hi if lang == "hi" else GameState.max_streak_en
	)

	if streak_label:
		streak_label.text = "Streak: %d  •  Best: %d" % [current_streak, max_streak]

	if subtitle_label:
		var lang_name: String = "Hindi" if lang == "hi" else "English"
		subtitle_label.text = "Daily puzzle  •  %s" % lang_name

	if language_button:
		language_button.text = "EN" if lang == "hi" else "हिं"


func _on_play_daily() -> void:
	get_tree().change_scene_to_file("res://scenes/daily_puzzle.tscn")


func _on_play_practice() -> void:
	get_tree().change_scene_to_file("res://scenes/practice_puzzle.tscn")


func _on_stats() -> void:
	get_tree().change_scene_to_file("res://scenes/stats_screen.tscn")


func _on_settings() -> void:
	get_tree().change_scene_to_file("res://scenes/settings.tscn")


func _on_toggle_language() -> void:
	var prev: String = GameState.current_lang
	GameState.current_lang = "hi" if prev == "en" else "en"
	GameState.save_state()
	Analytics.log_language_change(prev, GameState.current_lang)
	_refresh_ui()
