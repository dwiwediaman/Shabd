extends Node
## CloudSave — Firebase Auth (Google Sign-In) + Firestore wrapper.
##
## v1.0 sign-in is DEFERRED: the prompt only appears after the first
## 7-day streak or first cosmetic unlock — when the user has something
## to lose. Anonymous play is supported with local-only persistence
## (handled by GameState).
##
## This module is plugin-agnostic. The actual Firebase calls go through
## a Godot Firebase plugin chosen during Phase 0.3 PoC. Until that plugin
## is integrated, the methods below are stubs that log calls and return
## graceful failures so the rest of the game runs without crashing.

signal sign_in_completed(success: bool, uid: String, email: String)
signal cloud_state_loaded(state: Dictionary)
signal cloud_state_saved(success: bool)

var is_signed_in: bool = false
var current_uid: String = ""
var _plugin: Object = null  # Set by Phase 0.3 PoC integration


func _ready() -> void:
	_try_load_plugin()


func _try_load_plugin() -> void:
	# Phase 0.3 PoC will replace this with the real plugin lookup.
	# Common plugins to consider: godot-firebase, godot-firebase-auth.
	# For now, leave as null; methods below handle the null case gracefully.
	if Engine.has_singleton("FirebaseAuth"):
		_plugin = Engine.get_singleton("FirebaseAuth")


## Trigger Google Sign-In flow. Caller is expected to be a button handler.
func sign_in_with_google() -> void:
	if _plugin == null:
		push_warning("CloudSave: Firebase plugin not loaded; sign-in unavailable")
		sign_in_completed.emit(false, "", "")
		return

	# Plugin-specific: actual call here. Pseudocode:
	# _plugin.sign_in_with_google()
	# _plugin.connect("auth_completed", Callable(self, "_on_auth_completed"))
	push_warning("CloudSave: sign-in stub; integrate plugin in Phase 0.3")
	sign_in_completed.emit(false, "", "")


func sign_out() -> void:
	if _plugin == null:
		return
	# _plugin.sign_out()
	is_signed_in = false
	current_uid = ""


## Load the user's Firestore state document.
func load_cloud_state() -> void:
	if not is_signed_in or _plugin == null:
		cloud_state_loaded.emit({})
		return
	# Pseudocode:
	# var doc = await _plugin.firestore.collection("users").document(current_uid).get()
	# cloud_state_loaded.emit(doc.data)
	cloud_state_loaded.emit({})


## Save the user's state to Firestore. Called after each daily completion.
## The save is fire-and-forget; UI proceeds regardless of cloud status.
##
## Server-time verification: Firestore security rules reject writes where
## client-claimed puzzle_index does not match server-computed IST date.
## See `firestore.rules` (TODO: add to repo).
func save_cloud_state(state: Dictionary) -> void:
	if not is_signed_in or _plugin == null:
		cloud_state_saved.emit(false)
		return
	# Pseudocode:
	# var doc_ref = _plugin.firestore.collection("users").document(current_uid)
	# state["server_timestamp"] = FieldValue.server_timestamp()
	# await doc_ref.set(state, {merge: true})
	cloud_state_saved.emit(true)


## Determine whether to prompt the user to sign in.
## Trigger conditions (per v3 plan): first 7-day streak OR first cosmetic unlock.
static func should_prompt_signin() -> bool:
	if GameState.current_streak_hi >= 7 or GameState.current_streak_en >= 7:
		return true
	if GameState.theme_unlocks.size() > 1:  # default + at least one other
		return true
	return false
