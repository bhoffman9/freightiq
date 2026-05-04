# FreightIQ — Show Freight Inc Operations Dashboard

Real-time fleet cost-per-mile dashboard with AI-powered data uploads and live API integrations. Single-page React app deployed on Vercel.

## Live URL

**https://freightiq-nine-two.vercel.app** — NEVER change this URL or create duplicate Vercel projects.

**This is the ONE canonical repo.** All work happens here. Never apply changes to any other local copy. Always commit and push data updates immediately.

## Tech Stack

- **Frontend:** React 18 + Vite (dev server on port 3000)
- **Charts:** Recharts (BarChart, LineChart, ComposedChart)
- **Data Parsing:** PapaParse (CSV), SheetJS/XLSX (Excel)
- **APIs:** 7 Vercel serverless functions (see below)
- **AI Model:** claude-sonnet-4-20250514 (via api/ai.js proxy)
- **Live Data:** QuickBooks P&L + Balance Sheet, Samsara IFTA mileage, Alvys TMS loads
- **Database:** Supabase (shared with CFO Dashboard — OAuth tokens in `qbo_tokens` table, IFTA mileage in `ifta_mileage` table)
- **Hosting:** Vercel (auto-deploys on push to GitHub main)
- **Styling:** Inline CSS-in-JS, dark theme, IBM Plex Mono + Barlow Condensed fonts
- **Hybrid data model** — live API feeds for P&L, mileage, loads + hardcoded constants for EFS fuel and payroll (updated from file drops)

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Dev server → http://localhost:3000
npm run build        # Runs extract-metrics.js then vite build → dist/
npm run preview      # Preview production build locally
```

## MCPs to use in this project

Prefer installed MCPs over `curl`/WebFetch/manual HTTP. See `reference_mcp_servers.md` in freightiq-api memory scope for install state (last updated 2026-04-26).

- **playwright** (`mcp__playwright__*`) — QA live deploys before declaring a task done. The site is password-gated (`ShowFreight2026!`, localStorage key `sf_auth_v1`); handle the gate before driving tabs. Use `/qa` slash command for the default pass.
- **context7** (`mcp__context7__*`) — current docs for Recharts, PapaParse, SheetJS, Vite, React 18, Vercel SDK, Anthropic SDK. My training is frozen; these libraries drift. Use `/docs <lib>` slash command.
- **supabase** (`mcp__supabase__*`, read-only) — inspect `qbo_tokens` and `ifta_mileage` tables (shared with CFO Dashboard) before writing SQL or guessing schema. Never assume — query the real schema.
- **sentry** (`mcp__sentry__*`) — first stop for any prod error report on `freightiq-nine-two.vercel.app`. Use `/sentry` slash command.
- **quickbooks** (`mcp__claude_ai_Intuit_QuickBooks__*`) — direct Intuit QB queries (added 2026-04-26). Tools: `profit-loss-generator`, `cash-flow-generator`, `benchmarking-against-industry`, `company-info`, `quickbooks-transaction-import`, etc. Useful when validating the FreightIQ proxy endpoints (`/api/qbo-pnl`, `/api/qbo-bs`) or pulling category detail not exposed by them. Both companies (CE & SF Combined, CE East) live in QB; specify which.
- ~~**google-sheets**~~ — currently DISCONNECTED (2026-04-26). Re-enable before relying on it for shared sheet reads. Service account email still valid: `claude-sheets@distributed-eye-492805-d6.iam.gserviceaccount.com`.

**Do not** default to `curl -s https://freightiq-nine-two.vercel.app/...` + parsing HTML for UI work. Playwright gives a real browser.

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `ANTHROPIC_API_KEY` | Vercel dashboard | Claude API access for ai.js proxy |
| `GOOGLE_MAPS_API_KEY` | Vercel dashboard | Google Distance Matrix API for address mileage |
| `ALVYS_CLIENT_ID` | Vercel dashboard | Alvys TMS API authentication |
| `ALVYS_CLIENT_SECRET` | Vercel dashboard | Alvys TMS API authentication |
| `VITE_APP_PASSWORD` | Vercel dashboard | Password gate (current: `ShowFreight2026!`) |
| `SUPABASE_URL` | Vercel dashboard | Supabase instance (shared with CFO Dashboard) |
| `SUPABASE_SERVICE_KEY` | Vercel dashboard | Supabase service role key (for qbo_tokens table) |
| `QBO_CLIENT_ID` | Vercel dashboard | QuickBooks OAuth — Intuit app client ID |
| `QBO_CLIENT_SECRET` | Vercel dashboard | QuickBooks OAuth — Intuit app client secret |
| `SAMSARA_API_TOKEN` | Vercel dashboard | Samsara fleet API bearer token |

