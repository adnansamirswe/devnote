# devnote

An open-source, self-hosted developer notepad for tracking **Clients → Projects → Services & Accounts**. Built by **Byzo** ([byzo.cc](https://byzo.cc)).

Never lose track of which Gmail, team, or billing tier owns a Supabase cluster, Vercel deployment, Cloudflare zone, or Stripe account.

## Features

- **2-Pane Sidebar Tree**: Expandable Client → Project tree on the left, calm click-to-edit page on the right.
- **Auto-Matched Brand Badges**: Fuzzy-matches 40+ cloud providers (`Supabase`, `Vercel`, `Cloudflare`, `AWS`, `Stripe`, `Neon`, `Redis`, `Resend`, etc.) via `simple-icons`.
- **Smart Copy Pills**: Emails, URLs, and inline code in markdown notes render as one-click copyable chips.
- **Inline Autosave**: Edit titles, notes, and service cards in place with 600ms debounced autosave and optimistic updates.
- **Global Command Palette**: Press `⌘K` / `Ctrl+K` (or `/`) to search across clients, projects, and service descriptions.
- **Single-User Auth & JSON Backup**: Protected by a single password (`APP_PASSWORD`) and signed `HttpOnly` JWT cookie, with full JSON export/import.
- **Same-Origin Deployment**: One Cloudflare Worker serves both the static Next.js frontend and the Hono + D1 SQLite API.

## Tech Stack

- **Frontend (`frontend/`)**: Next.js (App Router, TypeScript, static export), Tailwind CSS v4, shadcn/ui, Motion (`motion/react`), TanStack Query, Vaul, Sonner, `simple-icons`
- **Backend (`backend/`)**: Hono on Cloudflare Workers, Cloudflare D1 (SQLite), Drizzle ORM, Zod

---

## Local Development

### 1. Clone and install dependencies

```bash
git clone https://github.com/adnansamirswe/devnote.git
cd devnote
npm install
npm install --prefix frontend
npm install --prefix backend
```

### 2. Configure local worker secrets

Copy the example file in `backend/` and set your local password and JWT secret:

```bash
cp backend/.dev.vars.example backend/.dev.vars
```

Required variables in `backend/.dev.vars`:
- `APP_PASSWORD` — password used to unlock `/app`
- `JWT_SECRET` — random 32+ character string for signing session cookies

### 3. Apply local D1 database migrations

```bash
cd backend
npm run db:migrate:local
cd ..
```

### 4. Start frontend and backend together

```bash
npm run dev
```

- Frontend: `http://localhost:3000` (Dashboard at `http://localhost:3000/app`)
- Backend API: `http://localhost:8787`

### Optional: Generate demo seed data

```bash
npx tsx scripts/seed.ts
```

This creates `scripts/seed-backup.json`, which you can import from **Settings → Import backup (JSON)** inside `/app`.

---

## Deploy to Cloudflare Workers (Free Tier)

Everything runs on a single Cloudflare Worker serving the static Next.js build (`frontend/out`) and `/api/*` on the same origin.

### 1. Authenticate Wrangler

```bash
npx wrangler login
```

### 2. Create the Cloudflare D1 database

```bash
cd backend
npx wrangler d1 create devnote-db
```

Copy the `database_id` printed by Wrangler and replace `"devnote-local-db"` in `backend/wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "devnote-db",
    "database_id": "<PASTE_YOUR_DATABASE_ID_HERE>",
    "migrations_dir": "migrations"
  }
]
```

### 3. Apply remote database migrations

```bash
npx wrangler d1 migrations apply devnote-db --remote
```

### 4. Set production secrets

```bash
npx wrangler secret put APP_PASSWORD
npx wrangler secret put JWT_SECRET
```

Use a strong password for `APP_PASSWORD` and a random 32+ character secret (e.g. `openssl rand -hex 32`) for `JWT_SECRET`.

### 5. Build and deploy

Return to the repository root and deploy:

```bash
cd ..
npm run deploy
```

`npm run deploy` builds the static Next.js export into `frontend/out` and deploys the Cloudflare Worker from `backend/`.

### 6. Optional: Custom domain & SEO URL

1. In the Cloudflare dashboard, open **Workers & Pages → devnote → Settings → Domains & Routes** and attach your custom domain (for example `devnote.byzo.cc`).
2. Before running `npm run deploy`, set `NEXT_PUBLIC_SITE_URL=https://your-domain` and update the domain in `frontend/public/robots.txt` and `frontend/public/sitemap.xml` so Open Graph previews and canonical tags match your live URL.

---

## Security Note

Service descriptions and project notes are stored as plain markdown text in your D1 database. Record account owner emails, team names, regions, tiers, and project IDs—**do not store raw passwords, API secrets, or private keys**.

## License

MIT — built by [Byzo](https://byzo.cc).
