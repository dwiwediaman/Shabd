extends Control
## HowToPlay — first-run tutorial overlay. Shows once on first launch
## (auto-dismissed via GameState.has_seen_tutorial), and re-openable from
## the main menu's "How to play" button afterwards.

@onready var got_it_button: Button = %GotItButton


func _ready() -> void:
	if got_it_button:
		got_it_button.pressed.connect(_on_dismiss)


func _on_dismiss() -> void:
	if not GameState.has_seen_tutorial:
		GameState.has_seen_tutorial = true
		GameState.save_state()
	get_tree().change_scene_to_file("res://scenes/main_menu.tscn")
