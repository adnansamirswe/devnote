# devnote: Project Plan

Open-source showcase project by **Byzo** (byzo.cc). A minimal notepad for developers to track **clients → projects → services/accounts**. The UI/UX is the whole point: premium, smooth, classy.

> "devnote" is a placeholder name. Rename freely.

---

## 1. Why this exists

A Supabase project got auto-paused after being unused. The app errored, it looked like a Google OAuth problem, and hours were lost debugging. Later, finding which Gmail/account owned which service meant searching through inboxes.

Fix: one place that records, per client project, which services it uses and which account owns each.

## 2. Scope (strict)

**In scope**
- Clients
- Projects linked to a client (with details)
- Services per project (name + free-form description where accounts, emails, plans, env, anything is written)
- Global search + command palette
- JSON export/import backup
- Landing page + dashboard
- Single-user password auth

**Out of scope (do NOT build)**
- Monitoring, health checks, alerts, status pages
- Billing, pricing, plans
- Multi-user, teams, signup, roles
- Credential/secret vault (descriptions are plain notes; README must warn users not to store raw passwords)
- Any selling/SaaS features

## 3. Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router, TypeScript) with **static export** |
| Styling | Tailwind CSS v4 (CSS-first config) + shadcn/ui |
| Motion | `motion` (import from `motion/react`) with `LazyMotion` |
| Data fetching | TanStack Query (optimistic mutations) |
| Backend | Hono on a Cloudflare Worker |
| Database | Cloudflare D1 (SQLite) + Drizzle ORM |
| Validation | Zod |
| Hosting | One Cloudflare Worker serves the static site (`web/out`) AND the API (`/api/*`), same origin |

## 4. Install commands (latest versions)

Run from an empty folder.

```bash
mkdir devnote && cd devnote
git init

# Frontend
npx create-next-app@latest web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
cd web
npx shadcn@latest init
npx shadcn@latest add button input textarea dialog command dropdown-menu sonner skeleton badge separator scroll-area tooltip drawer
npm install motion lenis vaul lucide-react @tanstack/react-query react-markdown remark-gfm next-themes simple-icons clsx tailwind-merge

# Magic UI components (landing page). Copied into the repo; check Magic UI docs if a URL changed.
npx shadcn@latest add "https://magicui.design/r/blur-fade.json"
npx shadcn@latest add "https://magicui.design/r/shimmer-button.json"
npx shadcn@latest add "https://magicui.design/r/bento-grid.json"
npx shadcn@latest add "https://magicui.design/r/animated-beam.json"
npx shadcn@latest add "https://magicui.design/r/marquee.json"
cd ..

# Backend
mkdir api && cd api
npm init -y
npm install hono drizzle-orm zod @hono/zod-validator
npm install -D wrangler drizzle-kit typescript @cloudflare/workers-types
npx wrangler d1 create devnote-db     # copy the printed database_id into wrangler.jsonc
cd ..

# Root (run web + api together)
npm init -y
npm install -D concurrently
```

## 5. Repo layout

```
devnote/
├─ web/                      Next.js static export
│  ├─ src/app/               landing ("/") and app ("/app")
│  ├─ src/components/        ClientList, ProjectList, ProjectDetail, ServiceCard,
│  │                         MarkdownEditor, SmartMarkdown, CommandPalette, ShortcutsDialog, ...
│  ├─ src/lib/               api client, query hooks, brand-icon matcher, utils
│  └─ next.config.ts
├─ api/
│  ├─ src/index.ts           Hono app
│  ├─ src/db/schema.ts       Drizzle schema
│  ├─ migrations/            drizzle-kit output
│  ├─ wrangler.jsonc
│  └─ .dev.vars.example
├─ scripts/seed.ts           demo data
├─ plan.md
├─ README.md
└─ LICENSE                   MIT
```

Share types between `api` and `web` through a small shared types file.

## 6. Data model (Drizzle, SQLite/D1)

IDs are `crypto.randomUUID()`. Timestamps are integer milliseconds.

```ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  details: text("details").notNull().default(""),   // markdown
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const services = sqliteTable("services", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),                      // e.g. Supabase, Vercel, Google OAuth
  description: text("description").notNull().default(""), // markdown: account email, plan, env, anything
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
```

Generate migrations with drizzle-kit into `api/migrations`, apply via `wrangler d1 migrations apply`. Add npm scripts for local and remote migrate.

