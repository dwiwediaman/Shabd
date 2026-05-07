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
@onready var how_to_play_button: Button = %HowToPlayButton
@onready var language_button: Button = %LanguageButton
@onready var streak_label: Label = %StreakLabel
@onready var subtitle_label: Label = %SubtitleLabel
@onready var version_label: Label = %VersionLabel


func _ready() -> void:
	_refresh_ui()
	_set_version_label()
	if play_daily_button:
		play_daily_button.pressed.connect(_on_play_daily)
	if play_practice_button:
		play_practice_button.pressed.connect(_on_play_practice)
	if stats_button:
		stats_button.pressed.connect(_on_stats)
	if settings_button:
		settings_button.pressed.connect(_on_settings)
	if how_to_play_button:
		how_to_play_button.pressed.connect(_on_how_to_play)
	if language_button:
		language_button.pressed.connect(_on_toggle_language)
	# First-launch: auto-show the tutorial.
	if not GameState.has_seen_tutorial:
		call_deferred("_on_how_to_play")


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


func _on_how_to_play() -> void:
	get_tree().change_scene_to_file("res://scenes/how_to_play.tscn")


func _set_version_label() -> void:
	if version_label == null:
		return
	# version_code is read from build-time constant injected via export_presets.
	# At runtime we surface only the version string + the AppMeta build code.
	var version_name: String = ProjectSettings.get_setting("application/config/version", "1.0.0")
	version_label.text = "v%s · build %d" % [version_name, AppMeta.BUILD_CODE]


func _on_toggle_language() -> void:
	var prev: String = GameState.current_lang
	GameState.current_lang = "hi" if prev == "en" else "en"
	GameState.save_state()
	Analytics.log_language_change(prev, GameState.current_lang)
	_refresh_ui()
