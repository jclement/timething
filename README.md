# timething

A clean, keyboard-driven dashboard for finding meeting times across time zones.
Type a city, add zones, see the grid light up. Print a landscape copy for the
wall. Everything lives in your browser — no account, no server state.

> Because 3pm somewhere is 4am elsewhere.

## Quick Start

1. `mise install` — installs Node + Wrangler
2. `mise run install` — installs npm packages
3. `mise run dev` — starts Vite + Worker at http://localhost:5173
4. Open the URL, type a city, watch the grid fill in

No auth, no database — your zone list is in `localStorage`.

## Features

- **Search-box first** — each row is an intelligent search. Type "Houston",
  "CST", "America/Chicago", or "Saudi Arabia" and the right zone appears.
- **Auto home zone** — defaults to `Intl.DateTimeFormat().resolvedOptions().timeZone`.
  Change it anytime by clicking the home icon on a zone.
- **Reference date** — pick any calendar day; the grid recomputes with the
  correct DST offset for every zone on that date.
- **Working-hours highlighting** — default 8–16, overrideable per zone.
- **Day-boundary indicators** — cells that fall on a different date show
  `+1d` / `-1d` chips and a heavier vertical divider.
- **Click-to-highlight** — click any hour cell to highlight that column
  across every zone.
- **Three range presets** — Work hours (7–19), Waking (6–24), Full day.
- **Landscape PDF export** — tries a server-rendered PDF first (see below)
  and falls back to the browser's Save-as-PDF dialog.
- **DST footnotes on print** — the printed page lists the next DST
  transition for each zone so recurring meetings won't surprise you.
- **Dark mode** — system / light / dark cycle in the header.
- **Zero backend dependencies** — works entirely client-side.

## Configuration

The app has no runtime env vars. Configuration lives in `localStorage` under
`timething:settings:v1`.

### Deploying to Cloudflare

```
mise run build
mise exec -- wrangler deploy
```

Requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in your environment
(use `fnox` locally — see [fnox.local.toml.sample](fnox.local.toml.sample)).

### Optional: server-side PDF generation

The `/api/pdf` endpoint uses Cloudflare's Browser Rendering API to produce a
proper PDF with `Content-Disposition: attachment` headers. To enable:

1. Upgrade to **Workers Paid** ($5/mo).
2. Install the Puppeteer helper: `npm install @cloudflare/puppeteer`.
3. Add to [wrangler.toml](wrangler.toml):
   ```toml
   browser = { binding = "BROWSER" }
   ```
4. Redeploy. The frontend detects the endpoint automatically (it probes with a
   real request and falls back to `window.print()` on a 501 or error).

Without this binding, the Export button still works — it just opens the native
print dialog, which on every modern browser includes "Save as PDF".

## Development

| Command | What it does |
|---|---|
| `mise run dev` | Vite + Worker dev server with HMR |
| `mise run test` | Unit tests (Vitest) |
| `mise run test:e2e` | Playwright smoke tests |
| `mise run lint` | TypeScript + ESLint |
| `mise run fmt` | Prettier formatting |
| `mise run build` | Production bundle in `dist/` |
| `mise run preview` | Serve the production build locally |
| `mise run deploy` | Build + `wrangler deploy` |
| `mise run dev:reset` | Blow away `dist/`, `.wrangler/`, Vite cache |

## Tech Stack

- React 19 + TypeScript (strict)
- Tailwind CSS v4 (no config file; theme in `src/app.css`)
- TanStack Router (file-based) + TanStack Query
- Lucide icons
- Vitest + React Testing Library (unit)
- Playwright (E2E, desktop + mobile)
- Cloudflare Workers + Vite via `@cloudflare/vite-plugin`

## Architecture

See [DESIGN.md](DESIGN.md) for the deeper walkthrough.

## License

(C) 2026 Jeff Clement
