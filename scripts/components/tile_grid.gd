extends Control
## TileGrid — 6-row × N-column grid of tiles for puzzle guesses.
##
## Each tile is a Control wrapping a ColorRect (background, drawn first)
## and a Label (letter, drawn on top). Colors load from res://assets/themes/theme.tres
## at _ready() — single source of truth.
##
## Public API:
##   - configure(tile_count, max_guesses)
##   - set_active_row(row_index, current_input_tiles)
##   - commit_row(row_index, per_tile_states, tile_strings)
##   - reset()

# Resolved at _ready() from theme.tres ("Tile" type entries).
var _color_empty: Color
var _color_active: Color
var _color_correct: Color
var _color_present: Color
var _color_absent: Color
var _color_border_empty: Color
var _color_border_active: Color
var _text_on_tile: Color
var _text_on_filled: Color

var _tiles: Array = []  # 2D array: rows[r][c] = Control (with Background + Letter children)
var _max_guesses: int = 6
var _tile_count: int = 5


func _ready() -> void:
	# Resolve theme colors. Tile type variation must exist in theme.tres.
	_color_empty = _theme_color("tile_empty", Color.WHITE)
	_color_active = _theme_color("tile_active", Color.WHITE)
	_color_correct = _theme_color("tile_correct", Color(0.29, 0.55, 0.28))
	_color_present = _theme_color("tile_present", Color(0.77, 0.66, 0.25))
	_color_absent = _theme_color("tile_absent", Color(0.47, 0.49, 0.49))
	_color_border_empty = _theme_color("tile_border_empty", Color(0.83, 0.83, 0.83))
	_color_border_active = _theme_color("tile_border_active", Color(0.10, 0.10, 0.10))
	_text_on_tile = _theme_color("text_on_tile", Color(0.10, 0.10, 0.10))
	_text_on_filled = _theme_color("text_on_filled_tile", Color.WHITE)


func _theme_color(name: String, fallback: Color) -> Color:
	# Defensive: fall back to literal if theme entry missing.
	if has_theme_color(name, "Tile"):
		return get_theme_color(name, "Tile")
	return fallback


func configure(tile_count: int, max_guesses: int = 6) -> void:
	_tile_count = tile_count
	_max_guesses = max_guesses
	_build_grid()


func _build_grid() -> void:
	for child in get_children():
		child.queue_free()
	_tiles.clear()

	for r in range(_max_guesses):
		var row_container: HBoxContainer = HBoxContainer.new()
		row_container.alignment = BoxContainer.ALIGNMENT_CENTER
		row_container.add_theme_constant_override("separation", DesignTokens.TILE_GAP)
		add_child(row_container)
		var row: Array = []
		for c in range(_tile_count):
			var tile := _make_tile()
			row_container.add_child(tile)
			row.append(tile)
		_tiles.append(row)


func _make_tile() -> Control:
	var tile := Control.new()
	tile.custom_minimum_size = Vector2(DesignTokens.TILE_SIZE, DesignTokens.TILE_SIZE)
	tile.mouse_filter = Control.MOUSE_FILTER_IGNORE

	# Background fill — drawn first.
	var bg := ColorRect.new()
	bg.name = "Background"
	bg.anchor_right = 1.0
	bg.anchor_bottom = 1.0
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bg.color = _color_empty
	tile.add_child(bg)

	# Border — thin border around tile, also a ColorRect "stroke" via 4 ColorRects
	# would be overkill. Use a single ColorRect underneath with 2px inset.
	# Simpler: use a Panel with StyleBoxFlat for border, but plan keeps tiles as ColorRect.
	# Fallback: paint a tinted edge by drawing a slightly larger ColorRect first.
	# For v1, skip border; revisit in Phase B.

	# Letter — drawn on top.
	var letter := Label.new()
	letter.name = "Letter"
	letter.anchor_right = 1.0
	letter.anchor_bottom = 1.0
	letter.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	letter.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	letter.mouse_filter = Control.MOUSE_FILTER_IGNORE
	letter.theme_type_variation = &"Tile_Latin"
	letter.add_theme_color_override("font_color", _text_on_tile)
	letter.text = ""
	tile.add_child(letter)

	return tile


func set_active_row(row_index: int, tile_strings: Array[String]) -> void:
	if row_index < 0 or row_index >= _tiles.size():
		return
	var row: Array = _tiles[row_index]
	for c in range(_tile_count):
		var tile: Control = row[c]
		var letter: Label = tile.get_node("Letter")
		letter.text = tile_strings[c] if c < tile_strings.size() else ""


func commit_row(row_index: int, per_tile_states: Array[int], tile_strings: Array[String]) -> void:
	if row_index < 0 or row_index >= _tiles.size():
		return
	var row: Array = _tiles[row_index]
	for c in range(_tile_count):
		var tile: Control = row[c]
		var letter: Label = tile.get_node("Letter")
		letter.text = tile_strings[c] if c < tile_strings.size() else ""
		var state: int = per_tile_states[c] if c < per_tile_states.size() else 0
		_apply_tile_color(tile, state)


func _apply_tile_color(tile: Control, state: int) -> void:
	var bg: ColorRect = tile.get_node("Background")
	var letter: Label = tile.get_node("Letter")
	var fill: Color = _color_empty
	var text_color: Color = _text_on_tile
	match state:
		PuzzleMechanic.TILE_STATE_CORRECT:
			fill = _color_correct
			text_color = _text_on_filled
		PuzzleMechanic.TILE_STATE_PRESENT:
			fill = _color_present
			text_color = _text_on_filled
		PuzzleMechanic.TILE_STATE_ABSENT:
			fill = _color_absent
			text_color = _text_on_filled
	bg.color = fill
	letter.add_theme_color_override("font_color", text_color)


func reset() -> void:
	for row in _tiles:
		for tile in row:
			var bg: ColorRect = tile.get_node("Background")
			var letter: Label = tile.get_node("Letter")
			letter.text = ""
			# Fix: previously only reset font_color but left Background colored
			# from prior game. Now reset both.
			bg.color = _color_empty
			letter.add_theme_color_override("font_color", _text_on_tile)