## 7. API (Hono, all under `/api`, Zod-validated)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/login` | `{password}` compared to secret `APP_PASSWORD`; sets signed httpOnly, Secure, SameSite=Lax cookie (hono/jwt, secret `JWT_SECRET`, 30-day expiry) |
| POST | `/api/logout` | Clears cookie |
| GET | `/api/me` | 200 if authenticated, else 401 |
| GET | `/api/tree` | All clients with nested projects and nested services in one call |
| POST/PATCH/DELETE | `/api/clients`, `/api/projects`, `/api/services` | CRUD |
| GET | `/api/export` | Full JSON backup |
| POST | `/api/import` | Restore from backup JSON |

- Auth middleware on everything except `/api/login`.
- Dev-only CORS for `http://localhost:3000` with credentials; never enabled in production.

### wrangler.jsonc

```jsonc
{
  "name": "devnote",
  "main": "src/index.ts",
  "compatibility_date": "<use the current date>",
  "assets": {
    "directory": "../web/out",
    "not_found_handling": "404-page",
    "run_worker_first": ["/api/*"]
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "devnote-db",
      "database_id": "<from wrangler d1 create>",
      "migrations_dir": "migrations"
    }
  ]
}
```

Secrets:

```bash
npx wrangler secret put APP_PASSWORD
npx wrangler secret put JWT_SECRET
```

Document both in `api/.dev.vars.example` for local dev.

## 8. Frontend rules (static export constraints)

`next.config.ts`:
- `output`: `'export'`
- `images.unoptimized`: `true`
- `trailingSlash`: `true`

Hard rules:
- NO server components fetching data, NO API routes, NO middleware, NO dynamic `[id]` routes
- Everything is client-side
- The app is one page at `/app` with state in URL search params (`?c=<clientId>&p=<projectId>`) so links are shareable and refresh works. Wrap `useSearchParams` in `Suspense`.
- TanStack Query holds `/api/tree` as the single source of truth. All mutations are optimistic with rollback on error.
- API base URL: `process.env.NEXT_PUBLIC_API_URL` (empty in production = same origin; `http://localhost:8787` in dev). All fetches use `credentials: "include"`.

## 9. Landing page (`/`)

Public, static, built to impress.

Sections:
1. **Hero:** headline, subtext, two CTAs ("Live demo", "GitHub"), subtle spotlight or grid background (one Aceternity-style effect max)
2. **Animated product preview:** a mock of the 3-pane UI built from real components (not an image)
3. **Bento grid:** 4-6 features
4. **Open source / self-host in 5 minutes:** copyable command block
5. **Footer:** "Built by Byzo" (byzo.cc), GitHub link

Lenis smooth scroll on the landing page only.

## 10. Dashboard (`/app`)

### Screens
1. **Login:** centered, minimal, subtle animated gradient/grain, single password field, shake animation on wrong password
2. **Main app, 3-pane layout:**
   - Left: client list (search filter, "+ New client", count badges)
   - Middle: selected client's projects (client notes editable at top)
   - Right: project detail with editable name, markdown details, then a grid of service cards

### Features
- **Service cards:** brand icon auto-matched from the service name using `simple-icons` (fuzzy: supabase, vercel, cloudflare, google, etc.), fallback to a lucide icon with the first letter. Rendered markdown description (react-markdown + remark-gfm). Click to edit in place (name input + markdown textarea with Write/Preview toggle).
- **Inline editing everywhere:** autosave with 600ms debounce and a small "Saved" indicator. No save buttons.
- **Smart copy:** in rendered descriptions, detect emails, URLs, and `inline code`; render as chips with a hover copy button (toast "Copied").
- **Command palette (⌘K / Ctrl+K):** search across clients, projects, AND services (including description text), grouped results, Enter jumps. Actions: New client / New project / New service / Toggle theme / Export backup / Logout.
- **Keyboard shortcuts:** `/` focus search, `N` new item in the focused pane, `Esc` closes dialogs, `↑↓` navigate lists, `?` opens shortcuts dialog.
- **Delete** with confirm dialog + undo toast (re-create if undone within 6s).
- **Export/Import JSON** in a settings menu.
- **Empty states:** designed icon/illustration + clear primary action for each level (no clients, no projects, no services).
- **Mobile:** panes become stacked drill-down navigation with a back button and bottom-sheet dialogs (Vaul). Fully usable as a quick phone lookup.

## 11. Visual design system

