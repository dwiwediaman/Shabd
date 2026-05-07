extends SceneTree

# Functional smoke test: load daily_puzzle, exercise the full guess flow:
#   1. configure() builds the grid
#   2. backspace removes letters
#   3. invalid word is rejected (not committed)
#   4. wrong guess → mixed CORRECT/PRESENT/ABSENT colours
#   5. correct guess → all green + "Solved" status

const OUT_DIR := "user://screenshots"

var _failures: Array[String] = []

func _initialize() -> void:
	for i in 30:
		await process_frame
	var gs := root.get_node_or_null("GameState")
	if gs:
		gs.set("has_seen_tutorial", true)
		gs.set("current_lang", "en")
		# Reset stats so streak/win counters start clean for this run.
		gs.set("current_streak_en", 0)
		gs.set("max_streak_en", 0)
		gs.set("total_played_en", 0)
		gs.set("total_won_en", 0)

	print("=== Functional test: daily_puzzle EN ===")
	var packed: PackedScene = load("res://scenes/daily_puzzle.tscn")
	var scene: Node = packed.instantiate()
	root.add_child(scene)
	for i in 15:
		await process_frame

	var tile_grid := scene.get_node_or_null("%TileGrid")
	var keyboard := scene.get_node_or_null("%Keyboard")
	var status_label: Label = scene.get_node_or_null("%StatusLabel")
	var puzzle: Variant = scene.get("_puzzle")

	if tile_grid == null or keyboard == null or puzzle == null:
		_fail("missing components: tile_grid=%s keyboard=%s puzzle=%s" % [tile_grid, keyboard, puzzle])
		return

	if tile_grid.get_child_count() == 0:
		_fail("tile_grid has zero rows — configure() did not build the grid")
		return

	var target: String = puzzle.target
	print("target word: ", target)

	# ── Test 1: backspace ─────────────────────────────────────
	print("\n[Test 1] backspace removes letters")
	keyboard.emit_signal("key_pressed", "a")
	keyboard.emit_signal("key_pressed", "b")
	keyboard.emit_signal("key_pressed", "c")
	await _settle(3)
	var current_after_typing: String = scene.get("_current_guess")
	keyboard.emit_signal("backspace_pressed")
	await _settle(3)
	var current_after_bs: String = scene.get("_current_guess")
	if current_after_typing == "abc" and current_after_bs == "ab":
		print("  PASS")
	else:
		_fail("backspace: typed='%s' after_bs='%s' (expected 'abc' then 'ab')" % [current_after_typing, current_after_bs])

	# Clear input
	for _i in current_after_bs.length():
		keyboard.emit_signal("backspace_pressed")
	await _settle(2)

	# ── Test 2: invalid-word rejection ─────────────────────────
	print("\n[Test 2] invalid word is rejected (history doesn't grow)")
	for ch in "zzzzz":
		keyboard.emit_signal("key_pressed", ch)
	await _settle(2)
	keyboard.emit_signal("submit_pressed")
	await create_timer(0.8).timeout
	var history: Array = scene.get("_history")
	if history.size() == 0:
		print("  PASS — invalid guess not committed")
	else:
		_fail("invalid word 'zzzzz' was committed (history size=%d)" % history.size())

	# Clear current guess (rejected words may stay in buffer or not depending on impl)
	var cur: String = scene.get("_current_guess")
	for _i in cur.length():
		keyboard.emit_signal("backspace_pressed")
	await _settle(2)

	# ── Test 3: wrong-but-valid guess shows mixed state ───────
	print("\n[Test 3] wrong valid guess shows mixed tile colours")
	# Use a generic well-known 5-letter starter word that's very likely in the
	# pool: "stare". If the target IS "stare", swap to "crane".
	var probe: String = "stare" if target.to_lower() != "stare" else "crane"
	for ch in probe:
		keyboard.emit_signal("key_pressed", ch)
	await _settle(2)
	keyboard.emit_signal("submit_pressed")
	await create_timer(1.4).timeout

	var hist_after_probe: Array = scene.get("_history")
	if hist_after_probe.size() != 1:
		_fail("probe '%s' did not commit (history=%d)" % [probe, hist_after_probe.size()])
	else:
		var first := tile_grid.get_child(0)
		var states: Array[String] = []
		for c in range(first.get_child_count()):
			var bg: ColorRect = first.get_child(c).get_node_or_null("Background")
			states.append(_classify_colour(bg.color) if bg else "?")
		print("  row 0 states: ", states, " for guess '%s' vs target '%s'" % [probe, target])
		if "?" in states or states.is_empty():
			_fail("could not read tile colours")

	await _save("01_after_probe.png")

	# ── Test 4: type the target → all green + Solved ──────────
	print("\n[Test 4] correct guess → all green + Solved status")
	for ch in target:
		keyboard.emit_signal("key_pressed", ch)
	await _settle(2)
	keyboard.emit_signal("submit_pressed")
	await create_timer(1.4).timeout

	# After Test 3, history is 1; the correct guess goes in row 1 (index 1).
	var second_row := tile_grid.get_child(1)
	var theme_correct := Color(0.290, 0.545, 0.278)
	var all_green := true
	for c in range(second_row.get_child_count()):
		var bg: ColorRect = second_row.get_child(c).get_node_or_null("Background")
		if bg == null or not bg.color.is_equal_approx(theme_correct):
			all_green = false
			print("  tile %d colour: %s" % [c, bg.color if bg else "(null)"])
	if all_green:
		print("  PASS — all tiles green")
	else:
		_fail("correct guess did not turn all tiles green")

	if status_label and status_label.text.find("Solved") >= 0:
		print("  PASS — status: %s" % status_label.text)
	else:
		_fail("status label did not flip to Solved (was: %s)" % (status_label.text if status_label else "null"))

	await _save("02_after_solve.png")

	# ── Summary ────────────────────────────────────────────────
	print("\n=== Summary ===")
	if _failures.is_empty():
		print("ALL TESTS PASSED")
		quit(0)
	else:
		print("FAILED (%d):" % _failures.size())
		for f in _failures:
			print("  - ", f)
		quit(1)


func _fail(msg: String) -> void:
	print("  FAIL: ", msg)
	_failures.append(msg)


func _settle(frames: int) -> void:
	for i in frames:
		await process_frame


func _save(name: String) -> void:
	for i in 3:
		await process_frame
	await RenderingServer.frame_post_draw
	var img := root.get_viewport().get_texture().get_image()
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT_DIR))
	var path := OUT_DIR.path_join("functional_" + name)
	img.save_png(path)
	print("  saved: ", ProjectSettings.globalize_path(path))


func _classify_colour(c: Color) -> String:
	if c.is_equal_approx(Color(0.290, 0.545, 0.278)):
		return "GREEN"
	if c.is_equal_approx(Color(0.768, 0.659, 0.247)):
		return "AMBER"
	if c.is_equal_approx(Color(0.471, 0.486, 0.494)):
		return "GREY"
	if c.is_equal_approx(Color(1, 1, 1)):
		return "EMPTY"
	return "rgba" + str(c)
