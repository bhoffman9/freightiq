# FreightIQ — Show Freight Inc Operations Dashboard

Real-time fleet cost-per-mile dashboard with AI-powered data uploads and live API integrations. Single-page React app deployed on Vercel.

## Live URL

**https://freightiq-nine-two.vercel.app** — NEVER change this URL or create duplicate Vercel projects.

## 📍 Canonical path — VERIFY THIS FIRST, before any edit

**`c:\Users\hoffm\Desktop\Freight\freightiq`** (plain Desktop, **not** OneDrive). Ruled by Ben 2026-07-30.

**This is the ONE canonical repo.** All work happens here. Never apply changes to any other local copy. Always commit and push data updates immediately.

There is a **stale mirror** at `C:\Users\hoffm\OneDrive\Desktop\Freight\freightiq`. It is a real git clone with the same `origin`, so it looks legitimate — on 2026-07-30 it was **37 commits behind** and a session opened there by default and nearly ran a weekly against it. Cause: Windows' registered Desktop *is* the OneDrive one (`HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders\Desktop` = `C:\Users\hoffm\OneDrive\Desktop`); OneDrive Known Folder Move swept the Desktop on 2026-07-20 ~05:26 and froze a copy. Anything resolving "Desktop" through Windows lands in the mirror.

```bash
cd "c:/Users/hoffm/Desktop/Freight/freightiq"
git rev-list --left-right --count HEAD...origin/main   # must print: 0  0
```

- **⛔ Do NOT delete the OneDrive Freight tree.** 16 of its 20 project folders exist ONLY there, and `cfo-dashboard`, `budget-calendar`, `showfreight-pitches`, `archive` have **no `.git` at all** (cfo-dashboard has no GitHub repo by design). The Flexent dashboard and the root `Freight\CLAUDE.md` are also OneDrive-only. Consolidating those 16 is an OPEN decision.
- **File drops:** most weekly files are in `C:\Users\hoffm\Downloads\`; some land in `OneDrive\Desktop\Freight\freightiq\incoming-freightiq\`. **Copy them into the canonical repo — never work in the mirror.**

## ⚡ Critical invariants — read before touching anything

The rules below have each shipped wrong numbers when missed. They live in full detail deeper in this file; this is the high-attention copy. Details in the linked sections.

- **Done = verified LIVE, not committed.** `curl` metrics.json + check cross-app CORS + visit downstream consumers before claiming done. → "Before declaring weekly update DONE"
- **CPM always divides by `MILES`, never `MILES_EST`.** MILES_EST (gallons×6.5) is fuel-price math only. → Drift pattern A
- **`PERIOD` is the ONLY date string you hand-type.** Everything else (day counts, quarters, subtitles) derives. Hand-typing a quarter/day-count anywhere else is a future regression. → "Update App.jsx constants"
- **LABOR comment keeps the digit adjacent to "drivers"** ("42 drivers active"), or `extract-metrics.js` regex sets `metrics.json drivers:0`. → drivers:N regression
- **ATL / Agent are per-week — ASK Ben every drop, never generalize** one week's roster to adjacent weeks. Agents are a separate bucket, never nested under ATL/owner. → Step 0
- **The office + contractor half is NOT optional.** `OFFICE_W2`/`WAREHOUSE` + `CONTRACTORS` refresh every week — drivers/fuel/income alone ≠ done. → checklist #10
- **Never clear `incoming-freightiq/` until the weekly is built, pushed, and verified live** — the payroll XLS is untracked and unrecoverable. → checklist #11
- **CPM source purity:** `FUEL_TOT` = EFS only (never QBO fuel line); `INS_TOT` = SF Truck Insurance only. → CPM Definitions
- **Move a $ constant and its denominator together.** `LABOR`↔`TOTAL_HRS`, `ATL_LABOR`↔`ATL_HRS`, costs↔`MILES`. The 7/24 payroll commit moved `LABOR` but not `TOTAL_HRS`, so `HOURLY_RATE` (Per Load CPM quotes) ran 3.4% high for a week. → "Update App.jsx constants"
- **EFS `Total Fuel` is ULSD only** — DEF (`DEFD`) and Fees are excluded. Re-deriving fuel from transaction lines without filtering DEFD overstates by ~4.7%. → "EFS fuel — per-week + parsing gotchas"
- **ATL carve follows DRIVERS, not trucks** (Ben, 2026-07-30) — `ATL_LABOR`/`ATL_FUEL` do; `ATL_MILES` still carves by truck. Known open defect, see "ATL carve basis".
- **Every weekly drop, report ATL charges to Ben unprompted** (driverPay+fuelAmt+contractorPay, agents excluded) + cumulative. → checklist #9

## Tech Stack

- **Frontend:** React 18 + Vite (dev server on port 3000)
- **Charts:** Recharts (BarChart, LineChart, ComposedChart)
- **Data Parsing:** PapaParse (CSV), SheetJS/XLSX (Excel)
- **APIs:** 7 Vercel serverless functions (see below)
- **AI Model:** claude-sonnet-4-20250514 (via api/ai.js proxy)
- **Live Data:** QuickBooks P&L + Balance Sheet, Alvys TMS loads (Samsara mileage retired June 2026 — now manual weekly xlsx drop)
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
| `GET /api/alvys-loads` | GET | Live load pipeline (lanes, revenue, RPM, statuses). **Paginated PER-STATUS** (200/page, each status looped independently, deduped by load id) since Jul 2026 — a single multi-status request paginated unreliably (a <200 page ended the loop early, returned 599 of ~925). Now captures the full pipeline. Returns `reportedTotal` (sum of Alvys per-status Total) as a cross-check. Powers Revenue tab + Per Load CPM. NOTE: no date filter — it's the whole booked pipeline (mostly future-dated Queued), not a calendar window ≠ QBO-invoiced revenue. |
| `GET /api/alvys-ar` | GET | Accounts receivable from Alvys — paginated, statuses Covered/Open/In Transit/Delivered/Invoiced. Returns `rows` (AR = delivered/invoiced/in-transit with balance>0) + `allRows` (full set for the Excel download) + aging/byCustomer/byStatus. Carrier not available from Alvys. |
| `GET /api/distance?origin=X&destination=Y` | GET | Google Maps Distance Matrix proxy — returns driving miles + hours |
| `GET /api/qbo-pnl?company=X&period=Y` | GET | QuickBooks P&L — companies: `ce_sf_combined`, `ce_east`. Periods: `ytd`, `this_week`, `last_week`, `jan`-`dec`, or `start_date`/`end_date`. **Returns `{ company, period, fiq, parsed }` — expenses/cogs/truckTrailer dicts live under `parsed.*`, not top-level. See `parsePnlReport()` in `_qbo-helpers.js` for the bucket-mapping gotchas (nested-section prefix loss, etc.)** |
| `GET /api/qbo-bs?company=X` | GET | QuickBooks Balance Sheet — returns assets, liabilities, equity with account detail |
| `GET/POST/PATCH/DELETE /api/budget-whatifs` | * | Supabase CRUD for Budgeting tab what-if scenarios. POST body `{ label, amount, frequency: 'weekly'\|'monthly' }`. Backed by `freightiq_budget_whatifs` table — returns 503 `table-not-found` until migration is applied |
| `GET /api/cash-flow` | GET | Pulls this week's scheduled payments from the budget-calendar's shared Supabase tables (`w_custom_recurring` + `w_one_time_expenses` + `w_checked_items` + `w_categories`) and shapes them as `{ week, windowStart, windowEnd, payments: [{day, vendor, amount, status, cat}] }`. Used by Cash Flow tab. Replaces the old GitHub raw fetch of `current-week.json`. Bank account balances are NOT tracked in the calendar tables — UI falls back to hardcoded `CASH_SNAPSHOTS` for that side |

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
     - Alvys TMS loads via `/api/alvys-loads` — live load pipeline
     - AP Aging equipment data via EquipmentContext
  2. **Hardcoded constants** (updated from file drops — EFS fuel, payroll, Samsara mileage):
     - `PAYROLL[]`, `FUEL{}` — updated weekly from SF/J&A payroll XLS + EFS PDF
     - `TRUCK_MILES[]` + `MILES` + `FLEET_LOCAL` + `FLEET_REGIONAL` — updated weekly from Samsara Vehicle Mileage xlsx via `scripts/parse_samsara_mileage.py` (Samsara API retired June 2026)
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
| Revenue | `RevenueDashboard()` | **LIVE from `/api/alvys-loads`** (as of Jul 2 2026 — was a static `ALVYS` snapshot). Alvys pipeline by status + top customers; CE/SF split derived from each load's `invoiceAs`. Falls back to static `ALVYS` (yellow warning) if the fetch fails. NOTE: this is booked pipeline across ALL statuses (mostly Queued/Covered) ≠ QBO-invoiced revenue on the Income tab. |
| A/R | `ArDashboard()` | **LIVE** accounts receivable from `/api/alvys-ar` — total AR, by-status KPIs, aging buckets (days since delivery), full detail table + by-customer. **⬇ Download Excel** exports everything except Queued/Released/Completed (SheetJS). Carrier NOT available from Alvys API (flagged). |
| Driver Detail | `DriverDetail()` | Per-driver labor + fuel + combined CPM |
| Trucks & Mileage | `TrucksMileage()` | Per-truck miles + state breakdown from Samsara Vehicle Mileage xlsx (static) |
| Fuel Analysis | `FuelAnalysis()` | Per-driver fuel spend, avg $/gal |
| Trucks | `TrucksTab()` | TEC, Penske, TCI lease details |
| Trailers | `TrailerFleet()` | McKinney, Xtra, Utility trailer fleet |
| Office Staff | `OfficeStaff()` | Office/warehouse/contractor payroll |
| Income | `IncomeDashboard()` | Live QB P&L + weekly/monthly income with YoY comparison |
| CE East | `CEEast()` | Live QBO P&L + Balance Sheet for the CE East entity. Uses a separate QBO token (`ce_east`) in the shared `qbo_tokens` table — when this token expires (401s in the console), re-auth via the CFO Dashboard (see "Re-authorizing QBO" below) |
| ATL Ops | `AtlOperations()` | Atlanta operations launched May 4, 2026. Reads `ATL_WEEKLY_LOG[]` — per-week roster + contribution amounts. NO sticky `entity:"ATL"` tags — designations toggle week-to-week. **Every week ask Ben which drivers + contractors + trucks were ATL FOR THAT WEEK.** Agents (Kevin) are NOT in ATL_WEEKLY_LOG — separate bucket. See `feedback_atl_weekly`, `feedback_atl_no_generalize`, `reference_atl_weekly_log` |
| ATL CPM | `AtlCpm()` | **Dedicated ATL cost-per-mile tab (added 2026-07-19).** ATL labor + fuel ÷ ATL miles (~$2.55/mi) from `ATL_LABOR`/`ATL_FUEL`/`ATL_MILES`/`ATL_TRUCKS` constants. ALL ATL drivers are now carved out of fleet CPM (not just ex-OTR trio); Ben gives the ATL truck#s each week → ATL_MILES = their Samsara miles. Primary ATL view (holds exact YTD). |
| Cash Flow | `CashFlowDashboard()` | Weekly cash snapshot. Bank-balance accounts are hardcoded in `CASH_SNAPSHOTS` (no Supabase table tracks them). Scheduled payments pull live from `/api/cash-flow` which queries the budget-calendar's `w_*` Supabase tables. Subtitle shows "Live from budget calendar (Supabase)" when the fetch succeeds |
| Budgeting | `Budgeting()` | QBO P&L rolled into 19 weekly-budget buckets + Agent bucket + Supabase-backed what-if simulator. See "Budgeting tab" section below for bucket-mapping rules. Agent bucket pulls from `AGENTS[]` (NOT subtracted from owner — Kevin's draws are a separate QBO category) |
| AP Aging | `ApAging()` — src/ApAging.jsx | AP aging dashboard folded in from the standalone app. Invoices/payments/equipment, aging buckets, PDF upload+AI-extract, payment recording, remittances, review-queue + trash. Reads `/api/ap-*`. See "Consolidated dashboards" |
| Budget Calendar | `BudgetCalendar()` — src/BudgetCalendar.jsx | Work bill/expense calendar folded in from budget-calendar (`w_*` tables). Byte-for-byte port — DO NOT touch its persistence. See "Consolidated dashboards" |

## Consolidated dashboards — AP Aging + Budget Calendar tabs (folded in Jul 2026)

Two standalone apps were ported into FreightIQ as tabs. **They live in SEPARATE files** (`src/ApAging.jsx`, `src/BudgetCalendar.jsx`) imported into App.jsx — the one deliberate exception to "everything in App.jsx," because each is a self-contained ~2,000-line sub-app. Both read/write the **same shared Supabase project** as everything else, so their data (AP `invoices`/`payments`/`equipment`; budget `w_*`) needed NO migration. The standalone apps (`ap-aging-v4.vercel.app`, `budget-calendar-lemon.vercel.app`) are now redundant — **retirement deferred** (CFO dashboard still reads the Supabase tables directly; leave tables intact).

### 🧾 AP Aging (`ApAging()` in `src/ApAging.jsx`, tab id `apaging`)
- New Vercel routes: `ap-invoices` (CRUD + soft-delete + review-queue), `ap-payments` (**atomic** via Postgres RPCs `ap_record_payment`/`ap_undo_payment` — row-locked, ±$0.05), `ap-extract` (base64 PDF → Claude **Haiku** + storage; validates `%PDF` magic), `ap-intake` (**Zapier email ingestion — see below**), `ap-equipment` (fleet + invoice-match, **60s cache**, CORS), `ap-pdf` (signed URLs), ~~`ap-sync`~~ (**RETIRED 2026-08-03** — the Gmail auto-extract feeding `fdw_equipment_invoice` is dead and it was never actually on a cron; superseded by `ap-intake`), `ap-payment-suggestions` (Plaid match — dormant until prod Plaid).

#### 📧 `ap-intake` — automated invoice email ingestion (Zapier)

One POST does the whole chain, so the Zap is a single step that either works or
doesn't: fetch/decode PDF → Claude Haiku extraction → dedup → auto-approve
policy → insert.

```
POST https://freightiq-nine-two.vercel.app/api/ap-intake
Header:  x-ap-key: <VITE_APP_PASSWORD>
Body:    { "pdfUrl": "<attachment url>", "filename": "...", "from": "...", "subject": "..." }
         (or "pdfBase64" instead of "pdfUrl")
