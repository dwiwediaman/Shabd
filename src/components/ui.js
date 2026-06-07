// ── Shared UI utilities ────────────────────────────────────────────────────
// Small helpers used across multiple screens. Keep this file free of any
// game-logic or state dependencies — pure DOM/string utilities only.

/**
 * Populate a star-field container with randomly-positioned twinkling dots.
 * @param {string} id     - The element ID to fill (must be in the DOM already)
 * @param {number} count  - Number of stars to spawn (default 50)
 */
export function spawnStars(id, count = 50) {
  const el = document.getElementById(id);
  if (!el) return;
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const sz = Math.random() * 2 + 0.5;
    s.style.cssText = `width:${sz}px;height:${sz}px;left:${Math.random() * 100}%;top:${Math.random() * 100}%;animation-delay:${Math.random() * 3}s;animation-duration:${2 + Math.random() * 3}s;`;
    el.appendChild(s);
  }
}

/**
 * Escape a string for safe insertion into HTML.
 * Handles & < > " ' — the five characters that must be escaped in HTML text
 * and attribute values.
 * @param {*} s - Value to escape (coerced to string)
 * @returns {string}
 */
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}
