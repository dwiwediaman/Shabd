extends Node
## SeedEngine — IST-keyed deterministic daily seed.
##
## The same daily puzzle is shown to every player on the same India calendar
## date (Asia/Kolkata = UTC+5:30). Per-language: each language has its own
## seed series so HI #042 and EN #042 are different words.
##
## Seed derivation:
##   timestamp_hash = SHA256("YYYY-MM-DD" + "shabd-v1-{lang}")
##   index = first 8 bytes as uint64 → modulo daily_pool_size
##
## This is offline-deterministic; no network call required for puzzle play.
## Streak verification (anti-time-travel) goes through Firestore Cloud
## Functions — see scripts/autoload/cloud_save.gd.

const IST_OFFSET_SECONDS: int = 19800  # +5:30 hours
const SEED_VERSION: String = "shabd-v1"


## Returns the IST calendar date as 'YYYY-MM-DD' for a given UTC timestamp.
## If timestamp is omitted, uses Time.get_unix_time_from_system().
static func get_ist_date(unix_timestamp: int = -1) -> String:
	if unix_timestamp < 0:
		unix_timestamp = int(Time.get_unix_time_from_system())
	var ist_unix: int = unix_timestamp + IST_OFFSET_SECONDS
	var d: Dictionary = Time.get_datetime_dict_from_unix_time(ist_unix)
	return "%04d-%02d-%02d" % [d.year, d.month, d.day]


## Returns the absolute puzzle index since the launch epoch.
## Launch epoch is 2026-01-01 IST; #1 = 2026-01-01.
static func get_puzzle_index(ist_date: String = "") -> int:
	if ist_date.is_empty():
		ist_date = get_ist_date()

	var parts: PackedStringArray = ist_date.split("-")
	if parts.size() != 3:
		push_error("Invalid IST date: %s" % ist_date)
		return 0

	var date_dict: Dictionary = {
		"year": int(parts[0]),
		"month": int(parts[1]),
		"day": int(parts[2]),
		"hour": 0, "minute": 0, "second": 0,
	}
	var unix: int = int(Time.get_unix_time_from_datetime_dict(date_dict))
	var epoch_unix: int = 1767225600  # 2026-01-01 00:00:00 UTC
	var days_since: int = (unix - epoch_unix) / 86400
	return days_since + 1  # 1-indexed


## Generates a deterministic 64-bit seed for (date, lang).
## Use this seed as `index = seed % daily_pool_size` to pick the day's word.
static func get_daily_seed(ist_date: String, lang: String) -> int:
	var raw: String = ist_date + "|" + SEED_VERSION + "|" + lang
	var ctx: HashingContext = HashingContext.new()
	ctx.start(HashingContext.HASH_SHA256)
	ctx.update(raw.to_utf8_buffer())
	var digest: PackedByteArray = ctx.finish()

	# First 8 bytes as little-endian uint64; clamp to int63 to fit Godot's int.
	var seed: int = 0
	for i in range(8):
		seed |= int(digest[i]) << (i * 8)
	return seed & 0x7FFFFFFFFFFFFFFF  # int63 positive


## Convenience: returns (puzzle_index, seed) pair for today's puzzle.
static func today(lang: String) -> Dictionary:
	var ist: String = get_ist_date()
	return {
		"date": ist,
		"index": get_puzzle_index(ist),
		"seed": get_daily_seed(ist, lang),
		"lang": lang,
	}
