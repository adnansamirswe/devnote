# devnote

An open-source, self-hosted developer notepad for tracking **Clients → Projects → Services & Accounts**. Built by **Byzo** ([byzo.cc](https://byzo.cc)).

Never lose track of which Gmail, team, or billing tier owns a Supabase cluster, Vercel deployment, Cloudflare zone, or Stripe account.

## Features

- **2-Pane Sidebar Tree**: Expandable Client → Project tree on the left, calm click-to-edit page on the right.
- **Auto-Matched Brand Badges**: Fuzzy-matches 40+ cloud providers (`Supabase`, `Vercel`, `Cloudflare`, `Stripe`, `Neon`, `Redis`, `Resend`, etc.) via `simple-icons`.
- **Smart Copy Pills**: Emails, URLs, and inline code in markdown notes render as one-click copyable chips.
- **Inline Autosave**: Edit titles, notes, and service cards in place with 600ms debounced autosave and optimistic updates.
- **Floating Workers AI Assistant (`⌘J`)**: Built-in chat widget powered by Cloudflare Workers AI (`env.AI`) to query any client/project/service or propose additions/updates—always asking clarifying questions when unsure and requiring explicit confirmation before saving.
- **IDE MCP Server (`/api/mcp`)**: Connect Antigravity, Cursor, Claude Code, Windsurf, or VS Code directly to your workspace using revocable Personal API Keys (Remote HTTP or Local Stdio).
- **Global Command Palette**: Press `⌘K` / `Ctrl+K` (or `/`) to search across clients, projects, and service descriptions.
- **Multi-User Auth & Security**: Email or username + password login (`bcryptjs`), short-lived JWT access cookies + 30-day rotating refresh tokens, D1-backed rate limiting, account lockout, CSRF origin checks, and per-user data isolation.
- **Admin Dashboard (`/admin/`)**: Manage users, roles, account status, and workspace usage stats.
- **JSON Backup**: Per-user export and import from Settings.
- **Same-Origin Deployment**: One Cloudflare Worker serves the static Next.js frontend, Hono + D1 SQLite API, Workers AI, and MCP endpoint.

## Tech Stack

- **Frontend (`frontend/`)**: Next.js (App Router, TypeScript, static export), Tailwind CSS v4, shadcn/ui, Motion (`motion/react`), TanStack Query, Vaul, Sonner, `simple-icons`
- **Backend (`backend/`)**: Hono on Cloudflare Workers, Cloudflare D1 (SQLite), Cloudflare Workers AI (`env.AI`), Drizzle ORM, Zod, `bcryptjs`
- **MCP (`backend/src/lib/mcp.ts` + `mcp/server.mjs`)**: MCP JSON-RPC 2.0 Streamable HTTP endpoint + zero-dependency Node.js stdio bridge

---

## IDE MCP Server Setup

Let your IDE's AI assistant read, search, create, update, or delete clients, projects, and services directly in your `devnote` workspace.

### 1. Generate a Personal API Key

1. Sign in at `/app/` and open **Settings → API Keys & MCP**.
2. Enter a name (e.g. `Antigravity IDE` or `Cursor`) and click **Generate key**.
3. Copy the ready-to-paste config shown once (raw keys are stored only as SHA-256 hashes in D1 and can be revoked anytime).

### 2. Option A — Remote HTTP MCP (Recommended, zero local setup)

```json
{
  "mcpServers": {
    "devnote": {
      "url": "https://your-devnote-domain/api/mcp",
      "headers": {
        "Authorization": "Bearer dn_live_YOUR_API_KEY_HERE"
      }
    }
  }
}
```

### 3. Option B — Local Stdio MCP (Node.js bridge)

For IDEs that spawn MCP servers via a local command:

```json
{
  "mcpServers": {
    "devnote": {
      "command": "node",
      "args": ["/absolute/path/to/devnote/mcp/server.mjs"],
      "env": {
        "DEVNOTE_API_URL": "https://your-devnote-domain",
        "DEVNOTE_API_KEY": "dn_live_YOUR_API_KEY_HERE"
      }
    }
  }
}
```

### Exposed MCP Tools

- **Read / Search**: `get_workspace_tree`, `search_workspace`, `get_project`
- **Clients**: `create_client`, `update_client`, `delete_client`
- **Projects**: `create_project`, `update_project`, `delete_project`
- **Services**: `create_service`, `update_service`, `delete_service`

All MCP calls are rate-limited, strictly validated with Zod, and scoped exclusively to the API key owner's data (API keys cannot access `/api/admin/*` or mint new keys).

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

### 2. Configure local worker secret

Copy the example file in `backend/` and set a local JWT signing secret:

```bash
cp backend/.dev.vars.example backend/.dev.vars
```

Required variable in `backend/.dev.vars`:
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

- Frontend: `http://localhost:3000` (Workspace at `/app/`, Admin Dashboard at `/admin/`)
- Backend API & MCP: `http://localhost:8787` (`/api/mcp`, `/api/ai/chat`)

### Optional: Generate demo seed data

```bash
npx tsx scripts/seed.ts
```

This creates `scripts/seed-backup.json`, which you can import from **Settings → Import backup (JSON)** inside `/app/`.

---

## Deploy to Cloudflare Workers (Free Tier)

Everything runs on a single Cloudflare Worker serving the static Next.js build (`frontend/out`), `/api/*`, Workers AI (`env.AI`), and `/api/mcp` on the same origin.

### 1. Authenticate Wrangler

```bash
npx wrangler login
```

### 2. Create the Cloudflare D1 database

```bash
cd backend
npx wrangler d1 create devnote-db
```

Copy the `database_id` printed by Wrangler and set it in `backend/wrangler.jsonc`:

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

### 4. Set production secret

```bash
npx wrangler secret put JWT_SECRET
```

Use a random 32+ character secret (for example, generated via `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).

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