## Authentication

- **Password gate** wraps the entire React app via the `PasswordGate` component in `src/App.jsx`
- Users enter the password once per browser, stays unlocked for **30 days** via localStorage key `sf_auth_v1`
- API endpoints (`/api/ai`, `/api/alvys-loads`, `/api/distance`, `/metrics.json`) bypass the gate so cross-app data flows still work (Per Load CPM, CFO Dashboard read these without authentication)
- Change the password by updating `VITE_APP_PASSWORD` in Vercel and redeploying — same password is used across FreightIQ, Per Load CPM, AP Aging, Budget Calendar, and Flexent

## Project Structure

```
freightiq/
├── api/
│   ├── _qbo-helpers.js     # Shared QB OAuth token management + P&L parser
│   ├── ai.js               # Vercel serverless — proxies Claude API requests
│   ├── alvys-loads.js       # Vercel serverless — fetches live loads from Alvys TMS
│   ├── distance.js          # Vercel serverless — Google Maps Distance Matrix proxy
│   ├── qbo-pnl.js           # Vercel serverless — QuickBooks P&L with period selector
│   ├── qbo-bs.js            # Vercel serverless — QuickBooks Balance Sheet
│   └── samsara-miles.js     # Vercel serverless — Samsara IFTA mileage per truck/state
├── src/
│   ├── main.jsx            # React entry point
│   └── App.jsx             # Entire dashboard (~7,500 lines, monolithic)
├── public/
│   └── metrics.json        # Auto-generated KPIs (built by extract-metrics.js)
├── incoming-freightiq/     # Drop weekly data files here for processing
├── extract-metrics.js      # Build script — parses App.jsx → metrics.json
├── index.html
├── package.json
├── vite.config.js
├── vercel.json             # Vercel config (framework: vite, output: dist)
└── .env.example
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/ai` | POST | Proxies requests to Anthropic Claude API (keeps key server-side) |
| `GET /api/alvys-loads` | GET | Authenticates with Alvys TMS, returns live load pipeline with lanes, revenue, RPM, statuses |
| `GET /api/distance?origin=X&destination=Y` | GET | Google Maps Distance Matrix proxy — returns driving miles + hours |
| `GET /api/qbo-pnl?company=X&period=Y` | GET | QuickBooks P&L — companies: `ce_sf_combined`, `ce_east`. Periods: `ytd`, `this_week`, `last_week`, `jan`-`dec`, or `start_date`/`end_date` |
| `GET /api/qbo-bs?company=X` | GET | QuickBooks Balance Sheet — returns assets, liabilities, equity with account detail |
| `GET /api/samsara-miles?year=2026` | GET | Samsara IFTA mileage — per-truck, per-state, aggregated across quarters |

**Other apps consume these endpoints:**
- Per Load CPM (`perload-cpm.vercel.app`) fetches `metrics.json` and `/api/alvys-loads`
- CFO Dashboard fetches `metrics.json` + `payroll-summary.json`

## Architecture