```

**The Zap:** Gmail *New Attachment* (filter to your AP label / vendor senders) →
*Webhooks by Zapier* → POST, Payload Type **JSON**, with the header above and
`pdfUrl` mapped to the attachment. Optionally add a Filter on `action` to Slack/
email yourself when something is `held` or `rejected`.

**Response `action` is what you branch on:**

| `action` | Meaning |
|---|---|
| `created` | Inserted. Check `needsReview` — `false` = live payable, `true` = held |
| `duplicate` | Already on file; nothing inserted (safe to ignore — Zapier retries land here) |
| `rejected` | Not an invoice / unreadable / not a PDF. `reason` says which |
| `error` | Server-side failure — worth alerting on |

**Auto-approve** reuses the exact rule from the old `ap-sync`, now shared in
`api/_ap-ingest.js`: high model confidence **AND** vendor/invoice#/amount all
present **AND** amount > 0 **AND** the vendor has prior history **AND** the
amount is within 1.5× that vendor's largest prior invoice. Anything else is held
in the review queue. Confidence alone is the model grading its own homework, so
the completeness and amount-vs-history checks carry the real weight.

**Gotchas:**
- There is **no `source` column** on `invoices`. Provenance goes in `description`
  as `[email] … · via Zapier from <sender> (high conf)`, matching ap-sync's
  `[auto] …` convention. Don't add a column without a migration.
- Dedup uses `dedupKey()` (case/punctuation-insensitive), not raw strings — the
  DB's unique index on `(vendor_name, invoice_number)` is the backstop, and a
  unique violation is returned as `duplicate`, not a 500, so Zapier won't retry forever.
- The extraction prompt lives in `api/_ap-extract-core.js` and is shared with
  `ap-extract`. Edit it there once; two copies would let the email path drift
  from the browser upload path.
- **AUTH:** every `/api/ap-*` route requires the app password via `x-ap-key` header (`api/_ap-auth.js` vs `process.env.VITE_APP_PASSWORD`, fails closed). The browser attaches it via a scoped `window.fetch` patch in App.jsx (rewrites only `/api/ap-*` URLs). Gate any new ap-route with `requireApAuth`. (This is abuse-prevention, not bank-grade — password ships in bundle; true fix = Supabase Auth / Vercel protection.)
- **EquipmentContext** (Trucks/Trailers) now fetches internal `/api/ap-equipment` (was `ap-aging-v4`).
- Invoices: **soft-delete** (`deleted_at`; `?trash=1`, PUT `{restore:true}`, `?hard=1` for permanent) + **review queue** (`needs_review`; auto-ingested anomalies held OUT of the payable list, `?review=1`, PUT `{approve:true}`). `ap-sync` auto-approves only high-confidence invoices within 1.5× the vendor's prior max; rejects $0/malformed.
- **Invoice-number dedup is whitespace/case-insensitive** (fixed 2026-07-30). The Gmail parser emitted `"LSVN 10471"` while the PDF prints `"LSVN10471"`; both stored raw, so the unique index on `(vendor_name, invoice_number)` saw two different invoices. Three McKinney invoices duplicated — **$583.26 of phantom open payables** and a live double-pay risk (all `open`, nothing actually paid twice). `api/ap-sync.js` now uses `canonInvoiceNo()` for what it **stores** (whitespace stripped, matching how vendors print) and `dedupKey()` for what it **compares** (also upper-cased, punctuation-stripped). Same bug class as `c69f5c1` (vendor names), different field. **Any new invoice-matching code must normalize both sides** — raw string equality on invoice numbers is a known trap here.

#### ⚠️ Equipment invoices are MANUAL now — Gmail auto-extract is DEAD (2026-07-20)
Ben killed equipment email ingestion — the AI extraction was untrustworthy (TEC `amount=null` quarantines, dropped units, invoices not pulled/miscategorized). **DO NOT reintroduce Gmail auto-extraction.** `fdw-extract` skips `truck_*`/`trailer_*` staging rows; the **`ap-sync` cron was removed** from `vercel.json` (code kept, unscheduled). EFS fuel ingest stays on.
- **Workflow now:** Ben downloads the exact invoice → Claude parses it **deterministically** (`python scripts/ingest_invoices.py <files>` = pdfplumber+regex, NO AI) → dedup on vendor+invoice# (+amount/date) → insert into `invoices` (→ AP Aging + Asset registry) → `node scripts/build_assets.mjs --write`. Files land in **`OneDrive\Desktop\Freight\freightiq\incoming-freightiq\`** or **Downloads** (his Desktop is OneDrive-synced — NOT the plain-Desktop repo path).
- **AP Aging self-serve form** (`ApAging.jsx`): drop a PDF → deterministic **pdf.js + regex** (mirrors ingest_invoices.py, `ap-extract` AI no longer used) pre-fills vendor/inv#/dates/amount/**units**/VINs → review/edit → save (`ap-invoices` POST persists `unit_ids`/`vin_ids`, dedup 409). NOTE: `extractTextFromPdf` **sorts pdf.js items by (y,x) + line-breaks on y-change** — pdf.js emits table cells out of order, so the unit parser needs this.
- **Flag any equipment invoice that parses to 0 units → OPEN the PDF** (a non-trivial-amount invoice with 0 units is a parser miss, never assume empty — bit us 3×: 7582-address-as-unit, McKinney VIN-on-next-line, Penske lease-detail).
- **Trust = completeness reconciliation** (per-vendor ingested total vs vendor statement / QB AP), NOT a better extractor. See `reference_manual_invoice_ingestion` memory.

### 📅 Budget Calendar (`BudgetCalendar()` in `src/BudgetCalendar.jsx`, tab id `calendar`)
- **SAFETY-CRITICAL, byte-for-byte port** of `budget-calendar/src/App.jsx` (verified via `diff`). Budgeting source of truth with a strict anti-data-loss model (diff-based saves, sync-refs, `isLoaded`/`loadError` gating). **NEVER touch the save/load/sync logic — UI only.** It had a data-wipe bug once; that model prevents recurrence.
- Uses a **browser anon Supabase client** — needs `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in Vercel (guarded: null client → config-error stop, not a crash). Writes directly to `w_*`. Light-theme Tailwind (Ben waived dark).
- **Imports only `useState, useRef`** — use `React.useEffect` (not bare) for new effects.
- It is NOT the same as the **Budgeting** tab (`Budgeting()`): Budget Calendar = operational bill/expense calendar (`w_*`); Budgeting = QBO P&L → weekly run-rate buckets + what-if. Both stay.

