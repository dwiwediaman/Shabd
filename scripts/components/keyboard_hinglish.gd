extends Control
## KeyboardHinglish — Roman keyboard with auto-commit Devanagari conversion
## and a 3-candidate suggestion strip for ambiguous mappings.
##
## Per Phase 0.6 input strategy: most common Hindi words need 2-3 Roman
## chars per akshara. The auto-commit fires when the user types a
## next-base-consonant after a vowel-completed cluster — we infer that
## the previous akshara is done and emit `key_pressed(akshara)`.
##
## For ambiguous cases (~20% of common words), the suggestion strip shows
## top-3 candidate Devanagari aksharas; tapping commits that variant.

signal key_pressed(input: String)
signal submit_pressed()
signal backspace_pressed()

const ROW_1: Array[String] = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"]
const ROW_2: Array[String] = ["a", "s", "d", "f", "g", "h", "j", "k", "l"]
const ROW_3: Array[String] = ["z", "x", "c", "v", "b", "n", "m"]

var _transliterator: HinglishTransliterator = HinglishTransliterator.new()
var _pending_roman: String = ""
@onready var suggestion_strip: HBoxContainer = $SuggestionStrip if has_node("SuggestionStrip") else null


func _ready() -> void:
	_build_keys()


func _build_keys() -> void:
	var key_rows: VBoxContainer = get_node_or_null("KeyRows")
	if key_rows == null:
		_wire_existing_buttons()
		return

	for child in key_rows.get_children():
		child.queue_free()

	key_rows.add_theme_constant_override("separation", DesignTokens.KEY_GAP_V)
	# Row 1 + Row 2 are letters only.
	for letters in [ROW_1, ROW_2]:
		var row: HBoxContainer = HBoxContainer.new()
		row.alignment = BoxContainer.ALIGNMENT_CENTER
		row.add_theme_constant_override("separation", DesignTokens.KEY_GAP_H)
		key_rows.add_child(row)
		for ch in letters:
			var btn: Button = Button.new()
			btn.text = ch
			btn.theme_type_variation = &"KeyboardKey"
			btn.custom_minimum_size = Vector2(DesignTokens.KEY_W, DesignTokens.KEY_H)
			btn.pressed.connect(func(): _on_roman_key(ch))
			row.add_child(btn)

	# Row 3: ENTER + z..m + BACKSPACE (Wordle layout).
	var row3: HBoxContainer = HBoxContainer.new()
	row3.alignment = BoxContainer.ALIGNMENT_CENTER
	row3.add_theme_constant_override("separation", DesignTokens.KEY_GAP_H)
	key_rows.add_child(row3)

	var enter: Button = Button.new()
	enter.text = "ENTER"
	enter.theme_type_variation = &"KeyboardEnter"
	enter.custom_minimum_size = Vector2(DesignTokens.KEY_W_ENTER, DesignTokens.KEY_H)
	enter.pressed.connect(func(): _on_submit())
	row3.add_child(enter)

	for ch in ROW_3:
		var btn: Button = Button.new()
		btn.text = ch
		btn.theme_type_variation = &"KeyboardKey"
		btn.custom_minimum_size = Vector2(DesignTokens.KEY_W, DesignTokens.KEY_H)
		btn.pressed.connect(func(): _on_roman_key(ch))
		row3.add_child(btn)

	var bs: Button = Button.new()
	bs.text = "⌫"
	bs.theme_type_variation = &"KeyboardKey"
	bs.custom_minimum_size = Vector2(DesignTokens.KEY_W_BACKSPACE, DesignTokens.KEY_H)
	bs.pressed.connect(func(): _on_backspace())
	row3.add_child(bs)


func _on_roman_key(ch: String) -> void:
	_pending_roman += ch

	# Try transliteration on the pending buffer
	var result: Dictionary = _transliterator.transliterate_chunk(_pending_roman)
	var candidates: Array = result.get("candidates", [])

	# Auto-commit if confident OR if a base consonant boundary just arrived
	# AND the prior buffer (without this char) had a confident match.
	if result.get("confident", false):
		_show_suggestions([])
		# Don't commit yet — wait for next key or explicit commit signal
		return

	if HinglishTransliterator.is_consonant_boundary(ch) and _pending_roman.length() > 1:
		# Try the prefix without the new consonant
		var prefix: String = _pending_roman.substr(0, _pending_roman.length() - 1)
		var prefix_result: Dictionary = _transliterator.transliterate_chunk(prefix)
		var prefix_akshara: String = prefix_result.get("akshara", "")
		if not prefix_akshara.is_empty():
			# Commit prefix akshara, restart buffer with the new consonant
			key_pressed.emit(prefix_akshara)
			_pending_roman = ch
			# Re-evaluate suggestions for the new buffer
			result = _transliterator.transliterate_chunk(_pending_roman)
			candidates = result.get("candidates", [])

	_show_suggestions(candidates)


func _on_backspace() -> void:
	if not _pending_roman.is_empty():
		_pending_roman = _pending_roman.substr(0, _pending_roman.length() - 1)
		var result: Dictionary = _transliterator.transliterate_chunk(_pending_roman)
		_show_suggestions(result.get("candidates", []))
	else:
		backspace_pressed.emit()


func _on_submit() -> void:
	# Flush pending roman as akshara if possible, then submit
	if not _pending_roman.is_empty():
		var result: Dictionary = _transliterator.transliterate_chunk(_pending_roman)
		var akshara: String = result.get("akshara", "")
		if not akshara.is_empty():
			key_pressed.emit(akshara)
		_pending_roman = ""
	submit_pressed.emit()


func _show_suggestions(candidates: Array) -> void:
	if suggestion_strip == null:
		return
	for child in suggestion_strip.get_children():
		child.queue_free()
	for c in candidates.slice(0, 3):
		var btn: Button = Button.new()
		btn.text = c
		btn.theme_type_variation = &"KeyboardKeyDeva"
		btn.custom_minimum_size = Vector2(72, 64)
		btn.pressed.connect(func(): _on_suggestion_tapped(c))
		suggestion_strip.add_child(btn)


func _on_suggestion_tapped(akshara: String) -> void:
	key_pressed.emit(akshara)
	_pending_roman = ""
	_show_suggestions([])


func _wire_existing_buttons() -> void:
	for btn in _find_all_buttons(self):
		match btn.name.to_lower():
			"backspace", "bksp":
				btn.pressed.connect(func(): _on_backspace())
			"enter", "submit", "send":
				btn.pressed.connect(func(): _on_submit())
			_:
				var t: String = btn.text
				btn.pressed.connect(func(): _on_roman_key(t))


func _find_all_buttons(node: Node) -> Array[Button]:
	var out: Array[Button] = []
	for child in node.get_children():
		if child is Button:
			out.append(child)
		out.append_array(_find_all_buttons(child))
	return out