- **Monolithic SPA:** Everything lives in `src/App.jsx` — all 15 tabs, all data, all components
- **No routing** — tab state managed via useState, no React Router
- **Hybrid data model** — data sources are:
  1. **Live APIs** (real-time, no file drops needed):
     - QuickBooks P&L via `/api/qbo-pnl` — CE & SF Combined + CE East, with period selector
     - QuickBooks Balance Sheet via `/api/qbo-bs` — CE East assets/liabilities/equity
     - Samsara IFTA mileage via `/api/samsara-miles` — per-truck, per-state (Q1 available, Q2+ auto-added)
     - Alvys TMS loads via `/api/alvys-loads` — live load pipeline
     - AP Aging equipment data via EquipmentContext
  2. **Hardcoded constants** (updated from file drops — EFS fuel, payroll):
     - `PAYROLL[]`, `FUEL{}` — updated weekly from SF/J&A payroll XLS + EFS PDF
     - `TRUCK_MILES[]` — static fallback when Samsara live unavailable
     - `INCOME_2026` — static fallback for weekly trend / YoY views
     - `CE_EAST{}` — static fallback for Owner Payback calculator
  3. User CSV/XLSX uploads parsed client-side (PapaParse + SheetJS)
  4. localStorage for upload history and invoice deduplication

## Dashboard Tabs

| Tab | Component | Purpose |
|-----|-----------|---------|
| Fleet Overview | `FleetOverview()` | All-in CPM, cost breakdown, driver table |
| CPM Calculator | `BasicCPM()` | Basic vs All-In CPM, margin targets, CPM simulator |
| Per Load CPM | `PerLoadCPM()` | Booking simulator, fleet cost cards, live Alvys loads |
| Revenue | `RevenueDashboard()` | Revenue by company (CE/SF/DI), Alvys + Ascend data |
| Driver Detail | `DriverDetail()` | Per-driver labor + fuel + combined CPM |
| Trucks & Mileage | `TrucksMileage()` | Samsara GPS data, per-truck miles, state breakdown |
| Fuel Analysis | `FuelAnalysis()` | Per-driver fuel spend, avg $/gal |
| Trucks | `TrucksTab()` | TEC, Penske, TCI lease details |
| Trailers | `TrailerFleet()` | McKinney, Xtra, Utility trailer fleet |
| Office Staff | `OfficeStaff()` | Office/warehouse/contractor payroll |
| Income | `IncomeDashboard()` | Live QB P&L + weekly/monthly income with YoY comparison |
| CE East | `CEEast()` | Live QB P&L + Balance Sheet, Owner Payback calculator |
| Cash Flow | `CashFlowDashboard()` | Cash flow analysis |
| Upload | `DataSettings()` | Drop CSV/XLSX files, AI auto-maps columns |
| Checklist | `Checklist()` | Weekly/monthly data update tasks |

## State Management

- **React Context** (2 contexts):
  - `DataContext` — upload/file processing state shared across tabs
  - `EquipmentContext` — truck/trailer AP aging data from external dashboard
- **Local state** via `useState` / `useRef` / `useEffect` in each component
- No Redux, Zustand, or other state library

## Key Data Constants (hardcoded in App.jsx)

- `PAYROLL[]` — 42 drivers with hours/cost (Memolo Dominick still 0; Kelly Kirk D / Butler Richard / Negrete Arturo / Whipple Wallace 57403 / Williams Will 27405 etc. *inactive markings) thru Apr 26, 2026. **Don't write "41 active drivers" in the LABOR comment — extract-metrics.js regex `(\d+)\s*drivers` needs the digit adjacent to "drivers" or `metrics.json` falls back to 0 (regression fixed week 16).**
- `FUEL{}` — per-driver fuel spend + gallons (EFS only, thru Apr 26)
- `MONTHLY_MILES[]` — Samsara GPS: per-month, per-truck local vs regional
- `TRUCK_MILES[]` — 35 trucks with per-state mileage breakdown (thru Apr 26; live via /api/samsara-miles supersedes)
- `TCI_LEASING{}`, `PENSKE{}`, `TEC_EQUIPMENT{}` — truck lease data
- `TRAILERS_INV{}`, `XTRA_LEASE{}` — trailer inventory/leases
- `INCOME_2026`, `INCOME_2025` — weekly/monthly revenue + margins
- `CE_EAST{}` — CE East subsidiary financials
- `MONTHLY_REVENUE[]` — 2025-2026 by company (CE/SF/DI)
- `DETAIL{}` — transaction breakdowns (labor, fuel, insurance, trucks, trailers, maintenance)
- `ASCEND{}` — Historical Ascend TMS data (Jan-Mar 2026, no longer active)
- `ALVYS{}` — Alvys TMS pipeline snapshot (also fetched live via /api/alvys-loads)