- Dark matte by default (background near `#0b0b0d`, surfaces one step lighter, 1px borders at ~8% white). Full light theme via `next-themes` with a smooth toggle.
- One accent color as a CSS variable (default: refined violet) so it is easy to re-theme. Everything else neutral.
- Typography: Geist Sans + Geist Mono. Tight tracking on headings, generous spacing, 8px grid.
- rounded-xl, soft shadows, intentional focus rings, thin custom scrollbars, selection color matches accent.
- Skeleton loaders on first load, never a blank flash.
- Accessible: proper labels, focus management in dialogs, AA contrast.
- Tone: classy, not flashy. No neon gradients, no glassmorphism overload.

## 12. Animation and library rules

**Library split**
- Dashboard: shadcn/ui, Motion, cmdk (via shadcn Command), Vaul, Sonner
- Landing: Magic UI (blur-fade, shimmer-button, bento-grid, animated-beam, marquee) + at most one Aceternity-style hero effect + Lenis

**Motion rules**
- Import from `motion/react`, NOT `framer-motion`. Wrap the app in `LazyMotion` with `domAnimation`.
- Animate only `transform` and `opacity`. Never width, height, top, left.
- Springs for UI movement (`stiffness ~300, damping ~30`), ease-out for fades, dashboard durations under 300ms.
- Layout animations on list add/remove, staggered fade-in for cards, subtle hover lift on service cards.
- Max 1-2 `backdrop-blur` elements per view.
- No continuous looping animations in the dashboard.
- Landing animations are scroll-triggered once (`whileInView`, `once: true`).
- Do not animate lists beyond ~50 items.
- Respect `prefers-reduced-motion` everywhere.
- No heavy WebGL / three.js.
- Do NOT use Lenis in the dashboard (it fights inner scroll panes).
- Target 60fps. Test the production build, not dev.

## 13. Build order (for the AI IDE)

1. **Scaffold check:** confirm repo layout, deps installed, do not downgrade or swap packages
2. **Backend:** schema, migrations, Hono routes, auth, `/api/tree`, export/import, wrangler config
3. **Frontend foundation:** theme tokens, layout shell, API client, TanStack Query, optimistic mutations, login
4. **Dashboard core:** 3-pane layout, CRUD for clients/projects/services, inline editing + autosave
5. **Dashboard polish:** service cards with brand icons, smart markdown chips, command palette, shortcuts, undo delete, empty states, mobile drill-down
6. **Landing page:** hero, product preview, bento grid, self-host section, footer, Lenis
7. **Seed + docs:** `scripts/seed.ts`, README, LICENSE
8. **Verification:** web build + type check for both apps, Lighthouse pass, fix everything

## 14. Quality bar

- TypeScript strict, no `any`, no dead code, no placeholder/TODO functions. Everything works end to end.
- Small focused components with clear names.
- Root `package.json` scripts:
  - `dev`: runs web and api concurrently
  - `build`: builds web
  - `deploy`: builds web, then `wrangler deploy` from `api`
- `scripts/seed.ts`: realistic fake demo data (3 clients, ~2 projects each, ~3 services each) for a public demo; document how to run it.
- Finish by running the web build and a type check for both apps; fix every error and warning before stopping.
- Landing page Lighthouse performance target: 95+.

## 15. README requirements

- What it is, GIF placeholder, features
- One-command-style self-host steps: create D1, apply migrations, set secrets, deploy
- Local dev steps
- Tech stack
- Security note: descriptions are plain notes, do not store raw passwords or secrets
- License: MIT
- "Built by Byzo" credit

## 16. Deploy checklist

1. `cd api && npx wrangler d1 create devnote-db` → paste `database_id` into `wrangler.jsonc`
2. `npx wrangler d1 migrations apply devnote-db --remote`
3. `npx wrangler secret put APP_PASSWORD` and `npx wrangler secret put JWT_SECRET`
4. From root: `npm run deploy`
5. Optional: attach a custom domain/subdomain under byzo.cc in the Cloudflare dashboard
6. Optional: seed a separate demo deployment with fake data for the public live demo

---

## Paste-ready AI IDE prompt

```
Read plan.md in the repo root and implement it completely, following the build order in section 13.
Dependencies are already installed at their latest versions. Do not downgrade or swap them.
Respect every constraint (static export rules, same-origin Worker, animation and performance rules, strict scope: no monitoring/billing/multi-user).
Do not stop until the web build and type checks for both apps pass with no errors or warnings, and the seed script works.
```