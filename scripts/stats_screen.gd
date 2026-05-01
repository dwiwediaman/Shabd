extends Control
## StatsScreen — shows streak history and aggregate stats per language.

@onready var streak_label_hi: Label = %StreakLabelHi
@onready var streak_label_en: Label = %StreakLabelEn
@onready var win_rate_label_hi: Label = %WinRateLabelHi
@onready var win_rate_label_en: Label = %WinRateLabelEn
@onready var back_button: Button = %BackButton


func _ready() -> void:
	_refresh()
	if back_button:
		back_button.pressed.connect(_on_back)


func _refresh() -> void:
	if streak_label_hi:
		streak_label_hi.text = "Hindi  •  Current %d  •  Best %d" % [
			GameState.current_streak_hi, GameState.max_streak_hi
		]
	if streak_label_en:
		streak_label_en.text = "English  •  Current %d  •  Best %d" % [
			GameState.current_streak_en, GameState.max_streak_en
		]
	if win_rate_label_hi:
		var rate_hi: float = (
			float(GameState.total_won_hi) / GameState.total_played_hi * 100.0
			if GameState.total_played_hi > 0 else 0.0
		)
		win_rate_label_hi.text = "Played %d  •  Won %.1f%%" % [
			GameState.total_played_hi, rate_hi
		]
	if win_rate_label_en:
		var rate_en: float = (
			float(GameState.total_won_en) / GameState.total_played_en * 100.0
			if GameState.total_played_en > 0 else 0.0
		)
		win_rate_label_en.text = "Played %d  •  Won %.1f%%" % [
			GameState.total_played_en, rate_en
		]


func _on_back() -> void:
	get_tree().change_scene_to_file("res://scenes/main_menu.tscn")