**Current period:** Jan 1 – Apr 26, 2026 (116 days)

## CPM Definitions (CRITICAL)

| CPM Component | Source | Notes |
|---|---|---|
| **LABOR** | QuickBooks payroll | Total driver cost (gross + taxes + 401k). NOT office staff. |
| **FUEL_TOT** | EFS only | NEVER from QuickBooks P&L fuel line |
| **INS_TOT** | SF Truck Insurance only | NOT health, workers comp, building, car, freight |
| **TRUCK_TOT** | QuickBooks Truck Rentals | Penske + TEC/Transco + TCI + Ryder |
| **TRAILER_TOT** | QuickBooks Trailer Rentals | McKinney + Xtra + Utility + Premier + Boxwheel |

**Basic CPM** = LABOR + FUEL + TRUCKS + INS (4 categories)
**All-In CPM** = Basic + Trailers + Maint + Storage + Uniforms (9 categories)

## Helper Functions

- `fd(n)` — format as dollars ($X,XXX.XX)
- `fn(n)` — format number with commas
- `fp(n)` — format as percentage
- `cpmColor(cpm)` — returns color: green (<$2.50), yellow ($2.50-$3.20), red (>$3.20)

## Color Scheme

| Token | Hex | Use |
|-------|-----|-----|
| Background | `#0b0d10` | Dark base |
| Surface | `#12151c` | Cards, panels |
| Primary | `#f47820` | Orange accent |
| Yellow | `#f5c542` | Warning / acceptable |
| Green | `#3ddc84` | Good / under target |
| Red | `#ff5252` | Bad / over target |
| Blue | `#4fc3f7` | Info accent |
| Purple | `#b39ddb` | Secondary accent |
| Text | `#e8eaf0` | Primary text |
| Muted | `#5a6370` | Secondary text |

## Build Pipeline

1. `extract-metrics.js` runs first — parses App.jsx constants, writes `public/metrics.json`
2. `metrics.json` is consumed by Per Load CPM and CFO Dashboard (live data feed)
3. `vite build` bundles React app → `dist/`
4. Vercel deploys `dist/` + `api/` serverless functions

## Deployment

- **Platform:** Vercel (auto-deploy on GitHub push to main)
- **URL:** https://freightiq-nine-two.vercel.app (PERMANENT)
- **GitHub:** github.com/bhoffman9/freightiq (private)
- **Config:** `vercel.json` — framework: vite, buildCommand: npm run build, output: dist
- **Serverless:** `api/ai.js`, `api/alvys-loads.js`, `api/distance.js`, `api/qbo-pnl.js`, `api/qbo-bs.js`, `api/samsara-miles.js` auto-deployed

## Weekly Update Workflow

### Automated (live feeds — no file drops needed):
- **CE & SF Combined P&L** — live from QuickBooks via `/api/qbo-pnl` (Income tab → Live QB)
- **CE East P&L + Balance Sheet** — live from QuickBooks (CE East tab → Live QB + Owner Payback)
- **Samsara mileage** — live from Samsara IFTA API via `/api/samsara-miles` (Trucks & Mileage tab)
- **Alvys TMS loads** — live via `/api/alvys-loads` (Revenue tab)
- **AP Aging equipment** — live via `https://ap-aging-v4.vercel.app/api/equipment` (Trucks + Trailers tabs). Cross-origin fetch — relies on global CORS in `ap-aging/next.config.js`. If Trucks/Trailers go blank, check the red error banner in the tab footer and the AP Aging deploy status.