### Integration gotchas
- **dataVersion remount:** the app tree is keyed by `dataVersion` for live-data refresh, but `apaging`/`calendar` render OUTSIDE that key (`(tab==='apaging'||tab==='calendar') ? page() : <div key={dataVersion}>…`). **Never re-key these two** — a remount mid-edit drops unsaved budget changes.
- **Width:** both use `.main-wide` (`max-width:none`, full screen) — the fleet/CPM tabs stay 1400px.
- **New build deps:** `tailwindcss`+`postcss`+`autoprefixer` (scoped to `.budget-root`, **preflight OFF**, `src/budget-tailwind.css` imported in main.jsx), `lucide-react`, `pdfjs-dist@4.4.168` (bundled, worker via `?url`). `tailwind.config.js`/`postcss.config.js` only touch the one budget CSS file — FreightIQ's inline-JS styles are unaffected.

### Direct SQL: `scripts/dbrun.mjs`
Run SQL against the warehouse via the **IPv4 session pooler** (`aws-1-us-east-2.pooler.supabase.com:5432`, user `postgres.bhdaiddrfeqtwjlsfifx`) — the direct host `db.<ref>.supabase.co` is IPv6-only and unreachable from tooling. `node scripts/dbrun.mjs <file.sql | -c "SQL">` with `PGHOST/PGUSER/PGPASSWORD/PGDATABASE` env (no secrets in repo; DB password in Supabase → Settings → Database). `npm install pg --no-save` (pruned by other npm installs — reinstall as needed). The read-only `mcp__postgres__query` MCP has a stale password after the 2026-07-13 reset.

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

### ATL Operations — per-week roster data layer (`ATL_WEEKLY_LOG`)

ATL Operations (Atlanta, launched May 4, 2026) is tracked via a **per-week roster array** (`ATL_WEEKLY_LOG[]`), not sticky entity tags. ATL designations toggle week-to-week — a driver or contractor can be ATL one week and not the next.

**Schema** (one entry per week):
```js
{
  weekStart: "2026-05-18",
  weekEnd:   "2026-05-24",
  drivers:   ["Davis Anthoni D", "Wainwright Michael W", ...],   // names from PAYROLL[]
  contractors: [
    { name: "ENM Trucking LLC", entity: "ENM Trucking LLC (Biniyam Fissehaye 1099 phase)", total: 1850 },
  ],
  driverPay:     11168.86,   // sum of weekly delta in PAYROLL YTD for listed drivers (exact for the latest week; best-effort historical)
  driverHours:   350.00,
  fuelAmt:       8591.14,    // sum of weekly delta in FUEL YTD for listed drivers
  fuelGallons:   1548.71,
  contractorPay: 1850,
  note: "Current week — exact deltas from weekly drop.",
}
```

**`atlSum()` helper** rolls all weeks into cumulative `{ driverPay, driverHours, fuelAmt, fuelGallons, contractorPay, weeks, total }`. `AtlOperations()` reads from this for headline KPIs and renders a per-week breakdown table.

**Rules:**
- There are NO sticky `entity: "ATL"` tags on PAYROLL/FUEL/CONTRACTORS/OFFICE_W2 anymore. Don't add them.
- Each week's roster is INDEPENDENT — never propagate a roster change to adjacent weeks. See `feedback_atl_no_generalize` memory.
- The latest week's `driverPay/driverHours/fuelAmt/fuelGallons` are computed exactly from `(thisWeek_YTD − lastWeek_YTD)` per driver. Historical weeks are best-effort allocations (7/13, 6/13 day splits, etc.) — flag in the `note` field.
- **Agents (Kevin / Nixon Graye) are NOT in ATL_WEEKLY_LOG.** Agent is a completely separate bucket — see `AGENTS[]` constant + Budgeting tab agent bucket. Do not nest agents under ATL or any other operating entity.

**Adding a new ATL week each weekly drop:**
1. ASK Ben for the THIS-WEEK roster (drivers + contractors). Each role is per-week, not inherited.
2. Compute `driverPay/driverHours/fuelAmt/fuelGallons` deltas from the PAYROLL/FUEL YTDs (this week vs prior).
3. Append a new entry to `ATL_WEEKLY_LOG[]` at the bottom.
4. AtlOperations() picks it up automatically — cumulative KPIs and the per-week table.

**Agents** — completely separate from ATL or any operating entity. Live only in:
- `AGENTS[]` top-level array (parallel to PAYROLL/CONTRACTORS, not nested)
- Budgeting tab's standalone 🤝 agent bucket
Agent payments are a separate draw category in QBO — **NOT inside `Total for Owners Draw`**. Do NOT subtract agent total from the owner bucket. See `reference_agent_draw_category` memory.

**An agent can be 1099 OR W-2 — the payment method doesn't change the bucket.**
As of Aug 2026 there are two:
- **Kevin Deveraux** / Nixon Graye Associates — $500/wk, booked as a QB Contractor
  Payment. **$6,000 / 12 payments thru Aug 2** (was stale at $2,500 / 5 for ~8 weeks).
- **Ethan Smith** — $1,538.46/wk gross ($80K/yr) on **J&A W-2 payroll**, first check
  07/31/2026. `total` carries loaded cost ($1,710.76 = gross + $172.30 employer tax).

**A W-2 agent MUST be excluded from `OFFICE_W2`/the paycheck grid** or Budgeting
counts them twice. Enforced by `W2_AGENTS` in `scripts/build_paycheck_grid.py`
(keyed `('smith','e')` — add new W-2 agents there). Kevin is excluded on the 1099
side via `canon()`. `gen_office.py` needs no change: it only updates people already
in `OFFICE_W2[]` and never adds new ones.

