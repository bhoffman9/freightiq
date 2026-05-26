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
│   ├── budget-whatifs.js    # Vercel serverless — Supabase CRUD for Budgeting tab what-if scenarios
│   ├── distance.js          # Vercel serverless — Google Maps Distance Matrix proxy
│   ├── qbo-pnl.js           # Vercel serverless — QuickBooks P&L with period selector
│   ├── qbo-bs.js            # Vercel serverless — QuickBooks Balance Sheet
│   └── samsara-miles.js     # Vercel serverless — Samsara IFTA mileage per truck/state
├── src/
│   ├── main.jsx            # React entry point
│   └── App.jsx             # Entire dashboard (~8,500 lines, monolithic)
├── public/
│   └── metrics.json        # Auto-generated KPIs (built by extract-metrics.js)
├── supabase/migrations/    # SQL migrations (run manually in Supabase SQL editor)
│   └── freightiq_budget_whatifs.sql
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
| `GET /api/qbo-pnl?company=X&period=Y` | GET | QuickBooks P&L — companies: `ce_sf_combined`, `ce_east`. Periods: `ytd`, `this_week`, `last_week`, `jan`-`dec`, or `start_date`/`end_date`. **Returns `{ company, period, fiq, parsed }` — expenses/cogs/truckTrailer dicts live under `parsed.*`, not top-level. See `parsePnlReport()` in `_qbo-helpers.js` for the bucket-mapping gotchas (nested-section prefix loss, etc.)** |
| `GET /api/qbo-bs?company=X` | GET | QuickBooks Balance Sheet — returns assets, liabilities, equity with account detail |
| `GET/POST/PATCH/DELETE /api/budget-whatifs` | * | Supabase CRUD for Budgeting tab what-if scenarios. POST body `{ label, amount, frequency: 'weekly'\|'monthly' }`. Backed by `freightiq_budget_whatifs` table — returns 503 `table-not-found` until migration is applied |
| `GET /api/cash-flow` | GET | Pulls this week's scheduled payments from the budget-calendar's shared Supabase tables (`w_custom_recurring` + `w_one_time_expenses` + `w_checked_items` + `w_categories`) and shapes them as `{ week, windowStart, windowEnd, payments: [{day, vendor, amount, status, cat}] }`. Used by Cash Flow tab. Replaces the old GitHub raw fetch of `current-week.json`. Bank account balances are NOT tracked in the calendar tables — UI falls back to hardcoded `CASH_SNAPSHOTS` for that side |
| `GET /api/samsara-miles?year=2026` | GET | Samsara fleet mileage. **Hybrid:** finalized quarters via IFTA endpoint (per-state breakdown), in-progress quarter via `/fleet/vehicles/stats/history` odometer delta (no per-state breakdown until IFTA closes). Returns `inProgressQuarter`, `inProgressSource` (e.g. `"obd:31 + gps:0"`), per-truck `iftaMiles` + `inProgressMiles`. Drives fleet `MILES` constant + CPM at runtime via `recomputeDerived()` + `dataVersion` remount |

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
     - Samsara fleet mileage via `/api/samsara-miles` — finalized quarters use IFTA per-state breakdown; in-progress quarter uses `gpsOdometerMeters`/`obdOdometerMeters` delta from `/fleet/vehicles/stats/history` (per-state breakdown only refreshes when IFTA closes at quarter end). Live `fleetTotal` mutates the module-level `MILES` constant on App mount → drives every fleet CPM display via `recomputeDerived()` + `key={dataVersion}` remount. localStorage cache (`fiq_fleet_miles_v1`, 24h TTL) hydrates synchronously on mount so returning visitors see correct CPM on first paint
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
| CE East | `CEEast()` | Live QBO P&L + Balance Sheet for the CE East entity. Uses a separate QBO token (`ce_east`) in the shared `qbo_tokens` table — when this token expires (401s in the console), re-auth via the CFO Dashboard (see "Re-authorizing QBO" below) |
| ATL Ops | `AtlOperations()` | Atlanta operations launched May 11, 2026. Sums entries tagged `entity:"ATL"` in PAYROLL/FUEL/CONTRACTORS. Transferred drivers/contractors carry an `atlPreYtd` snapshot so the tab shows since-launch only, not YTD. **Every week ask Ben which drivers + contractors were ATL — it's fluid, not a fixed roster.** See `feedback_atl_weekly` memory + the data layer notes below |
| Cash Flow | `CashFlowDashboard()` | Weekly cash snapshot. Bank-balance accounts are hardcoded in `CASH_SNAPSHOTS` (no Supabase table tracks them). Scheduled payments pull live from `/api/cash-flow` which queries the budget-calendar's `w_*` Supabase tables. Subtitle shows "Live from budget calendar (Supabase)" when the fetch succeeds |
| Budgeting | `Budgeting()` | QBO P&L rolled into 19 weekly-budget buckets + Agent bucket + Supabase-backed what-if simulator. See "Budgeting tab" section below for bucket-mapping rules. Agent bucket pulls from `AGENTS[]` (NOT subtracted from owner — Kevin's draws are a separate QBO category) |
| Upload | `DataSettings()` | Drop CSV/XLSX files, AI auto-maps columns |
| Checklist | `Checklist()` | Weekly/monthly data update tasks |

## State Management

- **React Context** (2 contexts):
  - `DataContext` — upload/file processing state shared across tabs
  - `EquipmentContext` — truck/trailer AP aging data from external dashboard
- **Local state** via `useState` / `useRef` / `useEffect` in each component
- No Redux, Zustand, or other state library

### Budgeting tab — QBO P&L bucket mapping

The Budgeting tab (`Budgeting()` component in App.jsx) rolls every QBO P&L expense line into 19 investor-readable buckets so the user can see weekly run-rate and add what-if scenarios. The mapping logic is non-obvious — these are the gotchas that cost time and would cost it again:

**Response shape:** `/api/qbo-pnl` returns `{ company, period, fiq, parsed }`. The dicts are nested under `parsed.*` (`parsed.expenses`, `parsed.cogs`, `parsed.truckTrailer`, `parsed.totals`) — NOT top-level. The `fiq` object is a flat KPI subset used elsewhere; don't confuse the two.

**Nested-section prefix:** `parsePnlReport()` stores nested rows as `"Parent Section > Item Name"`. Subtotals store as `"Total for X"` or sometimes `"Total X"` (QBO is inconsistent — match both spellings). Example:
- `"Salaries and Wages > Salaries & Wages - Drivers"` — direct child of Salaries section
- `"Payroll Taxes > Federal Tax"` — direct child of Payroll Taxes sub-section
- `"Total for Salaries and Wages"` — subtotal at top level
- `"Total Payroll Taxes"` — also subtotal at top level (no "for")

**Two-level nesting loses parent context.** When QBO nests sections (e.g. `Capacity Express East > Travel Expenses - CE East > Flights - CE East`), the parser only carries one level of prefix. The Flights row stores as `"Travel Expenses - CE East > Flights - CE East"` — the `Capacity Express East` context is gone. If you skip CE East's children via the `Capacity Express East` prefix, the CE East travel sub-items still leak through. Fix: add the inner section name (`Travel Expenses - CE East`) to `subSectionsUseSubtotal` AND skip the subtotal key (`Total Travel Expenses - CE East`) explicitly because it's already inside `Total for Capacity Express East`.

**Two ways a category gets counted (don't mix them up):**

1. **Use the subtotal.** Sections with sibling line items that aggregate (Asset Loans, Bad Debt, CE East, Cost of Labor, Insurance, Legal, Owner Draws, Payroll Taxes, Travel Expenses, Travel Expenses - CE East) — match the `"Total for X"` key, and add the section name to `subSectionsUseSubtotal` so the `>`-prefixed children are skipped.

2. **Use the components.** Sections where the subtotal bundles things you want separated (Salaries and Wages → drivers + office + contractor + payroll taxes are different buckets) — skip the `"Total for ..."` subtotal explicitly, and consume the `>`-prefixed children (strip the prefix when matching). Otherwise you'd double-count: subtotal + components.

**COGS bucket** = ALL `parsed.cogs` values, not just `Carrier Pay`. Flexent Funding Fees + Triumph Merchant Fees (~$69K YTD) are also COGS — sum them all into the carrier bucket.

**Net margin uses Net Income, not Net Operating Income.** Other Income (Triumph withholding refunds + interest) adds ~$77K YTD that's NOT in revenue−spend. Use `INCOME_2026.netIncome / INCOME_2026.total`, which matches the headline on the Income tab.

**What-if math:** each added $/wk reduces weekly net income 1:1. Show clearing in dollars (before vs after), not just margin points — the dollar number is what investors care about.

**Supabase what-if persistence:** scenarios live in `freightiq_budget_whatifs` (uuid id, label, amount, frequency, active, created_at, updated_at). RLS enabled with permissive policy (service key bypasses anyway). Migration SQL in `supabase/migrations/freightiq_budget_whatifs.sql` — run manually in the Supabase SQL editor; the read-only MCP can't create tables. The API returns `503 { error: 'table-not-found' }` until the migration is applied, and the UI surfaces that as a yellow setup banner so it's obvious what to do.

### ATL Operations + Agent — entity tagging data layer

ATL Operations (Atlanta, launched May 11, 2026) and the Agent model (Kevin Deveraux / Nixon Graye Associates, launched May 11, 2026) are tracked as separate operational entities. The plumbing:

**`entity: "ATL"` tag** on `PAYROLL[]`, `FUEL{}`, `CONTRACTORS[]` entries. `AtlOperations()` filters by this tag.

**`atlPreYtd` snapshot** on transferred drivers/contractors — stores their YTD as of the day before they transferred to ATL, so the ATL tab can subtract and show **since-launch only**, not YTD:
- PAYROLL: `atlPreYtd: { hours, totalCost }`
- FUEL: `atlPreYtd: { fuel, gallons }`
- CONTRACTORS: `atlPreYtd: { weeklyTotal, carTotal, commission, healthInsTotal, total }` — per-component so the contractor table can break it out by base / commission / health / car

Native-ATL entries (drivers/contractors who started fresh in ATL): no `atlPreYtd` needed; full YTD = ATL contribution.

**Initial ATL roster (May 11, 2026 launch):**
- W2 drivers (`entity: "ATL"`): Samuel Denman + Anthoni Davis (transferred from CE/SF, atlPreYtd stored), Manar Alshamaa + Robert Tucker (NEW), Christopher Johnson (NEW — pending first paycheck, EFS card 37459 already active)
- Contractors (`entity: "ATL"`): Mellody Abrego (transferred, atlPreYtd with components), ENM Trucking LLC = Biniyam Fissehaye (NEW — J&A W2 → 1099 same day)

**Agent layer (`AGENTS[]` array)** — separate top-level array NOT inside CONTRACTORS. Surfaced as its own bucket on the Budgeting tab (`agent` key, 🤝 icon). Agent payments are a **separate draw category in QBO** — NOT inside `Total for Owners Draw`. **Do NOT subtract agent total from the owner bucket** — they don't overlap in QBO.

Card-47458 footnote: previously misattributed to Wright Robert (frozen) — reassigned to Tucker Robert ATL in the May 16 update. Wright stays frozen at $2,170.77 (his card 37405 portion only).

### Re-authorizing QBO (when CE East or another company shows 401s)

QBO tokens for all companies live in the shared `qbo_tokens` Supabase table. CE East has its own row (`id: ce_east`). When the refresh token expires (typically 100 days), `/api/qbo-pnl?company=ce_east` returns 401 and the CE East tab falls back to its static block.

**The OAuth flow lives on the CFO Dashboard** (not FreightIQ) — it's the redirect URI registered with Intuit. Re-auth procedure:

1. Open: `https://cfo-dashboard-eta.vercel.app/api/qbo-auth?company=<id>` where `<id>` is one of `ce_sf_combined` | `sf_payroll` | `ja_management` | `ce_east`
2. Browser redirects to Intuit's OAuth screen — sign in if needed, pick the matching QuickBooks company, authorize
3. Intuit redirects back to `/api/qbo-callback` which writes the fresh token to `qbo_tokens` row matching `<id>`
4. FreightIQ reads from the same table — the relevant tab loads live on next page refresh

Verify with: `curl -s -o /dev/null -w "%{http_code}\n" "https://freightiq-nine-two.vercel.app/api/qbo-pnl?company=ce_east&period=ytd"` — should return 200.

### Runtime live-data mutation pattern

Module-level `let` constants (`MILES`, `LABOR`, `FUEL_TOT`, `BASIC_CPM_V`, `ALLIN_CPM_V`, etc.) are **mutated at runtime** when live data lands. The plumbing:

1. `recomputeDerived()` (defined just above the App component) re-derives every dependent constant (`BASIC_COST`, `BASIC_CPM_V`, `ALLIN_COST`, `ALLIN_CPM_V`, `MAINT_TOT`, `EQUIP_TOT`, `MILES_EST`, `DRIVERS`) from the current values of the inputs.
2. The App's `<div className="app" key={dataVersion}>` uses `dataVersion` as a remount key — bumping `dataVersion` unmounts and remounts the entire tab tree, so every component re-reads the freshly-mutated constants on next render.
3. Update flow: `MILES = newValue; recomputeDerived(); setDataVersion(v => v + 1);`

Used by:
- The Upload tab (constants pasted from QB exports)
- App-mount Samsara fetch (`MILES` from `/api/samsara-miles` `fleetTotal`, see API table)

If you're adding a new live data source that needs to drive CPM or other derived displays, follow this pattern instead of trying to wire prop drilling or context — the existing remount key already does the work.

**Hydration cache:** when fetching live data on App mount, store the last good value in localStorage with a TTL and hydrate synchronously on next mount before the fresh fetch fires. Returning visitors then see correct values on first paint instead of the static baseline. See `fiq_fleet_miles_v1` in App.jsx for the reference implementation.

## Key Data Constants (hardcoded in App.jsx)

- `PAYROLL[]` — 42 drivers with hours/cost (Memolo Dominick still 0; Kelly Kirk D / Butler Richard / Negrete Arturo / Whipple Wallace 57403 / Williams Will 27405 etc. *inactive markings) thru Apr 26, 2026. **Don't write "41 active drivers" in the LABOR comment — extract-metrics.js regex `(\d+)\s*drivers` needs the digit adjacent to "drivers" or `metrics.json` falls back to 0 (regression fixed week 16).**
- `FUEL{}` — per-driver fuel spend + gallons (EFS only, thru Apr 26)
- `MONTHLY_MILES[]` — Samsara GPS: per-month, per-truck local vs regional
- `TRUCK_MILES[]` — per-truck per-state mileage static fallback (live via /api/samsara-miles supersedes — driven by IFTA + odometer delta, see API table)
- `MILES` — fleet total miles **mutated at runtime** on App mount from `/api/samsara-miles` `fleetTotal`. Static baseline is the most recent live snapshot (~454K) so the pre-fetch frame is within 0.05% of truth. Don't extrapolate this manually anymore — set the static baseline to whatever Samsara returned at last build
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

### Step 0 — ASK Ben for the ATL + Agent rosters (do this FIRST, before any code changes)

ATL and Agent are fluid week-to-week. The QBO P&L files and payroll exports don't carry the entity label, so you can't infer it from data alone — Ben is the source of truth. Three questions, every weekly drop:

1. **ATL Drivers** — which W2 drivers were ATL this week? Any joins / leaves / transfers back to CE-SF?
2. **ATL Contractors** — which contractor payments were ATL this week? (Default-tagged ATL: Mellody, ENM Trucking)
3. **Agent payments** — which agents got paid this week? Any new agents? Same $/wk? (Default: Kevin Deveraux / Nixon Graye $500/wk)

For ATL drivers/contractors, also confirm whether each is **transferred from CE-SF** (needs `atlPreYtd` snapshot of YTD-as-of-day-before-transfer) or **native ATL** (no preATL — full YTD = ATL contribution). See `feedback_atl_weekly` memory for the full implementation.

### Automated (live feeds — no file drops needed):
- **CE & SF Combined P&L** — live from QuickBooks via `/api/qbo-pnl` (Income tab → Live QB)
- **CE East P&L + Balance Sheet** — live from QuickBooks (CE East tab → Live QB + Owner Payback)
- **Samsara mileage** — live from Samsara IFTA API via `/api/samsara-miles` (Trucks & Mileage tab)
- **Alvys TMS loads** — live via `/api/alvys-loads` (Revenue tab)
- **AP Aging equipment** — live via `https://ap-aging-v4.vercel.app/api/equipment` (Trucks + Trailers tabs). Cross-origin fetch — relies on global CORS in `ap-aging/next.config.js`. If Trucks/Trailers go blank, check the red error banner in the tab footer and the AP Aging deploy status.

### Atlanta billing (one extra file, dropped alongside the rest)
- **`2026-Atlanta Billing.xlsx`** — Atlanta load-level revenue spreadsheet, sheet name `as of <date>`. Columns: Driver · Load $ · REF # · PO # · Customer · Invoice Amount · Carrier · Carrier Amount · Assigned · Notes. Only rows where **Assigned = `ATL`** count as ATL revenue; `ASSIGNED TO CORP` (19 in week 1) and `ASSIGNED TO CEE` (2 in week 1) are ATL drivers running freight billed under SF/CEE, NOT ATL revenue.

Parse it with `python scripts/parse_atl_billing.py` — outputs the `ATL_BILLING` constant block to paste into `src/App.jsx` (replace existing). First-name → PAYROLL name mapping is in the script's `NAME_MAP` dict; extend when new ATL drivers appear in the sheet.

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

**Source-of-truth principle: PERIOD is the only date-related string you need to update.** The rest derives. As of May 2026, anything below labelled "auto-derived" no longer needs a manual edit each week — touching it is a regression risk.

Touch these (real data each week):
- `PERIOD` ← new week-ending date string (e.g. `"Jan 1 - May 9, 2026"`). Drives `PERIOD_DAYS`, header subtitle, Insurance day-count, P&L "2026 YTD (Nd)" column header. Update once.
- `LABOR` / `TOTAL_HRS` ← SF drivers-only from `_summary.txt`
- `FUEL_TOT` / `GALLONS` ← EFS total from `_summary.txt`
- `INS_TOT` / `TRUCK_TOT` / `TRAILER_TOT` / `STORAGE` / `TRUCK_MAINT` / `TRAIL_MAINT` / `UNIFORMS` ← CE&SF category totals
- `MILES` ← bump to whatever `/api/samsara-miles` returns for `fleetTotal` at update time (it'll be live-mutated on every page load too, but a stale baseline causes a wrong-CPM flicker on cold loads — keep within 1% of live)
- `PAYROLL[]` ← paste per-driver rows from `_summary.txt`
- `FUEL{}` ← match EFS cards to drivers; handle splits for shared cards
- `INCOME_2026` top-level totals + `weeks[]` (append new week) + `months[]` (replace partial month with full + add new partial)
- `MONTHLY_REVENUE` ← matching row update for the just-closed month
- Sweep any inline `thru <date>` comments next to category constants — these are still hand-typed annotations; keep them current

**DO NOT touch — auto-derived (touching breaks future-week derivation):**
- `PERIOD_DAYS` — parsed from `PERIOD` at module load
- `ytdDays` (in IncomeDashboard) — references `PERIOD_DAYS`
- Header subtitle "Show Freight Inc · {PERIOD}" — already templated
- Insurance tile subtitle "$6,375/wk · {PERIOD_DAYS}-day period" — derived
- P&L column header "2026 YTD ({PERIOD_DAYS}d)" — derived
- YoY same-window logic (`ytd26FullRev`, `ytd25SameRev`, `sameWindowLabel`, etc.) — auto-pairs 2026 closed months with same months in 2025; no Q1 baseline to bump
- Net Income YoY sign-cross handling — automatically swaps to `+$X (loss→profit)` format when sign changes
- `INCOME_2025.q1Rev/q1GP/q1NI` — left in data but no longer drives any display

**If you find yourself hand-typing a quarter, day count, or partial date anywhere in `App.jsx` outside of `PERIOD`, stop.** That's a future regression. Wire it through `PERIOD` / `PERIOD_DAYS` / `INCOME_2026.months` instead.

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
4b. **Quick `grep` for drift hotspots before commit:**
    ```bash
    # Hand-typed periods, quarters, "thru <month>"
    grep -nE '\b[0-9]{2,3}-day\b|\bQ[1-4] 20[2-9][0-9]\b|thru (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) [0-9]+' src/App.jsx | grep -v 'PERIOD_DAYS\|^\s*\*\|fixed\|incoming-freightiq'

    # Hardcoded month-range strings in subtitles (e.g. "Feb–Mar 2026", "Jan-Apr")
    grep -nE '\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*[-–]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b' src/App.jsx | grep -v 'INCOME_2025\|q1\|isPartialLast'

    # MILES_EST used anywhere except fuel-price math (line ~122)
    grep -nE '/\s*MILES_EST' src/App.jsx | grep -v 'fuel|gallons|PPG|avg|FUEL_TOT / GALLONS'

    # Hardcoded total inside a DETAIL[] row (should be live constants like LABOR, TRUCK_TOT, etc.)
    grep -nE 'total:\s*[0-9]+\.[0-9]+' src/App.jsx | head -5
    ```
    Any hits are hand-typed period strings or live-data divergences that should either be derived or deliberately annotated (e.g. inline `// partial — May 1-3 only` comments are fine; `"72-day period"` strings are not). MILES_EST is fuel-only (avg $/gal calc) — never use it for any CPM display; CPM always divides by `MILES` (live Samsara).
5. **No new entities silently absorbed.** New EFS card numbers, new vendor lines in the QB transaction report, new drivers in the payroll XLS — all must be either mapped in the appropriate constant OR explicitly noted in the commit message as "excluded from per-driver mapping" (e.g. card 17408 = Andres / warehouse).
6. **No stale partial-month rows.** `INCOME_2026.months[]` and `MONTHLY_REVENUE` last entries should either be a full closed month OR a partial flagged with an inline `// partial — May 1-3 only` comment. A closed prior month showing < 50% of the typical run is a stale row.
7. **Cross-repo fixes are pushed, not just local.** If a fix touches a sibling repo (e.g. `ap-aging` for CORS), `git status` in that repo to confirm clean. The nightly stale-repos cron (`~/Desktop/_stale-repos.md`) catches drift but should never be the first time you discover an uncommitted fix.
8. **Downstream consumers still work.** CFO Dashboard fetches `metrics.json` + `payroll-summary.json`; Per Load CPM fetches `metrics.json` + `/api/alvys-loads`. Visit each at least once after the deploy lands to confirm they hydrated with new numbers.
9. **Clear `incoming-freightiq/`** only AFTER all of the above pass.

### Drift patterns Ben should NEVER have to catch (you catch them first)

Ben paying attention to dashboard details is the LAST line of defense, not the first. Every time he spots a mismatch and has to point it out, that's a process failure. These are the classes of bugs that have bitten before — actively look for them before declaring weekly done:

**A. Numerator/denominator mismatches in CPM displays.** Every CPM (cost-per-mile) tile on every tab must divide by `MILES` (live Samsara), never `MILES_EST` (gallons × 6.5 — fuel-price math only). If you see two CPM panels showing the same metric with different values, that's the bug. Run the `/MILES_EST` grep above before commit; the only legitimate hit is the avg $/gal display.

**B. Hardcoded period strings outside `PERIOD` / `PERIOD_DAYS` / `PERIOD_END`.** Subtitles, tab headers, sub-view labels, modal `thru:` fields — none of these should contain a hand-typed month/quarter/date. If a label needs to reflect "current period," derive it from `PERIOD` so it auto-rolls. Examples that bit us:
- `"Feb–Mar 2026"` baked into Trucks + Trailers subtitles (caught May 17)
- `"thru May 2"` baked into DetailModal rows (caught May 16)
- `"122-day period"` in Insurance subtitle (caught weeks ago)

**C. Stale rows behind a live header.** Modals/panels that show a live total in the header but hardcoded line items below — when totals diverge from row sums by 3+ weeks of activity, the user notices. Pattern: either (a) make the rows live too via QBO/Supabase/array-derived data, or (b) hide the rows entirely behind a loading state. Never flash stale rows while a live fetch is in flight (DetailModal `displayRows = []` while `liveLoading`).

**D. Constants that drift silently because they're computed elsewhere.** A bucket showing `total: 233765.59` hardcoded inside DETAIL when the actual Owner Draws is now $247,082 — that's a stale literal. Whenever a tile has a "Total" header that references a live constant (LABOR, INS_TOT, etc.), the rows feeding into it should be similarly live or explicitly flagged stale.

**E. Tab subtitles that lie about data source.** "Live from X" badges, "thru May Y" labels, "N drivers" counts — these should reflect what's actually being displayed. If a subtitle says "Feb–Mar 2026" but the table below shows YTD-thru-May data, the subtitle is wrong. Always make subtitles either live-derived or explicitly flagged with `// historical snapshot — refresh weekly`.

**F. QBO API filters silently dropping.** When using class/customer/vendor/department filters on QBO reports, **always check `Header.Option[]` in the response** to confirm QBO recognized the filter. If your filter isn't in the Option list, the API ignored it and returned the full unfiltered report. Sanity-check by comparing filtered total to unfiltered total — if equal, your filter didn't filter. See `reference_qbo_class_filter.md` memory.

**G. Cross-app data ownership.** If a tab depends on a sibling repo (AP Aging, expense-calendar, etc.) and that repo's data shape changes or its publishing stops, FreightIQ falls back silently to hardcoded data. Check the cross-app fetch status banners on each tab; if a banner says "fetch failed" or shows stale data, it counts as broken.

**H. Constants frozen at first commit then never refreshed.** `DETAIL[]`, `MONTHLY_REVENUE` historical rows, vendor-specific blocks (TCI / Penske / TEC / McKinney). When the live data source for one of these changes, the hardcoded copy still ships unless you explicitly refresh or replace it. Search for "thru" comments next to any hardcoded constant — those are tells of frozen-in-time data.

### Office vs Driver split (SF Payroll):
**Office staff** (excluded from PAYROLL/CPM): Arias Adrian, Eagleton Gentry J (warehouse), Figueroa Andres (warehouse), Fissehaye Biniyam G, Gonzalez Gabriel, Grosser Scot E, Naruszewicz Bartosz, Rivera Cecilia I, Youngblood Nathan. Everyone else = drivers. (Encoded in `scripts/parse_weekly_drop.py` — keep in sync.)

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
- **Atlanta CPM** (`atlanta-cpm.vercel.app`) — ATL planning calculator. Local path: `Desktop/Freight/atlanta-cpm`, has its own CLAUDE.md. **Broader audience than FreightIQ** — when copying ATL operating numbers into atlanta-cpm: (1) driver wages only (no office/contractor/agent), (2) no revenue/GP/margin (cost tool only), (3) never add a UI link back to freightiq-nine-two from atlanta-cpm. The `metrics.json` fetch is fine; rendered links are not. See `feedback_atlanta_cpm_audience` memory.
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
