extends Node
## Analytics — Firebase Analytics wrapper for game events.
##
## Tracks the loved-game retention signals:
##   - daily_puzzle_attempt / daily_puzzle_solved
##   - share_tapped (Wordle-style emoji-grid share)
##   - practice_session_started
##   - hint_used / rewarded_ad_watched
##   - language_mode_selected / language_mode_switched
##   - theme_unlocked
##
## All events are fire-and-forget; UI never blocks on Analytics.
##
## Plugin-agnostic. Phase 0.3 PoC wires the actual Firebase plugin.

var _plugin: Object = null
var _enabled: bool = true


func _ready() -> void:
	if Engine.has_singleton("FirebaseAnalytics"):
		_plugin = Engine.get_singleton("FirebaseAnalytics")


## Generic event logger. Caller passes name + params dict.
func log_event(event_name: String, params: Dictionary = {}) -> void:
	if not _enabled or _plugin == null:
		# Stub mode: print so dev iteration is visible
		print("[Analytics] %s %s" % [event_name, params])
		return
	# _plugin.log_event(event_name, params)


# Convenience helpers for the most-used events

func log_daily_attempt(lang: String, puzzle_index: int) -> void:
	log_event("daily_puzzle_attempt", {"lang": lang, "puzzle_index": puzzle_index})


func log_daily_solved(lang: String, puzzle_index: int, attempts: int, time_ms: int) -> void:
	log_event("daily_puzzle_solved", {
		"lang": lang,
		"puzzle_index": puzzle_index,
		"attempts": attempts,
		"time_ms": time_ms,
	})


func log_daily_failed(lang: String, puzzle_index: int) -> void:
	log_event("daily_puzzle_failed", {
		"lang": lang,
		"puzzle_index": puzzle_index,
	})


func log_share_tapped(lang: String, puzzle_index: int, won: bool) -> void:
	log_event("share_tapped", {
		"lang": lang,
		"puzzle_index": puzzle_index,
		"won": won,
	})


func log_practice_session(lang: String, completed: int) -> void:
	log_event("practice_session", {"lang": lang, "completed": completed})


func log_hint_used(lang: String, source: String) -> void:
	# source: "free", "rewarded_ad"
	log_event("hint_used", {"lang": lang, "source": source})


func log_language_change(from_lang: String, to_lang: String) -> void:
	log_event("language_mode_switched", {"from": from_lang, "to": to_lang})


func log_theme_unlocked(theme_id: String, source: String) -> void:
	# source: "streak_reward", "iap" (v1.1+), "promo"
	log_event("theme_unlocked", {"theme_id": theme_id, "source": source})


func log_signin_prompt_shown(trigger: String) -> void:
	# trigger: "7_day_streak", "first_unlock", "manual"
	log_event("signin_prompt_shown", {"trigger": trigger})


func log_signin_completed(provider: String, success: bool) -> void:
	log_event("signin_completed", {"provider": provider, "success": success})


func set_enabled(enabled: bool) -> void:
	_enabled = enabled
