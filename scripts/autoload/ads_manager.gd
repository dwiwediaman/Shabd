extends Node
## AdsManager — AdMob rewarded video wrapper.
##
## v1.0 monetization is REWARDED-ONLY (no interstitials, no banners).
## Players opt in to watch a rewarded ad in exchange for:
##   - Hint reveal (1 letter shown in current puzzle)
##   - Extra hint per day after the free quota (1-2/day) is exhausted
##
## No forced ads. No mid-puzzle interruptions. Per the loved-game checklist.
##
## This module is plugin-agnostic. Actual AdMob calls go through a Godot
## AdMob plugin (godot-sdk-integrations/godot-admob v6.0+) wired in
## Phase 0.3 PoC. Until then, the methods below are stubs that simulate
## the reward flow so UI development can proceed.

signal ad_loaded()
signal ad_failed_to_load(reason: String)
signal ad_reward_earned(amount: int)
signal ad_dismissed()

const FREE_HINTS_PER_DAY: int = 1

var _plugin: Object = null
var _reward_loaded: bool = false


func _ready() -> void:
	_try_load_plugin()


func _try_load_plugin() -> void:
	if Engine.has_singleton("AdMob"):
		_plugin = Engine.get_singleton("AdMob")
		# _plugin.connect("rewarded_ad_loaded", Callable(self, "_on_loaded"))
		# _plugin.initialize()


## Pre-load a rewarded ad. Call this when the puzzle screen loads.
func preload_rewarded() -> void:
	if _plugin == null:
		_reward_loaded = false
		return
	# _plugin.load_rewarded_ad()


## Show a rewarded ad to the user. Returns true if the ad started.
## Caller should connect to `ad_reward_earned` for reward delivery.
func show_rewarded() -> bool:
	if _plugin == null:
		# Stub mode: simulate immediate reward for testing
		push_warning("AdsManager: plugin not loaded; simulating reward")
		ad_reward_earned.emit(1)
		ad_dismissed.emit()
		return true

	if not _reward_loaded:
		ad_failed_to_load.emit("not_ready")
		return false

	# _plugin.show_rewarded_ad()
	return true


## True if the user can still see a rewarded ad today (frequency cap not hit).
## Default cap: 5 rewarded ads/day to prevent ad-fatigue.
func has_remaining_quota() -> bool:
	# TODO: wire to a daily ad-counter persisted in GameState or local prefs.
	return true
