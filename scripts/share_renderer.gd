class_name ShareRenderer extends RefCounted
## ShareRenderer — converts a puzzle history into a shareable text + image.
##
## Two output formats:
##   1. Text: emoji-grid à la Wordle (universal, works in WhatsApp/Twitter/SMS)
##   2. Image: rendered PNG of the same grid (for platforms that strip text
##      formatting or for users who want a visual share card)
##
## v1.0 ships text only. Image rendering moves to v1.1 if user feedback
## indicates the text format doesn't render well in some Indian messaging
## clients.

const TILE_EMOJI: Dictionary = {
	PuzzleMechanic.TILE_STATE_CORRECT: "🟩",
	PuzzleMechanic.TILE_STATE_PRESENT: "🟨",
	PuzzleMechanic.TILE_STATE_ABSENT: "⬜",
	PuzzleMechanic.TILE_STATE_EMPTY: "⬛",
}


## Render a share-ready text block.
##
## Format:
##   Shabd HI #042 4/6
##   ⬜🟨⬜⬜
##   🟨⬜🟩⬜
##   🟩🟩🟨⬜
##   🟩🟩🟩🟩
##
##   Play at: github.com/dwiwediaman/Shabd
static func render_text(
	puzzle: PuzzleMechanic.PuzzleData,
	history: Array,
	include_link: bool = true
) -> String:
	var lines: PackedStringArray = []
	var attempts: int = history.size()
	var won: bool = attempts > 0 and history[attempts - 1].is_correct

	var solved_in: String = "X/%d" % puzzle.max_guesses
	if won:
		solved_in = "%d/%d" % [attempts, puzzle.max_guesses]

	lines.append("Shabd %s #%d %s" % [puzzle.lang.to_upper(), puzzle.puzzle_index, solved_in])
	lines.append("")

	for guess in history:
		var row: String = ""
		for state in guess.per_tile_state:
			row += TILE_EMOJI.get(state, "⬛")
		lines.append(row)

	if include_link:
		lines.append("")
		lines.append("Play at: github.com/dwiwediaman/Shabd")

	return "\n".join(lines)


## Trigger the OS share sheet with the rendered text.
## Godot 4 doesn't have a native share API; this is delegated to a Godot
## Android plugin or a JNI call. v1.0 fallback: copy to clipboard + toast.
static func trigger_share(text: String) -> void:
	# TODO: Phase 0.3 PoC — wire AndroidShareIntent plugin.
	# For now: clipboard fallback so the share is at least one tap away.
	DisplayServer.clipboard_set(text)
	print("[ShareRenderer] Share text copied to clipboard:")
	print(text)
