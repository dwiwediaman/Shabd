import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Structural regression test for the sticky-header bleed-through bug
// (first hit on vc101, properly fixed in vc102).
//
// Pure unit test, no browser: read style.css and assert the CSS structure
// that the fix depends on. Catches anyone re-adding padding-top to a
// scroll container or removing the safe-area padding from the header.
//
// What the actual bug was:
//   `.stats-header` is `position: sticky; top: 0` inside scrollable
//   containers (.htp-screen, .stats-screen, .settings-screen, .tt-screen).
//   Sticky's top:0 is measured from the PADDING-BOX edge of the scrolling
//   ancestor, so if the container has padding-top: 28px, the header pins
//   28px below the viewport top, leaving a transparent strip above where
//   scrolled content shows through. Fix: remove top padding from the
//   scroll containers; bake it into the header's own padding-top
//   (safe-area inset + 8px) so the header is the first thing in the
//   scrollport and its solid background covers up to the status bar.

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS_PATH  = resolve(__dirname, '../style.css');
const css       = readFileSync(CSS_PATH, 'utf8');

// Find ALL rule bodies whose selector list contains `selector`. Handles
// grouped selectors (`.menu-screen, .puzzle-screen, .stats-screen { … }`)
// AND multiple rules in different blocks for the same selector
// (e.g. `.stats-screen { … flex layout … }` THEN `.stats-screen { …
// padding … }` later in the file).
function rulesContaining(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Boundary: selector followed by `,`, whitespace, or `{` so
  // `.stats-screen` doesn't accidentally match `.stats-screen-foo`.
  const selectorBoundaryRx = new RegExp(escaped + String.raw`(?=[\s,{])`);
  const blockRx = /([^{}]+)\{([^{}]*)\}/g;
  const matches = [];
  let m;
  while ((m = blockRx.exec(css))) {
    if (selectorBoundaryRx.test(m[1])) {
      matches.push({ selectors: m[1].trim(), body: m[2] });
    }
  }
  return matches;
}

// Return the body of the rule for `selector` that declares `property`.
// Throws if no such rule exists — that's the regression we want to
// surface clearly rather than silently picking the wrong rule.
function ruleBodyDeclaring(selector, property) {
  const candidates = rulesContaining(selector);
  const propRx = new RegExp(String.raw`(?:^|\s|;|\{)` + property + String.raw`\s*:`);
  const match = candidates.find(r => propRx.test(r.body));
  if (!match) {
    throw new Error(
      `No rule for "${selector}" declares "${property}". ` +
      `Candidates found: ${candidates.length}.`
    );
  }
  return match.body;
}

describe('sticky-header CSS structure (vc102 regression guard)', () => {
  // ── Scroll containers must NOT have padding-top ────────────────────────
  // If any of these regrows a top padding, sticky top:0 will pin BELOW it
  // and content will bleed through above the header again.
  const SCROLL_CONTAINERS = [
    '.htp-screen',
    '.stats-screen',
    '.settings-screen',
    '.tt-screen',
    '.squads-screen',
  ];

  it.each(SCROLL_CONTAINERS)(
    '%s has padding-top: 0 (otherwise sticky header bleeds)',
    (selector) => {
      const body = ruleBodyDeclaring(selector, 'padding');
      const padShorthand = body.match(/padding\s*:\s*([^;]+);?/);
      expect(padShorthand, `${selector} must declare padding`).not.toBeNull();
      // First token of the shorthand = top edge. Normalise whitespace +
      // newlines to handle the multi-line padding declaration in
      // .htp-screen / .tt-screen.
      const firstToken = padShorthand[1].trim().split(/\s+/)[0];
      expect(firstToken, `${selector} padding-top token`).toBe('0');
    }
  );

  // ── .stats-header must absorb the safe-area inset ──────────────────────
  // Without this, scrolled content shows through above the back button on
  // devices with a notch and on phones generally where we want a minimum
  // 28px breathing room.
  it('.stats-header padding-top includes the safe-area inset + ≥28px floor', () => {
    const body = ruleBodyDeclaring('.stats-header', 'padding');
    const padShorthand = body.match(/padding\s*:\s*([^;]+);?/);
    expect(padShorthand, '.stats-header must declare padding').not.toBeNull();
    const decl = padShorthand[1];
    // Must use env(safe-area-inset-top, ...) so the notch is cleared.
    expect(decl).toMatch(/env\(\s*safe-area-inset-top/);
    // Must have a 28px (or bigger) floor so non-notch phones still
    // breathe. The expected shape is
    //   max(env(safe-area-inset-top, 0px), <floor>px)
    // Match the WHOLE max() — env(...) closes its own paren, then a
    // comma, then the floor, then the outer paren. This rules out the
    // env() fallback's `0px` from matching by accident.
    const floorMatch = decl.match(/max\(\s*env\([^)]+\)\s*,\s*(\d+)px\s*\)/);
    expect(floorMatch, 'expected max(env(...), <floor>px) pattern').not.toBeNull();
    const floorPx = parseInt(floorMatch[1], 10);
    expect(floorPx).toBeGreaterThanOrEqual(28);
  });

  it('.stats-header is sticky with top: 0 (the pin point we depend on)', () => {
    const body = ruleBodyDeclaring('.stats-header', 'position');
    expect(body).toMatch(/position\s*:\s*sticky/);
    expect(body).toMatch(/top\s*:\s*0/);
  });

  it('.stats-header has a solid background so scrolled content does not show through', () => {
    const body = ruleBodyDeclaring('.stats-header', 'background');
    // Either a literal colour or a var() — both fine.
    expect(body).toMatch(/background\s*:\s*(?:var\(|#|rgb)/);
  });
});
