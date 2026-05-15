// Shabd API — Cloudflare Worker entry point.
//
// Endpoints:
//   GET    /health                  → service liveness
//   POST   /auth/google             → exchange Google ID token for session JWT
//   GET    /sync/pull               Bearer → cloud-save read
//   POST   /sync/push               Bearer → cloud-save write (last-write-wins)
//   DELETE /account                 Bearer → GDPR/DPDP right-to-delete
//
// Phase 3 will add: /squads/*, /scores/submit, /squads/:id/board

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handleGoogleAuth, requireAuth, handleAccountDelete } from './auth.js';
import { handlePull, handlePush } from './sync.js';

const app = new Hono();

// ── CORS ──────────────────────────────────────────────────────────────────
// Capacitor Android WebView ships requests from `https://localhost` (default)
// or `capacitor://localhost` (older config). We allow both.
app.use('*', cors({
  origin: [
    'http://localhost',
    'https://localhost',
    'capacitor://localhost',
    'ionic://localhost',
  ],
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

// ── Public endpoints ──────────────────────────────────────────────────────
app.get('/health', (c) => c.json({
  ok:      true,
  service: 'shabd-api',
  version: '0.2.0',
  env:     c.env.APP_ENV ?? 'unknown',
  time:    new Date().toISOString(),
}));

app.post('/auth/google', handleGoogleAuth);

// ── Authenticated endpoints ───────────────────────────────────────────────
app.get   ('/sync/pull', requireAuth, handlePull);
app.post  ('/sync/push', requireAuth, handlePush);
app.delete('/account',   requireAuth, handleAccountDelete);

// ── Catch-all ─────────────────────────────────────────────────────────────
app.notFound((c) => c.json({ ok: false, error: 'not_found' }, 404));
app.onError((err, c) => {
  console.error('[shabd-api]', err);
  return c.json({ ok: false, error: 'internal_error' }, 500);
});

export default app;