Card-47458 footnote: previously misattributed to Wright Robert (frozen) — reassigned to Tucker Robert in the May 16 update. Wright stays frozen at $2,170.77 (his card 37405 portion only).

### ATL fully carved out of fleet CPM (2026-07-19; OTR dropped completely)

OTR is gone (`OtrOperations()`/`OTR_WEEKLY_LOG`/`otrSum()` removed). As of the 7/19 drop, **ALL ATL drivers are carved out of fleet CPM**, not just the ex-OTR trio. The carve set = that week's ATL roster (Ben gives it — 7/19 was 9: Baker/Dawson/Pacitti/Griffin/Johnson/Logan/Phillips/Tucker/Wainwright). `LABOR`/`FUEL_TOT`/`GALLONS`/`TOTAL_HRS`/`MILES` all EXCLUDE the ATL drivers + their 7 ATL trucks; the carve reconciles **exactly** (Fleet+ATL fuel == EFS total; Fleet+ATL miles == Samsara total). ATL gets its own `ATL_LABOR`/`ATL_FUEL`/`ATL_MILES`/etc. constants + the **🍑 ATL CPM tab** (~$2.55/mi). Each weekly drop, update the ATL roster in TWO places: `SF_ATL` in `parse_weekly_drop.py` + `OTR_LN` (last names) in `build_paycheck_grid.py`, then re-run. The `build_paycheck_grid.py` regex for the carve-out amount matches `ATL drivers \([^)]*\) \$...` in the LABOR comment.

**`DRIVER_WEEKLY`** (emitted by `build_paycheck_grid.py`) holds fleet + ex-OTR loaded cost per pay week (calibrated so YTD reconciles to LABOR + the carve-out); consumed by the **"This Week — All-In Payroll" card** + the **Fund Payroll panel** (Cash Flow tab). Drivers are excluded from the paycheck grid itself; `DRIVER_WEEKLY` adds them back for those.

**`metrics.json drivers:N` regression (bit us Jun 29):** `extract-metrics.js` regex is `(\d+)\s*drivers` — the FIRST match wins. Keep the digit adjacent to "drivers" in the LABOR comment (e.g. "42 drivers active", NOT "42 active"), or it grabs a later "3 drivers" comment and metrics shows `drivers:3`. Verify `metrics.json` drivers count after every weekly build.

### Weekly office/payroll gotcha — QB payroll file row layout SHIFTS

The QB PayrollSummaryByEmployee `.xls` row order is NOT stable — the SF file gained 3 rows on the Jun 29 drop (Gross/taxes/contrib/totalCost moved from rows 14/46/52/54 to 15/49/55/57), which silently zeroed the SF office rows. **Extract office/warehouse figures by ROW LABEL** ("Gross pay - total", "Employer taxes - total", "Company contributions - total", "Total payroll cost"), never hardcoded row indices. (Employee columns are stable; only line-item rows shift.)

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

If you're adding a new live data source that needs to drive CPM or other derived displays, follow this pattern instead of trying to wire prop drilling or context — the existing remount key already does the work.

(Historical: the Samsara live-fetch pattern + `fiq_fleet_miles_v1`/`v2` localStorage cache was retired in June 2026 when the API was killed; the App-mount cleanup-only effect still clears those stale keys for returning visitors.)

## Key Data Constants (hardcoded in App.jsx)

- `PAYROLL[]` — 54 drivers logged / **28 active** as of Aug 2 2026 (Memolo Dominick still 0; ~26 *inactive/frozen drivers keep YTDs so LABOR reconciles to QBO). **The LABOR comment's "N drivers active" digit MUST equal `ACTIVE_DRIVERS_COUNT`** — `extract-metrics.js` publishes it as `metrics.json drivers:N`, which CFO Dashboard and Per Load CPM consume. It read **53 while the UI showed 27** until Aug 3 2026; verify they match every drop. Keep the digit adjacent to the word ("28 drivers active", not "28 active") or the regex `(\d+)\s*drivers` falls back to 0.
  - **Check for stale `active:false` every week.** Diff each driver's `totalCost` against last week: any driver flagged inactive whose YTD *moved* was paid, so the flag is wrong (caught Dixon Deon A this way on Aug 3 — +$1,069.07 while flagged frozen). Conversely a flagged-active driver with no movement for several weeks is worth asking Ben about.
- `FUEL{}` — per-driver fuel spend + gallons (EFS only, thru Jun 12)
- `MONTHLY_MILES[]` — Samsara: per-month, per-truck local vs regional (currently Jan-Mar 2026 historical; no longer auto-refreshed — Samsara monthly XLS not provided in weekly drops)
- `TRUCK_MILES[]` — per-truck per-state mileage from Samsara Vehicle Mileage xlsx. Run `python scripts/parse_samsara_mileage.py` after dropping a new xlsx to regenerate
- `MILES`, `FLEET_LOCAL`, `FLEET_REGIONAL`, `TRUCK_COUNT` — fleet totals from the same Samsara Vehicle Mileage xlsx. Static now — no live API. Update via the parser script each week
- `TCI_LEASING{}`, `PENSKE{}`, `TEC_EQUIPMENT{}` — truck lease data
- `TRAILERS_INV{}`, `XTRA_LEASE{}` — trailer inventory/leases
- `INCOME_2026`, `INCOME_2025` — weekly/monthly revenue + margins
- `CE_EAST{}` — CE East subsidiary financials
- `MONTHLY_REVENUE[]` — 2025-2026 by company (CE/SF/DI)
- `DETAIL{}` — transaction breakdowns (labor, fuel, insurance, trucks, trailers, maintenance)
- `ASCEND{}` — Historical Ascend TMS data (Jan-Mar 2026, no longer active)
- `ALVYS{}` — Alvys TMS pipeline snapshot — now only a **fallback** for the Revenue tab (which is live via `/api/alvys-loads`); refresh only if you want an accurate offline fallback

**Current period:** driven by `PERIOD` in `src/App.jsx` — as of the Aug-3 drop, `Jan 1 - Aug 2, 2026` (214 days). Don't hand-maintain a copy here; read the constant.

### ⚠️ `/api/fdw-metrics` — the warehouse OVERRIDES your weekly constants

**Read this before wondering why a weekly update didn't show up on the site.**

On mount, App.jsx fetches `/api/fdw-metrics` and **mutates the module-level
fleet constants** (`LABOR`, `FUEL_TOT`, `GALLONS`, `MILES`, `INS_TOT`,
`TRUCK_TOT`, `TRAILER_TOT`, `TRUCK_MAINT`, `TRAIL_MAINT`, `STORAGE`,
`UNIFORMS`, `TRUCK_COUNT`, `TOTAL_HRS`, plus `PAYROLL`/`FUEL`/`INCOME_2026`)
from the `fdw_*` Supabase warehouse, then `recomputeDerived()` + remount. A green
`⚡ warehouse` badge in the header means warehouse numbers are showing, NOT yours.

**This bit hard on 2026-08-03.** The warehouse served `period: "Jan 1 - Jul 12"`
while `PERIOD` said Aug 2, so the header rendered an Aug-2 label over three-week-old
numbers — and `metrics.json` (built from the constants, consumed by CFO Dashboard
and Per Load CPM) silently disagreed with what the dashboard displayed. Worse, the
warehouse figures were **uncarved**: fuel $779,422.34 exceeded the entire EFS report
($771,909.82) and miles 974,844.04 exceeded all 54 Samsara trucks (965,151.70) —
only possible if the ATL carve never ran upstream. Fleet CPM read **$0.303/mi low
on Basic and $0.357/mi low on All-In**, on the number Per Load CPM prices against.

**The guard (in the `fetch("/api/fdw-metrics")` effect) refuses hydration when:**
1. `d.period.end < PERIOD_END_ISO` — stale
2. `f.miles > MILES + ATL_MILES` or `f.fuel_tot > FUEL_TOT + ATL_FUEL` — the ATL
   carve is missing upstream (fleet+ATL is by definition the whole report)

On refusal the hand-updated constants stand and the header shows an amber
**`⚠ warehouse stale/uncarved · using weekly constants`** badge. **Fix the
ingestion — never loosen the guard to make the badge go away.**

**Open:** the warehouse ingestion still needs the ATL carve applied and its
rollup period is pinned at Jul 12 (the collector heartbeat is fine — QBO and
Samsara sync on cron; EFS/payroll reach it by some path that stopped). Until
that's fixed the badge stays amber, which is correct — it's telling the truth.

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
- **Serverless:** `api/ai.js`, `api/alvys-loads.js`, `api/alvys-ar.js`, `api/distance.js`, `api/qbo-pnl.js`, `api/qbo-bs.js` auto-deployed

## Weekly Update Workflow

> Before starting a weekly, re-read the **⚡ Critical invariants** block at the top — it's the condensed version of the traps in this workflow. End with the **"Before declaring weekly update DONE"** checklist below.

