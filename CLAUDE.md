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

- `PAYROLL[]` — 41 drivers with hours/cost (thru Apr 13, 2026)
- `FUEL{}` — per-driver fuel spend + gallons (EFS only, thru Apr 11)
- `MONTHLY_MILES[]` — Samsara GPS: per-month, per-truck local vs regional
- `TRUCK_MILES[]` — 35 trucks with per-state mileage breakdown (thru Apr 11; also available live via /api/samsara-miles)
- `TCI_LEASING{}`, `PENSKE{}`, `TEC_EQUIPMENT{}` — truck lease data
- `TRAILERS_INV{}`, `XTRA_LEASE{}` — trailer inventory/leases
- `INCOME_2026`, `INCOME_2025` — weekly/monthly revenue + margins
- `CE_EAST{}` — CE East subsidiary financials
- `MONTHLY_REVENUE[]` — 2025-2026 by company (CE/SF/DI)
- `DETAIL{}` — transaction breakdowns (labor, fuel, insurance, trucks, trailers, maintenance)
- `ASCEND{}` — Historical Ascend TMS data (Jan-Mar 2026, no longer active)
- `ALVYS{}` — Alvys TMS pipeline snapshot (also fetched live via /api/alvys-loads)

**Current period:** Jan 1 – Apr 12, 2026 (102 days)

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

### Manual file drops (into `Desktop/Ben/incoming-freightiq/`):
1. **EFS Transaction Report PDF** — per-driver fuel (no API available)
2. **SF Payroll Summary** (QuickBooks XLS) — driver + office payroll
3. **J&A Management Payroll Summary** (QuickBooks XLS) — J&A office staff
4. **CE & SF Transaction Report** (QuickBooks XLSX) — line-item detail for DETAIL boxes
5. **Contractor payment detail** — weekly amounts for 1099 contractors

**After processing:** Always clear `incoming-freightiq/` folder, commit, and push immediately.

### Office vs Driver split (SF Payroll):
**Office staff** (excluded from PAYROLL/CPM): Arias Adrian, Eagleton Gentry (warehouse), Figueroa Andres (warehouse), Fissehaye Biniyam, Gonzalez Gabriel, Grosser Scot, Rivera Cecilia, Youngblood Nathan. Everyone else = drivers.

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
- **CFO Dashboard** (`cfo-dashboard-eta.vercel.app`) — Executive financial dashboard (React + Tailwind + Supabase), fetches metrics.json + payroll-summary.json from this app. Local path: `Desktop/Ben/cfo-dashboard`, no GitHub repo — deployed via `npx vercel deploy --prod --yes`
- **Samsara Agent** (`Desktop/Ben/samsara-agent`) — Autonomous agent pulling Samsara fleet data on cron
- **Flexent Dashboard** (`flexent-dashboard.vercel.app`) — Factoring dashboard for Capacity Express
