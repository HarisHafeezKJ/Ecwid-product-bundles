# Product Bundles & Upsells for Ecwid

Ecwid external app for quantity breaks, fixed bundles, mix & match, and cart upsells. Rebuilt from the Wix migration spec using **Ecwid Application Storage** (no external database).

## Configuration

### `.env` (only 3 variables)

```env
ECWID_CLIENT_ID=your_client_id
ECWID_CLIENT_SECRET=your_client_secret
PORT=3001
```

Secrets are read from `.env` files only — no server environment variables required. Place `.env` at the repo root or in `server/`.

All other settings live in **`app.manifest.json`**:

| Field | Purpose |
|-------|---------|
| `scopes` | OAuth permissions (used in install URL) |
| `paths.adminMount` | Admin UI path (`/admin`) |
| `paths.storefrontScript` | Storefront JS URL path |
| `paths.oauthCallback` | OAuth redirect path |
| `paths.webhook` | Order webhook path |
| `storage.*` | Ecwid Application Storage keys |

**URLs are auto-detected** from each HTTP request (`Host`, `X-Forwarded-Proto`, `X-Forwarded-Host`). OAuth redirect, admin, storefront script, and API URLs are built dynamically — nothing hardcoded in env.

### Ecwid app dashboard settings

Register these URLs using your deployed domain (paths from manifest):

| Ecwid setting | Example |
|---------------|---------|
| **redirectUrl** | `https://your-domain.com/api/auth/callback` |
| **openAppUrl** | `https://your-domain.com/admin` |
| **customJsUrl** | `https://your-domain.com/storefront/pb-bundles.js` |
| **webhookUrl** | `https://your-domain.com/api/webhooks/orders` |

Required scopes are listed in `app.manifest.json` → `scopes`.

## Data storage

All app data is stored in **Ecwid Application Storage** per installed store:

| Storage key | Contents |
|-------------|----------|
| `pb_rules` | Bundle/upsell offer definitions |
| `pb_settings` | View counters, cart script toggle |
| `pb_impressions` | Order conversion attribution |
| `pb_oauth` | OAuth tokens (private) |
| `public` | Storefront-readable config (cart upsell enabled) |

OAuth tokens are also mirrored to `server/data/oauth-cache.json` locally so storefront APIs work after server restarts (bootstrap only — not app data).

## Quick start

```bash
npm install
npm run build
npm start
```

Development (hot reload):

```bash
npm run dev
```

- **Server:** http://localhost:3001  
- **Admin (dev):** http://localhost:5173 (proxies `/api` to server)  
- **Admin (production build):** http://localhost:3001/admin  

### Authenticate locally

```bash
curl -X POST http://localhost:3001/api/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"storeId":"YOUR_STORE_ID","accessToken":"YOUR_SECRET_TOKEN"}' \
  -c cookies.txt
```

Or install via OAuth: `GET http://localhost:3001/api/auth/install`

### Discover resolved URLs

```bash
curl http://localhost:3001/api/auth/manifest
```

Returns manifest + auto-detected URLs for the current host.

## Project structure

```
app.manifest.json     # Scopes, paths, storage keys
packages/shared/      # Domain logic (pricing, eligibility)
server/               # Express API + Ecwid storage
admin/                # React merchant dashboard
storefront/           # Ecwid storefront JS bundle
```

## Features

- 4 offer types: volume break, bundle, mix & match, cart upsell
- Admin list + editor with setup/style tabs and live preview
- Server-side pricing (never trusts client prices)
- Cart upsell + volume/mix cart re-pricing
- Order webhook conversion tracking

See `WIX_APP_ANALYSIS_AND_ECWID_MIGRATION.md` for full behavioral spec.
