extends Node

# Design system spacing + sizing tokens. Autoloaded as `DesignTokens`.
#
# Colors and font_sizes do NOT live here — they're in res://assets/themes/theme.tres.
# This is per the architect-reviewer's single-source-of-truth rule: theme owns
# visual output, this file owns layout math used by procedural code.
#
# Base viewport: 1080x1920 portrait. Values are in canvas pixels at that base.

# 8px base spacing scale. All gaps, margins, padding are multiples of 8.
const XS: int = 4
const SM: int = 8
const MD: int = 16
const LG: int = 24
const XL: int = 40
const XXL: int = 64

# Tile grid sizing (consumed by scripts/components/tile_grid.gd).
# 1080-wide viewport: 5 tiles × 96 + 4 × 8 = 512 (47% width util — feels right
# next to a 974px keyboard). Bigger than Wordle web's ratio because mobile
# wants more letter weight per tile.
const TILE_SIZE: int = 96
const TILE_GAP: int = 8

# Keyboard key sizing (consumed by keyboard_hinglish.gd / keyboard_devanagari.gd).
# 1080-wide viewport: row 1 has 10 keys → 10×92 + 9×6 = 974 (90% width util),
# matching native iOS/Android keyboards. Don't shrink without re-checking row fit.
const KEY_W: int = 92
const KEY_H: int = 88
const KEY_W_BACKSPACE: int = 138
const KEY_W_ENTER: int = 138
const KEY_GAP_H: int = 6
const KEY_GAP_V: int = 10

# Touch targets — minimum hit area (per WCAG / Android material guidelines).
const TOUCH_MIN: int = 44

# Button heights by role (canvas px).
const BUTTON_H_PRIMARY: int = 88
const BUTTON_H_SECONDARY: int = 80
const BUTTON_H_TERTIARY: int = 80  # icon-only header buttons (square)

# Devanagari size scale — applied only via theme variation Label_DEVA, not in code.
# Documented here for cross-reference.
const DEVA_SIZE_SCALE: float = 1.1
