extends SceneTree

# Functional smoke test: load daily_puzzle, simulate typing + submit,
# assert tile colours actually update.

const OUT_DIR := "user://screenshots"

func _initialize() -> void:
	for i in 30:
		await process_frame
	var gs := root.get_node_or_null("GameState")
	if gs:
		gs.set("has_seen_tutorial", true)
		gs.set("current_lang", "en")

	print("--- Functional test: Daily puzzle EN ---")
	var packed: PackedScene = load("res://scenes/daily_puzzle.tscn")
	var scene: Node = packed.instantiate()
	root.add_child(scene)

	# Let _ready + autoload chain settle
	for i in 15:
		await process_frame

	# Locate components
	var tile_grid := scene.get_node_or_null("%TileGrid")
	var keyboard := scene.get_node_or_null("%Keyboard")
	var status_label: Label = scene.get_node_or_null("%StatusLabel")
	var script_var: Variant = scene.get("_puzzle")

	print("tile_grid: ", tile_grid)
	print("keyboard: ", keyboard)
	print("status: ", status_label.text if status_label else "(null)")
	print("_puzzle: ", script_var)
	if script_var:
		print("  target: ", script_var.target)
		print("  tile_count: ", script_var.tile_count)

	if tile_grid == null or keyboard == null or script_var == null:
		print("FAIL: missing components")
		quit(1)
		return

	# Verify tile grid is built (was the fix)
	var grid_children := tile_grid.get_child_count()
	print("tile_grid child count (rows): ", grid_children)
	if grid_children == 0:
		print("FAIL: tile_grid has zero rows — configure() not called or failed")
		quit(2)
		return

	# Snapshot before typing
	await _save("00_before_typing.png")

	# Simulate typing the target word (so we can verify all-correct state)
	var target: String = script_var.target
	print("Typing target word: ", target)
	for ch in target:
		keyboard.emit_signal("key_pressed", ch.to_lower())
		await process_frame
	await _save("01_after_typing.png")

	# Submit
	print("Submitting…")
	keyboard.emit_signal("submit_pressed")
	for i in 15:
		await process_frame
	await _save("02_after_submit.png")

	# Inspect first row's colours — should all be tile_correct (green) since we typed the answer.
	var first_row := tile_grid.get_child(0)
	if first_row == null:
		print("FAIL: no first row")
		quit(3)
		return

	var theme_correct: Color = scene.get_theme_color("tile_correct", "Tile") if scene.has_theme_color("tile_correct", "Tile") else Color(0.290, 0.545, 0.278)
	print("Expected green: ", theme_correct)

	var ok := true
	for c in range(first_row.get_child_count()):
		var tile: Node = first_row.get_child(c)
		var bg: ColorRect = tile.get_node_or_null("Background")
		if bg == null:
			print("  tile %d: no Background ColorRect" % c)
			ok = false
			continue
		print("  tile %d colour: %s" % [c, bg.color])
		if not bg.color.is_equal_approx(theme_correct):
			ok = false

	if ok:
		print("PASS: tiles all green after correct guess")
		quit(0)
	else:
		print("FAIL: tile colours did not update to green after correct guess")
		quit(10)


func _save(name: String) -> void:
	for i in 3:
		await process_frame
	await RenderingServer.frame_post_draw
	var img := root.get_viewport().get_texture().get_image()
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT_DIR))
	var path := OUT_DIR.path_join("functional_" + name)
	img.save_png(path)
	print("  saved: ", ProjectSettings.globalize_path(path))