### ✅ EBITDA tile — SHIPPED 2026-08-03
`EbitdaTile` in `src/App.jsx`, on the Income tab's Live QB view. Live off
`/api/qbo-pnl` — no weekly constant. Aug-2 YTD: EBITDA $620,144 (4.2% of
revenue), Adjusted $1,231,158 (8.2%).

Decisions made (all stated on the tile itself, not buried):
- **D&A = $0** — fleet is 100% leased, so cost runs through Truck/Trailer
  Rentals as opex. Verified: no depreciation or amortization line exists on the P&L.
- **Income tax = $0** — pass-through entity. `Payroll Taxes` ($490,607.94) is an
  operating cost, NOT an income tax, and is **not** added back. `Personal Tax
  Expense` sits inside Owners Draw.
- **Add-backs** = `EBITDA_ADDBACKS` const: Owners Draw + Asset Loan Payments
  (personal vehicles). Edit that array to change the list.

**Gotcha:** Owners Draw is an *Other* expense so it never appears in
`parsed.expenses`. It's derived as `totalOtherIncome + netOpIncome − netIncome`
(= 549,491.24, ties to the P&L exactly). Interest income isn't broken out by the
parser (it sits inside Other Income with the Triumph withholding refunds) — $185
YTD, treated as $0 and disclosed on the tile.

### Step 0 — ASK Ben for the ATL + Agent rosters (do this FIRST, before any code changes)

ATL and Agent are fluid week-to-week. The QBO P&L files and payroll exports don't carry the entity label, so you can't infer it from data alone — Ben is the source of truth. Three questions, every weekly drop:

1. **ATL Drivers** — which W2 drivers were ATL this week? Any joins / leaves / transfers back to CE-SF?
2. **ATL Contractors** — which contractor payments were ATL this week? (Default-tagged ATL: Mellody, ENM Trucking)
3. **Agent payments** — which agents got paid this week? Any new agents? Same $/wk? (Default: Kevin Deveraux / Nixon Graye $500/wk)
4. **ALL contractor payments** — full `CONTRACTORS[]` weekly amounts (Jon Marcus, Mellody, Gabriel Colon, Hilda, Maria Con, Logic, ENM, Delgado, Simpson, Debra…). These only come from chat — get them up front so the office/contractor half doesn't get skipped.

**ATL is strictly per-week** — don't generalize one week's roster to adjacent weeks. Each `ATL_WEEKLY_LOG[]` entry is independent. If Ben says "X was ATL for week Y", apply only to week Y. See `feedback_atl_no_generalize`.

For the per-week driver/fuel deltas in the new entry, subtract the PAYROLL/FUEL YTDs from the prior week's snapshot for the named drivers — that gives exact this-week contribution. Historical weeks can stay as best-effort allocations.

### Automated (live feeds — no file drops needed):
- **CE & SF Combined P&L** — live from QuickBooks via `/api/qbo-pnl` (Income tab → Live QB)
- **CE East P&L + Balance Sheet** — live from QuickBooks (CE East tab → Live QB + Owner Payback)
- **Alvys TMS loads** — live via `/api/alvys-loads` (Revenue tab)
- **AP Aging equipment** — live via `https://ap-aging-v4.vercel.app/api/equipment` (Trucks + Trailers tabs). Cross-origin fetch — relies on global CORS in `ap-aging/next.config.js`. If Trucks/Trailers go blank, check the red error banner in the tab footer and the AP Aging deploy status.

### Manual file drops (into `Desktop/Freight/freightiq/incoming-freightiq/`):
1. **EFS Transaction Report PDF** — per-driver fuel (no API available).
   **CRITICAL: Download the PDF directly from the EFS portal — never "Print to PDF" via Windows.** Print-to-PDF produces a raster/image-only file with no text layer; pdfplumber returns 0 chars across all pages and the parser silently outputs `$0.00`. Producer field will say "Microsoft: Print To PDF" — that's the giveaway. Real EFS exports are ~150 KB; print-to-PDF balloons to ~10 MB.
2. **SF Payroll Summary** (QuickBooks XLS) — driver + office payroll.
3. **J&A Management Payroll Summary** (QuickBooks XLS) — J&A office staff. **Always update each week — same cadence as SF.**
4. **CE & SF Transaction Report** (QuickBooks `.xlsx` **or `.csv`**) — line-item detail for category totals (Fuel, Insurance, Truck/Trailer Rentals, Storage, Maintenance, Uniforms).
   - **QB switched these exports .xlsx → .csv on the Aug 3 2026 drop.** `parse_weekly_drop.py` now accepts both (`_sheet_rows()` + `_csv_num()`). Before the fix a `.csv` matched no pattern, `cesf_path` came back `None`, and **every category total silently vanished from `_summary.txt`** with no error.
   - Three P&L files arrive with near-identical names. Identify by their header row, and rename on drop so future runs aren't ambiguous: single `Total` column = **YTD**, `Jan 1-4 / Jan 5-11 …` = **WEEKLY**, `Jan 2026 … Aug 1-3 2026` = **MONTHLY**.
5. **CE & SF Profit and Loss — Weekly** (QuickBooks XLSX with column headers like `Apr 27 - May 3 2026`) — feeds `INCOME_2026.weeks[]`.
6. **CE & SF Profit and Loss — Monthly** (QuickBooks XLSX with column headers like `Jan 2026`, `Feb 2026`, … `May 1-3 2026`) — feeds `INCOME_2026.months[]` and `MONTHLY_REVENUE`.
7. **Samsara Vehicle Mileage** (XLSX, e.g. `Vehicle Mileage - Jan 1, 12 AM - May 30, 11_59 PM.xlsx`) — per-truck per-state mileage. Columns: `Vehicle | Jurisdiction | Distance (mi) | Toll Distance (mi)`. Run `python scripts/parse_samsara_mileage.py` to regenerate `MILES` + `TRUCK_COUNT` + `FLEET_LOCAL` + `FLEET_REGIONAL` + `TRUCK_MILES[]`. Samsara API retired June 2026 — this xlsx is now the only mileage source.
   - **The parser does NOT emit `active:false` flags — you must re-apply them.** `activeFleetCount` (displayed "N in service") = `TRUCK_MILES.filter(t => t.active !== false).length`, so blindly pasting the parser block inflates it. Preserve the prior inactive-truck set, and default any NEW truck numbers the report introduces to `active:false` (so the count stays at Ben's hardcoded `TRUCK_COUNT`) — then flag them for Ben to classify. Watch for malformed/garbage vehicle ids (e.g. `590114` on the Jun-18 drop, likely a typo'd Samsara vehicle name) — flag, don't silently fold into the fleet.
