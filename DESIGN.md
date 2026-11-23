# Design Brief: devnote

## 1. Audience & Context of Use
- **Audience:** Solo developers, technical founders, and freelance engineers managing cloud infrastructure, databases, API keys, and accounts across diverse client projects.
- **Context:** Used during intense deep-work development sessions, incident triage (e.g. paused database or expired OAuth token), and quick lookups on mobile phones when away from the desk.
- **Mood:** Focused, calm, precise, reliable, no-nonsense.

## 2. Concept
**"An architect's indexed blueprint binder"** — a dense, tactile, precision-calibrated workstation where every client, project, and service occupies a structured, high-visibility index slot with zero fluff or distraction.

## 3. References
1. **Raycast Extension & Quicklinks Directory:** High-density, keyboard-driven navigation, instantaneous search indexing, and seamless one-touch clipboard actions.
2. **Swiss Technical Specification Cards / Industrial Index Plates:** Clean monochrome structural borders, explicit metadata badges, monospaced keys, and crisp dividing rules.
3. **Linear Issue & Document Sheets:** Inline autosaving text manipulation without intrusive modals, predictable keyboard flow (`/`, `N`, `Esc`), and subtle tactile toast notifications.

## 4. Signature Move
**"Living Brand Badges with Smart Copy Pills"**
Service cards automatically resolve fuzzy service names (e.g. "Supabase", "Cloudflare", "Vercel", "AWS", "Stripe") into official monochrome brand icons via `simple-icons`. Markdown descriptions automatically tokenize emails, URLs, and inline code into hoverable, one-click copy pills with immediate micro-feedback ("Copied").

## 5. Design Decisions
- **Type Pairing:**
  - UI, Headings, Labels & Body: `Geist Sans` (`var(--font-geist-sans)`) across all headings (`28px` semibold page title, `14px` semibold section heading, `14px` body, `13px` muted). No ALL-CAPS wide-tracking section labels.
  - Copyable Values & Code Only: `Geist Mono` (`var(--font-geist-mono)`) reserved strictly for copyable values (emails, IDs, domains, inline code, and command snippets).
- **Palette:**
  - **Dark Mode (Default):**
    - Deep matte background: `#0b0b0d`
    - Workstation panels / card surfaces: `#121215` / `#18181c`
    - Structural borders: `rgba(255, 255, 255, 0.08)`
    - Text primary: `#f4f4f6`
    - Text secondary / muted: `#9ca3af`
  - **Light Mode:**
    - Clean chalk paper background: `#f9fafb`
    - Panels / card surfaces: `#ffffff`
    - Structural borders: `#e5e7eb`
    - Text primary: `#111827`
    - Text secondary / muted: `#6b7280`
  - **Accent:** Refined Deep Slate-Violet (`#4c3d8f` in light, `#8b5cf6` in dark). Reserved strictly for active pane selection, primary focus indicators, and key action highlights.
- **Radius & Borders:**
  - Controls & Inputs: `rounded-lg` (8px).
  - Cards & Modals: `rounded-xl` (12px).
  - Borders: Crisp 1px hairline rules without heavy dropshadows or blurry borders.
- **Density & Grid:**
  - Density: Balanced, calm 2-pane workstation with one level of surface (page background, then cards—no card-in-card nesting).
  - Grid: 8px spatial grid. Desktop layout is a 2-pane split (280px expandable `SidebarTree` + flex-1 main content canvas). Service cards use a responsive `min 320px` grid.
  - Mobile: Sidebar collapses into a left-sliding Vaul drawer triggered from a slim top bar; main area is full-width.
- **Motion Style:**
  - Library: `motion/react` with `LazyMotion` and `domAnimation`.
  - Parameters: Quick spring curves (`stiffness: 320, damping: 30`), sub-200ms transitions for pane selection and dialogs.
  - Restraint: Strict adherence to animating only `transform` and `opacity`. No continuous looping animations in the dashboard. Respects `prefers-reduced-motion`.

## 6. Anti-Choices
- No generic purple/blue aurora mesh gradients or glowing neon cards.
- No heavy glassmorphism or distracting backdrop-blur overload (max 1-2 subtle blurs).
- No multi-tenant team abstractions, billing widgets, or SaaS upgrade banners.
- No modal-heavy creation flows; all updates are inline autosaved with debounce.
- No decorative emojis or fake ratings.
