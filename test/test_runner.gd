extends SceneTree
## Test runner — executes all test_*.gd files in res://test/ headlessly.
##
## Usage:
##   godot --headless --path . --script res://test/test_runner.gd
##
## Exits with code 0 on success, 1 on any test failure.


func _init() -> void:
	print("=== Shabd test runner ===")
	var total_passed: int = 0
	var total_failed: int = 0
	var all_errors: Array[String] = []

	# Manually register test suites (no auto-discovery to avoid Godot import races)
	var suites: Array = []

	var seed_tests: GDScript = load("res://test/test_seed_engine.gd")
	if seed_tests != null:
		suites.append(seed_tests)

	for suite in suites:
		var result: Dictionary = suite.run_all()
		print("[%s] passed=%d failed=%d" % [result.name, result.passed, result.failed])
		total_passed += result.passed
		total_failed += result.failed
		for err in result.errors:
			all_errors.append("[%s] %s" % [result.name, err])

	print("\n=== Summary: %d passed, %d failed ===" % [total_passed, total_failed])
	if total_failed > 0:
		for err in all_errors:
			print("  FAIL: %s" % err)
		quit(1)
	else:
		quit(0)
