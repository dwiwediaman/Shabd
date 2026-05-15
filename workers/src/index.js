// Shabd API — Cloudflare Worker entry point.
//
// Endpoints (Phase 1):
//   GET  /health                  → service liveness
//
// Phase 2 will add:
//   POST /auth/google             → exchange Google ID token for session JWT
//   GET  /sync/pull               → cloud-save read
//   POST /sync/push               → cloud-save write
//   POST /squads/create           → create a leaderboard squad
//   POST /squads/join             → join via invite code
//   GET  /squads/:id/board        → today's leaderboard
//   POST /scores/submit           → submit a play (server replays vs word DB)
//   DELETE /account               → wipe user data (GDPR / DPDP)

import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// CORS — allow the Capacitor WebView origins + localhost dev.
app.use('*', cors({
  origin: [
    'http://localhost',
    'https://localhost',
    'capacitor://localhost',  // Capacitor Android WebView
    'ionic://localhost',      // Capacitor iOS WebView (just in case)
  ],
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

// ── Health check ───────────────────────────────────────────────────────────
app.get('/health', (c) => {
  return c.json({
    ok:      true,
    service: 'shabd-api',
    version: '0.1.0',
    env:     c.env.APP_ENV ?? 'unknown',
    time:    new Date().toISOString(),
  });
});

// 404 fallback
app.notFound((c) => c.json({ ok: false, error: 'not_found' }, 404));

// Unhandled error fallback
app.onError((err, c) => {
  console.error('[shabd-api]', err);
  return c.json({ ok: false, error: 'internal_error' }, 500);
});

export default app;