8. **Atlanta Billing** (`.csv` or `.xlsx`, e.g. `ATLANTA 2026 - ALL LOADS THRU <M.D>.csv`) — Atlanta load-level revenue. Run `python scripts/parse_atl_billing.py` to regenerate the `ATL_BILLING` constant block in `src/App.jsx`. Per Ben every load in the sheet counts as ATL revenue regardless of `Assigned` / `OFFICE` column values (which only reflect QBO booking routing).
   - **FIXED 2026-08-03 — the parser now runs WITHOUT a Driver column** (per Ben: "doesn't matter, run without"). `driver` is optional; totals compute and `byDriver` comes back empty. It also accepts `.csv` (the export moved off `.xlsx` on the Aug 3 drop) and reads the as-of date from the filename when there's no sheet name. `ATL_BILLING.byDriver` is now `[]` — the May 4-29 rows that used to sit there were four months stale and read as current; the ATL Ops per-driver table renders an explanatory note instead of an empty grid. If the Driver column ever returns, re-running the parser repopulates it automatically.
   - **`_num()` matters:** CSV money cells arrive as strings (`" $ 6,800.00 "`, `"(150.00)"`). The old `isinstance(v,(int,float))` checks scored those as **0** and would have silently understated revenue.
   - **EXCLUDE spreadsheet subtotal rows.** The "ALL LOADS THRU <date>" tab has SUM rows mixed into the data (no Delivery Date / Load # / Customer, just a big Invoice Amount). On the Jun 16 drop two such rows (110/112) inflated revenue by $450K — one of them ($198,867.64) was literally the loads total. When computing manually, skip any row where Delivery Date AND Load # AND Customer are all blank. Real Jun-16 figure: 87 loads, $198,868, 70.7% margin.
   - **Blank Carrier Amount = SF self-haul, NOT pending reconciliation.** Many loads land with a blank Carrier Amount (54 of 76 on the Jun 12 drop) because SF hauled them on its own trucks — SF is the carrier, so there's no external carrier cost to deduct. Those loads are full income; SF's cost for them lives in the fleet buckets (LABOR/FUEL), not ATL carrier pay. So the ~70% ATL margin is REAL, not inflated. (Per Ben, Jun 15 — do not describe blank-carrier loads as "carrier-pending".)
9. **Contractor payment detail** — usually given in chat (e.g. "$2,800 Jon Marcus, $2,150 Mellody, …"). Mention any car payments, commission, or one-offs explicitly.

### Weekly parse — one command
```bash
python scripts/parse_weekly_drop.py
```
Reads everything in `incoming-freightiq/`, writes:
- `_summary.txt` — driver labor (office pre-excluded), EFS per-card totals, CE&SF P&L category totals.
- `_parse_output.txt` — raw row-by-row dumps of every file (read this when you need office/contractor detail).
- `_office_extract.json` / `_pnl_extract.json` — cached structured extracts (skip re-parsing across iterations).

If P&L files are present, parse them separately for `INCOME_2026` updates (the main parser doesn't write a summary section for them yet — read straight from the .xlsx using openpyxl).

### Weekly array generators — DON'T hand-edit the big arrays (added 2026-07-19)
`PAYROLL[]` (54 rows), `FUEL{}` (~50 rows), `TRUCK_MILES[]` (~50 rows), `OFFICE_W2[]`/`WAREHOUSE[]` are now REGENERATED by scripts, each with a reconciliation check. Hand-editing them ships errors. After updating `SF_ATL`/`OTR_LN` to this week's ATL roster + running `parse_weekly_drop.py`, run:
```bash
python scripts/gen_office.py          # OFFICE_W2 + WAREHOUSE (run FIRST — grid uses its factors)
python scripts/build_paycheck_grid.py # OFFICE_PAYCHECKS + DRIVER_WEEKLY
python scripts/check_contractors.py   # ← MANDATORY GUARD. Must pass before commit.
python scripts/gen_weekly_arrays.py   # writes _gen_payroll.txt + _gen_fuel.txt → splice into App.jsx
python scripts/gen_truck_miles.py     # TRUCK_MILES (flags departed + 7 ATL trucks)
```

**`check_contractors.py` is not optional.** It catches the two ways contractor
data goes missing silently, both of which ran undetected for four months in 2026:

1. **Payee went silent** — someone being paid drops to zero mid-range. Debra
   Adamson, Elizabeth Delgado and Christopher Simpson came off W-2 in Feb/Mar
   2026 and their Apr/May 1099 payments were never recorded. Nothing flagged it;
   `CONTRACTORS[]` just quietly ran 16% under QBO until Aug 3.
2. **Monthly drift vs QBO** — grid 1099 cash vs the `Contractor Payroll` P&L line
   per month, 2% tolerance. A YTD total hides *which* month broke; per-month
   points straight at it.

It exits non-zero on a finding. Do NOT commit a weekly with it failing — either
add the missing weeks to `MANUAL_CONTRACTORS` and re-run `build_paycheck_grid.py`,
or, if the variance is genuinely explained, say so explicitly in the commit
message. Never silence it by widening `DRIFT_PCT`.

**Weekly drop files are archived to `Desktop/Freight/_freightiq-drop-archive/<week>/`
before `incoming-freightiq/` is cleared.** The payroll XLS is untracked and
otherwise unrecoverable. Keep the frozen historical base in `incoming-freightiq/`
(ContractorPayments + Chase VendorEmployeePayments + latest PaycheckHistory) —
the scripts re-read those every run.
Then splice `_gen_payroll.txt`/`_gen_fuel.txt` in (regex-replace `let PAYROLL = [...]` / `let FUEL = {...}`).

**Two generator traps fixed 2026-08-03 — don't reintroduce them:**
- `build_paycheck_grid.py` `_carlbl()` returned a date string **raw**. Grid columns
  are **PAY DAY** labels (`7/10, 7/17, 7/24, 7/31`), so a spec of `'7/30'` landed
  under a column that doesn't exist and the amount **silently vanished** (this ate
  Jon Marcus's $350 July car). It now maps dates through `wk_of()` and **raises**
  rather than dropping. Car/reimb specs may be a payday label or a real date.
- `gen_weekly_arrays.py` copied the `FUEL{}` **header comment verbatim** from the
  previous block, so every weekly shipped a header quoting last week's dollars
  above this week's rows. It's now derived from live values. Note the rows-sum vs
  `FUEL_TOT` gap ≠ the unmapped-card total, because frozen drivers carry fixed
  historical values — the emitted comment says so explicitly.
- **The grid ACCUMULATES and never overwrites prior weeks** (`merge-guard: N -> M
  cells`). A bad run therefore *persists*: my first `'7/30'` attempt left a phantom
  `car` cell that inflated Jon's YTD to $2,800 even after fixing the spec. If a
  wrong cell lands, strip it from `OFFICE_PAYCHECKS` in `src/App.jsx` and subtract
  it from that row's `total` — re-running alone will not clear it. See `reference_weekly_generators` memory for the reconciliation checks (PAYROLL sum == LABOR; Fleet+ATL fuel == EFS total; Fleet+ATL miles == Samsara total). Still hand-updated each week: the fleet CONSTANTS (LABOR/FUEL_TOT/GALLONS/MILES/INS/TRUCK/TRAILER/etc. + ATL_* constants), `PERIOD`, `INCOME_2026`, `ATL_BILLING`, `ATL_WEEKLY_LOG` entry.

### Update App.jsx constants

**Source-of-truth principle: PERIOD is the only date-related string you need to update.** The rest derives. As of May 2026, anything below labelled "auto-derived" no longer needs a manual edit each week — touching it is a regression risk.

Touch these (real data each week):
- `PERIOD` ← new week-ending date string (e.g. `"Jan 1 - May 9, 2026"`). Drives `PERIOD_DAYS`, header subtitle, Insurance day-count, P&L "2026 YTD (Nd)" column header. Update once.
- `LABOR` / `TOTAL_HRS` ← SF drivers-only from `_summary.txt`
- `FUEL_TOT` / `GALLONS` ← EFS total from `_summary.txt`
- `INS_TOT` / `TRUCK_TOT` / `TRAILER_TOT` / `STORAGE` / `TRUCK_MAINT` / `TRAIL_MAINT` / `UNIFORMS` ← CE&SF category totals
- `MILES`, `FLEET_LOCAL`, `FLEET_REGIONAL`, `TRUCK_COUNT`, `TRUCK_MILES[]` ← regenerate by running `python scripts/parse_samsara_mileage.py` after dropping the Samsara Vehicle Mileage xlsx into `incoming-freightiq/`. Paste the emitted block into the SAMSARA MILEAGE DATA section of App.jsx
- `PAYROLL[]` ← paste per-driver rows from `_summary.txt`
- `FUEL{}` ← match EFS cards to drivers; handle splits for shared cards
- **`OFFICE_W2[]` + `WAREHOUSE[]`** ← per-person gross/taxes/contrib/totalCost from the **SF + J&A payroll XLS** (xlrd rows: "Gross pay - total", "Employer taxes - total", "Company contributions - total", "Total payroll cost"; salary = gross − bonus − reimb − commission). Names are "Last First" in the XLS vs "First Last" in App.jsx — map them. *Former/frozen staff come back UNCHANGED — that's the tell they're inactive, not a parse miss. **This half is easy to forget — it's NOT optional.**
- **`CONTRACTORS[]`** ← per-contractor weekly amounts given by Ben **in chat** (no file carries them). Each entry: payments+1, weeklyTotal += weekly, bump commission/health/car where applicable, recompute `total` (= weeklyTotal + carTotal + commission + healthInsTotal + other). Ask for these as part of Step 0, alongside the ATL/Agent roster. **Run `scripts/check_contractors.py` after — it reconciles vs the QBO "Contractor Payroll" line per month and catches payees who go silent.**
  - **KNOWN OPEN VARIANCE (as of Aug 2026): −$72,793.28 / −16.0% vs QBO.** Root-caused, not mysterious: **Debra Adamson, Elizabeth Delgado and Christopher Simpson show ZERO in both April and May** — no W-2 and no 1099. They came off W-2 in Feb/Mar and their Apr/May 1099 payments were never recorded. The Chase `VendorEmployeePayments` export only covers the **"Capacity Express 1" account (8 payees)**; these three were paid from another account. Monthly gaps: Jan 336 · Feb 335 · **Mar 8,943 · Apr 16,749 · May 22,968 · Jun 18,602** · Jul 4,860. Fissehaye is clean (W-2 thru May, 1099 from Jun).
  - **To close it:** a Chase `VendorEmployeePayments` export for the **J&A account, Mar–Jun**, or a full-year QB `ContractorPayments` export. Do NOT back-fill at assumed weekly rates — at their known rates the three explain only ~$13.9K of April's $16.7K and ~$17.4K of May's $23.0K, so roughly $8K/month is something else, and guessing would write wrong per-week cells into the Office Staff grid.
  - `CONTRACTORS[]` has **13 entries** since Aug 2026 — Erika Valencio, Kacy Richardson and Mairena Tapias were being paid but weren't tracked. Mairena's row holds **two people**: entries thru 06/30 are **Nelly** (predecessor), 07/02 forward are Mairena at $478/wk. Label kept merged per Ben. Her payments are a hand-maintained dated list in `build_paycheck_grid.py` — **append her wires every week** (five July wires were missing until Aug 3).
- **`OFFICE_PAYCHECKS`** (Office Staff → Weekly Checks grid + the Weekly Cost Trend chart, which now derives from this same data) ← regenerated each week by `scripts/build_paycheck_grid.py`. See the "Office Staff Weekly Checks grid" section below for the full procedure.
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

**Build will fail silently on the `drivers: 0` (or wrong-number) regression.** The `extract-metrics.js` regex is `/(\d+)\s*drivers/i` — it matches the FIRST `<digit>+ space + drivers` pattern in App.jsx. Two failure modes:

1. **LABOR comment phrasing**: "41 active drivers" breaks the regex. Use "41 drivers active" or "— 41 drivers (…)" so the digit sits adjacent to the word.
2. **Phrase shadowing elsewhere**: any earlier `<digit>+ drivers` in the file overrides the LABOR comment. Watch for comments like "// to W2 drivers" — the `2` gets matched as the count. Fix by rewording (e.g. "fleet drivers") so no spurious `\d+ drivers` appears before the LABOR comment. Caught May 25 2026 (`drivers: 2` regression).

**Display-vs-record distinction:** "active drivers" displayed on the dashboard ≠ `PAYROLL.length`. PAYROLL[] contains BOTH active and frozen (`active: false`) drivers — frozen YTDs still contribute to LABOR/TOTAL_HRS (so the QBO total reconciles) but don't count toward count displays. The derived const `ACTIVE_DRIVERS_COUNT = PAYROLL.filter(p => p.active !== false).length` is what the Fleet Overview subtitle, Labor card subtitle, and Revenue-per-driver tile use. When the active driver count changes:
- Add/remove `active: false` field on the relevant PAYROLL entries
- Update the `LABOR` comment's "N drivers active" digit (drives `metrics.json drivers:N` via the regex)

Build verifies + regenerates `public/metrics.json` and `public/payroll-summary.json` which feed CFO Dashboard + Per Load CPM. Commit + push → Vercel auto-deploys (~2 min). Clear `incoming-freightiq/` after **all** consumers (CFO Dashboard, Per Load CPM) confirmed pulling new metrics.

### Office Staff Weekly Checks grid (`OFFICE_PAYCHECKS`) — weekly refresh

The Office Staff tab has a **Weekly Checks** sub-tab: a per-employee × per-week grid of payroll cost, grouped by **company** (CE / SF / CE East / J&A), with a big per-week grand total in the header. The **Weekly Cost Trend** chart on the same tab derives from this same data. Refresh it every weekly drop:

1. **Each week, Ben drops only the W-2 paycheck history** (`ShowFreightInc_PaycheckHistory_*.xls` + `J&A*PaycheckHistory*.xls`) and **gives the contractor amounts in chat** (per his Jun-29 2026 preference — he won't re-export contractor files weekly).
2. **Contractors:** add a new week key to the `MANUAL_CONTRACTORS` dict in `build_paycheck_grid.py` with that week's chat amounts (Gabriel Colon split 50/50 CE/SF; Mellody = base + commission). The dated `J&A*ContractorPayments*.xls` (QB) + `VendorEmployeePayments*.csv` (Chase) files are the **FROZEN HISTORICAL base (~through 6/15)** — **leave them in `incoming-freightiq/`, do NOT delete them** (the script re-reads them every run for the back-weeks). From 6/22 forward, contractors come from `MANUAL_CONTRACTORS`.
3. Run `python scripts/build_paycheck_grid.py` (auto-detects the latest paycheck-history files) → rebuilds `OFFICE_PAYCHECKS` into `src/App.jsx`. Then `npm run build`, commit, push.

**What the script does / rules it encodes (maintain these as people change — they're hardcoded in the script, not the files):**
- **Cells:** W-2 = full loaded cost (gross × that person's employer-tax/401k factor from `OFFICE_W2`/`WAREHOUSE`) shown white; 1099 = actual dated contractor payments shown amber. Reconciles: W-2 portion = sum of `OFFICE_W2`+`WAREHOUSE` totalCost.
- **Columns = PAY DAY, not Monday week-start (per Ben, Jul 2026).** Each Mon–Sun bucket is labeled with the most-common check date that week (`PD` map in the script; `wk_of()` returns the payday label). `MANUAL_CONTRACTORS` is still hand-keyed by Monday ("6/29") but auto-maps to the payday label via `PD_BY_MONLABEL` so contractors land in the same column as that week's W-2 checks.
- **Contractors are ALL-IN:** cells include cash + **car allowances (monthly) + company health insurance (weekly) + REIMBURSEMENTS**. **⚠️ Methodology changed 2026-07-23 (Ben):** all-in `ltotals = camts + car + health + reimb` — reimbursements are now **INCLUDED** (add via `MANUAL_REIMB` dict, keyed by Monday) and commission is **NOT spread** (the old `COMMISSION_TOTAL` block was removed — "spreading a YTD total across weeks doesn't make sense"; if commission is actually paid a week, put it in that week's cash). Kevin/Nixon Graye = agent, excluded. See `reference_office_payroll_grid` memory.
- **⚠️ Refresh `LABOR` every drop BEFORE trusting the card's fleet number.** `DRIVER_WEEKLY`'s loaded factor = `LABOR / driver-gross-YTD`. Run the script on a new PaycheckHistory without updating `LABOR` and every fleet number re-scales DOWN (7/24 came out $53k vs true $56k). Fix: recompute `LABOR` = fleet-driver YTD **Total-payroll-cost** (SF, EXCL the `OFFICE` list + the 9 ATL drivers) from `ShowFreightInc_PayrollSummaryByEmployee_*.xls` (**col 1 = "Total"/YTD**), update `let LABOR` + `let ATL_LABOR` + the LABOR-comment ATL-carve `$…` (build_paycheck_grid regex-parses it), THEN re-run. **Use `npm run build`, NOT `npx vite build`** (only the former runs extract-metrics.js → metrics.json).
- **`DRIVER_WEEKLY` constant** (emitted by the same script): fleet + ex-OTR loaded cost per pay week, calibrated so YTD sums reconcile to LABOR + the carve-out. Powers the **"This Week — All-In Payroll" card** at the top of the Office Staff tab + the Fund Payroll panel (owner-facing: Drivers + Office/WH + Contractors, all-in, with WoW). Drivers are excluded from the grid but `DRIVER_WEEKLY` adds them back for that card only.
- **Company map** (`W2DIV` + `canon()`): per-person CE/SF/CE East/J&A with 50/50 splits (Bart & Gabriel Colon = CE/SF; Harold & Kidist = CE/CE East; Nathan & Cecy = CE).
- **Dual people** (W-2→1099): Delgado, Simpson, Debra, **Biniyam (= ENM Trucking)** merge into ONE row — W-2 weeks white, 1099 weeks amber. Payee aliases: Bill A→Deb, Neon Vibes→Mellody, Salman→Hilda, Christopher→Simpson, ENM→Biniyam.
- **`OFFICE` list** (drivers excluded from the grid) includes `wilson` (Antionette Wilson = ATL office support, reclassified from driver Jul 2026).
- **Excluded from the grid cash cells:** reimbursements (kept in the `reimb` dict — now feed the all-in card via `ltotals`, see methodology note above) and **the agent** (Nixon Graye / Kevin — excluded entirely, `canon()` returns None).
- **Not in any file → hardcoded, MUST update manually:** Maria Con ($550/wk → $650 after Mar 10), Logic ($500/wk all year), **Mairena Tapias** (Jon Marcus's assistant, 100% CE — her dated payments are a literal list in the script; **append her new weekly payments each week**).
- **Dimming:** a row dims only if former AND has no 1099 activity (still-active contractors stay full brightness).

**Open gap:** CE East currently only contains Harold/Kidist's split halves (~$3K). If CE East gets its own staff, add a CE East paycheck export + extend the script.

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
    Any hits are hand-typed period strings or live-data divergences that should either be derived or deliberately annotated (e.g. inline `// partial — May 1-3 only` comments are fine; `"72-day period"` strings are not). MILES_EST is fuel-only (avg $/gal calc) — never use it for any CPM display; CPM always divides by `MILES` (Samsara Vehicle Mileage xlsx).
5. **No new entities silently absorbed.** New EFS card numbers, new vendor lines in the QB transaction report, new drivers in the payroll XLS — all must be either mapped in the appropriate constant OR explicitly noted in the commit message as "excluded from per-driver mapping" (e.g. card 17408 = Andres / warehouse).
6. **No stale partial-month rows.** `INCOME_2026.months[]` and `MONTHLY_REVENUE` last entries should either be a full closed month OR a partial flagged with an inline `// partial — May 1-3 only` comment. A closed prior month showing < 50% of the typical run is a stale row.
7. **Cross-repo fixes are pushed, not just local.** If a fix touches a sibling repo (e.g. `ap-aging` for CORS), `git status` in that repo to confirm clean. The nightly stale-repos cron (`~/Desktop/_stale-repos.md`) catches drift but should never be the first time you discover an uncommitted fix.
8. **Downstream consumers still work.** CFO Dashboard fetches `metrics.json` + `payroll-summary.json`; Per Load CPM fetches `metrics.json` + `/api/alvys-loads`. Visit each at least once after the deploy lands to confirm they hydrated with new numbers.
9. **Report ATL weekly charges to Ben (ALWAYS, every weekly drop).** After the update lands, give Ben the total ATL operating charges for the week just added to `ATL_WEEKLY_LOG`: **driverPay + fuelAmt + contractorPay** (agents excluded — separate bucket). Show the 3-line breakdown + the week total, plus the running cumulative from `atlSum()`. This is a standing request (Ben, Jun 15 2026) — don't wait to be asked. See `feedback_atl_weekly_charges` memory.
10. **Office + contractor half is done too.** `OFFICE_W2` / `WAREHOUSE` refreshed from the SF + J&A payroll XLS, and `CONTRACTORS` updated from Ben's chat amounts. The weekly is NOT done after just drivers/fuel/income — skipping this leaves the Office Staff tab showing last week's numbers (Ben caught this Jun 20 2026; see `feedback_freightiq_weekly_completeness`).
11. **Clear `incoming-freightiq/`** only AFTER all of the above pass — INCLUDING office/contractor. Clearing early DELETES the payroll XLS (untracked → unrecoverable) and forces a re-drop. Don't clear until the full weekly is built, pushed, and verified live.

### Drift patterns Ben should NEVER have to catch (you catch them first)

Ben paying attention to dashboard details is the LAST line of defense, not the first. Every time he spots a mismatch and has to point it out, that's a process failure. These are the classes of bugs that have bitten before — actively look for them before declaring weekly done:

**A. Numerator/denominator mismatches in CPM displays.** Every CPM (cost-per-mile) tile on every tab must divide by `MILES` (Samsara Vehicle Mileage report), never `MILES_EST` (gallons × 6.5 — fuel-price math only). If you see two CPM panels showing the same metric with different values, that's the bug. Run the `/MILES_EST` grep above before commit; the only legitimate hit is the avg $/gal display.

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

**H2. Hardcoded rates/multipliers that should DERIVE from live constants.** If a rate is just a ratio of two constants that already update weekly, compute it — don't hardcode a number that silently drifts. Fixed Jul 2026: `HOURLY_RATE` in the Per Load CPM simulator was a hardcoded `31.15` (a stale `LABOR/TOTAL_HRS`); changed to `const HOURLY_RATE = LABOR / TOTAL_HRS` so it self-updates every drop (~$31.36 now). When you see a bare numeric rate/price/multiplier, ask "is this derivable from constants that already move?" — if yes, derive it.

### Office vs Driver split (SF Payroll):
**Office staff** (excluded from PAYROLL/CPM): Arias Adrian, Eagleton Gentry J (warehouse), Figueroa Andres (warehouse), Fissehaye Biniyam G, Gonzalez Gabriel, Grosser Scot E, Kennon Jessica S (ATL office, terminated May 2026), Mahan Tasha (office/warehouse, started Jun 2026), Naruszewicz Bartosz, Rivera Cecilia I, Wilson Antionette (ATL office support, reclassified from driver Jul 2026), Youngblood Nathan. **Ex-OTR (now ATL, carved out of fleet LABOR):** Baker Anthony, Dawson Brian, Pacitti Michael R — in `SF_OTR` (relabeled ATL), excluded from fleet LABOR, folded into `ATL_WEEKLY_LOG`. Everyone else = drivers. (Both sets encoded in `scripts/parse_weekly_drop.py` — keep in sync.)

### EFS fuel — per-week + parsing gotchas (added 2026-07-30)

`FUEL_TOT` / `ATL_FUEL` come from each card's **`Total Fuel`** line in the EFS Transaction Report, which is **ULSD only** — `DEFD` (diesel exhaust fluid) and per-transaction `Fees` are listed but excluded:

```
Group: 14 07454   Amount  Quantity  Avg PPU
DEFD              61.43     12.29   4.999
ULSD             477.56     91.86   5.199
Fees               1.25     0.000
Totals           540.24     0.000
Total Fuel       477.56     91.86      <-- what we use
```

`scripts/parse_weekly_drop.py` already reads `Total Fuel` and is correct. **The trap is re-deriving from transaction lines** (needed for per-week splits): include `DEFD` and you overstate by ~4.7% — measured $131,260.81 vs the true $125,350.93 on the Jul-30 ATL cards. Filter `item in ('DEFD','DEF')` and it reconciles to the penny per card.

**Per-week fuel** (Ben asks for this): transaction rows carry `Tran Date` — bucket Mon–Sun on it. Row shape:
`<5-digit card> <YYYY-MM-DD> <invoice> <unit> <driver> <location> <CITY> <ST> <fee> <ITEM> <price> <qty> <amt> N USD/Gallons`
DEF continuation lines have no card/date prefix — carry the previous card+date forward.

- **Unit numbers are not clean truck numbers.** EFS writes truck 685 as `9512685`, 673 as `9512673`, 488 as `9513488`, sometimes `95128685`. **Normalize to the last 3 digits** before matching `ATL_TRUCKS` — un-normalized matching understated ATL-truck share as 40.4% vs the real 57.7%.
- **EFS closes after the P&L** (Jul-30 drop: EFS thru Jul 29, P&L thru Jul 26). So `FUEL_TOT(new) − FUEL_TOT(old)` is NOT a clean week — use transaction dates for a true Mon–Sun figure.
- DEF is a real cost (~$5,910 YTD ATL) that sits in **no** CPM bucket — it's inside the QBO fuel line, not EFS-only `FUEL_TOT`.

### ATL carve basis — OPEN defects (2026-07-30)

**Ben's rule: the ATL carve follows the DRIVERS on ATL payroll.** `ATL_LABOR` (by `SF_ATL` name) and `ATL_FUEL` (by EFS card) obey it. **`ATL_MILES` does not — it carves by truck (`ATL_TRUCKS`).**

Two defects, both **unfixed on purpose**:

1. **Whole-year roster on a part-year operation.** ATL launched **2026-05-04**; the carve applies today's roster to all of 2026. Wainwright was a fleet driver Jan–May 3, so **$30,489.12 labor + $24,792.97 fuel = $55,282.09 of pre-launch cost is booked to ATL**. He's the only one of the nine with pre-launch activity (other 8 are exactly $0.00).
2. **`ATL_MILES` has the same contamination and can't be split** — the Samsara export is a YTD per-truck-per-state total with **no date column**.

**⚠ Do NOT fix the numerator alone** — ATL CPM would fall $2.5053 → $2.0036, a ~20% "improvement" that is pure artifact. **Unblocker:** a Samsara Vehicle Mileage export for **2026-05-04 → 2026-07-26**, then it ships as one commit.

**Undecided (Ben):** the Samsara export has no driver dimension, so strict driver-following for miles isn't possible with the current file. Options — (a) pull a driver-level Samsara report, (b) keep truck-based and document the mixed basis, (c) derive driver→truck weekly from EFS unit numbers (approximation).

**Also worth knowing:** ATL is *not* geographically Atlanta. Week of 7/20: only 20.6% of fuel bought in GA, 3.8% NV, rest OH/NJ/CT/PA/NM/AZ/OK/NC/IL/LA/MO/KS. Long-haul run out of Atlanta. ATL fuel since inception (May 4) = **$100,557.96 / 19,658.04 gal over 13 weeks**, avg $7,735/wk.

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
- **AP Aging** (`ap-aging-v4.vercel.app`) — original standalone AP dashboard (Next.js + Supabase). **Now folded into FreightIQ as the 🧾 AP Aging tab** (`src/ApAging.jsx` + `/api/ap-*`) — see "Consolidated dashboards" above. The standalone deploy is redundant (retirement deferred); FreightIQ reads the same `invoices`/`payments`/`equipment` tables directly.
- **Budget Calendar** (`budget-calendar-lemon.vercel.app`) — original standalone work-expense calendar (React/Vite + Supabase `w_*`). **Now folded into FreightIQ as the 📅 Budget Calendar tab** (`src/BudgetCalendar.jsx`, byte-for-byte port — see "Consolidated dashboards"). Standalone redundant (retirement deferred).
- **CFO Dashboard** (`cfo-dashboard-eta.vercel.app`) — Executive financial dashboard (React + Tailwind + Supabase), fetches metrics.json + payroll-summary.json from this app. Local path: `Desktop/Freight/cfo-dashboard`, no GitHub repo — deployed via `npx vercel deploy --prod --yes`. Has per-source status bar, section quick-nav, safeDivide guards, dynamic period/truck count. Known debt: monolithic App.jsx, RLS wide open, no endpoint auth, hardcoded business data.
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