### Manual file drops (into `Desktop/Freight/freightiq/incoming-freightiq/`):
1. **EFS Transaction Report PDF** — per-driver fuel (no API available).
   **CRITICAL: Download the PDF directly from the EFS portal — never "Print to PDF" via Windows.** Print-to-PDF produces a raster/image-only file with no text layer; pdfplumber returns 0 chars across all pages and the parser silently outputs `$0.00`. Producer field will say "Microsoft: Print To PDF" — that's the giveaway. Real EFS exports are ~150 KB; print-to-PDF balloons to ~10 MB.
2. **SF Payroll Summary** (QuickBooks XLS) — driver + office payroll.
3. **J&A Management Payroll Summary** (QuickBooks XLS) — J&A office staff. **Always update each week — same cadence as SF.**
4. **CE & SF Transaction Report** (QuickBooks XLSX) — line-item detail for category totals (Fuel, Insurance, Truck/Trailer Rentals, Storage, Maintenance, Uniforms).
5. **CE & SF Profit and Loss — Weekly** (QuickBooks XLSX with column headers like `Apr 27 - May 3 2026`) — feeds `INCOME_2026.weeks[]`.
6. **CE & SF Profit and Loss — Monthly** (QuickBooks XLSX with column headers like `Jan 2026`, `Feb 2026`, … `May 1-3 2026`) — feeds `INCOME_2026.months[]` and `MONTHLY_REVENUE`.
7. **Contractor payment detail** — usually given in chat (e.g. "$2,800 Jon Marcus, $2,150 Mellody, …"). Mention any car payments, commission, or one-offs explicitly.

### Weekly parse — one command
```bash
python scripts/parse_weekly_drop.py
```
Reads everything in `incoming-freightiq/`, writes:
- `_summary.txt` — driver labor (office pre-excluded), EFS per-card totals, CE&SF P&L category totals.
- `_parse_output.txt` — raw row-by-row dumps of every file (read this when you need office/contractor detail).
- `_office_extract.json` / `_pnl_extract.json` — cached structured extracts (skip re-parsing across iterations).

