extends Control
## Settings — language toggle, keyboard mode (Devanagari vs Hinglish),
## sound, haptics, sign-in (manual trigger).

@onready var lang_button_group: ButtonGroup = preload("res://scenes/settings_button_group.tres") if FileAccess.file_exists("res://scenes/settings_button_group.tres") else null
@onready var lang_hi_button: CheckBox = %LangHiButton
@onready var lang_en_button: CheckBox = %LangEnButton
@onready var keyboard_devanagari_button: CheckBox = %KeyboardDevanagariButton
@onready var keyboard_hinglish_button: CheckBox = %KeyboardHinglishButton
@onready var sound_toggle: CheckBox = %SoundToggle
@onready var haptics_toggle: CheckBox = %HapticsToggle
@onready var signin_button: Button = %SigninButton
@onready var back_button: Button = %BackButton


func _ready() -> void:
	_load_settings_to_ui()
	if back_button:
		back_button.pressed.connect(_on_back)
	if signin_button:
		signin_button.pressed.connect(_on_signin)
	if lang_hi_button:
		lang_hi_button.toggled.connect(func(p): if p: _set_lang("hi"))
	if lang_en_button:
		lang_en_button.toggled.connect(func(p): if p: _set_lang("en"))
	if keyboard_devanagari_button:
		keyboard_devanagari_button.toggled.connect(func(p): if p: _set_kbd("devanagari"))
	if keyboard_hinglish_button:
		keyboard_hinglish_button.toggled.connect(func(p): if p: _set_kbd("hinglish"))
	if sound_toggle:
		sound_toggle.toggled.connect(_set_sound)
	if haptics_toggle:
		haptics_toggle.toggled.connect(_set_haptics)


func _load_settings_to_ui() -> void:
	if lang_hi_button:
		lang_hi_button.button_pressed = (GameState.current_lang == "hi")
	if lang_en_button:
		lang_en_button.button_pressed = (GameState.current_lang == "en")
	if keyboard_devanagari_button:
		keyboard_devanagari_button.button_pressed = (GameState.keyboard_mode_hi == "devanagari")
	if keyboard_hinglish_button:
		keyboard_hinglish_button.button_pressed = (GameState.keyboard_mode_hi == "hinglish")
	if sound_toggle:
		sound_toggle.button_pressed = GameState.sound_enabled
	if haptics_toggle:
		haptics_toggle.button_pressed = GameState.haptics_enabled
	if signin_button:
		signin_button.text = "Signed in" if CloudSave.is_signed_in else "Sign in with Google"
		signin_button.disabled = CloudSave.is_signed_in


func _set_lang(lang: String) -> void:
	var prev: String = GameState.current_lang
	GameState.current_lang = lang
	GameState.save_state()
	if prev != lang:
		Analytics.log_language_change(prev, lang)


func _set_kbd(mode: String) -> void:
	GameState.keyboard_mode_hi = mode
	GameState.save_state()


func _set_sound(on: bool) -> void:
	GameState.sound_enabled = on
	GameState.save_state()


func _set_haptics(on: bool) -> void:
	GameState.haptics_enabled = on
	GameState.save_state()


func _on_signin() -> void:
	Analytics.log_signin_prompt_shown("manual")
	CloudSave.sign_in_with_google()


func _on_back() -> void:
	get_tree().change_scene_to_file("res://scenes/main_menu.tscn")
