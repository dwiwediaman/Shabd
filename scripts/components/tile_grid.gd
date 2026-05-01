extends Control
## TileGrid — 6-row × N-column grid of tiles for puzzle guesses.
##
## Public API:
##   - configure(tile_count, max_guesses)
##   - set_active_row(row_index, current_input_tiles)
##   - commit_row(row_index, per_tile_states, tile_strings)
##   - reset()
##
## Visual layout, animation, and theming are handled in the .tscn editor.
## This script is the data binding layer.

const TILE_COLOR_EMPTY: Color = Color(0.95, 0.94, 0.92, 1.0)
const TILE_COLOR_CORRECT: Color = Color(0.41, 0.69, 0.31, 1.0)  # green
const TILE_COLOR_PRESENT: Color = Color(0.93, 0.69, 0.20, 1.0)  # amber
const TILE_COLOR_ABSENT: Color = Color(0.50, 0.50, 0.50, 1.0)   # grey
const TILE_TEXT_LIGHT: Color = Color.WHITE
const TILE_TEXT_DARK: Color = Color(0.13, 0.13, 0.13, 1.0)

@export var tile_scene: PackedScene  # Reference to a tile.tscn (Label-based)

var _tiles: Array = []  # 2D array: rows[r][c] = Label
var _max_guesses: int = 6
var _tile_count: int = 5


func configure(tile_count: int, max_guesses: int = 6) -> void:
	_tile_count = tile_count
	_max_guesses = max_guesses
	_build_grid()


func _build_grid() -> void:
	# Clear existing
	for child in get_children():
		child.queue_free()
	_tiles.clear()

	# Build rows: each row is an HBoxContainer of tile_count Labels
	# In the .tscn, this script attaches to a VBoxContainer parent.
	for r in range(_max_guesses):
		var row_container: HBoxContainer = HBoxContainer.new()
		row_container.alignment = BoxContainer.ALIGNMENT_CENTER
		add_child(row_container)
		var row: Array = []
		for c in range(_tile_count):
			var tile: Label = Label.new()
			tile.custom_minimum_size = Vector2(80, 80)
			tile.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			tile.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
			tile.add_theme_color_override("font_color", TILE_TEXT_DARK)
			tile.text = ""
			row_container.add_child(tile)
			row.append(tile)
		_tiles.append(row)


func set_active_row(row_index: int, tile_strings: Array[String]) -> void:
	if row_index < 0 or row_index >= _tiles.size():
		return
	var row: Array = _tiles[row_index]
	for c in range(_tile_count):
		var tile: Label = row[c]
		tile.text = tile_strings[c] if c < tile_strings.size() else ""


func commit_row(row_index: int, per_tile_states: Array[int], tile_strings: Array[String]) -> void:
	if row_index < 0 or row_index >= _tiles.size():
		return
	var row: Array = _tiles[row_index]
	for c in range(_tile_count):
		var tile: Label = row[c]
		tile.text = tile_strings[c] if c < tile_strings.size() else ""
		var state: int = per_tile_states[c] if c < per_tile_states.size() else 0
		_apply_tile_color(tile, state)


func _apply_tile_color(tile: Label, state: int) -> void:
	var bg: ColorRect = tile.get_node_or_null("Background")
	var fill: Color = TILE_COLOR_EMPTY
	var text_color: Color = TILE_TEXT_DARK
	match state:
		PuzzleMechanic.TILE_STATE_CORRECT:
			fill = TILE_COLOR_CORRECT
			text_color = TILE_TEXT_LIGHT
		PuzzleMechanic.TILE_STATE_PRESENT:
			fill = TILE_COLOR_PRESENT
			text_color = TILE_TEXT_LIGHT
		PuzzleMechanic.TILE_STATE_ABSENT:
			fill = TILE_COLOR_ABSENT
			text_color = TILE_TEXT_LIGHT
	tile.add_theme_color_override("font_color", text_color)
	if bg:
		bg.color = fill


func reset() -> void:
	for row in _tiles:
		for tile in row:
			tile.text = ""
			tile.add_theme_color_override("font_color", TILE_TEXT_DARK)
