// Cloud backend configuration.
//
// API_BASE points at the Cloudflare Worker. WEB_CLIENT_ID is the Google OAuth
// Web Client ID — it becomes the `aud` claim of the ID token, which the worker
// verifies against its own GOOGLE_CLIENT_ID env var. The two must match.

export const API_BASE        = 'https://shabd-api.dwiwediaman-shabd.workers.dev';
export const WEB_CLIENT_ID   = '345143844571-bc5hflbdgue0qphais119t4fob9ounik.apps.googleusercontent.com';

// LocalStorage keys (kept in one place so we can audit what we store)
export const LS_KEYS = {
  sessionToken:    'shabd_cloud_session',       // our HS256 session JWT
  userId:          'shabd_cloud_userId',        // our internal user_id
  nickname:        'shabd_cloud_nickname',
  lastSyncAt:      'shabd_cloud_lastSyncAt',
  // Bumped to v2 on vc105 so every client re-runs a full pushAll on next
  // launch — needed because the previous worker silently dropped sessions
  // older than 7 days during /sync/push (anti-cheat H3, removed in vc105),
  // and the 24-hour ensureBackfilled throttle otherwise prevents the
  // re-push from happening. Reading the old key returns null → throttle
  // sees "never backfilled" → full push runs once. After that, the new
  // key carries the throttle as usual.
  lastBackfillAt:  'shabd_cloud_lastBackfillAt_v2',// last successful full push (cold-start throttle)
  pendingPush:     'shabd_cloud_pendingPush',   // '1' when a submitScore failed → bypass 24h throttle on next ensureBackfilled
  signedIn:        'shabd_cloud_signedIn',      // boolean string flag
};