If P&L files are present, parse them separately for `INCOME_2026` updates (the main parser doesn't write a summary section for them yet — read straight from the .xlsx using openpyxl).

### Update App.jsx constants
Swap in numbers from `_summary.txt`:
- `LABOR` / `TOTAL_HRS` ← SF drivers-only (office already excluded by the parser)
- `FUEL_TOT` / `GALLONS` ← EFS total
- `INS_TOT` / `TRUCK_TOT` / `TRAILER_TOT` / `STORAGE` / `TRUCK_MAINT` / `TRAIL_MAINT` / `UNIFORMS` ← CE&SF category totals
- `PERIOD` / `ytdDays` ← new week-ending date + day count (Jan 1 to end date)
- `MILES` ← extrapolate (old × new_days / old_days); live `/api/samsara-miles` supersedes anyway
- `PAYROLL[]` ← paste per-driver rows from `_summary.txt`
- `FUEL{}` ← match EFS cards to drivers; handle splits for shared cards
- `thru Apr X` labels throughout — grep and sweep
- `INCOME_2026` top-level totals + `weeks[]` (append new week) + `months[]` (replace partial month with full + add new partial)
- `MONTHLY_REVENUE` ← matching row update for the just-closed month

**Build will fail silently on the `drivers: 0` regression** if the `LABOR` comment doesn't have a digit adjacent to the word "drivers". The `extract-metrics.js` regex is `/(\d+)\s*drivers/i` — phrasings like "41 active drivers" break it. Use "41 drivers active" or "— 41 drivers (…)" instead.

Build verifies + regenerates `public/metrics.json` and `public/payroll-summary.json` which feed CFO Dashboard + Per Load CPM. Commit + push → Vercel auto-deploys (~2 min). Clear `incoming-freightiq/` after **all** consumers (CFO Dashboard, Per Load CPM) confirmed pulling new metrics.

### Monthly close protocol
At month close (when month N is fully invoiced in QB), refresh BOTH spots in App.jsx that hold monthly numbers — they drift independently and there's no automatic check:

1. **`INCOME_2026.months[]`** — replace the partial month-N entry with the full-month numbers from the monthly P&L XLSX. Then append a new partial entry for month N+1 (label `"May"`, etc.) with whatever days are in.
2. **`MONTHLY_REVENUE`** array (~line 2548) — same data point, different shape: replace the `m:"Apr 26"` row with full April numbers, then append `m:"May 26"` for the partial.

If you only update one, the other silently shows the wrong number forever. (This bit us in May 2026 — the `Apr 26` row in `MONTHLY_REVENUE` sat at `$356K` for weeks while `INCOME_2026.months` had a different partial value, both wrong.)

Tag any partial-month row with an inline `// partial — May 1-3 only` comment so future-you doesn't mistake it for a closed month.

### Before declaring weekly update DONE — verification checklist
**Ben should not be the QA layer.** Don't claim weekly is done until every box below is checked. Skipping any of these has historically caused wrong numbers to sit on the dashboard for weeks (the `Apr 26` MONTHLY_REVENUE row at $356K when actual was $2.16M; the AP Aging CORS regression that left Trucks/Trailers blank for ~32 days).

1. **Build clean.** `npm run build` succeeds AND `metrics.json` shows `"drivers"` matching the active driver count (not 0 — that's the LABOR-comment regex regression).
2. **Live deploy reflects the change.** `curl -s https://freightiq-nine-two.vercel.app/metrics.json` shows the new period, total_revenue, labor, fuel_tot. Don't trust the commit — verify the deploy.
3. **Cross-app endpoints respond.** `curl -s -I https://ap-aging-v4.vercel.app/api/equipment | grep -i access-control` returns CORS headers. If missing, Trucks/Trailers will be blank (`⚠ AP Aging fetch failed` banner appears in the tab footer).
4. **Sanity-check headline deltas.** A revenue jump >20% WoW or a category that's UNCHANGED WoW (`INS_TOT`, `TRAIL_MAINT`, `UNIFORMS` etc.) should be flagged in the commit message — they're usually either real or a missing data file.
4a. **Scan subtitle / explanatory labels next to dollar values, not just the dollars.** The numbers can be right while the prose surrounding them silently lies. Anything hardcoded with a quarter ("Q1 2026"), a day count ("72-day period"), or a date should be derived from `PERIOD` / `PERIOD_DAYS` — never typed in directly. If you see a hand-typed quarter/day-count anywhere, that's a future regression about to happen; replace with a derived value.
5. **No new entities silently absorbed.** New EFS card numbers, new vendor lines in the QB transaction report, new drivers in the payroll XLS — all must be either mapped in the appropriate constant OR explicitly noted in the commit message as "excluded from per-driver mapping" (e.g. card 17408 = Andres / warehouse).
6. **No stale partial-month rows.** `INCOME_2026.months[]` and `MONTHLY_REVENUE` last entries should either be a full closed month OR a partial flagged with an inline `// partial — May 1-3 only` comment. A closed prior month showing < 50% of the typical run is a stale row.
7. **Cross-repo fixes are pushed, not just local.** If a fix touches a sibling repo (e.g. `ap-aging` for CORS), `git status` in that repo to confirm clean. The nightly stale-repos cron (`~/Desktop/_stale-repos.md`) catches drift but should never be the first time you discover an uncommitted fix.
8. **Downstream consumers still work.** CFO Dashboard fetches `metrics.json` + `payroll-summary.json`; Per Load CPM fetches `metrics.json` + `/api/alvys-loads`. Visit each at least once after the deploy lands to confirm they hydrated with new numbers.
9. **Clear `incoming-freightiq/`** only AFTER all of the above pass.

### Office vs Driver split (SF Payroll):
**Office staff** (excluded from PAYROLL/CPM): Arias Adrian, Eagleton Gentry J (warehouse), Figueroa Andres (warehouse), Fissehaye Biniyam G, Gonzalez Gabriel, Grosser Scot E, Rivera Cecilia I, Youngblood Nathan. Everyone else = drivers. (Encoded in `scripts/parse_weekly_drop.py` — keep in sync.)

### EFS card → driver mapping
Cards are mapped to drivers via inline comments in `FUEL{}` (e.g. `// card 27406`). Several cards split between active and *inactive (frozen) drivers — when a card's total is unchanged WoW but the card has frozen contributors, the entire card is dormant. New activity on a split card goes to the active driver(s); frozen drivers' historical values stay locked. EFS cards that don't map to a `PAYROLL[]` driver (warehouse / office / unknown) are excluded from per-driver `FUEL{}` but **still counted in `FUEL_TOT`** so the fleet CPM math reconciles to the EFS report total.

## Upload Sources (AI auto-detects format)

QuickBooks (P&L, payroll) · EFS (fuel cards) · Mudflap (fuel) · Samsara (GPS mileage) · Penske / TEC / TCI (truck leases) · McKinney / Xtra (trailers) · Any CSV/XLSX with driver, fuel, mileage, or financial data

## Testing

No test framework configured. No automated tests.

## Code Conventions

- All components defined as functions inside App.jsx (not separate files)
- Inline styles throughout (no CSS modules or Tailwind)
- Data-heavy: expect large constant arrays/objects at top of App.jsx
- Recharts for all visualizations — use ResponsiveContainer wrapper
- When adding new data, follow existing patterns (add constant, wire into component)
- Max layout width: 1400px

## Related Projects

- **Per Load CPM** (`perload-cpm.vercel.app`) — Standalone booking tool, fetches metrics.json + /api/alvys-loads from this app
- **AP Aging** (`ap-aging-v4.vercel.app`) — AP Aging dashboard (Next.js + Supabase), feeds equipment data into FreightIQ via EquipmentContext
- **CFO Dashboard** (`cfo-dashboard-eta.vercel.app`) — Executive financial dashboard (React + Tailwind + Supabase), fetches metrics.json + payroll-summary.json from this app. Local path: `Desktop/Freight/cfo-dashboard`, no GitHub repo — deployed via `npx vercel deploy --prod --yes`. Has per-source status bar, section quick-nav, safeDivide guards, dynamic period/truck count. Known debt: monolithic App.jsx, RLS wide open, no endpoint auth, hardcoded business data.
- **Samsara Agent** (`Desktop/Freight/samsara-agent`) — Autonomous agent pulling Samsara fleet data on cron
- **Flexent Dashboard** (`flexent-dashboard.vercel.app`) — Factoring dashboard for Capacity Express
- **Alvys Invoice Clearer** (`Desktop/Freight/alvys-clearer.html`) — Standalone HTML tool: drop Flexent CarrierRept PDFs, AI parses invoices, cross-references against Alvys queued loads, exports Alvys-ready CSV. Uses `/api/ai` + `/api/alvys-loads`. Supports multiple PDF drops (accumulates). Alvys API is read-only for invoicing — CSV must be uploaded via Alvys UI.

## Cross-app deployment dependencies

This dashboard makes cross-origin browser fetches to other repos. **CORS regressions are silent failures** — the response arrives but the browser drops it; the React effect's `.catch` was the only signal until the visible error banner was added.

| Endpoint | Owner repo | Required header | Where it's set |
|---|---|---|---|
| `https://ap-aging-v4.vercel.app/api/equipment` | `Desktop/Freight/ap-aging` | `Access-Control-Allow-Origin: *` | Global `headers()` in `next.config.js` (applies to all `/api/*` routes) |
| `https://flexent-dashboard.vercel.app/master.csv` | `Desktop/Freight` | static asset, no CORS issue | n/a |

If you change `ap-aging/next.config.js` or stand up a sibling AP-Aging deploy, **verify CORS headers are present in the deployed response** before declaring done:
```bash
curl -s -I "https://ap-aging-v4.vercel.app/api/equipment" | grep -i access-control
```
If the header is missing, the Trucks + Trailers tabs in FreightIQ go blank with a red banner: `⚠ AP Aging fetch failed: <reason>`.

**Watch for the uncommitted-fix pattern** — the CORS regression that bit May 2026 was a fix that lived in the local working tree of `ap-aging` for weeks but was never committed/pushed. Before celebrating a cross-app fix, run `git status` in the upstream repo to confirm the change is shipped.
