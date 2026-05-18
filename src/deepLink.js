// Deep-link router for shabd:// URLs.
//
// Squad-invite share links land here. The shape is:
//   shabd://squad/<inviteCode>
// The web fallback page at /Shabd/s/?c=CODE redirects to this scheme
// via window.location when the app is installed (otherwise it shows a
// Play Store CTA). See docs/s/index.html.
//
// On cold start the URL arrives BEFORE screens are registered, so we
// stash it in `pendingDeepLink` and the boot sequence consumes it once
// the UI is ready. On warm start (app already in memory) the listener
// in main.js routes immediately.

let pendingDeepLink = null;

/** Parse `shabd://squad/<code>` and return `{ kind, code }` or `null`. */
export function parseShabdDeepLink(url) {
  if (typeof url !== 'string' || !url) return null;
  // Accept either shabd://squad/CODE or shabd:squad/CODE (some launchers strip //)
  const m = url.match(/^shabd:(?:\/\/)?squad\/([A-Z0-9]{4,8})\b/i);
  if (!m) return null;
  return { kind: 'squad', code: m[1].toUpperCase() };
}

/** Stash a deep link for later consumption (cold-start case). */
export function setPendingDeepLink(parsed) {
  pendingDeepLink = parsed;
}

/** Drain the stashed deep link (single-shot — clears on read). */
export function consumePendingDeepLink() {
  const x = pendingDeepLink;
  pendingDeepLink = null;
  return x;
}
