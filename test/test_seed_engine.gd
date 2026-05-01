extends RefCounted
## Smoke tests for SeedEngine. Run with:
##   godot --headless --path . --script res://test/test_runner.gd
##
## When the GUT addon is integrated (Phase 0.3 PoC), these will become
## proper GUT TestSuite classes. For now they're plain assertion functions.

const SeedEngineRef: GDScript = preload("res://scripts/autoload/seed_engine.gd")


static func run_all() -> Dictionary:
	var passed: int = 0
	var failed: int = 0
	var errors: Array[String] = []

	# Test 1: get_ist_date returns YYYY-MM-DD format
	var date: String = SeedEngineRef.get_ist_date()
	if date.length() == 10 and date[4] == "-" and date[7] == "-":
		passed += 1
	else:
		failed += 1
		errors.append("get_ist_date format: got %s" % date)

	# Test 2: get_daily_seed is deterministic for same inputs
	var s1: int = SeedEngineRef.get_daily_seed("2026-05-01", "hi")
	var s2: int = SeedEngineRef.get_daily_seed("2026-05-01", "hi")
	if s1 == s2:
		passed += 1
	else:
		failed += 1
		errors.append("seed determinism failed: %d != %d" % [s1, s2])

	# Test 3: hi and en seeds for the same date are different
	var s_hi: int = SeedEngineRef.get_daily_seed("2026-05-01", "hi")
	var s_en: int = SeedEngineRef.get_daily_seed("2026-05-01", "en")
	if s_hi != s_en:
		passed += 1
	else:
		failed += 1
		errors.append("hi/en seeds collided on same date")

	# Test 4: consecutive dates produce different seeds
	var s_d1: int = SeedEngineRef.get_daily_seed("2026-05-01", "hi")
	var s_d2: int = SeedEngineRef.get_daily_seed("2026-05-02", "hi")
	if s_d1 != s_d2:
		passed += 1
	else:
		failed += 1
		errors.append("consecutive-date seeds collided")

	# Test 5: puzzle_index for 2026-01-01 is 1
	var idx: int = SeedEngineRef.get_puzzle_index("2026-01-01")
	if idx == 1:
		passed += 1
	else:
		failed += 1
		errors.append("puzzle_index for epoch wrong: got %d expected 1" % idx)

	return {
		"name": "SeedEngine",
		"passed": passed,
		"failed": failed,
		"errors": errors,
	}
