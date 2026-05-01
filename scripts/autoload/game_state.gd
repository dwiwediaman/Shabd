extends Node
## GameState — singleton holding per-user state across the app.
##
## - Streak tracking (per-language)
## - Settings (theme, sound, haptics, default language)
## - Theme/cosmetic unlocks
## - Local persistence in user://state.cfg (ConfigFile)
## - Cloud sync delegated to CloudSave (only when user signs in)

signal streak_updated(lang: String, current: int, best: int)
signal puzzle_completed(lang: String, won: bool, attempts: int)
signal settings_changed()

const SAVE_PATH: String = "user://state.cfg"
const SCHEMA_VERSION: int = 1

# Per-language streak state
var current_streak_hi: int = 0
var max_streak_hi: int = 0
var current_streak_en: int = 0
var max_streak_en: int = 0

# Last completed dates (used to detect streak breaks)
var last_completed_hi: String = ""  # "YYYY-MM-DD" IST
var last_completed_en: String = ""

# Cumulative stats (per language)
var total_played_hi: int = 0
var total_won_hi: int = 0
var total_played_en: int = 0
var total_won_en: int = 0

# Settings
var current_lang: String = "en"  # "hi" or "en"
var keyboard_mode_hi: String = "hinglish"  # "hinglish" or "devanagari"
var sound_enabled: bool = true
var haptics_enabled: bool = true
var theme: String = "default"

# Unlocks
var theme_unlocks: Array[String] = ["default"]


func _ready() -> void:
	load_state()


func load_state() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		return  # First run; defaults stand.

	var cfg: ConfigFile = ConfigFile.new()
	var err: Error = cfg.load(SAVE_PATH)
	if err != OK:
		push_warning("GameState: failed to load %s (err %d); using defaults" % [SAVE_PATH, err])
		return

	# Schema migration: read version, upgrade if needed (none for v1)
	var saved_version: int = cfg.get_value("meta", "schema_version", 1)
	if saved_version > SCHEMA_VERSION:
		push_warning("GameState: save file is newer (v%d) than runtime (v%d)" % [saved_version, SCHEMA_VERSION])

	current_streak_hi = cfg.get_value("streak", "current_hi", 0)
	max_streak_hi = cfg.get_value("streak", "max_hi", 0)
	current_streak_en = cfg.get_value("streak", "current_en", 0)
	max_streak_en = cfg.get_value("streak", "max_en", 0)
	last_completed_hi = cfg.get_value("streak", "last_completed_hi", "")
	last_completed_en = cfg.get_value("streak", "last_completed_en", "")

	total_played_hi = cfg.get_value("stats", "total_played_hi", 0)
	total_won_hi = cfg.get_value("stats", "total_won_hi", 0)
	total_played_en = cfg.get_value("stats", "total_played_en", 0)
	total_won_en = cfg.get_value("stats", "total_won_en", 0)

	current_lang = cfg.get_value("settings", "current_lang", "en")
	keyboard_mode_hi = cfg.get_value("settings", "keyboard_mode_hi", "hinglish")
	sound_enabled = cfg.get_value("settings", "sound_enabled", true)
	haptics_enabled = cfg.get_value("settings", "haptics_enabled", true)
	theme = cfg.get_value("settings", "theme", "default")

	var unlocks: Variant = cfg.get_value("unlocks", "themes", ["default"])
	if unlocks is Array:
		theme_unlocks.assign(unlocks)


func save_state() -> void:
	var cfg: ConfigFile = ConfigFile.new()
	cfg.set_value("meta", "schema_version", SCHEMA_VERSION)
	cfg.set_value("streak", "current_hi", current_streak_hi)
	cfg.set_value("streak", "max_hi", max_streak_hi)
	cfg.set_value("streak", "current_en", current_streak_en)
	cfg.set_value("streak", "max_en", max_streak_en)
	cfg.set_value("streak", "last_completed_hi", last_completed_hi)
	cfg.set_value("streak", "last_completed_en", last_completed_en)
	cfg.set_value("stats", "total_played_hi", total_played_hi)
	cfg.set_value("stats", "total_won_hi", total_won_hi)
	cfg.set_value("stats", "total_played_en", total_played_en)
	cfg.set_value("stats", "total_won_en", total_won_en)
	cfg.set_value("settings", "current_lang", current_lang)
	cfg.set_value("settings", "keyboard_mode_hi", keyboard_mode_hi)
	cfg.set_value("settings", "sound_enabled", sound_enabled)
	cfg.set_value("settings", "haptics_enabled", haptics_enabled)
	cfg.set_value("settings", "theme", theme)
	cfg.set_value("unlocks", "themes", theme_unlocks)

	var err: Error = cfg.save(SAVE_PATH)
	if err != OK:
		push_error("GameState: failed to save (err %d)" % err)


## Called when a daily puzzle is completed (won or lost).
func record_daily_completion(lang: String, won: bool, attempts: int, ist_date: String) -> void:
	if lang == "hi":
		total_played_hi += 1
		if won:
			total_won_hi += 1
			_advance_streak("hi", ist_date)
		else:
			current_streak_hi = 0
			last_completed_hi = ist_date
	else:
		total_played_en += 1
		if won:
			total_won_en += 1
			_advance_streak("en", ist_date)
		else:
			current_streak_en = 0
			last_completed_en = ist_date

	save_state()
	puzzle_completed.emit(lang, won, attempts)
	streak_updated.emit(
		lang,
		current_streak_hi if lang == "hi" else current_streak_en,
		max_streak_hi if lang == "hi" else max_streak_en
	)


func _advance_streak(lang: String, ist_date: String) -> void:
	var last: String = last_completed_hi if lang == "hi" else last_completed_en
	# If last completion was yesterday, streak continues. Otherwise reset to 1.
	if _is_consecutive_day(last, ist_date):
		if lang == "hi":
			current_streak_hi += 1
			max_streak_hi = max(max_streak_hi, current_streak_hi)
			last_completed_hi = ist_date
		else:
			current_streak_en += 1
			max_streak_en = max(max_streak_en, current_streak_en)
			last_completed_en = ist_date
	else:
		if lang == "hi":
			current_streak_hi = 1
			max_streak_hi = max(max_streak_hi, 1)
			last_completed_hi = ist_date
		else:
			current_streak_en = 1
			max_streak_en = max(max_streak_en, 1)
			last_completed_en = ist_date


func _is_consecutive_day(prev: String, current: String) -> bool:
	if prev.is_empty():
		return false
	# Naive but sufficient: parse both dates, check current = prev + 1 day
	var p: PackedStringArray = prev.split("-")
	var c: PackedStringArray = current.split("-")
	if p.size() != 3 or c.size() != 3:
		return false
	var p_dict: Dictionary = {"year": int(p[0]), "month": int(p[1]), "day": int(p[2]), "hour": 0, "minute": 0, "second": 0}
	var c_dict: Dictionary = {"year": int(c[0]), "month": int(c[1]), "day": int(c[2]), "hour": 0, "minute": 0, "second": 0}
	var p_unix: int = int(Time.get_unix_time_from_datetime_dict(p_dict))
	var c_unix: int = int(Time.get_unix_time_from_datetime_dict(c_dict))
	return (c_unix - p_unix) == 86400


func unlock_theme(theme_id: String) -> void:
	if not theme_unlocks.has(theme_id):
		theme_unlocks.append(theme_id)
		save_state()
