# FreightIQ — Show Freight Inc Operations Dashboard

Real-time fleet cost-per-mile dashboard. Built-in data + AI-powered upload for weekly updates. Deploy to Vercel, share a URL with your team.

## Architecture

```
Your Team (browser)
    ↓
freightiq.vercel.app
    ↓                    ↓
/api/ai.js           src/App.jsx
(serverless proxy)   (dashboard + upload)
    ↓                    ↓
Anthropic API       Built-in data
(key stays secret)  (updated via Upload tab)
```

- **Built-in data** = your current Q1 2026 numbers are baked into the code. Dashboard works immediately.
- **📂 Upload tab** = drop any raw CSV/XLSX export. AI auto-detects the format, maps columns, loads it into the dashboard.
- **`/api/ai.js`** = serverless function that proxies AI requests so your Anthropic API key never touches the browser.
- **Vercel** = hosting. Push code changes to GitHub, auto-redeploys in ~30 seconds.

## Deploy in 4 Steps

### 1. Push to GitHub

```bash
unzip freightiq.zip
cd freightiq
git init
git add .
git commit -m "FreightIQ v1"
gh repo create freightiq --private --push
```

Or create a repo manually at github.com and push.

### 2. Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click "Import Git Repository"
3. Select your `freightiq` repo
4. Framework preset will auto-detect as **Vite**

### 3. Set Environment Variable

In the Vercel project dashboard → Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` (from [console.anthropic.com](https://console.anthropic.com/)) |

### 4. Deploy

Click **Deploy**. You get a URL like `freightiq-xyz.vercel.app`.

Optional: Add a custom domain in Vercel → Settings → Domains (e.g., `dashboard.showfreight.com`).

Share the URL with your team — they open it and see the dashboard. No logins, no installs.

## Weekly Update Workflow

1. Export payroll from QuickBooks → go to 📂 Upload tab → drop the file
2. Export fuel from EFS portal → drop it
3. Export mileage from Samsara → drop it
4. Click **Apply** on each — dashboard recalculates everything instantly
5. To make updates permanent (persist across deploys), bring the updated file back here to Claude and ask to update the built-in data in `src/App.jsx`, then push to GitHub

### Supported Upload Sources

The AI reads your column headers and figures out the rest. Any format works:

- **QuickBooks** — P&L reports, payroll summaries
- **EFS** — fuel card transaction exports
- **Mudflap** — fuel card statements
- **Samsara** — GPS mileage reports
- **Penske / TEC / TCI** — lease invoices
- **McKinney / Xtra** — trailer invoices
- **Any CSV or XLSX** with driver, fuel, mileage, or financial data

## Making Code Changes

```bash
git clone https://github.com/yourname/freightiq.git
cd freightiq
npm install

# Run locally
cp .env.example .env.local
# Fill in ANTHROPIC_API_KEY
npm run dev
# → http://localhost:3000

# Edit src/App.jsx
# Push → auto-deploys
git add . && git commit -m "Updated layout" && git push
```

## Dashboard Tabs

| Tab | What it shows |
|-----|---------------|
| 🏢 Fleet Overview | All-in CPM, cost breakdown, driver table |
| 🧮 CPM Calculator | Basic vs All-In CPM, margin targets |
| 🚛 Driver Detail | Per-driver labor + fuel + combined CPM |
| 📍 Trucks & Mileage | Samsara GPS: per-truck miles, local vs regional, state breakdown |
| 🛢 Fuel Analysis | Per-driver fuel spend, avg $/gal, fuel CPM |
| 🚛 Trucks | TEC, Penske, TCI lease detail |
| 🚜 Trailers | McKinney, Xtra, Utility trailer fleet |
| 💵 Income | Revenue by company (CE/SF/DI), weekly trends, YoY |
| 🏦 CE East | Balance sheet, P&L, distribution projections |
| 🤖 AI Analyst | Ask anything about your data |
| 📂 Upload | Drop raw exports, AI maps columns |

## Tech Stack

- **React 18** + **Vite**
- **Recharts** — charts
- **PapaParse** — CSV parsing
- **SheetJS** — XLSX parsing
- **Vercel** — hosting + serverless
- **Claude API** — AI analysis + report classification

## File Structure

```
freightiq/
├── api/
│   └── ai.js              # Serverless proxy for Anthropic API
├── src/
│   ├── main.jsx            # React entry
│   └── App.jsx             # Full dashboard (~4,600 lines)
├── index.html
├── package.json
├── vite.config.js
├── vercel.json
├── .env.example
└── .gitignore
```
