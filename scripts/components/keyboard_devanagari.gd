extends Control
## KeyboardDevanagari — on-screen Devanagari keyboard.
##
## Layout (3 rows of consonants + 1 row of vowels/matras + 1 row of controls):
##   Row 1: क ख ग घ च छ ज झ ट ठ
##   Row 2: ड ढ त थ द ध न प फ ब
##   Row 3: भ म य र ल व श स ह ङ
##   Row 4: ा ि ी ु ू े ै ो ौ ं
##   Row 5: BACKSPACE  ENTER
##
## Emits:
##   - key_pressed(input: String)
##   - submit_pressed()
##   - backspace_pressed()
##
## Visual layout is built in the .tscn; this script wires button presses
## to signals.

signal key_pressed(input: String)
signal submit_pressed()
signal backspace_pressed()

const ROW_1: Array[String] = ["क", "ख", "ग", "घ", "च", "छ", "ज", "झ", "ट", "ठ"]
const ROW_2: Array[String] = ["ड", "ढ", "त", "थ", "द", "ध", "न", "प", "फ", "ब"]
const ROW_3: Array[String] = ["भ", "म", "य", "र", "ल", "व", "श", "स", "ह", "ङ"]
const ROW_4: Array[String] = ["ा", "ि", "ी", "ु", "ू", "े", "ै", "ो", "ौ", "ं"]


func _ready() -> void:
	_build_keys()


func _build_keys() -> void:
	# Build the 5 rows. The .tscn provides a VBoxContainer named "KeyRows";
	# this script populates it with HBoxContainers of buttons.
	# If the user prefers manual layout in editor, this script falls back
	# to wiring whatever buttons it finds.
	var key_rows: VBoxContainer = get_node_or_null("KeyRows")
	if key_rows == null:
		# No structured container; assume manual editor layout.
		_wire_existing_buttons()
		return

	for child in key_rows.get_children():
		child.queue_free()

	key_rows.add_theme_constant_override("separation", DesignTokens.KEY_GAP_V)
	for letters in [ROW_1, ROW_2, ROW_3, ROW_4]:
		var row: HBoxContainer = HBoxContainer.new()
		row.alignment = BoxContainer.ALIGNMENT_CENTER
		row.add_theme_constant_override("separation", DesignTokens.KEY_GAP_H)
		key_rows.add_child(row)
		for letter in letters:
			var btn: Button = Button.new()
			btn.text = letter
			btn.theme_type_variation = &"KeyboardKeyDeva"
			btn.custom_minimum_size = Vector2(DesignTokens.KEY_W, DesignTokens.KEY_H)
			btn.pressed.connect(func(): key_pressed.emit(letter))
			row.add_child(btn)

	# Control row
	var controls: HBoxContainer = HBoxContainer.new()
	controls.alignment = BoxContainer.ALIGNMENT_CENTER
	controls.add_theme_constant_override("separation", DesignTokens.KEY_GAP_H)
	key_rows.add_child(controls)

	var bs: Button = Button.new()
	bs.text = "⌫"
	bs.theme_type_variation = &"KeyboardKey"
	bs.custom_minimum_size = Vector2(DesignTokens.KEY_W_BACKSPACE, DesignTokens.KEY_H)
	bs.pressed.connect(func(): backspace_pressed.emit())
	controls.add_child(bs)

	var enter: Button = Button.new()
	enter.text = "ENTER"
	enter.theme_type_variation = &"KeyboardEnter"
	enter.custom_minimum_size = Vector2(DesignTokens.KEY_W_ENTER, DesignTokens.KEY_H)
	enter.pressed.connect(func(): submit_pressed.emit())
	controls.add_child(enter)


func _wire_existing_buttons() -> void:
	# Recurse: any Button whose name == its text gets wired as a key.
	# Buttons named "Backspace" / "Enter" / "Submit" get wired specially.
	for btn in _find_all_buttons(self):
		match btn.name.to_lower():
			"backspace", "bksp":
				btn.pressed.connect(func(): backspace_pressed.emit())
			"enter", "submit", "send":
				btn.pressed.connect(func(): submit_pressed.emit())
			_:
				var t: String = btn.text
				btn.pressed.connect(func(): key_pressed.emit(t))


func _find_all_buttons(node: Node) -> Array[Button]:
	var out: Array[Button] = []
	for child in node.get_children():
		if child is Button:
			out.append(child)
		out.append_array(_find_all_buttons(child))
	return out
