# Shabd API (Cloudflare Worker)

Backend for Shabd. Provides:

- **Cloud save** — back up sessions/freezes/prefs across reinstalls
- **Squads** — private friend leaderboards with anti-cheat
- **Auth** — Google Sign-In, server-issued session JWTs

Lives in `workers/`. Deployed automatically by GitHub Actions on push (see `.github/workflows/deploy-worker.yml`).

---

## One-time setup (you, the human)

Do these once. After that everything is automated.

### 1. Cloudflare account
- Sign up at <https://dash.cloudflare.com/sign-up> (free).
- Note your **Account ID** from the right sidebar of the dashboard.
- Your worker URL will be `https://shabd-api.<your-subdomain>.workers.dev`. Pick the subdomain when prompted on first deploy.

### 2. Create a Cloudflare API token
- Dashboard → My Profile → API Tokens → Create Token
- Template: **Edit Cloudflare Workers**
- Account Resources: include the account you just created
- Save the token (shown once).

### 3. Install Wrangler locally
```bash
cd workers
npm install
npx wrangler login        # browser-based OAuth
```

### 4. Create the D1 database
```bash
npm run db:create
```
Copy the `database_id` from the output into `wrangler.toml`:
```toml
[[d1_databases]]
binding       = "DB"
database_name = "shabd-db"
database_id   = "..."     # paste here
```

### 5. Run initial migrations
```bash
npm run db:migrate:remote
```

### 6. Set session secret
```bash
# Generate a random 32+ character string
openssl rand -base64 48 | npx wrangler secret put SESSION_JWT_SECRET
```

### 7. Add Google OAuth Client ID
Get one from Google Cloud Console → Credentials → Create OAuth Client → **Android** (use your app's SHA-1 cert fingerprint + `in.shabd.game`).

Paste the client ID into `wrangler.toml` under `[vars] GOOGLE_CLIENT_ID`.

### 8. First deploy
```bash
npm run deploy
```
Should output: `Deployed shabd-api triggers... shabd-api.<your-subdomain>.workers.dev`.

Test it:
```bash
curl https://shabd-api.<your-subdomain>.workers.dev/health
# {"ok":true,"service":"shabd-api","version":"0.1.0",...}
```

### 9. Add CI/CD secrets to GitHub
For automated deploys, add these to the GitHub repo → Settings → Secrets and variables → Actions:

| Name | Value |
|------|-------|
| `CLOUDFLARE_API_TOKEN` | from step 2 |
| `CLOUDFLARE_ACCOUNT_ID` | from step 1 (right sidebar) |
| `CLOUDFLARE_WORKERS_SUBDOMAIN` | your chosen subdomain (without `.workers.dev`) |

After this, every push to `main` or `capacitor-app` that touches `workers/` auto-deploys.

---

## Local development

```bash
cd workers
npm run dev               # starts wrangler dev with local D1
# → http://localhost:8787
curl http://localhost:8787/health
```

Local D1 lives in `workers/.wrangler/state/d1/` — gitignored.

---

## D1 cheat sheet

```bash
# Apply migrations locally
npm run db:migrate:local

# Apply migrations to production
npm run db:migrate:remote

# Run a one-off SQL command (local)
npm run db:console:local -- "SELECT count(*) FROM users"

# Same against production
npm run db:console:remote -- "SELECT count(*) FROM users"

# Tail live worker logs
npm run tail
```

---

## Endpoints (Phase 1)

| Method | Path     | Auth   | Purpose          |
|--------|----------|--------|------------------|
| GET    | /health  | none   | Liveness check   |

More endpoints land in Phase 2 (`/auth/google`, `/sync/*`, `/squads/*`, `/scores/submit`).

---

## Cost

At expected scale (≤6,600 DAU): **$0/month**. See [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) and [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/). Free tier ceilings:
- Workers: 100k requests/day
- D1: 5 GB storage, 5M row reads/day, 100k row writes/day
