import { useState, useMemo, useEffect, useRef, createContext, useContext } from "react";
import { BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import * as Papa from "papaparse";
import * as XLSX from "xlsx";

// ── Data Context (for Upload tab communication) ──────────────
const DataContext = createContext(null);
function useDataCtx() { return useContext(DataContext); }

// ── Equipment Context (live from AP Aging) ──────────────────
const EquipmentContext = createContext(null);
function useEquipment() { return useContext(EquipmentContext); }


// ── PAYROLL DATA ──────────────────────────────────────────────
// QuickBooks payroll summary by employee, Jan 1 – May 29, 2026
// LABOR = total payroll cost for drivers (gross + employer taxes + 401k)
// * = inactive/terminated driver
// entity:"ATL" = Atlanta operations (since May 11, 2026); YTD includes prior CE/SF weeks
// ATL designation is week-to-week (see ATL_WEEKLY_LOG below) — no longer
// tagged here. The entity:"ATL" + atlPreYtd pattern was dropped May 25, 2026
// after Ben clarified that ATL designations toggle weekly and aren't sticky.
//
// active: false marks a driver whose YTD is frozen (no recent activity).
// Used by ACTIVE_PAYROLL filter — UI shows only active drivers in counts.
// Frozen YTD still counts toward LABOR / TOTAL_HRS so fleet totals reconcile
// to QBO; only the COUNT displays are filtered.
let PAYROLL = [
  { name: "Alexander Christopher", hours: 1456.91,totalCost: 45064.19 },
  { name: "Cowsky Andy",           hours: 697.70, totalCost: 20339.12 },                  // QB shows "Cowsky Andrew"
  { name: "Allwine Brian A",       hours: 181.34, totalCost: 5043.53,   active: false }, // *inactive (UNCHANGED WoW)
  { name: "Alshamaa Manar",        hours: 302.34, totalCost: 9368.45, active: false },                   // ATL since May 11
  { name: "Anderson Justin M",     hours: 79.01,  totalCost: 2285.37,   active: false }, // *inactive (UNCHANGED WoW)
  { name: "Brown Jr Marcellus",    hours: 77.08,  totalCost: 2143.78,   active: false }, // *inactive (UNCHANGED WoW)
  { name: "Butler Richard",        hours: 382.40, totalCost: 11493.27,  active: false }, // *inactive (UNCHANGED WoW)
  { name: "Christian Norman L",    hours: 100.08, totalCost: 2894.81,   active: false }, // *inactive (UNCHANGED WoW)
  { name: "Clark Rettick",         hours: 255.06, totalCost: 7377.62,   active: false }, // *inactive (UNCHANGED WoW)
  { name: "Cotton Kejlon",         hours: 320.32, totalCost: 11677.82,  active: false }, // *inactive (UNCHANGED WoW)
  { name: "Daniels Gerald W",      hours: 771.31, totalCost: 22531.82 },
  { name: "Davis Anthoni D",       hours: 1901.80,totalCost: 66229.72 },                  // OFF ATL as of Jun 1 — back to CE/SF
  { name: "Denman Samuel E",       hours: 1507.82,totalCost: 49929.37 },
  { name: "Dixon Deon A",         hours: 101.84,  totalCost: 3045.73, active: false },                   // NEW · started Jun 2026 · no EFS card mapped yet
  { name: "Dotch Brandon C",       hours: 540.11, totalCost: 16130.43, active: false },                  // (UNCHANGED WoW × 2)
  { name: "Gray Stephen D",        hours: 255.56,  totalCost: 7622.08 },                   // NEW · started Jun 2026
  { name: "Gutierrez Danny",       hours: 1410.42,totalCost: 44635.21 },
  { name: "Guzman Jose",           hours: 1736.53,totalCost: 62566.70 },
  { name: "Howell Lawrence",       hours: 85.33,  totalCost: 2373.24,   active: false }, // *inactive (UNCHANGED WoW)
  { name: "Ibarra Jose Pablo",     hours: 1728.21,totalCost: 61653.11 },
  { name: "Johnson Christopher",   hours: 508.56, totalCost: 15782.49 },                   // ATL since May 18 · QB shows "Johnson Christopher M"
  { name: "Juarez Angel",          hours: 376.15, totalCost: 10863.46,  active: false }, // *inactive (UNCHANGED WoW)
  { name: "Kelly Kirk D",          hours: 801.82, totalCost: 23044.55,  active: false }, // *inactive (UNCHANGED WoW)
  { name: "Landreth James",        hours: 161.05,  totalCost: 4883.37, active: false },                   // started May 25
  { name: "Logan LaDyle",          hours: 323.31,  totalCost: 10088.24 },                   // NEW · ATL driver · started Jun 2026
  { name: "Lucero Andrew",         hours: 149.53, totalCost: 4325.15, active: false },                   // (UNCHANGED WoW × 5)
  { name: "Magtee Christopher",    hours: 39.47,  totalCost: 1141.68, active: false },                   // NEW · started Jun 2026 · no EFS card mapped yet
  { name: "Matthews Ron A",        hours: 464.44, totalCost: 13126.62,  active: false }, // *inactive (UNCHANGED WoW)
  { name: "Mcclam Michael A",      hours: 1078.09, totalCost: 33182.58 },
  { name: "McDaniels James",       hours: 279.57,  totalCost: 8309.95 },                   // started May 25
  { name: "McNamara John",         hours: 1630.93,totalCost: 54214.32 },
  { name: "Memolo Dominick",       hours: 0.00,      totalCost: 0.00,         active: false }, // *inactive
  { name: "Negrete Arturo",        hours: 371.01, totalCost: 11053.06,  active: false }, // *inactive (UNCHANGED WoW)
  { name: "Ponce Carlos",          hours: 871.21, totalCost: 26993.35 },
  { name: "Restrepo Julian E",     hours: 924.21, totalCost: 29615.34 },
  { name: "Reyes Corey",           hours: 732.33, totalCost: 21110.40 },
  { name: "Robinson Animashaun",   hours: 968.61, totalCost: 28407.95 },
  { name: "Ronkov Martin P",       hours: 1566.97,totalCost: 45215.60 },
  { name: "Secrest Jermelle",      hours: 613.67, totalCost: 17708.58, active: false },                  // (UNCHANGED WoW × 3)
  { name: "Stevenson Timothy",     hours: 333.14,  totalCost: 9631.52 },                   // NEW · started Jun 2026
  { name: "Stringer Adam E",       hours: 203.46, totalCost: 5885.08, active: false },                   // (UNCHANGED WoW × 3)
  { name: "Striplin Lamareh",      hours: 653.62, totalCost: 20028.99, active: false },                  // (UNCHANGED WoW × 2)
  { name: "Thomas John",           hours: 194.71,  totalCost: 6024.83 },                   // started May 25
  { name: "Thorne Richard",        hours: 254.53, totalCost: 7387.28,   active: false }, // *inactive (UNCHANGED WoW)
  { name: "Tucker Robert",         hours: 559.91, totalCost: 17776.26 },                   // ATL since May 11
  { name: "Vue CJ Z",              hours: 3.00,   totalCost: 86.78, active: false },                     // (UNCHANGED WoW × 2)
  { name: "Wainwright Michael W",  hours: 1589.37,totalCost: 47133.16 },
  { name: "Watkins Shawn",         hours: 862.89, totalCost: 25591.49, active: false }, // *terminated Jul 2026
  { name: "Watson Dahnifu S",      hours: 1263.31,totalCost: 36480.52, active: false }, // *terminated Jul 2026
  { name: "Whipple Wallace",       hours: 1611.17,totalCost: 52262.72 },
  { name: "Williams Tadaryl C",    hours: 1548.29,totalCost: 45836.06 },
  { name: "Williams Will",         hours: 1109.03, totalCost: 33447.69 },
  { name: "Willis Wali A",         hours: 1796.30,totalCost: 61706.82 },
  { name: "Wright Robert",         hours: 260.66, totalCost: 9443.88,   active: false }, // *inactive (UNCHANGED WoW),                  // NEW · card 27450 · 0 hrs (signed, not yet driving)
  { name: "Camacho Stephen B",     hours: 103.32,  totalCost: 2988.53 },                  // NEW · started Jun 2026 · no EFS card mapped yet,                  // NEW · card 17451 · 0 hrs (signed, not yet driving)
  { name: "Lewis Steve",           hours: 94.43,  totalCost: 2731.38 },                  // NEW · card 97454,                  // NEW · card 87455
];

// Active driver count — used everywhere a "how many drivers" display number
// matters. Frozen/inactive YTD still counts toward LABOR; this is for counts only.
const ACTIVE_DRIVERS_COUNT = PAYROLL.filter(p => p.active !== false).length;

// ── FUEL DATA (EFS only) ──────────────────────────────────────
// ATL designation dropped here too — see ATL_WEEKLY_LOG. Cards still mapped
// to fleet drivers; ATL fuel for a given week is computed via per-week roster.
let FUEL = {
  // EFS only, Jan 1 – Jun 12, 2026 — $515,335.28 (94,400.05 gal) per EFS Transaction Report
  // No Mudflap charges this period
  // Fuel = ULSD + BDSL + CDSL + UNPR + UNRG (all fuel products; excludes DEF, fees, parking, CADV)
  // Excluded from per-driver mapping (still counted in FUEL_TOT): card 17408 Andres ($5,337.52 — warehouse), 27467 Nathan ($90.01 — office), 67402 ($1,005.41 unknown), 47465 ($369.67 unknown), 07409 Adrian ($332.35 — office, NEW)
  "Alexander Christopher": { fuel: 29199.65, gallons: 4808.95 },  // card 77409
  "Allwine Brian A":       { fuel: 2147.67,  gallons: 556.49 },   // card 07408 split (Jan only, *inactive — frozen)
  "Alshamaa Manar":        { fuel: 5680.93,  gallons: 1055.67 },   // card 87454
  "Anderson Justin M":     { fuel: 450.60,   gallons: 76.00 },    // card 07405 split (Jan only, *inactive — frozen)
  "Brown Jr Marcellus":    { fuel: 1282.90,  gallons: 307.66 },   // card 77462 (*inactive — frozen)
  "Butler Richard":        { fuel: 7248.06,  gallons: 1300.88 },  // card 67400 (*inactive — frozen UNCHANGED)
  "Christian Norman L":    { fuel: 819.40,   gallons: 149.01 },   // card 47402 split (Mar only, *inactive — frozen)
  "Clark Rettick":         { fuel: 2339.97,  gallons: 482.50 },   // card 37405 split (*inactive — frozen)
  "Cotton Kejlon":         { fuel: 235.78,   gallons: 61.10 },    // card 87401 split (*inactive — frozen)
  "Cowsky Andy":           { fuel: 17259.06, gallons: 2846.49 },  // card 77457
  "Daniels Gerald W":      { fuel: 11821.46,  gallons: 2041.07 },  // card 47402 split (active, absorbs deltas over Christian)
  "Davis Anthoni D":       { fuel: 45676.91, gallons: 8308.99 },  // card 27406
  "Denman Samuel E":       { fuel: 26384.69, gallons: 5228.22 },  // cards 47405 + 37403
  "Dotch Brandon C":       { fuel: 12032.86, gallons: 1880.68 },  // cards 07405 (Anderson-frozen split) + 17468 (UNCHANGED WoW × 3)
  "Gray Stephen D":        { fuel: 3909.51,   gallons: 768.84 },   // NEW · card 27403
  "Gutierrez Danny":       { fuel: 9977.47,  gallons: 2052.14 },  // card 47404 (UNCHANGED WoW × 2)
  "Guzman Jose":           { fuel: 11522.63, gallons: 2294.54 },  // card 77401 (UNCHANGED WoW)
  "Howell Lawrence":       { fuel: 0.00,        gallons: 0.00 },
  "Ibarra Jose Pablo":     { fuel: 9619.73,  gallons: 1889.67 },  // card 97409
  "Johnson Christopher":   { fuel: 10778.14,  gallons: 2132.27 },   // card 37459
  "Juarez Angel":          { fuel: 2961.21,  gallons: 429.11 },   // card 87461 (frozen UNCHANGED)
  "Kelly Kirk D":          { fuel: 13948.17, gallons: 2933.07 },  // card 77402 split (*inactive — frozen)
  "Logan LaDyle":          { fuel: 7004.09,  gallons: 1434.76 },   // NEW · card 57457 · ATL driver
  "Lucero Andrew":         { fuel: 1481.30,  gallons: 210.83 },   // card 87401 split (UNCHANGED WoW × 5)
  "Matthews Ron A":        { fuel: 4209.19,  gallons: 1032.33 },  // card 07408 split (*inactive — frozen)
  "Mcclam Michael A":      { fuel: 25412.86, gallons: 3889.25 },  // card 07407
  "McNamara John":         { fuel: 21945.37, gallons: 4624.51 },  // card 17407
  "Memolo Dominick":       { fuel: 0.00,        gallons: 0.00 },
  "Negrete Arturo":        { fuel: 6348.68,  gallons: 1511.56 },  // card 57404 (*inactive — frozen UNCHANGED)
  "Ponce Carlos":          { fuel: 18710.03, gallons: 3051.36 },  // card 37466
  "Restrepo Julian E":     { fuel: 20728.50, gallons: 3521.85 },  // card 37405 split (active, absorbs deltas over Wright+Clark)
  "Reyes Corey":           { fuel: 14353.27,  gallons: 2170.32 },  // cards 07469 + 97453
  "Robinson Animashaun":   { fuel: 3446.71,     gallons: 625.34 },   // card 97455 ("Shaun R" on EFS = Animashaun/Robinson) — was unmapped, he had 968 hrs but $0 fuel
  "Ronkov Martin P":       { fuel: 7611.12,  gallons: 1505.42 },  // card 67403
  "Secrest Jermelle":      { fuel: 16213.45, gallons: 2451.98 },  // cards 37404 + 27404 (Mell) — UNCHANGED WoW × 3
  "Stevenson Timothy":     { fuel: 5185.93,   gallons: 906.71 },   // NEW · card 07452
  "Stringer Adam E":       { fuel: 3165.51,  gallons: 561.20 },   // card 77402 split (UNCHANGED WoW × 3 — Kelly portion frozen)
  "Striplin Lamareh":      { fuel: 12395.32, gallons: 2247.71 },  // card 87407 — moved off UNCHANGED streak
  "Thorne Richard":        { fuel: 5514.29,  gallons: 938.16 },   // card 87401 split (*inactive — frozen)
  "Tucker Robert":         { fuel: 13257.14,  gallons: 2611.29 },  // card 47458
  "Vue CJ Z":              { fuel: 0.00,        gallons: 0.00 },        // no card mapped
  "Wainwright Michael W":  { fuel: 36577.76, gallons: 7439.31 },  // card 67463
  "Watkins Shawn":         { fuel: 38387.04, gallons: 6812.25 },  // cards 57401 + 57464
  "Watson Dahnifu S":      { fuel: 16274.57, gallons: 2966.78 },  // card 97406 (Shaq)
  "Whipple Wallace":       { fuel: 27613.18, gallons: 5636.87 },  // card 57403
  "Williams Tadaryl C":    { fuel: 20980.84, gallons: 3974.82 },  // card 37402 (UNCHANGED WoW × 2)
  "Williams Will":         { fuel: 23794.99, gallons: 4134.18 },  // card 27405
  "Willis Wali A":         { fuel: 13159.83, gallons: 2385.92 },  // card 87400
  "Wright Robert":         { fuel: 2170.77,  gallons: 538.08 },   // card 37405 split only (*inactive — frozen; 47458 reassigned to Tucker), // NEW · card 27450, // NEW · card 87455, // NEW · card 17451
  "Lewis Steve":           { fuel: 979.82, gallons: 148.48 }, // NEW · card 97454
};

// ── FLEET CONSTANTS (QuickBooks + EFS only — these drive CPM) ───
// FUEL_TOT comes ONLY from EFS/Mudflap exports, never QuickBooks.
// All other costs come from QuickBooks P&L.
// Individual vendor invoices (TCI, Penske, TEC, McKinney, etc.) are
// shown in the Trucks/Trailers tabs but do NOT affect these totals.
let LABOR     = 1197915.05; // QuickBooks: SF FLEET driver payroll (gross+taxes+401k) thru ~Jul 2 (payroll-only refresh — payroll file ~1wk ahead of the Jun 28 PERIOD; fuel/miles/income still Jun 26-28). 29 drivers active (frozen + 12 terminated Jul 2026 keep YTD so LABOR reconciles). EXCLUDES OTR (Baker/Dawson/Pacitti $14,785.86 — see OTR_WEEKLY_LOG) + Wilson Antionette (ATL office, moved to OFFICE_W2)
let FUEL_TOT  = 603068.29;  // EFS fleet only — thru Jul 4 (EFS report total $616,958.33 minus OTR cards 27450/17451/87455 $13,890.04; OTR carved out of CPM)
let GALLONS   = 111256.42;  // EFS 114,182.80 minus OTR 2,926.38
let MILES_EST = GALLONS * 6.5;  // kept for fuel avg price calc
let MILES     = 737887.1;     // Samsara Vehicle Mileage report, Jan 1 – Jun 27, 2026 (49 logged). PENDING: Samsara xlsx for the Jul 5 period not yet dropped — MILES lags the rest by ~1wk. Update via scripts/parse_samsara_mileage.py when it lands.
let TRUCK_COUNT = 30;       // ACTIVE fleet trucks per Ben's truck-count sheet. NOTE: TRUCK_MILES now has 49 entries from the mileage report; cumulative miles feed MILES + CPM but departed/temp trucks don't count toward the active fleet. (Confirm active count with Ben.)
let TOTAL_HRS  = 38193.24;  // Payroll hours — fleet drivers only (office + OTR + Wilson excluded), thru ~Jul 2
let INS_WEEK  = 6375;
let INS_TOT    = 163284.16;  // QB: SF Truck Insurance only (CPM insurance = truck insurance) thru Jul 5 — caught up (+$14.7K, June/July truck-ins posted)
let TRUCK_TOT  = 489911.62;  // QuickBooks: Truck Rentals (Penske + TEC/Transco + TCI + Ryder) thru Jul 5
let TRAILER_TOT = 215129.80; // QuickBooks: Trailer Rentals (McKinney + Xtra + Utility + Premier + Boxwheel + Ten) thru Jul 5
let EQUIP_TOT   = TRUCK_TOT + TRAILER_TOT;
let TRUCK_MAINT  = 7783.45;   // Prime Wash, AutoForce, Titan Glass, Towing, Batteries, TZ Parts, eBay, SF Heavy Equipment thru Jul 5
let TRAIL_MAINT  = 5656.52;   // TravelCenters of America, MKD Express thru Jul 5
let STORAGE      = 53835.40;  // Storage/Parking per P&L thru Jul 5
let MAINT_TOT    = TRUCK_MAINT + TRAIL_MAINT + STORAGE;
let UNIFORMS     = 10863.06;  // Unifirst + Safety Guard Shoe thru Jul 5 — caught up off prior unchanged streak
// Basic CPM = Labor + Fuel + Truck Rentals + Insurance only
let BASIC_COST  = LABOR + FUEL_TOT + TRUCK_TOT + INS_TOT;
let BASIC_CPM_V = BASIC_COST / MILES;
// All-In CPM = everything tracked
let ALLIN_COST  = LABOR + FUEL_TOT + TRUCK_TOT + INS_TOT + TRAILER_TOT + TRUCK_MAINT + TRAIL_MAINT + STORAGE + UNIFORMS;
let ALLIN_CPM_V = ALLIN_COST / MILES;
let PERIOD    = "Jan 1 - Jul 5, 2026";
// Derived day count parsed from PERIOD — keeps subtitle labels honest without
// having to bump a magic number every week. If PERIOD parsing fails, fall back
// to current behavior (Jan 1 → today).
const PERIOD_DAYS = (() => {
  const m = PERIOD.match(/(\w+ \d+).*?(\w+ \d+),\s*(\d{4})/);
  if (m) {
    const s = new Date(`${m[1]}, ${m[3]}`);
    const e = new Date(`${m[2]}, ${m[3]}`);
    return Math.round((e - s) / 86400000) + 1;
  }
  const yr = new Date().getFullYear();
  return Math.round((Date.now() - new Date(`Jan 1, ${yr}`).getTime()) / 86400000) + 1;
})();
// Period end date — derived from PERIOD, used in subtitle annotations to avoid drift
const PERIOD_END = (() => {
  const m = PERIOD.match(/-\s*(\w+\s+\d+),/);
  return m ? m[1] : "";
})();

// Build merged driver rows
let DRIVERS = PAYROLL.map(p => {
  const f = FUEL[p.name] || { fuel: 0, gallons: 0 };
  const mi = f.gallons * 6.5;
  const tot = p.totalCost + f.fuel;
  return {
    ...p,
    fuel: f.fuel,
    gallons: f.gallons,
    miles: mi,
    combined: tot,
    cpm:      mi > 0 ? tot / mi : null,
    lCPM:     mi > 0 ? p.totalCost / mi : null,
    fCPM:     mi > 0 ? f.fuel / mi : null,
  };
});

// ── HELPERS ───────────────────────────────────────────────────
const fd = (n, d = 2) => {
  if (n == null || isNaN(n) || !isFinite(n)) return "—";
  return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
};
const fn = (n, d = 1) => {
  if (n == null || isNaN(n)) return "—";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
};
const fp = n => (n == null || isNaN(n)) ? "—" : Number(n).toFixed(1) + "%";

const cpmColor = c => {
  if (c == null) return "#5a6370";
  if (c < 2.5)  return "#3ddc84";
  if (c < 3.2)  return "#f5c542";
  return "#ff5252";
};


// ── STYLES ────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=IBM+Plex+Mono:wght@400;500&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #0b0d10; --s1: #12151c; --s2: #181c26; --bd: #1f2535;
  --or: #f47820; --or2: #c45e10; --orl: rgba(244,120,32,.12);
  --ye: #f5c542; --gn: #3ddc84; --rd: #ff5252; --bl: #4fc3f7; --pu: #b39ddb;
  --tx: #e8eaf0; --mu: #5a6370;
  --f1: 'IBM Plex Mono', monospace; --f2: 'Barlow Condensed', sans-serif;
}
body { background: var(--bg); color: var(--tx); font-family: var(--f1); }
.app { display: flex; flex-direction: column; min-height: 100vh; }

/* header */
.hdr { background: var(--s1); border-bottom: 2px solid var(--or); height: 52px;
  display: flex; align-items: center; padding: 0 22px; gap: 14px; }
.logo { font-family: var(--f2); font-size: 22px; font-weight: 900; letter-spacing: 3px; color: var(--or); }
.logo b { color: var(--ye); font-weight: 900; }
.hsub { font-size: 10px; color: var(--mu); letter-spacing: 2px; text-transform: uppercase;
  border-left: 1px solid var(--bd); padding-left: 12px; }
.hbdg { margin-left: auto; display: flex; gap: 7px; }
.bdg { font-size: 9px; letter-spacing: 1px; text-transform: uppercase; padding: 3px 8px;
  border-radius: 2px; border: 1px solid; }
.bdg-o { background: var(--orl); color: var(--or); border-color: var(--or); }
.bdg-g { background: rgba(61,220,132,.1); color: var(--gn); border-color: rgba(61,220,132,.4); }

/* nav */
.nav { background: var(--s1); border-bottom: 1px solid var(--bd); display: flex; padding: 0 22px; overflow-x: auto; }
.ntab { background: none; border: none; border-bottom: 3px solid transparent;
  color: var(--mu); font-family: var(--f2); font-size: 13px; font-weight: 700;
  letter-spacing: 1px; text-transform: uppercase; padding: 12px 16px;
  cursor: pointer; transition: all .15s; white-space: nowrap; }
.ntab:hover { color: var(--tx); }
.ntab.on { color: var(--or); border-bottom-color: var(--or); }

/* per-load slider */
.pl-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 10px;
  border-radius: 5px; background: var(--bd); outline: none; cursor: pointer; }
.pl-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none;
  width: 24px; height: 24px; border-radius: 50%; background: var(--or);
  border: 3px solid var(--tx); cursor: pointer; box-shadow: 0 0 8px rgba(0,0,0,.5); }
.pl-slider::-moz-range-thumb { width: 24px; height: 24px; border-radius: 50%;
  background: var(--or); border: 3px solid var(--tx); cursor: pointer; }
.pl-slider::-webkit-slider-runnable-track { height: 10px; border-radius: 5px; }
.pl-sticky { position: sticky; top: 0; z-index: 50; }
@keyframes pl-pulse { 0%{box-shadow:0 0 0 0 var(--pulse-col)} 70%{box-shadow:0 0 0 12px transparent} 100%{box-shadow:0 0 0 0 transparent} }
.pl-verdict-pulse { animation: pl-pulse .6s ease-out; }

/* layout */
.main { flex: 1; padding: 22px 32px; max-width: 1400px; width: 100%; margin: 0 auto; }
.ptitle { font-family: var(--f2); font-size: 32px; font-weight: 900; letter-spacing: 2px;
  text-transform: uppercase; margin-bottom: 3px; }
.psub { font-size: 10px; color: var(--mu); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 20px; }

/* grids */
.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.g3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
.g4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }

/* cards */
.card { background: var(--s1); border: 1px solid var(--bd); border-radius: 4px; padding: 18px; }
.ctit { font-family: var(--f2); font-size: 11px; font-weight: 700; letter-spacing: 3px;
  text-transform: uppercase; color: var(--or); margin-bottom: 14px; }

/* kpi tiles */
.kpi { background: var(--s2); border: 1px solid var(--bd); border-radius: 3px; padding: 13px 15px; }
.klbl { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: var(--mu); margin-bottom: 4px; }
.kval { font-family: var(--f2); font-size: 24px; font-weight: 800; line-height: 1; }
.ksub { font-size: 10px; color: var(--mu); margin-top: 3px; }

/* metric blocks */
.met { background: var(--bg); border: 1px solid var(--bd); border-radius: 3px; padding: 13px; margin-bottom: 9px; }
.mlbl { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: var(--mu); margin-bottom: 3px; }
.mval { font-family: var(--f2); font-size: 26px; font-weight: 800; line-height: 1.1; }
.msub { font-size: 10px; color: var(--mu); margin-top: 2px; }

/* inputs */
.fld { margin-bottom: 11px; }
.lbl { display: block; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: var(--mu); margin-bottom: 4px; }
.inp { width: 100%; background: var(--bg); border: 1px solid var(--bd); border-radius: 3px;
  color: var(--tx); font-family: var(--f1); font-size: 12px; padding: 8px 10px; outline: none; }
.inp:focus { border-color: var(--or); }
.inp:disabled { opacity: 0.4; cursor: not-allowed; }
select.inp { cursor: pointer; }
.row2 { display: flex; gap: 10px; }
.row2 .fld { flex: 1; margin-bottom: 0; }

/* buttons */
.btn { background: var(--or); color: #fff; border: none; border-radius: 3px;
  font-family: var(--f2); font-size: 13px; font-weight: 700; letter-spacing: 2px;
  text-transform: uppercase; padding: 10px 20px; cursor: pointer; width: 100%; }
.btn:hover { background: var(--or2); }
.btn:disabled { background: var(--bd); color: var(--mu); cursor: not-allowed; }
.btn-o { background: transparent; border: 1px solid var(--or); color: var(--or); }
.btn-o:hover { background: var(--orl); }

/* progress bar */
.bar { height: 5px; background: var(--bd); border-radius: 3px; overflow: hidden; margin-top: 6px; }
.bfil { height: 100%; border-radius: 3px; }

/* stacked bar */
.sbar { display: flex; height: 24px; border-radius: 3px; overflow: hidden; margin: 8px 0; }
.sseg { display: flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 700; letter-spacing: 1px; color: #fff; overflow: hidden; }

/* tag */
.tag { display: inline-block; font-size: 9px; font-weight: 700; letter-spacing: 2px;
  text-transform: uppercase; padding: 2px 7px; border-radius: 2px; margin-top: 4px; }

/* table */
.tbl { width: 100%; border-collapse: collapse; font-size: 11px; }
.tbl th { background: var(--s2); color: var(--mu); font-family: var(--f2); font-size: 9px;
  font-weight: 700; letter-spacing: 2px; text-transform: uppercase; padding: 8px 9px;
  text-align: right; border-bottom: 1px solid var(--bd); white-space: nowrap; }
.tbl th:first-child, .tbl th:nth-child(2) { text-align: left; }
.tbl td { padding: 6px 9px; border-bottom: 1px solid var(--bd); text-align: right; }
.tbl td:first-child, .tbl td:nth-child(2) { text-align: left; }
.tbl tr:hover td { background: var(--s2); }
.tbl tfoot td { background: var(--s2); font-family: var(--f2); font-weight: 700;
  font-size: 11px; color: var(--or); border-top: 1px solid var(--or); }

/* info boxes */
.ibox { background: var(--orl); border: 1px solid rgba(244,120,32,.35); border-radius: 3px;
  padding: 11px 14px; font-size: 11px; line-height: 1.7; margin-bottom: 14px; }
.sbox { background: rgba(79,195,247,.06); border: 1px solid rgba(79,195,247,.2); border-radius: 3px;
  padding: 9px 13px; font-size: 10px; color: var(--mu); line-height: 1.8; margin-bottom: 14px; }

/* AI output */
.aiout { background: var(--bg); border: 1px solid var(--bd); border-left: 3px solid var(--or);
  border-radius: 3px; padding: 16px; font-size: 12px; line-height: 1.9;
  white-space: pre-wrap; margin-top: 12px; }
.spinner { display: flex; align-items: center; gap: 8px; color: var(--mu);
  font-size: 10px; letter-spacing: 2px; text-transform: uppercase; margin-top: 10px; }
.spinner span { animation: pulse 1.2s infinite; color: var(--or); font-size: 16px; }
.spinner span:nth-child(2) { animation-delay: .2s; }
.spinner span:nth-child(3) { animation-delay: .4s; }
@keyframes pulse { 0%,80%,100%{opacity:.1} 40%{opacity:1} }

hr { border: none; border-top: 1px solid var(--bd); margin: 14px 0; }

/* gauge */
.gauge { text-align: center; padding: 14px 0; }
.gval { font-family: var(--f2); font-size: 56px; font-weight: 900; line-height: 1; }
.glbl { font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: var(--mu); margin-top: 5px; }

/* empty state */
.empty { display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; padding: 50px; opacity: .35; }
.empty-icon { font-size: 44px; }
.empty-text { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; }

@media (max-width: 700px) {
  .g2, .g3, .g4 { grid-template-columns: 1fr; }
  .main { padding: 14px; }
  .hbdg { display: none; }
}
`;




// ── MONTHLY MILEAGE DATA (Samsara, per month) ────────────────
let MONTHLY_MILES = [
  { m:"Jan", local:21061.8, regional:62297.1, total:83358.9,
    trucks:{"120":{l:735.8,r:9478.5,t:10214.3},"937":{l:168.4,r:8775.7,t:8944.0},"951":{l:1092.9,r:7033.4,t:8126.3},"728":{l:1150.7,r:6177.9,t:7328.6},"731":{l:1194.8,r:5833.1,t:7027.9},"574":{l:1366.0,r:5571.6,t:6937.6},"738":{l:1181.2,r:4762.9,t:5944.1},"149":{l:913.3,r:3773.4,t:4686.7},"476":{l:1413.0,r:2894.3,t:4307.3},"676":{l:2393.2,r:1566.8,t:3960.0},"568":{l:2066.3,r:1799.0,t:3865.3},"20":{l:2928.4,r:471.7,t:3400.0},"730":{l:832.3,r:2308.5,t:3140.8},"577":{l:1329.6,r:1537.7,t:2867.2},"573":{l:1252.3,r:312.7,t:1565.0},"589":{l:985.5,r:0.0,t:985.5},"127":{l:58.2,r:0.0,t:58.2}} },
  { m:"Feb", local:15497.6, regional:50279.4, total:65777.0,
    trucks:{"539":{l:1022.9,r:7378.4,t:8401.3},"120":{l:677.2,r:7520.8,t:8198.0},"951":{l:1093.3,r:5237.7,t:6331.0},"577":{l:1031.1,r:4856.4,t:5887.6},"738":{l:719.4,r:4825.6,t:5545.0},"568":{l:1205.8,r:4316.3,t:5522.1},"728":{l:998.8,r:3636.6,t:4635.4},"730":{l:512.5,r:3673.7,t:4186.2},"476":{l:1123.0,r:2824.7,t:3947.7},"574":{l:990.1,r:2012.9,t:3003.0},"573":{l:1759.9,r:541.9,t:2301.8},"731":{l:657.7,r:1432.3,t:2090.0},"149":{l:442.0,r:1476.7,t:1918.6},"676":{l:1716.4,r:0.0,t:1716.4},"20":{l:1307.1,r:0.0,t:1307.1},"441":{l:214.3,r:545.3,t:759.7},"127":{l:26.1,r:0.0,t:26.1}} },
  { m:"Mar", local:25107.3, regional:97602.6, total:122710.0,
    trucks:{"127":{l:1064.3,r:6811.8,t:7876.1},"568":{l:1116.2,r:6644.1,t:7760.3},"418":{l:817.8,r:6205.3,t:7023.1},"120":{l:872.3,r:6150.5,t:7022.8},"417":{l:737.1,r:5906.2,t:6643.3},"731":{l:1138.8,r:5469.5,t:6608.3},"577":{l:797.3,r:5274.5,t:6071.8},"738":{l:616.1,r:4888.0,t:5504.0},"728":{l:773.2,r:4624.2,t:5397.4},"463":{l:508.8,r:4843.3,t:5352.0},"496":{l:374.5,r:4586.7,t:4961.2},"441":{l:1613.8,r:3235.6,t:4849.4},"574":{l:778.6,r:3922.3,t:4701.0},"730":{l:602.0,r:4059.5,t:4661.5},"573":{l:1847.6,r:2614.7,t:4462.4},"149":{l:692.0,r:3462.2,t:4154.2},"440":{l:1821.9,r:2253.9,t:4075.8},"419":{l:735.0,r:3161.2,t:3896.2},"20":{l:1830.0,r:1725.4,t:3555.4},"353":{l:1152.3,r:2310.3,t:3462.6},"569":{l:1716.7,r:1551.9,t:3268.5},"951":{l:1507.3,r:1681.9,t:3189.1},"502":{l:287.4,r:1510.4,t:1797.7},"189":{l:338.8,r:1154.9,t:1493.7},"476":{l:295.8,r:1124.0,t:1419.8},"462":{l:99.8,r:1081.1,t:1180.9},"570":{l:773.1,r:0.0,t:773.1},"402":{l:79.4,r:508.7,t:588.1},"498":{l:37.8,r:375.3,t:413.1},"510":{l:73.0,r:278.2,t:351.2},"539":{l:8.8,r:187.1,t:196.0}} },
];


// ── TRUCK TYPE DATA ───────────────────────────────────────────
const TRUCK_TYPE = {
  "568":"Sleeper","728":"Sleeper","730":"Sleeper","731":"Sleeper",
  "738":"Sleeper","149":"Sleeper","574":"Sleeper","120":"Sleeper",
  "127":"Sleeper","417":"Sleeper","418":"Sleeper",
  "476":"Sleeper","539":"Sleeper","577":"Sleeper","937":"Sleeper",
  "20":"Day Cab","951":"Day Cab","353":"Day Cab","440":"Day Cab",
  "441":"Day Cab","569":"Day Cab","570":"Day Cab","573":"Day Cab",
  "676":"Day Cab",
  "189":"Box Truck",
  // New trucks (2026)
  "419":"Sleeper","462":"Sleeper","463":"Sleeper","496":"Sleeper","502":"Sleeper",
  "510":"Sleeper","498":"Sleeper","869":"Sleeper","402":"Sleeper",
  "508":"Sleeper","870":"Sleeper",
  // Idealease (INTL) trucks — added Jun 2026
  "669":"Sleeper","673":"Sleeper","674":"Sleeper","685":"Sleeper","686":"Sleeper",
  "971":"Sleeper",  // Penske temp (Jun 2026) — active:false in TRUCK_MILES
  // 589 returned 1/14/2026 — removed from active fleet
};

// ── SAMSARA MILEAGE DATA ──────────────────────────────────────
// Source: Samsara Vehicle Mileage report (manually dropped into
// incoming-freightiq/ each week). Run `python scripts/parse_samsara_mileage.py`
// to regenerate MILES + TRUCK_COUNT + FLEET_LOCAL + FLEET_REGIONAL + TRUCK_MILES.
// Local = NV; Regional = everything else.
let TRUCK_MILES = [
  { truck:"120", local:4154.8, regional:37925.9, miles:42080.6, states:{"CA":24595.3,"NV":4154.8,"AZ":2692.8,"TX":1638.4,"NM":1494.8,"OK":1259.1,"UT":1044.6,"GA":1032.1,"AR":1017.5,"AL":991.4,"MS":663.7,"CO":552.6,"TN":407.8,"LA":399.3,"SC":136.6} },
  { truck:"496", local:3330.2, regional:29036.4, miles:32366.7, states:{"CA":21909.9,"NV":3330.2,"AZ":2299.1,"UT":2078.6,"CO":1111.8,"TX":888.4,"NM":748.6} },
  { truck:"568", local:6456.6, regional:23912.8, miles:30369.4, states:{"CA":18479.2,"NV":6456.6,"AZ":4680.3,"UT":753.2} },
  { truck:"418", local:3707.5, regional:26391.1, miles:30098.6, states:{"CA":26391.1,"NV":3707.5} },
  { truck:"419", local:3785.9, regional:26168.0, miles:29953.9, states:{"CA":23291.2,"NV":3785.9,"AZ":1536.9,"UT":727.7,"CO":612.2} },
  { truck:"417", local:3538.8, regional:24883.7, miles:28422.5, states:{"CA":24300.7,"NV":3538.8,"AZ":583.0} },
  { truck:"502", local:2972.7, regional:23060.5, miles:26033.2, states:{"CA":21971.2,"NV":2972.7,"AZ":1089.3} },
  { truck:"127", local:3353.3, regional:22299.4, miles:25652.7, states:{"CA":21104.5,"NV":3353.3,"UT":623.5,"AZ":571.4} },
  { truck:"441", local:7272.2, regional:17919.5, miles:25191.7, states:{"CA":17919.5,"NV":7272.2} },
  { truck:"402", local:2764.1, regional:22094.4, miles:24858.5, states:{"CA":19693.6,"NV":2764.1,"AZ":1117.2,"UT":728.3,"CO":555.3} },
  { truck:"869", local:305.0, regional:24200.8, miles:24505.8, states:{"TN":4244.0,"VA":2484.9,"GA":2170.7,"PA":1684.6,"IL":1648.5,"FL":1348.7,"NY":1313.6,"WI":1230.3,"NJ":920.2,"NC":824.1,"TX":781.9,"AZ":761.3,"NM":755.0,"IN":556.7,"CA":464.8,"KY":464.7,"OK":334.4,"NV":305.0,"MD":297.4,"AR":288.8,"MN":278.8,"MS":202.5,"LA":192.8,"WV":182.8,"VT":175.5,"CT":167.2,"SC":115.6,"MA":109.8,"MO":106.5,"AL":70.7,"DE":23.9} },
  { truck:"951", local:7097.8, regional:17136.8, miles:24234.6, states:{"CA":16053.1,"NV":7097.8,"AZ":1083.7} },
  { truck:"508", local:3043.9, regional:18814.4, miles:21858.4, states:{"CA":17007.9,"NV":3043.9,"AZ":1149.7,"UT":656.8} },
  { truck:"574", local:4236.6, regional:16352.2, miles:20588.8, states:{"CA":15339.6,"NV":4236.6,"AZ":1012.6} },
  { truck:"577", local:4296.6, regional:15391.6, miles:19688.2, states:{"CA":13093.8,"NV":4296.6,"AZ":2297.8} },
  { truck:"870", local:2050.5, regional:16747.4, miles:18797.9, states:{"CA":14848.5,"NV":2050.5,"UT":1248.2,"AZ":650.7} },
  { truck:"498", local:1999.1, regional:16114.8, miles:18113.9, states:{"CA":14474.6,"NV":1999.1,"AZ":1640.2} },
  { truck:"573", local:9366.8, regional:8058.2, miles:17425.0, states:{"NV":9366.8,"CA":8058.2} },
  { truck:"728", local:2922.7, regional:14438.8, miles:17361.5, states:{"CA":11505.6,"AZ":2933.2,"NV":2922.7} , active:false },
  { truck:"738", local:2516.6, regional:14476.5, miles:16993.1, states:{"CA":13218.9,"NV":2516.6,"AZ":638.1,"UT":619.4} , active:false },
  { truck:"731", local:2991.3, regional:12734.9, miles:15726.2, states:{"CA":11120.1,"NV":2991.3,"AZ":1614.8} , active:false },
  { truck:"020", local:12376.5, regional:3176.2, miles:15552.7, states:{"NV":12376.5,"CA":3176.2} },
  { truck:"510", local:1447.9, regional:13511.0, miles:14959.0, states:{"CA":13511.0,"NV":1447.9} },
  { truck:"674", local:0.0, regional:13999.3, miles:13999.3, states:{"GA":4022.7,"FL":3282.1,"TN":2011.7,"KY":1032.5,"IN":954.4,"VA":578.7,"LA":343.6,"NJ":240.2,"MD":236.4,"NC":236.0,"OH":235.3,"MI":168.7,"MS":162.4,"IL":149.7,"AL":133.5,"SC":108.6,"NY":36.9,"DC":33.0,"DE":32.9} },
  { truck:"685", local:0.0, regional:13756.0, miles:13756.0, states:{"GA":5151.0,"FL":2527.2,"TN":2076.0,"AL":1456.1,"MS":674.0,"SC":451.6,"KY":428.9,"NC":390.3,"LA":358.3,"OH":242.7} },
  { truck:"440", local:6963.9, regional:5501.6, miles:12465.5, states:{"NV":6963.9,"CA":4969.7,"AZ":531.9} },
  { truck:"353", local:3999.5, regional:8275.8, miles:12275.4, states:{"CA":8275.8,"NV":3999.5} },
  { truck:"673", local:0.0, regional:12248.2, miles:12248.2, states:{"GA":3756.2,"TN":1962.9,"SC":1018.3,"WV":936.3,"KY":864.4,"PA":849.8,"AL":596.3,"NC":558.0,"IN":556.3,"NJ":313.3,"MD":229.7,"VA":175.0,"MS":156.5,"LA":121.9,"IL":110.8,"NY":42.4} },
  { truck:"569", local:7463.2, regional:4648.2, miles:12111.4, states:{"NV":7463.2,"CA":4648.2} },
  { truck:"730", local:1946.8, regional:10041.7, miles:11988.5, states:{"CA":10041.7,"NV":1946.8} , active:false },
  { truck:"463", local:1111.7, regional:10683.1, miles:11794.8, states:{"CA":7323.7,"TX":1311.0,"AZ":1297.9,"NV":1111.7,"NM":750.6} , active:false },
  { truck:"669", local:0.0, regional:11249.2, miles:11249.2, states:{"GA":2678.6,"TN":2199.2,"NC":792.7,"FL":758.5,"VA":714.6,"SC":681.6,"IL":579.1,"KY":535.5,"WV":446.7,"AL":299.1,"IN":282.6,"MS":256.7,"MD":248.5,"PA":233.9,"NJ":226.2,"LA":173.8,"WI":68.4,"NY":33.7,"DE":32.9,"OH":6.8} },
  { truck:"570", local:8064.9, regional:2921.7, miles:10986.6, states:{"NV":8064.9,"CA":2921.7} },
  { truck:"149", local:2047.3, regional:8712.3, miles:10759.6, states:{"CA":8712.3,"NV":2047.3} , active:false },
  { truck:"476", local:2831.8, regional:6843.0, miles:9674.8, states:{"CA":6270.1,"NV":2831.8,"AZ":572.9} , active:false },
  { truck:"686", local:0.0, regional:9381.3, miles:9381.3, states:{"GA":3118.4,"TN":1896.2,"FL":1811.7,"VA":1319.0,"MD":403.5,"NJ":244.6,"NC":236.9,"PA":166.4,"SC":107.0,"WV":26.1,"NY":19.9,"DE":19.5,"DC":12.2} },
  { truck:"937", local:168.4, regional:8775.7, miles:8944.0, states:{"TX":1691.9,"CA":1176.2,"AZ":959.1,"AL":649.9,"LA":584.1,"NM":542.5,"MS":472.8,"OK":455.8,"GA":451.8,"MO":297.6,"MD":294.4,"VA":276.9,"OH":227.5,"NV":168.4,"IL":160.9,"IN":159.9,"NC":127.5,"SC":107.9,"WV":83.9,"PA":55.2} , active:false },
  { truck:"539", local:1031.8, regional:7565.5, miles:8597.4, states:{"CA":2853.6,"NV":1031.8,"AZ":934.4,"GA":700.1,"OK":669.3,"NM":635.8,"AR":575.8,"AL":384.9,"TX":355.3,"MS":264.8,"SC":165.3,"TN":26.2} , active:false },
  { truck:"676", local:4109.6, regional:1566.8, miles:5676.4, states:{"NV":4109.6,"CA":1566.8} , active:false },
  { truck:"971", local:1359.5, regional:3928.6, miles:5288.1, states:{"CA":1827.1,"NV":1359.5,"UT":794.2,"MT":667.9,"ID":533.2,"AZ":57.7,"WA":48.6} , active:false },
  { truck:"675", local:206.1, regional:3811.0, miles:4017.1, states:{"CA":473.0,"CO":454.1,"KS":424.8,"AZ":409.9,"NM":374.3,"UT":365.0,"OK":331.3,"AR":285.9,"NV":206.1,"AL":189.6,"TX":177.1,"MS":131.8,"MO":101.9,"GA":80.1,"TN":12.2} , active:false },
  { truck:"114", local:43.6, regional:2816.7, miles:2860.3, states:{"TX":898.9,"CA":474.3,"AZ":374.2,"LA":252.9,"AL":212.8,"FL":191.2,"GA":167.4,"NM":166.2,"MS":78.8,"NV":43.6} , active:false },
  { truck:"503", local:350.4, regional:2509.3, miles:2859.7, states:{"AZ":1325.1,"CA":1184.2,"NV":350.4} , active:false },
  { truck:"189", local:801.6, regional:1154.9, miles:1956.5, states:{"CA":1154.9,"NV":801.6} },
  { truck:"351", local:526.2, regional:730.1, miles:1256.2, states:{"CA":730.1,"NV":526.2} , active:false },
  { truck:"462", local:99.8, regional:1081.1, miles:1180.9, states:{"CA":1081.1,"NV":99.8} , active:false },
  { truck:"589", local:985.5, regional:0.0, miles:985.5, states:{"NV":985.5} , active:false },
  { truck:"968", local:42.1, regional:667.5, miles:709.6, states:{"CA":667.5,"NV":42.1} , active:false },
  { truck:"488", local:0.0, regional:31.8, miles:31.8, states:{"GA":31.8} , active:false },
];
let FLEET_LOCAL    = 140141.1;   // NV miles
let FLEET_REGIONAL = 597746.0;   // non-NV miles

// ── TRANSACTION DETAIL DATA ──────────────────────────────────
const DETAIL = {
  labor: {
    label: "Labor — Driver Payroll",
    thru: null,  // derived from PERIOD_END at render time
    note: "All-in employer cost: gross wages + SS + Medicare + NV SUI + FUTA + 401K match. Live from PAYROLL constant.",
    live: "client",  // rendered from DRIVERS array, no API fetch needed
    total: LABOR,
    cols: ["Driver", "Hours", "Employer Cost"],
    rows: DRIVERS.map(d => [d.name, d.hours.toFixed(2), d.totalCost]),
  },
  fuel: {
    label: "Fuel — EFS (per driver)",
    thru: null,
    note: "From EFS fuel card export only — NOT QuickBooks. Per-driver totals from live FUEL{} mapping.",
    live: "client",
    total: FUEL_TOT,
    cols: ["Driver", "Amount", "Gallons", "Avg $/Gal"],
    rows: Object.entries(FUEL)
      .filter(([,v]) => v.fuel > 0)
      .sort((a,b) => b[1].fuel - a[1].fuel)
      .map(([name, v]) => [name, v.fuel, v.gallons, v.gallons > 0 ? v.fuel / v.gallons : 0]),
  },
  insurance: {
    label: "Insurance — SF Truck Insurance",
    thru: null,
    note: "SF Truck Insurance only (CPM). Live from QuickBooks transaction detail.",
    live: "qbo",
    total: INS_TOT,
    cols: ["Date", "Vendor", "Amount"],
    rows: [
      ["Jan 2",  "SF Truck Insurance",  6375.00],
      ["Jan 9",  "SF Truck Insurance",  6375.00],
      ["Jan 16", "SF Truck Insurance",  6375.00],
      ["Jan 23", "SF Truck Insurance",  6375.00],
      ["Feb 4",  "SF Truck Insurance",  6375.00],
      ["Feb 11", "SF Truck Insurance",  6375.00],
      ["Feb 18", "SF Truck Insurance",  6375.00],
      ["Feb 25", "SF Truck Insurance",  6375.00],
      ["Mar 6",  "SF Truck Insurance",  6375.00],
      ["Mar 10", "Triumph Insurance",    467.44],
      ["Mar 13", "SF Truck Insurance",  6375.00],
      ["Mar 20", "SF Truck Insurance",  6375.00],
      ["Mar 27", "SF Truck Insurance",  6375.00],
      ["Mar 31", "Triumph Insurance",    7236.00],
      ["Apr 10", "People's Premium Finance", 18641.80],
    ],
  },
  trucks: {
    label: "Truck Payments",
    thru: null,
    note: "QuickBooks: Truck Rentals — Penske + TEC/Transco + TCI + Ryder. Live from QBO transaction detail.",
    live: "qbo",
    total: TRUCK_TOT,
    cols: ["Date", "Vendor", "Amount"],
    rows: [
      ["Jan 10", "Penske",                    7585.26],
      ["Jan 15", "TEC / Transco Leasing",    17985.00],
      ["Jan 26", "TEC / Transco Leasing",    28775.80],
      ["Jan 29", "TCI",                       2125.17],
      ["Jan 29", "Mercury Insurance (credit)",-6787.25],
      ["Feb 4",  "TCI",                       1982.88],
      ["Feb 6",  "TCI",                       1510.38],
      ["Feb 9",  "TCI",                       1005.75],
      ["Feb 10", "TCI",                       4740.45],
      ["Feb 10", "Penske",                    8141.36],
      ["Feb 11", "TCI",                       1326.38],
      ["Feb 17", "TEC / Transco Leasing",    42912.69],
      ["Feb 18", "TCI",                       1259.23],
      ["Feb 25", "TEC / Transco Leasing",     1544.93],
      ["Mar 10", "Penske",                    9386.35],
      ["Mar 18", "TCI",                       2225.32],
      ["Mar 19", "Ryder Truck Rentals",       7200.00],
      ["Mar 25", "TEC / Transco Leasing",    27724.37],
      ["Mar 27", "TCI",                      16947.18],
      ["Apr 10", "Penske",                    7957.68],
    ],
  },
  trailers: {
    label: "Trailer Payments",
    thru: null,
    note: "QuickBooks: McKinney + Xtra + Utility + Premier + Boxwheel + Ten Trailer. Live from QBO transaction detail.",
    live: "qbo",
    total: TRAILER_TOT,
    cols: ["Date", "Vendor", "Amount"],
    rows: [
      ["Jan 7",  "Utility Trailers",         2520.00],
      ["Jan 13", "Boxwheel Trailer Leasing",  876.73],
      ["Jan 24", "Xtra Lease",               4222.31],
      ["Feb 3",  "McKinney Trailer Rentals",  2000.00],
      ["Feb 4",  "McKinney Trailer Rentals",  2000.00],
      ["Feb 4",  "Utility Trailers",          2520.00],
      ["Feb 6",  "McKinney Trailer Rentals",  2000.00],
      ["Feb 11", "McKinney Trailer Rentals",  2000.00],
      ["Feb 12", "McKinney Trailer Rentals",  4000.00],
      ["Feb 17", "McKinney Trailer Rentals",  5137.31],
      ["Feb 18", "McKinney Trailer Rentals",  1638.99],
      ["Feb 18", "Utility Trailers",          2520.00],
      ["Feb 21", "Xtra Lease",               6238.26],
      ["Mar 6",  "McKinney Trailer Rentals", 10888.77],
      ["Mar 7",  "Xtra Lease",               1141.55],
      ["Mar 14", "Premier Trailers",          1402.12],
      ["Mar 18", "McKinney Trailer Rentals", 12189.24],
      ["Mar 21", "Xtra Lease",               5362.39],
      ["Mar 24", "Ten Trailer Leasing",       2171.98],
      ["Apr 2",  "McKinney Trailer Rentals", 2455.03],
      ["Apr 3",  "Ten Trailer Leasing",      2574.90],
    ],
  },
  truckMaint: {
    label: "Truck Maintenance",
    thru: null,
    note: "Live from QBO transaction detail.",
    live: "qbo",
    total: TRUCK_MAINT,
    cols: ["Date", "Vendor", "Amount"],
    rows: [
      ["Jan 21", "Prime Washing",                       387.00],
      ["Feb 2",  "U.S. AutoForce",                      140.33],
      ["Feb 5",  "U.S. AutoForce (credit)",            -140.33],
      ["Feb 10", "Titan Auto Glass",                    398.00],
      ["Feb 11", "City to City Towing",                 800.00],
      ["Feb 12", "Canos Batteries",                     201.91],
      ["Feb 18", "Dahnifu Watson",                      917.00],
      ["Feb 18", "U.S. AutoForce",                      503.18],
      ["Feb 20", "U.S. AutoForce (credit)",            -503.18],
      ["Feb 25", "TZ Parts",                            490.90],
      ["Mar 5",  "eBay",                                179.74],
      ["Mar 11", "San Francisco Heavy Equipment",       674.26],
    ],
  },
  trailerMaint: {
    label: "Trailer Maintenance",
    thru: null,
    note: "Live from QBO transaction detail.",
    live: "qbo",
    total: TRAIL_MAINT,
    cols: ["Date", "Vendor", "Amount"],
    rows: [
      ["Feb 20", "TravelCenters of America", 3734.48],
      ["Mar 6",  "MKD Express LLC",           405.23],
      ["Apr 7",  "MKD Express LLC",           452.18],
    ],
  },
  uniforms: {
    label: "Worker Uniforms",
    thru: null,
    note: "Unifirst monthly service + Safety Guard Shoe. Live from QBO transaction detail.",
    live: "qbo",
    total: UNIFORMS,
    cols: ["Date", "Vendor", "Amount"],
    rows: [
      ["Jan 1",  "Unifirst Corporation",   1772.85],
      ["Jan 31", "Unifirst Corporation",    774.93],
      ["Feb 28", "Unifirst Corporation",   1361.73],
      ["Mar 5",  "Safety Guard Shoe",      1354.59],
      ["Apr 1",  "Unifirst Corporation",  1188.16],
    ],
  },
  storage: {
    label: "Storage / Parking",
    thru: null,
    note: "Live from QBO transaction detail.",
    live: "qbo",
    total: STORAGE,
    cols: ["Date", "Vendor", "Amount"],
    rows: [
      ["Jan 9",  "Total Transportation",    3100.00],
      ["Jan 14", "Storage on Wheels",         270.94],
      ["Jan 16", "Storage on Wheels",          97.54],
      ["Feb 9",  "Total Transportation",     3100.00],
      ["Feb 9",  "Parking Service Center",    105.95],
      ["Feb 16", "Storage on Wheels",         270.94],
      ["Feb 17", "Storage on Wheels",          97.54],
      ["Mar 9",  "Total Transportation",     3100.00],
      ["Mar 16", "Storage on Wheels",         270.94],
      ["Mar 31", "Citation Permits Processing", 203.50],
      ["Mar 31", "SFMTA",                      105.00],
      ["Apr 9",  "Total Transportation",     3100.00],
    ],
  },
};

// ── TABS ──────────────────────────────────────────────────────
const TABS = [
  { id: "overview", icon: "🏢", label: "Fleet Overview" },
  { id: "basiccpm", icon: "🧮", label: "CPM Calculator" },
  { id: "perload",  icon: "📦", label: "Per Load CPM" },
  { id: "revenue", icon: "📊", label: "Revenue" },
  { id: "driver",   icon: "🚛", label: "Driver Detail" },
  { id: "trucks",   icon: "📍", label: "Trucks & Mileage" },
  { id: "fuel",     icon: "🛢", label: "Fuel Analysis" },
  { id: "trucks2",  icon: "🚛", label: "Trucks" },
  { id: "trailers", icon: "🚜", label: "Trailers" },
  { id: "office",   icon: "🏢", label: "Office Staff" },
  { id: "income",  icon: "💵", label: "Income" },
  { id: "ceeast",   icon: "🏦", label: "CE East" },
  { id: "atl",      icon: "🍑", label: "ATL Ops" },
  { id: "ar",       icon: "📋", label: "A/R" },
  { id: "otr",      icon: "🛣️", label: "OTR Ops" },
  { id: "cashflow", icon: "💰", label: "Cash Flow" },
  { id: "budget",   icon: "📋", label: "Budgeting" },
  { id: "settings", icon: "📂", label: "Upload" },
  { id: "checklist", icon: "✅", label: "Checklist" },
];


// ── DETAIL MODAL ──────────────────────────────────────────────
function DetailModal({ id, onClose }) {
  const [liveRows, setLiveRows] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState(null);

  // Fetch QBO transaction detail when a QBO-sourced bucket opens. Client-side
  // buckets (labor, fuel) render from their static rows derived from live arrays.
  useEffect(() => {
    if (!id) { setLiveRows(null); setLiveError(null); return; }
    const d = DETAIL[id];
    if (!d || d.live !== "qbo") return;
    setLiveLoading(true); setLiveError(null); setLiveRows(null);
    fetch(`/api/qbo-detail?bucket=${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setLiveError(data.error); return; }
        setLiveRows(data.rows || []);
      })
      .catch(e => setLiveError(e.message || String(e)))
      .finally(() => setLiveLoading(false));
  }, [id]);

  if (!id) return null;
  const d = DETAIL[id];
  if (!d) return null;

  const isMoney = v => typeof v === "number" && (Math.abs(v) > 1 || v === 0);
  const isDriver = id === "labor";

  // Resolve the rows + columns to render:
  //   - "client" buckets (labor, fuel): always render static rows derived
  //     from live arrays (DRIVERS / FUEL{}).
  //   - "qbo" buckets: show empty (with loading message) until liveRows
  //     arrives, then show those. Falls back to static only on hard error.
  //     Never flash the stale May-2 hardcoded rows while loading.
  let displayRows = d.rows;
  let displayCols = d.cols;
  if (d.live === "qbo") {
    if (liveRows) {
      displayRows = liveRows.map(r => [r.date, r.vendor, r.memo || "", r.amount]);
      displayCols = ["Date", "Vendor", "Memo", "Amount"];
    } else if (liveLoading || !liveError) {
      // Loading (or just-opened, before fetch resolves): show empty with
      // the "Loading live transactions…" placeholder row instead of stale rows.
      displayRows = [];
      displayCols = ["Date", "Vendor", "Memo", "Amount"];
    }
    // liveError + no liveRows: fall through to d.rows (static fallback)
  }

  const thruLabel = d.thru || (typeof PERIOD_END === "string" ? PERIOD_END : "");

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,.75)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: "var(--s1)", border: "1px solid var(--bd)", borderRadius: 6,
        width: "100%", maxWidth: isDriver ? 900 : 600,
        maxHeight: "85vh", display: "flex", flexDirection: "column",
        boxShadow: "0 24px 60px rgba(0,0,0,.6)",
      }} onClick={e => e.stopPropagation()}>

        {/* Modal header */}
        <div style={{
          padding: "16px 22px", borderBottom: "1px solid var(--bd)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontFamily: "var(--f2)", fontSize: 18, fontWeight: 800,
              letterSpacing: 2, textTransform: "uppercase", color: "var(--or)" }}>
              {d.label}
            </div>
            <div style={{ fontSize: 10, color: "var(--mu)", letterSpacing: 2,
              textTransform: "uppercase", marginTop: 3 }}>
              through {thruLabel}
              {liveLoading && <span style={{ marginLeft: 10, color: "var(--bl)" }}>● loading live…</span>}
              {liveError && <span style={{ marginLeft: 10, color: "var(--ye)" }}>● live fetch failed — showing static</span>}
              {liveRows && !liveLoading && <span style={{ marginLeft: 10, color: "var(--gn)" }}>● live QBO</span>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, color: "var(--mu)", letterSpacing: 2, textTransform: "uppercase" }}>Total</div>
              <div style={{ fontFamily: "var(--f2)", fontSize: 24, fontWeight: 800, color: "var(--ye)" }}>{fd(d.total, 0)}</div>
            </div>
            <button onClick={onClose} style={{
              background: "var(--s2)", border: "1px solid var(--bd)", borderRadius: 3,
              color: "var(--mu)", cursor: "pointer", fontSize: 16, padding: "4px 10px",
              fontFamily: "var(--f1)",
            }}>✕</button>
          </div>
        </div>

        {/* Note */}
        {d.note && (
          <div style={{
            padding: "8px 22px", background: "var(--orl)",
            borderBottom: "1px solid rgba(244,120,32,.2)",
            fontSize: 11, color: "var(--tx)", flexShrink: 0,
          }}>
            {d.note}
          </div>
        )}

        {/* Table */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          <table className="tbl" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                {displayCols.map(c => <th key={c} style={{ position: "sticky", top: 0, background: "var(--s2)", textAlign: c === displayCols[0] || c === "Driver" || c === "Vendor" || c === "Description" || c === "Card" || c === "Date" || c === "Memo" ? "left" : "right" }}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {displayRows.length === 0 && (
                <tr><td colSpan={displayCols.length} style={{ textAlign:"center", color:"var(--mu)", padding:"24px" }}>
                  {liveLoading ? "Loading live transactions…" : "No transactions for this period"}
                </td></tr>
              )}
              {displayRows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => {
                    const isAmt = typeof cell === "number";
                    const isNeg = isAmt && cell < 0;
                    return (
                      <td key={j} style={{
                        textAlign: j === 0 || (typeof cell === "string" && j > 0 && !isAmt) ? "left" : "right",
                        color: isNeg ? "#ff5252" : isAmt ? (j === row.length - 1 ? "var(--ye)" : "var(--tx)") : "var(--tx)",
                        fontWeight: isAmt && j === row.length - 1 ? 600 : 400,
                        background: i % 2 === 0 ? "var(--s2)" : "transparent",
                      }}>
                        {isAmt ? fd(cell, cell % 1 === 0 ? 0 : 2) : cell}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                {displayCols.map((c, j) => (
                  <td key={c} style={{ textAlign: j === 0 ? "left" : "right" }}>
                    {j === 0 ? "TOTAL" : j === displayCols.length - 1 ? fd(d.total, 0) : ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}


// ── TRUCKS & MILEAGE ──────────────────────────────────────────
function TrucksMileage() {
  const [expanded, setExpanded] = useState(null);
  const [sortKey, setSortKey]   = useState("miles");
  const [filter, setFilter]     = useState("all");
  const [view, setView]         = useState("detail"); // detail | trend

  // Static-only as of June 2026 (Samsara API retired — manual Vehicle Mileage
  // xlsx drop, parsed via scripts/parse_samsara_mileage.py each week).
  const activeTrucks   = TRUCK_MILES;
  const activeLocal    = FLEET_LOCAL;
  const activeRegional = FLEET_REGIONAL;
  const activeTotal    = MILES;
  const activeFleetCount = TRUCK_MILES.filter(t => t.active !== false).length; // 30 currently in service
  const loggedCount      = TRUCK_MILES.length;                                  // 43 that ran YTD (incl departed)
  const activeLabel    = `Samsara Vehicle Mileage · ${PERIOD} · ${activeFleetCount} active (${loggedCount} ran YTD)`;

  const sorted = useMemo(() => {
    const arr = [...activeTrucks];
    if (sortKey === "miles")    return arr.sort((a,b) => b.miles    - a.miles);
    if (sortKey === "local")    return arr.sort((a,b) => b.local    - a.local);
    if (sortKey === "regional") return arr.sort((a,b) => b.regional - a.regional);
    if (sortKey === "truck")    return arr.sort((a,b) => Number(a.truck) - Number(b.truck));
    if (sortKey === "localPct") return arr.sort((a,b) => (b.local/b.miles) - (a.local/a.miles));
    return arr;
  }, [sortKey, activeTrucks]);

  const STATE_COLORS = {
    CA:"#f47820",NV:"#4fc3f7",AZ:"#3ddc84",TX:"#f5c542",OR:"#b39ddb",
    UT:"#a78bfa",NM:"#ff8a65",GA:"#26a69a",AR:"#ef5350",OK:"#ab47bc",
    AL:"#66bb6a",TN:"#29b6f6",MS:"#ff7043",LA:"#8d6e63",SC:"#ec407a",
    WV:"#78909c",VA:"#5c6bc0",MD:"#26c6da",OH:"#d4e157",NC:"#ffa726",
    IN:"#42a5f5",PA:"#7e57c2",IL:"#26a69a",MO:"#ff7043",
  };
  const getColor = (st, i) => STATE_COLORS[st] || `hsl(${(i*47)%360},60%,55%)`;

  const localPct    = activeLocal    / activeTotal * 100;
  const regionalPct = activeRegional / activeTotal * 100;
  const truckCount  = loggedCount;  // avg-per-truck divides by trucks that LOGGED miles (43), since the cumulative total includes departed trucks' miles

  return (
    <div>
      <div className="ptitle">Trucks + Mileage</div>
      <div className="psub">{activeLabel} · NV = Local · All other states = Regional</div>

      {/* Fleet summary KPIs */}
      <div className="g4" style={{ marginBottom:14 }}>
        <div className="kpi">
          <div className="klbl">Total Fleet Miles</div>
          <div className="kval" style={{ color:"#4fc3f7" }}>{fn(activeTotal,0)}</div>
          <div className="ksub">{activeFleetCount} active · {loggedCount} ran YTD</div>
        </div>
        <div className="kpi">
          <div className="klbl">Local Miles (NV)</div>
          <div className="kval" style={{ color:"#3ddc84" }}>{fn(activeLocal,0)}</div>
          <div className="ksub">{fp(localPct)} of fleet</div>
        </div>
        <div className="kpi">
          <div className="klbl">Regional Miles</div>
          <div className="kval" style={{ color:"#f47820" }}>{fn(activeRegional,0)}</div>
          <div className="ksub">{fp(regionalPct)} of fleet</div>
        </div>
        <div className="kpi">
          <div className="klbl">Avg Miles / Truck</div>
          <div className="kval" style={{ color:"#f5c542" }}>{fn(activeTotal/truckCount,0)}</div>
          <div className="ksub">{fn(activeLocal/truckCount,0)} local · {fn(activeRegional/truckCount,0)} regional</div>
        </div>
      </div>

      {/* Local vs Regional stacked bar */}
      <div className="card" style={{ marginBottom:14 }}>
        <div className="ctit">Local vs Regional Split — Fleet Total</div>
        <div className="sbar" style={{ height:32, marginBottom:10 }}>
          <div className="sseg" style={{ width:`${localPct}%`, background:"#3ddc84", fontSize:11, fontWeight:700 }}>
            Local (NV) {fp(localPct)}
          </div>
          <div className="sseg" style={{ width:`${regionalPct}%`, background:"#f47820", fontSize:11, fontWeight:700 }}>
            Regional {fp(regionalPct)}
          </div>
        </div>
        <div style={{ display:"flex", gap:24, fontSize:11 }}>
          <span><span style={{ color:"#3ddc84" }}>■</span> Local (NV): {fn(activeLocal,0)} mi</span>
          <span><span style={{ color:"#f47820" }}>■</span> Regional (all other states): {fn(activeRegional,0)} mi</span>
          <span style={{ color:"var(--mu)" }}>Total: {fn(activeTotal,0)} mi</span>
        </div>
      </div>

      {/* View toggle */}
      <div style={{ display:"flex",gap:8,marginBottom:14 }}>
        {[["detail","🚛 Per-Truck Detail"],["trend","📈 Monthly Trend"],["type","🏷️ Day Cab vs Sleeper"]].map(([id,lbl]) => (
          <button key={id} onClick={() => setView(id)} style={{
            padding:"7px 16px", borderRadius:3, cursor:"pointer",
            fontFamily:"var(--f2)", fontSize:12, fontWeight:700,
            letterSpacing:1, textTransform:"uppercase",
            background: view===id ? "var(--or)" : "transparent",
            color:       view===id ? "#fff"     : "var(--mu)",
            border:      `1px solid ${view===id ? "var(--or)" : "var(--bd)"}`,
          }}>{lbl}</button>
        ))}
      </div>

      {/* Monthly Trend View */}
      {view === "trend" && (
        <>
          {/* Fleet monthly totals chart */}
          <div className="card" style={{ marginBottom:14 }}>
            <div className="ctit">Fleet Monthly Mileage — Local vs Regional</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={MONTHLY_MILES} margin={{ top:8,right:10,left:10,bottom:5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" />
                <XAxis dataKey="m" tick={{ fill:"var(--mu)",fontSize:11 }} />
                <YAxis tick={{ fill:"var(--mu)",fontSize:9 }} tickFormatter={v=>fn(v,0)+" mi"} />
                <Tooltip formatter={(v,n) => [fn(v,0)+" mi", n]} contentStyle={{ background:"var(--s2)",border:"1px solid var(--bd)",borderRadius:3 }} labelStyle={{ color:"var(--or)",fontFamily:"var(--f2)",fontWeight:700 }} />
                <Bar dataKey="local"    name="Local (NV)"  fill="#3ddc84" stackId="a" radius={[0,0,0,0]} />
                <Bar dataKey="regional" name="Regional"    fill="#f47820" stackId="a" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display:"flex",gap:24,fontSize:11,color:"var(--mu)",marginTop:8 }}>
              {MONTHLY_MILES.map(m => (
                <div key={m.m} style={{ textAlign:"center",flex:1 }}>
                  <div style={{ fontSize:9,color:"var(--mu)",letterSpacing:2,textTransform:"uppercase" }}>{m.m}</div>
                  <div style={{ fontFamily:"var(--f2)",fontSize:13,fontWeight:800,color:"var(--tx)" }}>{fn(m.total,0)}</div>
                  <div style={{ fontSize:10,color:"#3ddc84" }}>{fp(m.local/m.total*100)} local</div>
                  <div style={{ fontSize:10,color:"#f47820" }}>{fp(m.regional/m.total*100)} regional</div>
                </div>
              ))}
            </div>
          </div>

          {/* Per-truck monthly table */}
          <div className="card">
            <div className="ctit">Per-Truck Monthly Mileage — Local · Regional · Total</div>
            <div style={{ overflowX:"auto" }}>
              <table className="tbl" style={{ fontSize:11 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign:"left" }}>Truck</th>
                    {MONTHLY_MILES.map(m => (
                      <th key={m.m} colSpan={3} style={{ textAlign:"center",borderLeft:"1px solid var(--bd)" }}>{m.m}</th>
                    ))}
                  </tr>
                  <tr>
                    <th style={{ textAlign:"left",color:"var(--mu)",fontSize:9 }}></th>
                    {MONTHLY_MILES.map(m => (
                      <>
                        <th key={m.m+"l"} style={{ color:"#3ddc84",fontWeight:600,borderLeft:"1px solid var(--bd)",fontSize:9 }}>Local</th>
                        <th key={m.m+"r"} style={{ color:"#f47820",fontWeight:600,fontSize:9 }}>Regional</th>
                        <th key={m.m+"t"} style={{ color:"var(--tx)",fontWeight:700,fontSize:9 }}>Total</th>
                      </>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...new Set(MONTHLY_MILES.flatMap(m => Object.keys(m.trucks)))].sort((a,b)=>+a-+b).map((truck,i) => (
                    <tr key={truck} style={{ background:i%2===0?"var(--s2)":"transparent" }}>
                      <td style={{ fontWeight:700,color:"var(--or)",fontFamily:"var(--f2)",fontSize:14,letterSpacing:1 }}>#{truck}</td>
                      {MONTHLY_MILES.map(m => {
                        const v = m.trucks[truck];
                        return v ? (
                          <>
                            <td key={m.m+"l"} style={{ color:"#3ddc84",borderLeft:"1px solid var(--bd)" }}>{fn(v.l,0)}</td>
                            <td key={m.m+"r"} style={{ color:"#f47820" }}>{fn(v.r,0)}</td>
                            <td key={m.m+"t"} style={{ fontWeight:600 }}>{fn(v.t,0)}</td>
                          </>
                        ) : (
                          <>
                            <td key={m.m+"l"} style={{ color:"var(--mu)",borderLeft:"1px solid var(--bd)" }}>—</td>
                            <td key={m.m+"r"} style={{ color:"var(--mu)" }}>—</td>
                            <td key={m.m+"t"} style={{ color:"var(--mu)" }}>—</td>
                          </>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={{ fontWeight:700 }}>FLEET</td>
                    {MONTHLY_MILES.map(m => (
                      <>
                        <td key={m.m+"l"} style={{ color:"#3ddc84",fontWeight:700,borderLeft:"1px solid var(--bd)" }}>{fn(m.local,0)}</td>
                        <td key={m.m+"r"} style={{ color:"#f47820",fontWeight:700 }}>{fn(m.regional,0)}</td>
                        <td key={m.m+"t"} style={{ fontWeight:800 }}>{fn(m.total,0)}</td>
                      </>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Day Cab vs Sleeper view */}
      {view === "type" && (() => {
        const sleepers = TRUCK_MILES.filter(t => TRUCK_TYPE[t.truck] === "Sleeper");
        const daycabs  = TRUCK_MILES.filter(t => TRUCK_TYPE[t.truck] === "Day Cab");
        const boxes    = TRUCK_MILES.filter(t => TRUCK_TYPE[t.truck] === "Box Truck");
        const ext      = TRUCK_MILES.filter(t => !TRUCK_TYPE[t.truck]);

        const sum = (arr, key) => arr.reduce((s,t) => s + t[key], 0);
        const groups = [
          { label:"Sleeper",         trucks:sleepers, color:"#4fc3f7", icon:"🛏️" },
          { label:"Day Cab",         trucks:daycabs,  color:"#3ddc84", icon:"🚛" },
          { label:"Box Truck",       trucks:boxes,    color:"#b39ddb", icon:"📦" },
          { label:"External/Untagged",trucks:ext,     color:"#5a6370", icon:"❓" },
        ].filter(g => g.trucks.length > 0);

        return (
          <>
            {/* Hero summary */}
            <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14 }}>
              {groups.map(g => {
                const mi    = sum(g.trucks,"miles");
                const local = sum(g.trucks,"local");
                const reg   = sum(g.trucks,"regional");
                return (
                  <div key={g.label} style={{
                    background:"var(--s1)",border:`1px solid ${g.color}40`,borderRadius:6,padding:"18px 16px",
                  }}>
                    <div style={{ fontSize:9,letterSpacing:3,textTransform:"uppercase",color:g.color,marginBottom:4 }}>{g.icon} {g.label}</div>
                    <div style={{ fontFamily:"var(--f2)",fontSize:32,fontWeight:900,color:g.color }}>{fn(mi,0)}</div>
                    <div style={{ fontSize:10,color:"var(--mu)",marginTop:4 }}>{g.trucks.length} truck{g.trucks.length>1?"s":""} · {fp(mi/MILES*100)} of fleet</div>
                    <div style={{ display:"flex",gap:10,marginTop:8,fontSize:10 }}>
                      <span style={{ color:"#3ddc84" }}>NV {fn(local,0)}</span>
                      <span style={{ color:"#f47820" }}>Reg {fn(reg,0)}</span>
                    </div>
                    <div className="bar" style={{ marginTop:6 }}>
                      <div className="bfil" style={{ width:`${mi/MILES*100}%`,background:g.color }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Stacked comparison bar */}
            <div className="card" style={{ marginBottom:14 }}>
              <div className="ctit">Miles by Truck Type — All Time</div>
              <div className="sbar" style={{ height:32,marginBottom:10 }}>
                {groups.map(g => {
                  const mi = sum(g.trucks,"miles");
                  const pct = mi/MILES*100;
                  return (
                    <div key={g.label} className="sseg"
                      style={{ width:`${pct}%`,background:g.color,fontSize:11,fontWeight:700,minWidth:4 }}>
                      {pct > 8 ? `${g.label} ${fp(pct)}` : ""}
                    </div>
                  );
                })}
              </div>
              <div style={{ display:"flex",gap:20,fontSize:11,flexWrap:"wrap" }}>
                {groups.map(g => {
                  const mi = sum(g.trucks,"miles");
                  return (
                    <span key={g.label}>
                      <span style={{ color:g.color }}>■</span> {g.label}: {fn(mi,0)} mi ({fp(mi/MILES*100)})
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Monthly Day Cab vs Sleeper chart */}
            {(() => {
              const typeData = MONTHLY_MILES.map(m => {
                let sleeper = 0, daycab = 0, box = 0;
                Object.entries(m.trucks).forEach(([trk, v]) => {
                  const t = v.t || 0;
                  const typ = TRUCK_TYPE[trk];
                  if (typ === "Sleeper") sleeper += t;
                  else if (typ === "Day Cab") daycab += t;
                  else if (typ === "Box Truck") box += t;
                });
                return { m: m.m, sleeper, daycab, box, total: m.total };
              });
              return (
                <div className="card" style={{ marginBottom:14 }}>
                  <div className="ctit">Fleet Monthly Mileage — Day Cab vs Sleeper</div>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={typeData} margin={{ top:8,right:10,left:10,bottom:5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" />
                      <XAxis dataKey="m" tick={{ fill:"var(--mu)",fontSize:11 }} />
                      <YAxis tick={{ fill:"var(--mu)",fontSize:9 }} tickFormatter={v=>fn(v,0)+" mi"} />
                      <Tooltip formatter={(v,n) => [fn(v,0)+" mi", n]} contentStyle={{ background:"var(--s2)",border:"1px solid var(--bd)",borderRadius:3 }} labelStyle={{ color:"var(--or)",fontFamily:"var(--f2)",fontWeight:700 }} />
                      <Bar dataKey="sleeper" name="Sleeper"   fill="#4fc3f7" stackId="a" radius={[0,0,0,0]} />
                      <Bar dataKey="daycab"  name="Day Cab"   fill="#3ddc84" stackId="a" radius={[0,0,0,0]} />
                      <Bar dataKey="box"     name="Box Truck"  fill="#b39ddb" stackId="a" radius={[2,2,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ display:"flex",gap:24,fontSize:11,color:"var(--mu)",marginTop:8 }}>
                    {typeData.map(m => (
                      <div key={m.m} style={{ textAlign:"center",flex:1 }}>
                        <div style={{ fontSize:9,color:"var(--mu)",letterSpacing:2,textTransform:"uppercase" }}>{m.m}</div>
                        <div style={{ fontFamily:"var(--f2)",fontSize:13,fontWeight:800,color:"var(--tx)" }}>{fn(m.total,0)}</div>
                        <div style={{ fontSize:10,color:"#4fc3f7" }}>{fp(m.sleeper/m.total*100)} sleeper · {fn(m.sleeper,0)}</div>
                        <div style={{ fontSize:10,color:"#3ddc84" }}>{fp(m.daycab/m.total*100)} day cab · {fn(m.daycab,0)}</div>
                        {m.box > 0 && <div style={{ fontSize:10,color:"#b39ddb" }}>{fp(m.box/m.total*100)} box · {fn(m.box,0)}</div>}
                      </div>
                    ))}
                  </div>
                  <div style={{ display:"flex",gap:20,fontSize:11,marginTop:10 }}>
                    <span><span style={{ color:"#4fc3f7" }}>■</span> Sleeper</span>
                    <span><span style={{ color:"#3ddc84" }}>■</span> Day Cab</span>
                    <span><span style={{ color:"#b39ddb" }}>■</span> Box Truck</span>
                  </div>
                </div>
              );
            })()}

            {/* Per-group truck tables */}
            {groups.filter(g=>g.label!=="External/Untagged").map(g => (
              <div key={g.label} className="card" style={{ marginBottom:14 }}>
                <div className="ctit" style={{ color:g.color }}>{g.icon} {g.label} Trucks — {g.trucks.length} units · {fn(sum(g.trucks,"miles"),0)} total miles</div>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th style={{ textAlign:"left" }}>Truck</th>
                      <th style={{ color:"#3ddc84" }}>Local (NV)</th>
                      <th style={{ color:"#3ddc84" }}>Local %</th>
                      <th style={{ color:"#f47820" }}>Regional</th>
                      <th style={{ color:"#f47820" }}>Regional %</th>
                      <th>Total Miles</th>
                      <th>Split</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...g.trucks].sort((a,b)=>b.miles-a.miles).map((t,i) => {
                      const lp = t.miles>0 ? t.local/t.miles*100 : 0;
                      return (
                        <tr key={t.truck} style={{ background:i%2===0?"var(--s2)":"transparent" }}>
                          <td style={{ fontWeight:700,color:g.color,fontFamily:"var(--f2)",fontSize:16,letterSpacing:1 }}>#{t.truck}</td>
                          <td style={{ color:"#3ddc84",fontWeight:600 }}>{fn(t.local,0)}</td>
                          <td style={{ color:"#3ddc84" }}>{fp(lp)}</td>
                          <td style={{ color:"#f47820",fontWeight:600 }}>{fn(t.regional,0)}</td>
                          <td style={{ color:"#f47820" }}>{fp(100-lp)}</td>
                          <td style={{ fontWeight:700 }}>{fn(t.miles,0)}</td>
                          <td style={{ width:120 }}>
                            <div style={{ display:"flex",height:10,borderRadius:2,overflow:"hidden" }}>
                              <div style={{ width:`${lp}%`,background:"#3ddc84",minWidth:lp>0?2:0 }} />
                              <div style={{ width:`${100-lp}%`,background:"#f47820",minWidth:(100-lp)>0?2:0 }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>TOTAL</td>
                      <td style={{ color:"#3ddc84" }}>{fn(sum(g.trucks,"local"),0)}</td>
                      <td style={{ color:"#3ddc84" }}>{fp(sum(g.trucks,"local")/sum(g.trucks,"miles")*100)}</td>
                      <td style={{ color:"#f47820" }}>{fn(sum(g.trucks,"regional"),0)}</td>
                      <td style={{ color:"#f47820" }}>{fp(sum(g.trucks,"regional")/sum(g.trucks,"miles")*100)}</td>
                      <td>{fn(sum(g.trucks,"miles"),0)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ))}

            {/* External trucks note */}
            {ext.length > 0 && (
              <div className="card">
                <div className="ctit" style={{ color:"#5a6370" }}>❓ Not on Company Truck List — {ext.length} units · {fn(sum(ext,"miles"),0)} mi</div>
                <div style={{ fontSize:11,color:"var(--mu)",marginBottom:10,lineHeight:1.7 }}>
                  Trucks {ext.map(t=>`#${t.truck}`).join(", ")} appear in Samsara but are not in the uploaded truck list. 
                  They may be owner-operators, leased units, or recently added trucks.
                </div>
                <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                  {[...ext].sort((a,b)=>b.miles-a.miles).map(t => (
                    <div key={t.truck} style={{ background:"var(--bg)",border:"1px solid var(--bd)",borderRadius:3,padding:"8px 14px",textAlign:"center" }}>
                      <div style={{ fontFamily:"var(--f2)",fontSize:16,fontWeight:800,color:"#5a6370" }}>#{t.truck}</div>
                      <div style={{ fontSize:11,color:"var(--mu)" }}>{fn(t.miles,0)} mi</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* Per-truck table — only show in detail view */}
      {view === "detail" && <div className="card">
        <div className="ctit" style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          Per-Truck Breakdown — click any row for state detail
          <select className="inp" style={{ width:"auto", fontSize:10, padding:"3px 7px" }}
            value={sortKey} onChange={e => setSortKey(e.target.value)}>
            <option value="miles">Sort: Total Miles</option>
            <option value="local">Sort: Local Miles</option>
            <option value="regional">Sort: Regional Miles</option>
            <option value="localPct">Sort: Local %</option>
            <option value="truck">Sort: Truck #</option>
          </select>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ textAlign:"center" }}>#</th>
                <th>Truck</th>
                <th style={{ color:"#3ddc84" }}>Local (NV)</th>
                <th style={{ color:"#3ddc84" }}>Local %</th>
                <th style={{ color:"#f47820" }}>Regional</th>
                <th style={{ color:"#f47820" }}>Regional %</th>
                <th>Total Miles</th>
                <th>Split</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t, i) => {
                const lPct = t.miles > 0 ? t.local / t.miles * 100 : 0;
                const rPct = 100 - lPct;
                const isOpen = expanded === t.truck;
                const states = Object.entries(t.states).sort((a,b) => b[1]-a[1]);
                return [
                  <tr key={t.truck}
                    onClick={() => setExpanded(isOpen ? null : t.truck)}
                    style={{ cursor:"pointer" }}>
                    <td style={{ textAlign:"center", color:"var(--mu)" }}>
                      {i < 3 ? ["🥇","🥈","🥉"][i] : i+1}
                    </td>
                    <td style={{ fontWeight:700, color:"var(--or)", fontFamily:"var(--f2)", fontSize:16, letterSpacing:1 }}>
                      #{t.truck}
                    </td>
                    <td style={{ color:"#3ddc84", fontWeight:600 }}>{t.local > 0 ? fn(t.local,0) : <span style={{ color:"var(--mu)" }}>—</span>}</td>
                    <td style={{ color:"#3ddc84" }}>{t.local > 0 ? fp(lPct) : "—"}</td>
                    <td style={{ color:"#f47820", fontWeight:600 }}>{t.regional > 0 ? fn(t.regional,0) : <span style={{ color:"var(--mu)" }}>—</span>}</td>
                    <td style={{ color:"#f47820" }}>{t.regional > 0 ? fp(rPct) : "—"}</td>
                    <td style={{ fontWeight:700 }}>{fn(t.miles,0)}</td>
                    <td style={{ width:120 }}>
                      <div style={{ display:"flex", height:10, borderRadius:2, overflow:"hidden" }}>
                        {t.local > 0 && <div style={{ width:`${lPct}%`, background:"#3ddc84", minWidth:2 }} />}
                        {t.regional > 0 && <div style={{ width:`${rPct}%`, background:"#f47820", minWidth:2 }} />}
                      </div>
                    </td>
                  </tr>,
                  isOpen && (
                    <tr key={t.truck + "-detail"}>
                      <td colSpan={8} style={{ padding:0 }}>
                        <div style={{ background:"var(--s2)", padding:"14px 16px", borderBottom:"1px solid var(--bd)" }}>
                          <div style={{ fontFamily:"var(--f2)", fontSize:13, fontWeight:700, letterSpacing:2,
                            textTransform:"uppercase", color:"var(--or)", marginBottom:12 }}>
                            Truck #{t.truck} — {fn(t.miles,0)} total mi · {fn(t.local,0)} local · {fn(t.regional,0)} regional
                          </div>
                          {/* Local / Regional summary */}
                          <div style={{ display:"flex", gap:10, marginBottom:12 }}>
                            <div style={{ background:"rgba(61,220,132,.1)", border:"1px solid rgba(61,220,132,.3)",
                              borderRadius:3, padding:"10px 16px", flex:1, textAlign:"center" }}>
                              <div style={{ fontSize:9, color:"#3ddc84", letterSpacing:2, textTransform:"uppercase", marginBottom:3 }}>Local (NV)</div>
                              <div style={{ fontFamily:"var(--f2)", fontSize:26, fontWeight:900, color:"#3ddc84" }}>{fn(t.local,0)}</div>
                              <div style={{ fontSize:10, color:"var(--mu)" }}>{fp(lPct)} of this truck</div>
                            </div>
                            <div style={{ background:"rgba(244,120,32,.1)", border:"1px solid rgba(244,120,32,.3)",
                              borderRadius:3, padding:"10px 16px", flex:1, textAlign:"center" }}>
                              <div style={{ fontSize:9, color:"var(--or)", letterSpacing:2, textTransform:"uppercase", marginBottom:3 }}>Regional</div>
                              <div style={{ fontFamily:"var(--f2)", fontSize:26, fontWeight:900, color:"var(--or)" }}>{fn(t.regional,0)}</div>
                              <div style={{ fontSize:10, color:"var(--mu)" }}>{fp(rPct)} of this truck</div>
                            </div>
                          </div>
                          {/* State pills */}
                          <div style={{ fontSize:10, color:"var(--mu)", letterSpacing:2, textTransform:"uppercase", marginBottom:8 }}>State Breakdown</div>
                          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                            {states.map(([st, mi], idx) => (
                              <div key={st} style={{
                                background:"var(--bg)", borderRadius:3, padding:"6px 12px",
                                border:`1px solid ${st==="NV"?"rgba(61,220,132,.4)":getColor(st,idx)+"40"}`,
                                minWidth:70, textAlign:"center",
                              }}>
                                <div style={{ fontSize:11, fontWeight:700, fontFamily:"var(--f2)",
                                  color: st==="NV" ? "#3ddc84" : getColor(st,idx), letterSpacing:1 }}>
                                  {st} {st==="NV"&&<span style={{ fontSize:8 }}>LOCAL</span>}
                                </div>
                                <div style={{ fontSize:12, color:"var(--tx)", fontWeight:600 }}>{fn(mi,0)}</div>
                                <div style={{ fontSize:9, color:"var(--mu)" }}>{fp(mi/t.miles*100)}</div>
                              </div>
                            ))}
                          </div>
                          {/* State bar */}
                          <div style={{ marginTop:10, height:12, display:"flex", borderRadius:3, overflow:"hidden" }}>
                            {states.map(([st, mi], idx) => (
                              <div key={st} title={`${st}: ${fn(mi,0)} mi`}
                                style={{ width:`${mi/t.miles*100}%`,
                                  background: st==="NV" ? "#3ddc84" : getColor(st,idx), minWidth:2 }} />
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                ].filter(Boolean);
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>FLEET TOTAL</td>
                <td style={{ color:"#3ddc84" }}>{fn(FLEET_LOCAL,0)}</td>
                <td style={{ color:"#3ddc84" }}>{fp(localPct)}</td>
                <td style={{ color:"#f47820" }}>{fn(FLEET_REGIONAL,0)}</td>
                <td style={{ color:"#f47820" }}>{fp(regionalPct)}</td>
                <td>{fn(MILES,0)}</td>
                <td>
                  <div style={{ display:"flex", height:10, borderRadius:2, overflow:"hidden" }}>
                    <div style={{ width:`${localPct}%`, background:"#3ddc84" }} />
                    <div style={{ width:`${regionalPct}%`, background:"#f47820" }} />
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>}
    </div>
  );
}



// ── BASIC CPM ─────────────────────────────────────────────────
function BasicCPM() {
  const lCPM = LABOR    / MILES;
  const fCPM = FUEL_TOT / MILES;
  const tCPM = TRUCK_TOT / MILES;
  const iCPM = INS_TOT  / MILES;

  return (
    <div>
      <div className="ptitle">CPM Calculator</div>
      <div className="psub">Basic (4 core costs) vs All-In (9 categories) · {fn(MILES,0)} Samsara miles</div>

      {/* Two CPM heroes */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
        <div style={{
          background:"linear-gradient(145deg,#1a1f2e 0%,#0f1118 100%)",
          border:"2px solid #3ddc84", borderRadius:6, padding:"28px 24px",
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
          textAlign:"center", boxShadow:"0 0 40px rgba(61,220,132,.12)",
          position:"relative", overflow:"hidden",
        }}>
          <div style={{ position:"absolute",inset:0,opacity:.04,
            backgroundImage:"repeating-linear-gradient(0deg,#3ddc84 0px,#3ddc84 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,#3ddc84 0px,#3ddc84 1px,transparent 1px,transparent 40px)" }} />
          <div style={{ fontSize:10,letterSpacing:4,textTransform:"uppercase",color:"#3ddc84",marginBottom:6,position:"relative" }}>Basic CPM</div>
          <div style={{ fontFamily:"var(--f2)",fontSize:80,fontWeight:900,lineHeight:1,color:"#3ddc84",position:"relative",textShadow:"0 0 60px rgba(61,220,132,.3)" }}>
            {fd(BASIC_CPM_V,3)}
          </div>
          <div style={{ fontSize:11,color:"var(--mu)",marginTop:10,position:"relative" }}>Labor · Fuel · Truck Rentals · Insurance</div>
          <div style={{ fontSize:10,color:"var(--mu)",marginTop:3,position:"relative" }}>{fd(BASIC_COST,0)} · {fn(MILES,0)} mi</div>
          <div className="tag tg" style={{ marginTop:10,fontSize:11,padding:"4px 14px",position:"relative" }}>4 core categories</div>
        </div>

        <div style={{
          background:"linear-gradient(145deg,#1f1a12 0%,#141008 100%)",
          border:"2px solid var(--or)", borderRadius:6, padding:"28px 24px",
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
          textAlign:"center", boxShadow:"0 0 40px rgba(244,120,32,.12)",
          position:"relative", overflow:"hidden",
        }}>
          <div style={{ position:"absolute",inset:0,opacity:.04,
            backgroundImage:"repeating-linear-gradient(0deg,var(--or) 0px,var(--or) 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,var(--or) 0px,var(--or) 1px,transparent 1px,transparent 40px)" }} />
          <div style={{ fontSize:10,letterSpacing:4,textTransform:"uppercase",color:"var(--or)",marginBottom:6,position:"relative" }}>All-In CPM</div>
          <div style={{ fontFamily:"var(--f2)",fontSize:80,fontWeight:900,lineHeight:1,color:"var(--or)",position:"relative",textShadow:"0 0 60px rgba(244,120,32,.25)" }}>
            {fd(ALLIN_CPM_V,3)}
          </div>
          <div style={{ fontSize:11,color:"var(--mu)",marginTop:10,position:"relative" }}>+ Trailers · Maint · Storage · Uniforms</div>
          <div style={{ fontSize:10,color:"var(--mu)",marginTop:3,position:"relative" }}>{fd(ALLIN_COST,0)} · +{fd(ALLIN_COST-BASIC_COST,0)} above basic</div>
          <div className="tag to" style={{ marginTop:10,fontSize:11,padding:"4px 14px",position:"relative" }}>9 categories · +{fd(ALLIN_CPM_V-BASIC_CPM_V,3)}/mi</div>
        </div>
      </div>

      <div className="g2" style={{ marginBottom:14 }}>
        {/* Left: cost breakdown */}
        <div className="card">
          <div className="ctit">Basic CPM — 4 Components</div>
          <div className="sbar" style={{ marginBottom:14 }}>
            <div className="sseg" style={{ width:`${LABOR/BASIC_COST*100}%`,    background:"#f47820" }}>Labor {fp(LABOR/BASIC_COST*100)}</div>
            <div className="sseg" style={{ width:`${FUEL_TOT/BASIC_COST*100}%`, background:"#c49a00",color:"#fff" }}>Fuel {fp(FUEL_TOT/BASIC_COST*100)}</div>
            <div className="sseg" style={{ width:`${TRUCK_TOT/BASIC_COST*100}%`,background:"#0288d1" }}>Trucks {fp(TRUCK_TOT/BASIC_COST*100)}</div>
            <div className="sseg" style={{ width:`${INS_TOT/BASIC_COST*100}%`,  background:"#7c5cbf" }}>Ins {fp(INS_TOT/BASIC_COST*100)}</div>
          </div>
          {[
            { label:"Labor",         val:LABOR,    cpm:lCPM, color:"#f47820", sub:ACTIVE_DRIVERS_COUNT + " drivers · all-in employer cost" },
            { label:"Fuel",          val:FUEL_TOT, cpm:fCPM, color:"#f5c542", sub:"EFS + Mudflap · "+fn(GALLONS,0)+" gal" },
            { label:"Truck Rentals", val:TRUCK_TOT,cpm:tCPM, color:"#4fc3f7", sub:"Penske + TEC/Transco + TCI" },
            { label:"Insurance",     val:INS_TOT,  cpm:iCPM, color:"#b39ddb", sub:"$"+fn(INS_WEEK,0)+"/wk · "+PERIOD_DAYS+"-day period" },
          ].map(item => (
            <div key={item.label} style={{
              background:"var(--bg)", border:"1px solid var(--bd)", borderRadius:3,
              padding:"12px 14px", marginBottom:8,
              display:"flex", justifyContent:"space-between", alignItems:"center",
            }}>
              <div>
                <div style={{ fontSize:9,letterSpacing:2,textTransform:"uppercase",color:"var(--mu)",marginBottom:2 }}>{item.label}</div>
                <div style={{ fontFamily:"var(--f2)",fontSize:20,fontWeight:800,color:item.color }}>{fd(item.val,0)}</div>
                <div style={{ fontSize:10,color:"var(--mu)",marginTop:2 }}>{item.sub}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontFamily:"var(--f2)",fontSize:26,fontWeight:900,color:item.color }}>{fd(item.cpm,3)}</div>
                <div style={{ fontSize:10,color:"var(--mu)" }}>per mile · {fp(item.val/BASIC_COST*100)}</div>
              </div>
            </div>
          ))}
          <div style={{
            background:"var(--orl)", border:"1px solid var(--or)", borderRadius:3,
            padding:"12px 14px", display:"flex", justifyContent:"space-between", alignItems:"center",
          }}>
            <div style={{ fontFamily:"var(--f2)",fontSize:13,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"var(--or)" }}>BASIC TOTAL</div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontFamily:"var(--f2)",fontSize:30,fontWeight:900,color:"#3ddc84" }}>{fd(BASIC_CPM_V,3)}</div>
              <div style={{ fontSize:10,color:"var(--mu)" }}>{fd(BASIC_COST,0)}</div>
            </div>
          </div>
        </div>

        {/* Right: margin targets + optional add-ons */}
        <div>
          <div className="card" style={{ marginBottom:14 }}>
            <div className="ctit">Rate/Mile Needed by Margin Target</div>
            {[10,15,20,25,30].map(pct => {
              const bNeeded = BASIC_CPM_V / (1 - pct/100);
              const aNeeded = ALLIN_CPM_V / (1 - pct/100);
              const col = pct>=20?"#3ddc84":pct>=15?"#f5c542":"var(--or)";
              return (
                <div key={pct} style={{ display:"flex", alignItems:"center", padding:"9px 0", borderBottom:"1px solid var(--bd)", gap:8 }}>
                  <div style={{ fontFamily:"var(--f2)",fontSize:20,fontWeight:800,color:"var(--mu)",width:80 }}>{pct}%</div>
                  <div style={{ flex:1, textAlign:"center" }}>
                    <div style={{ fontSize:9,color:"#3ddc84",letterSpacing:1,textTransform:"uppercase",marginBottom:2 }}>Basic</div>
                    <div style={{ fontFamily:"var(--f2)",fontSize:28,fontWeight:900,color:col }}>{fd(bNeeded,3)}</div>
                  </div>
                  <div style={{ width:1, background:"var(--bd)", alignSelf:"stretch" }} />
                  <div style={{ flex:1, textAlign:"center" }}>
                    <div style={{ fontSize:9,color:"var(--or)",letterSpacing:1,textTransform:"uppercase",marginBottom:2 }}>All-In</div>
                    <div style={{ fontFamily:"var(--f2)",fontSize:28,fontWeight:900,color:col }}>{fd(aNeeded,3)}</div>
                  </div>
                </div>
              );
            })}
          </div>


        </div>
      </div>

      {/* CPM Simulator */}
      <CpmSimulator />

    </div>
  );
}

function CpmSimulator() {
  const categories = [
    { key:"labor",    label:"Labor (Payroll)",     val:LABOR,       color:"#f47820" },
    { key:"fuel",     label:"Fuel (EFS + Mudflap)", val:FUEL_TOT,   color:"#f5c542" },
    { key:"trucks",   label:"Truck Rentals",        val:TRUCK_TOT,  color:"#4fc3f7" },
    { key:"trailers", label:"Trailer Rentals",      val:TRAILER_TOT,color:"#3ddc84" },
    { key:"ins",      label:"Insurance",            val:INS_TOT,    color:"#b39ddb" },
    { key:"tmaint",   label:"Truck Maintenance",    val:TRUCK_MAINT,color:"#ff8a65" },
    { key:"rmaint",   label:"Trailer Maintenance",  val:TRAIL_MAINT,color:"#26a69a" },
    { key:"storage",  label:"Storage / Parking",    val:STORAGE,    color:"#d97706" },
    { key:"uniforms", label:"Uniforms",             val:UNIFORMS,   color:"#ec407a" },
  ];

  const [selected, setSelected] = useState(() => {
    const init = {};
    categories.forEach(c => { init[c.key] = true; });
    return init;
  });

  const toggle = key => setSelected(prev => ({ ...prev, [key]: !prev[key] }));
  const selectAll = () => { const s = {}; categories.forEach(c => { s[c.key] = true; }); setSelected(s); };
  const selectNone = () => { const s = {}; categories.forEach(c => { s[c.key] = false; }); setSelected(s); };
  const selectBasic = () => {
    const s = {};
    categories.forEach(c => { s[c.key] = ["labor","fuel","trucks","ins"].includes(c.key); });
    setSelected(s);
  };

  const activeCats = categories.filter(c => selected[c.key]);
  const totalCost = activeCats.reduce((s,c) => s + c.val, 0);
  const cpm = MILES > 0 ? totalCost / MILES : 0;
  const activeCount = activeCats.length;

  return (
    <div style={{
      marginTop:14, padding:"24px", borderRadius:6,
      background:"linear-gradient(135deg,#0f1118,#12151c)",
      border:"2px solid #b39ddb40",
    }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
        <div>
          <div style={{ fontFamily:"var(--f2)",fontSize:18,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"#b39ddb" }}>
            CPM Simulator
          </div>
          <div style={{ fontSize:10,color:"var(--mu)",marginTop:2 }}>Pick any combination of cost categories to see the CPM impact</div>
        </div>
        <div style={{ display:"flex",gap:6 }}>
          {[
            ["All (9)", selectAll],
            ["Basic (4)", selectBasic],
            ["None", selectNone],
          ].map(([lbl, action]) => (
            <button key={lbl} onClick={action} style={{
              padding:"4px 12px",borderRadius:3,cursor:"pointer",
              fontFamily:"var(--f2)",fontSize:11,fontWeight:700,
              background:"transparent",color:"var(--mu)",
              border:"1px solid var(--bd)",
            }}>{lbl}</button>
          ))}
        </div>
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:20 }}>
        {/* Left: checkboxes */}
        <div>
          {categories.map(c => {
            const on = selected[c.key];
            const pct = totalCost > 0 ? c.val / totalCost * 100 : 0;
            return (
              <div key={c.key} onClick={() => toggle(c.key)} style={{
                display:"flex",alignItems:"center",gap:10,padding:"8px 10px",marginBottom:4,
                borderRadius:3,cursor:"pointer",
                background:on ? `${c.color}10` : "transparent",
                border:`1px solid ${on ? c.color+"40" : "var(--bd)"}`,
                opacity:on ? 1 : 0.4,
                transition:"all .15s",
              }}>
                <div style={{
                  width:18,height:18,borderRadius:3,flexShrink:0,
                  background:on ? c.color : "transparent",
                  border:`2px solid ${on ? c.color : "var(--mu)"}`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:11,color:"#fff",fontWeight:700,
                }}>{on ? "✓" : ""}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12,fontWeight:600,color:on ? "var(--tx)" : "var(--mu)" }}>{c.label}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:"var(--f2)",fontSize:14,fontWeight:700,color:on ? c.color : "var(--mu)" }}>{fd(c.val,0)}</div>
                  <div style={{ fontSize:9,color:"var(--mu)" }}>{fd(c.val/MILES,3)}/mi</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: result */}
        <div>
          {/* CPM hero */}
          <div style={{
            background:"rgba(0,0,0,.3)",border:"2px solid var(--or)",borderRadius:6,
            padding:"28px",textAlign:"center",marginBottom:14,
          }}>
            <div style={{ fontSize:9,letterSpacing:4,textTransform:"uppercase",color:"var(--or)",marginBottom:6 }}>
              Custom CPM — {activeCount} of 9
            </div>
            <div style={{ fontFamily:"var(--f2)",fontSize:72,fontWeight:900,color:cpmColor(cpm),lineHeight:1 }}>
              {activeCount > 0 ? fd(cpm,3) : "—"}
            </div>
            <div style={{ fontSize:11,color:"var(--mu)",marginTop:8 }}>
              {fd(totalCost,0)} / {fn(MILES,0)} mi
            </div>
          </div>

          {/* Active categories stacked bar */}
          {activeCount > 0 && (
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10,color:"var(--mu)",letterSpacing:2,textTransform:"uppercase",marginBottom:6 }}>Cost Composition</div>
              <div className="sbar" style={{ marginBottom:8 }}>
                {activeCats.map(c => {
                  const pct = c.val / totalCost * 100;
                  return (
                    <div key={c.key} className="sseg" style={{ width:`${pct}%`,background:c.color,fontSize:pct>8?9:0 }}>
                      {pct > 8 ? `${c.label.split(" ")[0]} ${fp(pct)}` : ""}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Comparison vs full all-in */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
            <div style={{ background:"var(--bg)",border:"1px solid var(--bd)",borderRadius:3,padding:"12px",textAlign:"center" }}>
              <div style={{ fontSize:9,color:"var(--mu)",letterSpacing:2,textTransform:"uppercase",marginBottom:4 }}>vs Basic (4)</div>
              <div style={{ fontFamily:"var(--f2)",fontSize:20,fontWeight:900,color:cpm>BASIC_CPM_V?"#ff5252":cpm<BASIC_CPM_V?"#3ddc84":"var(--mu)" }}>
                {cpm > BASIC_CPM_V ? "+" : ""}{activeCount>0 ? fd(cpm-BASIC_CPM_V,3) : "—"}
              </div>
              <div style={{ fontSize:10,color:"var(--mu)" }}>Basic: {fd(BASIC_CPM_V,3)}</div>
            </div>
            <div style={{ background:"var(--bg)",border:"1px solid var(--bd)",borderRadius:3,padding:"12px",textAlign:"center" }}>
              <div style={{ fontSize:9,color:"var(--mu)",letterSpacing:2,textTransform:"uppercase",marginBottom:4 }}>vs All-In (9)</div>
              <div style={{ fontFamily:"var(--f2)",fontSize:20,fontWeight:900,color:cpm>ALLIN_CPM_V?"#ff5252":cpm<ALLIN_CPM_V?"#3ddc84":"var(--mu)" }}>
                {cpm > ALLIN_CPM_V ? "+" : ""}{activeCount>0 ? fd(cpm-ALLIN_CPM_V,3) : "—"}
              </div>
              <div style={{ fontSize:10,color:"var(--mu)" }}>All-In: {fd(ALLIN_CPM_V,3)}</div>
            </div>
          </div>

          {/* Per-mile breakdown */}
          {activeCount > 0 && (
            <div style={{ marginTop:14 }}>
              <div style={{ fontSize:10,color:"var(--mu)",letterSpacing:2,textTransform:"uppercase",marginBottom:6 }}>Per-Mile Breakdown</div>
              {activeCats.map(c => (
                <div key={c.key} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0",borderBottom:"1px solid var(--bd)" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                    <div style={{ width:8,height:8,borderRadius:2,background:c.color }} />
                    <span style={{ fontSize:11,color:"var(--tx)" }}>{c.label}</span>
                  </div>
                  <span style={{ fontFamily:"var(--f2)",fontSize:12,fontWeight:700,color:c.color }}>{fd(c.val/MILES,3)}</span>
                </div>
              ))}
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:8 }}>
                <span style={{ fontFamily:"var(--f2)",fontSize:12,fontWeight:800,color:"var(--or)" }}>TOTAL CPM</span>
                <span style={{ fontFamily:"var(--f2)",fontSize:16,fontWeight:900,color:"var(--or)" }}>{fd(cpm,3)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PER LOAD CPM ─────────────────────────────────────────────
function PerLoadCPM() {
  // Live Alvys data
  const [alvys, setAlvys] = useState(null);
  useEffect(() => {
    fetch("/api/alvys-loads")
      .then(r => r.json())
      .then(d => { if (d.loads) setAlvys(d); })
      .catch(e => console.warn("Alvys fetch failed:", e));
  }, []);

  const costCategories = [
    { key:"labor",    label:"Labor",           val:LABOR,        color:"#f47820" },
    { key:"fuel",     label:"Fuel",            val:FUEL_TOT,     color:"#f5c542" },
    { key:"trucks",   label:"Truck Rentals",   val:TRUCK_TOT,    color:"#4fc3f7" },
    { key:"trailers", label:"Trailer Rentals", val:TRAILER_TOT,  color:"#3ddc84" },
    { key:"ins",      label:"Insurance",       val:INS_TOT,      color:"#b39ddb" },
  ];

  // Booking simulator state
  const [grossRev, setGrossRev] = useState(1846);
  const [miles, setMiles] = useState(386);
  const [roundtrip, setRoundtrip] = useState(false);
  const [trucks, setTrucks] = useState(1);
  const [laborHours, setLaborHours] = useState(10);
  const HOURLY_RATE = LABOR / TOTAL_HRS;   // blended loaded driver $/hr — derives from weekly LABOR + TOTAL_HRS so it never goes stale (was hardcoded $31.15; now ~$31.36)
  const [margin, setMargin] = useState(25);

  // Address-based mileage
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [routeStatus, setRouteStatus] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);

  const calcRoute = async () => {
    if (!origin.trim() || !dest.trim()) return;
    setRouteStatus("loading");
    try {
      const r = await fetch(`/api/distance?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Route calculation failed");
      setMiles(data.miles);
      setRouteInfo({ miles: data.miles, hours: data.hours, origin: data.origin, dest: data.destination });
      setRouteStatus("done");
    } catch (e) {
      setRouteStatus("error");
      setRouteInfo({ error: e.message });
    }
  };

  // CPM component selector — which fleet costs apply to this load
  const [selectedCosts, setSelectedCosts] = useState(() => {
    const init = {};
    costCategories.forEach(c => { init[c.key] = true; });
    return init; // Default: all 4 basic components
  });
  const toggleCost = key => setSelectedCosts(prev => ({ ...prev, [key]: !prev[key] }));
  const presetAll = () => {
    const s = {};
    costCategories.forEach(c => { s[c.key] = true; });
    setSelectedCosts(s);
  };
  const presetNone = () => {
    const s = {};
    costCategories.forEach(c => { s[c.key] = false; });
    setSelectedCosts(s);
  };

  // Derived calculations — per-truck miles, then multiply for fleet total
  const perTruckMiles = roundtrip ? miles * 2 : miles;
  const effectiveMiles = perTruckMiles * trucks;
  const totalRev = grossRev * trucks;
  const rpm = perTruckMiles > 0 ? grossRev / perTruckMiles : 0;

  // Fleet cost — labor is hours-based, rest is CPM-based
  const activeCats = costCategories.filter(c => selectedCosts[c.key]);
  const mileageCats = activeCats.filter(c => c.key !== "labor");
  const mileageTotal = mileageCats.reduce((s,c) => s + c.val, 0);
  const mileageCPM = MILES > 0 ? mileageTotal / MILES : 0;
  const laborCost = selectedCosts.labor ? laborHours * HOURLY_RATE * trucks : 0;
  const mileageCost = effectiveMiles * mileageCPM;
  const fleetCost = laborCost + mileageCost;
  const selectedCPM = effectiveMiles > 0 ? fleetCost / effectiveMiles : 0;
  const netProfit = totalRev - fleetCost;
  const netMarginCalc = totalRev > 0 ? (netProfit / totalRev) * 100 : 0;

  // Margin color
  const mCol = margin >= 25 ? "#3ddc84" : margin >= 15 ? "#f5c542" : "#ff5252";

  const breakevens = [100, 200, 300, 400, 500, 750, 1000, 1500];

  // Verdict based on net profit (revenue minus selected fleet costs)
  const verdictCol = netProfit > 0 && netMarginCalc >= 15 ? "#3ddc84" : netProfit > 0 ? "#f5c542" : "#ff5252";
  const verdictLabel = netProfit > 0 && netMarginCalc >= 15 ? "Good Load" : netProfit > 0 ? "Acceptable" : "Loses Money";
  const profitPerMile = effectiveMiles > 0 ? netProfit / effectiveMiles : 0;
  const minRevForTarget = margin < 100 ? fleetCost / (1 - margin / 100) : 0;
  const hitsTarget = netMarginCalc >= margin;
  const revBorderCol = hitsTarget ? "#3ddc84" : totalRev > fleetCost ? "#f5c542" : "#ff5252";

  // Pulse on verdict change
  const verdictRef = useRef(null);
  const prevVerdict = useRef(verdictLabel);
  useEffect(() => {
    if (prevVerdict.current !== verdictLabel && verdictRef.current) {
      verdictRef.current.classList.remove("pl-verdict-pulse");
      void verdictRef.current.offsetWidth; // reflow
      verdictRef.current.style.setProperty("--pulse-col", verdictCol + "60");
      verdictRef.current.classList.add("pl-verdict-pulse");
    }
    prevVerdict.current = verdictLabel;
  }, [verdictLabel, verdictCol]);

  // Mileage quick-compare
  const compareMiles = [200, 300, 400, 500, 750];

  const inputBox = (label, value, onChange, color, prefix, presets, presetFmt) => (
    <div style={{ position:"relative" }}>
      <span style={{ position:"absolute", left:14, top:8, fontSize:12, letterSpacing:2, textTransform:"uppercase",
        color, fontWeight:700, pointerEvents:"none", zIndex:1 }}>{label}</span>
      {prefix && <span style={{ position:"absolute", left:14, top:32, fontFamily:"var(--f2)", fontSize:20,
        fontWeight:700, color:"var(--mu)", pointerEvents:"none", zIndex:1 }}>{prefix}</span>}
      <input type="number" value={value} onChange={e => onChange(Number(e.target.value) || 0)}
        style={{ background:"var(--bg)", border:`2px solid ${color}60`, borderRadius:6,
          padding: prefix ? "32px 14px 12px 32px" : "32px 14px 12px 14px",
          color:"var(--tx)", fontFamily:"var(--f2)", fontSize:28, fontWeight:700,
          textAlign:"center", outline:"none", width:"100%",
          transition:"border-color .15s",
        }} />
      {presets && (
        <div style={{ display:"flex", gap:4, marginTop:8, flexWrap:"wrap" }}>
          {presets.map(v => (
            <button key={v} onClick={() => onChange(v)} style={{
              padding:"4px 10px", borderRadius:3, cursor:"pointer", fontSize:12, fontWeight:700,
              fontFamily:"var(--f2)",
              background: value === v ? color : "transparent",
              color: value === v ? (color==="#f5c542"?"#000":"#fff") : "var(--mu)",
              border:`1px solid ${value === v ? color : "var(--bd)"}`,
            }}>{presetFmt ? presetFmt(v) : v}</button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div className="ptitle">Per Load CPM</div>
      <div className="psub">Book loads with real-time margin analysis · Select cost components below · {PERIOD}</div>

      {/* ═══ STICKY BOOKING SIMULATOR ═══ */}
      <div className="pl-sticky" style={{
        padding:"20px 24px", borderRadius:8, marginBottom:14,
        background:"linear-gradient(135deg,#0f1118 0%,#12151c 100%)",
        border:`2px solid ${verdictCol}`,
        boxShadow:`0 0 40px ${verdictCol}20`,
        transition:"border-color .3s, box-shadow .3s",
      }}>

        {/* ── PROFIT HERO ── */}
        <div style={{ textAlign:"center", marginBottom:18 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:12 }}>
            <div style={{
              fontFamily:"var(--f2)", fontSize:72, fontWeight:900, lineHeight:1,
              color: verdictCol,
              textShadow:`0 0 40px ${verdictCol}40`,
            }}>
              {netProfit >= 0 ? "+" : ""}{fd(netProfit,0)}
            </div>
            <div style={{ textAlign:"left" }}>
              <div ref={verdictRef} style={{
                fontSize:14, fontWeight:800, letterSpacing:2, textTransform:"uppercase",
                color: verdictCol, padding:"5px 14px", borderRadius:3,
                background:`${verdictCol}18`, border:`1px solid ${verdictCol}40`,
                marginBottom:6,
              }}>{verdictLabel}</div>
              <div style={{ fontSize:14, color:"var(--mu)" }}>{fp(netMarginCalc)} margin · {activeCats.length} cost{activeCats.length!==1?"s":""} · {fd(selectedCPM,3)}/mi</div>
            </div>
          </div>
        </div>

        {/* ── LANE — origin & destination ── */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr auto", gap:10, marginBottom:14, alignItems:"end" }}>
          <div>
            <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:"#3ddc84", marginBottom:6, fontWeight:700 }}>Origin</div>
            <input type="text" value={origin} onChange={e => setOrigin(e.target.value)} placeholder="City, State or address"
              onKeyDown={e => e.key === "Enter" && calcRoute()}
              style={{ background:"var(--bg)", border:"1px solid var(--bd)", borderRadius:6, padding:"12px 14px",
                color:"var(--tx)", fontFamily:"var(--f1)", fontSize:14, outline:"none", width:"100%", transition:"border-color .15s" }} />
          </div>
          <div style={{ fontFamily:"var(--f2)", fontSize:24, fontWeight:900, color:"var(--mu)", paddingBottom:8 }}>{"\u2192"}</div>
          <div>
            <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:"#ff5252", marginBottom:6, fontWeight:700 }}>Destination</div>
            <input type="text" value={dest} onChange={e => setDest(e.target.value)} placeholder="City, State or address"
              onKeyDown={e => e.key === "Enter" && calcRoute()}
              style={{ background:"var(--bg)", border:"1px solid var(--bd)", borderRadius:6, padding:"12px 14px",
                color:"var(--tx)", fontFamily:"var(--f1)", fontSize:14, outline:"none", width:"100%", transition:"border-color .15s" }} />
          </div>
          <button onClick={calcRoute} style={{
            padding:"12px 24px", borderRadius:6, cursor:"pointer", border:"none",
            fontFamily:"var(--f2)", fontSize:14, fontWeight:800, letterSpacing:1, textTransform:"uppercase",
            background: routeStatus === "loading" ? "var(--bd)" : "var(--or)", color:"#fff", transition:"all .15s",
          }}>{routeStatus === "loading" ? "..." : "Calc Miles"}</button>
        </div>
        {routeInfo && routeStatus === "done" && (
          <div style={{ display:"flex", gap:16, alignItems:"center", marginBottom:14, padding:"10px 16px",
            background:"rgba(61,220,132,.06)", border:"1px solid #3ddc8430", borderRadius:4 }}>
            <span style={{ fontSize:13, color:"var(--mu)" }}>{routeInfo.origin.split(",").slice(0,2).join(",")}</span>
            <span style={{ fontFamily:"var(--f2)", fontSize:14, fontWeight:800, color:"var(--or)" }}>{"\u2192"}</span>
            <span style={{ fontSize:13, color:"var(--mu)" }}>{routeInfo.dest.split(",").slice(0,2).join(",")}</span>
            <span style={{ fontFamily:"var(--f2)", fontSize:18, fontWeight:900, color:"#4fc3f7" }}>{fn(routeInfo.miles,0)} mi</span>
            <span style={{ fontSize:13, color:"var(--mu)" }}>{routeInfo.hours} hrs driving</span>
          </div>
        )}
        {routeInfo && routeStatus === "error" && (
          <div style={{ marginBottom:14, padding:"10px 16px", background:"rgba(255,82,82,.06)", border:"1px solid #ff525230", borderRadius:4, fontSize:13, color:"#ff5252" }}>
            {routeInfo.error}
          </div>
        )}

        {/* ── INPUTS ROW ── */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 2fr", gap:12, marginBottom:16 }}>
          {/* Gross revenue with dynamic border */}
          <div style={{ position:"relative" }}>
            <span style={{ position:"absolute", left:14, top:8, fontSize:12, letterSpacing:2, textTransform:"uppercase",
              color:revBorderCol, fontWeight:700, pointerEvents:"none", zIndex:1 }}>Gross Revenue</span>
            <span style={{ position:"absolute", left:14, top:32, fontFamily:"var(--f2)", fontSize:20,
              fontWeight:700, color:"var(--mu)", pointerEvents:"none", zIndex:1 }}>$</span>
            <input type="number" value={grossRev} onChange={e => setGrossRev(Number(e.target.value) || 0)}
              style={{ background:"var(--bg)", border:`2px solid ${revBorderCol}`, borderRadius:6,
                padding:"32px 14px 12px 32px",
                color:"var(--tx)", fontFamily:"var(--f2)", fontSize:28, fontWeight:700,
                textAlign:"center", outline:"none", width:"100%",
                transition:"border-color .3s",
              }} />
            <div style={{ display:"flex", gap:4, marginTop:8, flexWrap:"wrap" }}>
              {[1000,1500,2000,2500,3500,5000].map(v => (
                <button key={v} onClick={() => setGrossRev(v)} style={{
                  padding:"4px 10px", borderRadius:3, cursor:"pointer", fontSize:12, fontWeight:700,
                  fontFamily:"var(--f2)",
                  background: grossRev === v ? revBorderCol : "transparent",
                  color: grossRev === v ? "#fff" : "var(--mu)",
                  border:`1px solid ${grossRev === v ? revBorderCol : "var(--bd)"}`,
                }}>{fd(v,0)}</button>
              ))}
            </div>
          </div>
          {/* Mileage with roundtrip toggle */}
          <div>
            {inputBox("Mileage (one-way)", miles, setMiles, "#4fc3f7", null,
              [150,250,386,500,750,1000], v => `${fn(v,0)} mi`)}
            <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:8, flexWrap:"wrap" }}>
              <button onClick={() => setRoundtrip(!roundtrip)} style={{
                padding:"5px 14px", borderRadius:20, cursor:"pointer",
                fontFamily:"var(--f2)", fontSize:12, fontWeight:700, letterSpacing:1,
                background: roundtrip ? "#4fc3f7" : "transparent",
                color: roundtrip ? "#000" : "var(--mu)",
                border:`1px solid ${roundtrip ? "#4fc3f7" : "var(--bd)"}`,
                transition:"all .15s",
              }}>{roundtrip ? "\u2194 Roundtrip" : "\u2192 One-way"}</button>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                <span style={{ fontSize:12, color:"var(--mu)" }}>Trucks:</span>
                <select value={trucks} onChange={e => setTrucks(Number(e.target.value))} style={{
                  background:"var(--bg)", border:"1px solid var(--bd)", borderRadius:4,
                  padding:"4px 8px", color:"var(--tx)", fontFamily:"var(--f2)", fontSize:14, fontWeight:700,
                  cursor:"pointer", outline:"none",
                }}>
                  {Array.from({length:20},(_,i)=>i+1).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              {(roundtrip || trucks > 1) && (
                <span style={{ fontFamily:"var(--f2)", fontSize:14, fontWeight:700, color:"#4fc3f7" }}>
                  {fn(effectiveMiles,0)} mi total{trucks > 1 ? ` · ${trucks} trucks · ${fd(totalRev,0)} total rev` : ""}
                </span>
              )}
            </div>
          </div>

          {/* Margin — actual + target slider + min revenue */}
          <div>
            {/* Actual margin — large */}
            <div style={{ textAlign:"center", marginBottom:8 }}>
              <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:"var(--mu)", marginBottom:2 }}>Actual Margin</div>
              <div style={{ fontFamily:"var(--f2)", fontSize:52, fontWeight:900, lineHeight:1, color:verdictCol }}>
                {fp(netMarginCalc)}
              </div>
            </div>
            {/* Target margin slider */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4 }}>
              <span style={{ fontSize:12, letterSpacing:2, textTransform:"uppercase", color:mCol, fontWeight:700 }}>Target Margin</span>
              <span style={{ fontFamily:"var(--f2)", fontSize:28, fontWeight:900, color:mCol, lineHeight:1 }}>
                {margin}%
              </span>
            </div>
            <input type="range" className="pl-slider" min={0} max={50} step={1}
              value={margin} onChange={e => setMargin(Number(e.target.value))}
              style={{ accentColor:mCol }} />
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
              {[0,10,15,20,25,30,40,50].map(t => (
                <button key={t} onClick={() => setMargin(t)} style={{
                  padding:"3px 8px", borderRadius:3, cursor:"pointer", fontSize:12, fontWeight:700,
                  fontFamily:"var(--f2)", border:"none",
                  background: margin === t ? mCol : "transparent",
                  color: margin === t ? "#000" : "var(--mu)",
                }}>{t}%</button>
              ))}
            </div>
            {/* Min revenue needed to hit target */}
            {(() => {
              const minRev = margin < 100 ? fleetCost / (1 - margin / 100) : 0;
              const minRPM = perTruckMiles > 0 ? (minRev / trucks) / perTruckMiles : 0;
              const gap = totalRev - minRev;
              const hitsTarget = netMarginCalc >= margin;
              return (
                <div style={{
                  marginTop:10, padding:"10px 14px", borderRadius:4,
                  background: hitsTarget ? "rgba(61,220,132,.08)" : "rgba(255,82,82,.08)",
                  border:`1px solid ${hitsTarget ? "#3ddc8440" : "#ff525240"}`,
                }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                    <span style={{ fontSize:12, color:"var(--mu)" }}>Min revenue for {margin}%</span>
                    <span style={{ fontFamily:"var(--f2)", fontSize:18, fontWeight:800, color:mCol }}>{fd(minRev,0)}</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                    <span style={{ fontSize:12, color:"var(--mu)" }}>Min rate/mile</span>
                    <span style={{ fontFamily:"var(--f2)", fontSize:15, fontWeight:700, color:mCol }}>{fd(minRPM,2)}/mi</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:12, color:"var(--mu)" }}>{hitsTarget ? "Above target by" : "Short by"}</span>
                    <span style={{ fontFamily:"var(--f2)", fontSize:15, fontWeight:800, color:hitsTarget?"#3ddc84":"#ff5252" }}>
                      {hitsTarget ? "+" : ""}{fd(gap,0)}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* ── FLEET COSTS ── */}
        <div style={{ marginBottom:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:12 }}>
            <div>
              <span style={{ fontFamily:"var(--f2)", fontSize:15, fontWeight:800, letterSpacing:3, textTransform:"uppercase", color:"var(--tx)" }}>Fleet Costs</span>
              <span style={{ fontSize:13, color:"var(--mu)", marginLeft:12 }}>{activeCats.length} of 5 active</span>
            </div>
            <div style={{ display:"flex", alignItems:"baseline", gap:16 }}>
              <span style={{ fontFamily:"var(--f2)", fontSize:22, fontWeight:900, color:"#ff5252" }}>{fd(selectedCPM,3)}<span style={{ fontSize:13, fontWeight:700, color:"var(--mu)" }}>/mi</span></span>
              <div style={{ display:"flex", gap:6 }}>
                {[["All", presetAll],["None", presetNone]].map(([lbl, action]) => (
                  <button key={lbl} onClick={action} style={{
                    padding:"5px 14px", borderRadius:20, cursor:"pointer",
                    fontFamily:"var(--f2)", fontSize:11, fontWeight:700, letterSpacing:1,
                    textTransform:"uppercase",
                    background:"transparent", color:"var(--mu)", border:"1px solid var(--bd)",
                    transition:"all .15s",
                  }}>{lbl}</button>
                ))}
              </div>
            </div>
          </div>
          {/* Cost cards */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:10 }}>
            {costCategories.map(c => {
              const on = selectedCosts[c.key];
              const isLabor = c.key === "labor";
              const cpm = MILES > 0 ? c.val / MILES : 0;
              const loadCost = isLabor ? laborHours * HOURLY_RATE * trucks : cpm * effectiveMiles;
              return (
                <div key={c.key} onClick={isLabor ? undefined : () => toggleCost(c.key)} style={{
                  padding:"16px", borderRadius:6, cursor: isLabor ? "default" : "pointer",
                  background: on ? `${c.color}08` : "rgba(0,0,0,.15)",
                  border: on ? `1px solid ${c.color}40` : "1px solid var(--bd)",
                  borderTop: on ? `3px solid ${c.color}` : "3px solid transparent",
                  opacity: on ? 1 : 0.35, transition:"all .2s",
                  textAlign:"center",
                }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                    <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color: on ? c.color : "var(--mu)", fontWeight:700 }}>
                      {c.label}
                    </div>
                    {isLabor && (
                      <button onClick={(e) => { e.stopPropagation(); toggleCost("labor"); }} style={{
                        fontSize:9, padding:"2px 6px", borderRadius:3, cursor:"pointer",
                        background: on ? c.color : "transparent", color: on ? "#000" : "var(--mu)",
                        border:`1px solid ${on ? c.color : "var(--bd)"}`, fontWeight:700,
                      }}>{on ? "ON" : "OFF"}</button>
                    )}
                  </div>
                  {isLabor ? (
                    <>
                      <div style={{ fontFamily:"var(--f2)", fontSize:28, fontWeight:900, color: on ? c.color : "var(--mu)", lineHeight:1, marginBottom:4 }}>
                        {fd(HOURLY_RATE,2)}
                      </div>
                      <div style={{ fontSize:12, color:"var(--mu)" }}>per hour</div>
                      <div style={{ marginTop:8, paddingTop:8, borderTop:`1px solid ${on ? c.color+"20" : "var(--bd)"}` }}>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, marginBottom:4 }}>
                          <input type="number" value={laborHours} onClick={e => e.stopPropagation()}
                            onChange={e => setLaborHours(Number(e.target.value) || 0)}
                            style={{ width:50, background:"var(--bg)", border:"1px solid var(--bd)", borderRadius:3,
                              padding:"4px", color:"var(--tx)", fontFamily:"var(--f2)", fontSize:16, fontWeight:700,
                              textAlign:"center", outline:"none" }} />
                          <span style={{ fontSize:11, color:"var(--mu)" }}>hrs</span>
                        </div>
                        <div style={{ fontFamily:"var(--f2)", fontSize:18, fontWeight:800, color: on ? "var(--tx)" : "var(--mu)" }}>{fd(loadCost,0)}</div>
                        <div style={{ fontSize:11, color:"var(--mu)" }}>{trucks > 1 ? `${trucks} trucks` : "this load"}</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontFamily:"var(--f2)", fontSize:28, fontWeight:900, color: on ? c.color : "var(--mu)", lineHeight:1, marginBottom:4 }}>
                        {fd(cpm,3)}
                      </div>
                      <div style={{ fontSize:12, color:"var(--mu)" }}>per mile</div>
                      <div style={{ marginTop:8, paddingTop:8, borderTop:`1px solid ${on ? c.color+"20" : "var(--bd)"}` }}>
                        <div style={{ fontFamily:"var(--f2)", fontSize:18, fontWeight:800, color: on ? "var(--tx)" : "var(--mu)" }}>{fd(loadCost,0)}</div>
                        <div style={{ fontSize:11, color:"var(--mu)" }}>this load</div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── CONDENSED KPI BAR ── */}
        <div style={{
          display:"flex", justifyContent:"space-between", alignItems:"center",
          background:"rgba(0,0,0,.3)", borderRadius:4, padding:"12px 20px",
          marginBottom:16,
        }}>
          {[
            { label:"RPM", val:`$${rpm.toFixed(2)}`, color:"var(--or)" },
            { label:"Fleet CPM", val:`$${selectedCPM.toFixed(3)}`, color:"#ff5252" },
            { label:"Profit/Mi", val:`$${profitPerMile.toFixed(2)}`, color:profitPerMile>=0?verdictCol:"#ff5252" },
            { label:`Fleet Cost (${activeCats.length})`, val:fd(fleetCost,0), color:"#ff5252" },
            { label:"Net Profit", val:(netProfit>=0?"+":"")+fd(netProfit,0), color:verdictCol },
            { label:"Net Margin", val:fp(netMarginCalc), color:verdictCol },
          ].map((k,i) => (
            <div key={k.label} style={{ display:"flex", alignItems:"center", gap:8,
              ...(i > 0 ? { borderLeft:"1px solid var(--bd)", paddingLeft:14 } : {}) }}>
              <span style={{ fontSize:12, letterSpacing:1, textTransform:"uppercase", color:"var(--mu)" }}>{k.label}</span>
              <span style={{ fontFamily:"var(--f2)", fontSize:20, fontWeight:800, color:k.color }}>{k.val}</span>
            </div>
          ))}
        </div>

        {/* ── COST SUMMARY — large text ── */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr auto 1fr", gap:0, alignItems:"center",
          background:"rgba(0,0,0,.2)", borderRadius:6, padding:"20px 24px" }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:12, letterSpacing:2, textTransform:"uppercase", color:"var(--mu)", marginBottom:6 }}>Revenue{trucks>1?` (${trucks} trucks)`:""}</div>
            <div style={{ fontFamily:"var(--f2)", fontSize:42, fontWeight:900, color:"#3ddc84", lineHeight:1 }}>{fd(totalRev,0)}</div>
          </div>
          <div style={{ fontFamily:"var(--f2)", fontSize:36, fontWeight:900, color:"var(--mu)", padding:"0 16px" }}>−</div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:12, letterSpacing:2, textTransform:"uppercase", color:"var(--mu)", marginBottom:6 }}>Fleet Cost</div>
            <div style={{ fontFamily:"var(--f2)", fontSize:42, fontWeight:900, color:"#ff5252", lineHeight:1 }}>{fd(fleetCost,0)}</div>
          </div>
          <div style={{ fontFamily:"var(--f2)", fontSize:36, fontWeight:900, color:"var(--mu)", padding:"0 16px" }}>=</div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:12, letterSpacing:2, textTransform:"uppercase", color:"var(--mu)", marginBottom:6 }}>Net Profit</div>
            <div style={{ fontFamily:"var(--f2)", fontSize:42, fontWeight:900, color:verdictCol, lineHeight:1 }}>
              {netProfit >= 0 ? "+" : ""}{fd(netProfit,0)}
            </div>
          </div>
        </div>

        {/* ── MILEAGE QUICK-COMPARE ── */}
        <div style={{ background:"rgba(0,0,0,.2)", borderRadius:6, padding:"14px 18px", marginTop:16 }}>
          <div style={{ fontSize:13, letterSpacing:2, textTransform:"uppercase", color:"var(--mu)", marginBottom:10 }}>
            What if mileage changes? · {fd(totalRev,0)} revenue{trucks>1?` · ${trucks} trucks`:""}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {compareMiles.map(m => {
              const em = (roundtrip ? m * 2 : m) * trucks;
              const tRev = grossRev * trucks;
              const cost = em * selectedCPM;
              const prof = tRev - cost;
              const mrg = tRev > 0 ? (prof / tRev) * 100 : 0;
              const col = prof > 0 && mrg >= 15 ? "#3ddc84" : prof > 0 ? "#f5c542" : "#ff5252";
              const isActive = m === miles;
              return (
                <div key={m} onClick={() => setMiles(m)} style={{
                  flex:1, textAlign:"center", padding:"10px 6px", borderRadius:4, cursor:"pointer",
                  background: isActive ? `${col}15` : "var(--bg)",
                  border: isActive ? `2px solid ${col}` : "1px solid var(--bd)",
                  transition:"all .15s",
                }}>
                  <div style={{ fontFamily:"var(--f2)", fontSize:16, fontWeight:800, color:"#4fc3f7" }}>{fn(m,0)} mi{roundtrip ? " RT" : ""}</div>
                  <div style={{ fontFamily:"var(--f2)", fontSize:13, fontWeight:700, color:"var(--mu)", marginTop:2 }}>${(tRev/em).toFixed(2)}/mi</div>
                  <div style={{ fontFamily:"var(--f2)", fontSize:18, fontWeight:900, color:col, marginTop:4 }}>
                    {prof >= 0 ? "+" : ""}{fd(prof,0)}
                  </div>
                  <div style={{ fontSize:12, fontWeight:700, color:col }}>{fp(mrg)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ TOP 10 LANES (LIVE FROM ALVYS) ═══ */}
      <div style={{ marginTop:28, paddingTop:20, borderTop:"2px solid var(--bd)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ fontSize:15, fontFamily:"var(--f2)", fontWeight:800, letterSpacing:3, textTransform:"uppercase", color:"var(--tx)" }}>
            Top 10 Lanes
          </div>
          {alvys && <span style={{ fontSize:12, color:"var(--mu)" }}>Live from Alvys · Updated {new Date(alvys.fetchedAt).toLocaleString()}</span>}
        </div>

        {!alvys ? (
          <div style={{ textAlign:"center", padding:"40px", color:"var(--mu)" }}>Loading lanes...</div>
        ) : (
          <div className="card">
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ borderBottom:"2px solid var(--bd)" }}>
                  {[{l:"#",a:"left"},{l:"Origin",a:"left"},{l:"Destination",a:"left"},{l:"Loads",a:"right"},{l:"Avg Miles",a:"right"},{l:"Avg Revenue",a:"right"},{l:"Avg RPM",a:"right"},{l:"Total Revenue",a:"right"}].map(h => (
                    <th key={h.l} style={{ textAlign:h.a, padding:"10px 8px", fontSize:10, color:"var(--mu)", letterSpacing:1, textTransform:"uppercase" }}>{h.l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(alvys.topLanes || []).map((l,i) => (
                  <tr key={`${l.origin}-${l.destination}`} style={{ borderBottom:"1px solid var(--bd)" }}>
                    <td style={{ padding:"10px 8px", fontFamily:"var(--f2)", fontSize:16, fontWeight:800, color:"var(--mu)" }}>{i+1}</td>
                    <td style={{ padding:"10px 8px", color:"var(--tx)", fontWeight:600 }}>{l.origin}</td>
                    <td style={{ padding:"10px 8px", color:"var(--tx)", fontWeight:600 }}>{l.destination}</td>
                    <td style={{ textAlign:"right", padding:"10px 8px", fontFamily:"var(--f2)", fontSize:18, fontWeight:900, color:"var(--or)" }}>{l.loads}</td>
                    <td style={{ textAlign:"right", padding:"10px 8px", fontFamily:"var(--f2)", color:"#4fc3f7" }}>{l.avgMiles > 0 ? fn(l.avgMiles,0) : "—"}</td>
                    <td style={{ textAlign:"right", padding:"10px 8px", fontFamily:"var(--f2)", fontWeight:700, color:"#3ddc84" }}>{fd(l.avgRevenue,0)}</td>
                    <td style={{ textAlign:"right", padding:"10px 8px", fontFamily:"var(--f2)", fontWeight:700, color:l.avgRPM>=4?"#3ddc84":l.avgRPM>=3?"#f5c542":"#ff5252" }}>{l.avgRPM > 0 ? `$${l.avgRPM.toFixed(2)}` : "—"}</td>
                    <td style={{ textAlign:"right", padding:"10px 8px", fontFamily:"var(--f2)", fontWeight:800, color:"#3ddc84" }}>{fd(l.revenue,0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── FLEET OVERVIEW ────────────────────────────────────────────
function FleetOverview() {
  const [sortKey, setSortKey] = useState("combined");
  const [modal, setModal] = useState(null);

  const rows = useMemo(
    () => [...DRIVERS].sort((a, b) => b[sortKey] - a[sortKey]),
    [sortKey]
  );

  const totalTracked = LABOR + FUEL_TOT + INS_TOT + EQUIP_TOT + MAINT_TOT + UNIFORMS;
  const lCPM = LABOR    / MILES;
  const fCPM = FUEL_TOT / MILES;
  const iCPM = INS_TOT  / MILES;
  const tCPM = totalTracked / MILES;
  const lP = (LABOR       / totalTracked) * 100;
  const fP = (FUEL_TOT    / totalTracked) * 100;
  const iP = (INS_TOT     / totalTracked) * 100;
  const tP = (TRUCK_TOT   / totalTracked) * 100;
  const rP = (TRAILER_TOT / totalTracked) * 100;
  const mP = (MAINT_TOT   / totalTracked) * 100;
  const uP = (UNIFORMS    / totalTracked) * 100;


  return (
    <div>
      <DetailModal id={modal} onClose={() => setModal(null)} />
      <div className="ptitle">Fleet Overview</div>
      <div className="psub">Show Freight Inc · {PERIOD} · {ACTIVE_DRIVERS_COUNT} Drivers</div>

      <div className="sbox">
        <strong style={{ color: "#4fc3f7" }}>Data sources (QuickBooks + EFS):</strong>
        {" "}Payroll {fd(LABOR,0)} <span style={{color:"var(--mu)"}}>(thru {PERIOD_END})</span> ·
        {" "}Fuel {fd(FUEL_TOT,0)} <span style={{color:"var(--mu)"}}>(EFS thru {PERIOD_END})</span> ·
        {" "}Insurance {fd(INS_TOT,0)} <span style={{color:"var(--mu)"}}>(thru {PERIOD_END})</span> ·
        {" "}Trucks {fd(TRUCK_TOT,0)} <span style={{color:"var(--mu)"}}>(thru {PERIOD_END})</span> ·
        {" "}Trailers {fd(TRAILER_TOT,0)} <span style={{color:"var(--mu)"}}>(thru {PERIOD_END})</span> ·
        {" "}Truck Maint {fd(TRUCK_MAINT,0)} <span style={{color:"var(--mu)"}}>(thru {PERIOD_END})</span> ·
        {" "}Trailer Maint {fd(TRAIL_MAINT,0)} <span style={{color:"var(--mu)"}}>(thru {PERIOD_END})</span> ·
        {" "}Storage {fd(STORAGE,0)} <span style={{color:"var(--mu)"}}>(thru {PERIOD_END})</span> ·
        {" "}Uniforms {fd(UNIFORMS,0)} <span style={{color:"var(--mu)"}}>(thru {PERIOD_END})</span>
        <br/><span style={{color:"var(--mu)",fontSize:9}}>CPM uses QuickBooks totals (labor, ins, trucks, trailers, maint, storage, uniforms) + EFS/Mudflap for fuel · Individual invoices in Trucks/Trailers tabs</span>
      </div>

      {/* CPM Hero + cost tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14, marginBottom: 14 }}>

        {/* CPM HERO BOX */}
        <div style={{
          background: "linear-gradient(145deg, #1a1f2e 0%, #0f1118 100%)",
          border: "2px solid var(--or)",
          borderRadius: 6,
          padding: "28px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          boxShadow: "0 0 40px rgba(244,120,32,.12)",
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", inset: 0, opacity: .04,
            backgroundImage: "repeating-linear-gradient(0deg, var(--or) 0px, var(--or) 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, var(--or) 0px, var(--or) 1px, transparent 1px, transparent 40px)",
          }} />
          <div style={{ fontSize: 10, letterSpacing: 4, textTransform: "uppercase", color: "var(--or)", marginBottom: 8, position: "relative" }}>
            Tracked Cost Per Mile
          </div>
          <div style={{
            fontFamily: "var(--f2)", fontSize: 88, fontWeight: 900, lineHeight: 1,
            color: cpmColor(tCPM), position: "relative",
            textShadow: `0 0 60px ${cpmColor(tCPM)}40`,
          }}>
            {fd(tCPM, 3)}
          </div>
          <div style={{ fontSize: 11, color: "var(--mu)", marginTop: 10, position: "relative" }}>
            {fn(MILES, 0)} mi · {PERIOD}
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 10, position: "relative" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "var(--mu)", letterSpacing: 2, textTransform: "uppercase" }}>Total Cost</div>
              <div style={{ fontFamily: "var(--f2)", fontSize: 20, fontWeight: 800, color: "var(--ye)" }}>{fd(totalTracked, 0)}</div>
            </div>
            <div style={{ width: 1, background: "var(--bd)" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "var(--mu)", letterSpacing: 2, textTransform: "uppercase" }}>Categories</div>
              <div style={{ fontFamily: "var(--f2)", fontSize: 20, fontWeight: 800, color: "var(--ye)" }}>9</div>
            </div>
          </div>
          <div style={{ marginTop: 12, position: "relative" }}>
            <div className="tag" style={{
              fontSize: 10, padding: "4px 14px",
              background: tCPM < 3.0 ? "rgba(61,220,132,.15)" : tCPM < 4.0 ? "rgba(245,197,66,.15)" : "rgba(255,82,82,.15)",
              color: cpmColor(tCPM),
              border: `1px solid ${cpmColor(tCPM)}50`,
            }}>
              {tCPM < 3.0 ? "✓ Competitive" : tCPM < 4.0 ? "⚡ Average" : "⚠ Review Costs"}
            </div>
          </div>
        </div>

        {/* Cost breakdown tiles — 3x3 grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { key: "labor",       label: "Labor",           val: LABOR,       cpm: lCPM, pct: lP, color: "#f47820" },
            { key: "fuel",        label: "Fuel",            val: FUEL_TOT,    cpm: fCPM, pct: fP, color: "#f5c542" },
            { key: "insurance",   label: "Insurance",       val: INS_TOT,     cpm: iCPM, pct: iP, color: "#b39ddb" },
            { key: "trucks",      label: "Trucks",          val: TRUCK_TOT,   cpm: TRUCK_TOT/MILES, pct: tP, color: "#4fc3f7" },
            { key: "trailers",    label: "Trailers",        val: TRAILER_TOT, cpm: TRAILER_TOT/MILES, pct: rP, color: "#3ddc84" },
            { key: "truckMaint",  label: "Truck Maint",     val: TRUCK_MAINT, cpm: TRUCK_MAINT/MILES, pct: (TRUCK_MAINT/totalTracked)*100, color: "#d97706" },
            { key: "trailerMaint",label: "Trailer Maint",   val: TRAIL_MAINT, cpm: TRAIL_MAINT/MILES, pct: (TRAIL_MAINT/totalTracked)*100, color: "#d97706" },
            { key: "storage",     label: "Storage/Park",    val: STORAGE,     cpm: STORAGE/MILES, pct: (STORAGE/totalTracked)*100, color: "#d97706" },
            { key: "uniforms",    label: "Uniforms",        val: UNIFORMS,    cpm: UNIFORMS/MILES, pct: uP, color: "#a78bfa" },
          ].map(item => (
            <div key={item.key}
              className="kpi"
              onClick={() => setModal(item.key)}
              style={{ cursor: "pointer", padding: "12px 13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                <div className="klbl" style={{ margin: 0 }}>{item.label}</div>
                <div style={{ fontSize: 9, color: "var(--or)", letterSpacing: 0 }}>↗</div>
              </div>
              <div style={{ fontFamily: "var(--f2)", fontSize: 20, fontWeight: 800, color: item.color, lineHeight: 1 }}>
                {fd(item.val, 0)}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                <span style={{ fontSize: 10, color: "var(--mu)" }}>{fd(item.cpm, 3)}/mi</span>
                <span style={{ fontSize: 10, color: "var(--mu)" }}>{fp(item.pct)}</span>
              </div>
              <div className="bar" style={{ marginTop: 5 }}>
                <div className="bfil" style={{ width: `${Math.min(100, item.pct * 2)}%`, background: item.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stack bar */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="ctit">All-In Cost Stack — {fd(tCPM, 3)}/mi</div>
        <div className="sbar">
          <div className="sseg" style={{ width: `${lP}%`, background: "#f47820" }}>Labor {fp(lP)}</div>
          <div className="sseg" style={{ width: `${fP}%`, background: "#c49a00", color: "#fff" }}>Fuel {fp(fP)}</div>
          <div className="sseg" style={{ width: `${iP}%`, background: "#7c5cbf" }}>Ins {fp(iP)}</div>
          <div className="sseg" style={{ width: `${tP}%`, background: "#0288d1" }}>Trucks {fp(tP)}</div>
          <div className="sseg" style={{ width: `${rP}%`, background: "#1b7a4e" }}>Trailers {fp(rP)}</div>
          <div className="sseg" style={{ width: `${mP}%`, background: "#78350f" }}>Maint+Stor {fp(mP)}</div>
          <div className="sseg" style={{ width: `${uP}%`, background: "#4a1d96" }}>Unif {fp(uP)}</div>
        </div>
        <div className="g3" style={{ marginTop: 12 }}>
          <div className="kpi"><div className="klbl">Labor CPM</div><div className="kval" style={{ fontSize: 18, color: "#f47820" }}>{fd(lCPM, 3)}</div></div>
          <div className="kpi"><div className="klbl">Fuel CPM</div><div className="kval" style={{ fontSize: 18, color: "#f5c542" }}>{fd(fCPM, 3)}</div></div>
          <div className="kpi"><div className="klbl">Insurance CPM</div><div className="kval" style={{ fontSize: 18, color: "#b39ddb" }}>{fd(iCPM, 3)}</div></div>
          <div className="kpi"><div className="klbl">Truck CPM</div><div className="kval" style={{ fontSize: 18, color: "#4fc3f7" }}>{fd(TRUCK_TOT/MILES, 3)}</div></div>
          <div className="kpi"><div className="klbl">Trailer CPM</div><div className="kval" style={{ fontSize: 18, color: "#3ddc84" }}>{fd(TRAILER_TOT/MILES, 3)}</div></div>
          <div className="kpi"><div className="klbl">Maint+Stor CPM</div><div className="kval" style={{ fontSize: 18, color: "#d97706" }}>{fd(MAINT_TOT/MILES, 3)}</div></div>
          <div className="kpi"><div className="klbl">Avg Fuel Price</div><div className="kval" style={{ fontSize: 18, color: "#4fc3f7" }}>{fd(FUEL_TOT / GALLONS, 3)}/gal</div></div>
        </div>
      </div>

      {/* Driver table */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="ctit" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          All Drivers
          <select className="inp" style={{ width: "auto", fontSize: 10, padding: "3px 7px" }}
            value={sortKey} onChange={e => setSortKey(e.target.value)}>
            <option value="combined">Sort: Total (L+F)</option>
            <option value="totalCost">Sort: Labor</option>
            <option value="fuel">Sort: Fuel</option>
            <option value="cpm">Sort: CPM</option>
          </select>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th><th>Driver</th>
                <th>Labor</th><th>Fuel</th><th>Total (L+F)</th>
                <th>Gallons</th><th>Est Miles</th>
                <th>Labor CPM</th><th>Fuel CPM</th><th>Combined CPM</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d, i) => (
                <tr key={d.name}>
                  <td style={{ color: "#5a6370", textAlign: "center" }}>
                    {i < 3 ? ["🥇","🥈","🥉"][i] : i + 1}
                  </td>
                  <td style={{ fontWeight: 500 }}>{d.name}</td>
                  <td style={{ color: "#f47820" }}>{fd(d.totalCost, 0)}</td>
                  <td style={{ color: "#f5c542" }}>{d.fuel > 0 ? fd(d.fuel, 0) : <span style={{ color: "#5a6370" }}>—</span>}</td>
                  <td style={{ color: "#4fc3f7", fontWeight: 600 }}>{d.combined > 0 ? fd(d.combined, 0) : "—"}</td>
                  <td style={{ color: "#5a6370" }}>{d.gallons > 0 ? fn(d.gallons, 0) : "—"}</td>
                  <td style={{ color: "#5a6370" }}>{d.miles > 0 ? fn(d.miles, 0) : "—"}</td>
                  <td style={{ color: d.lCPM ? cpmColor(d.lCPM) : "#5a6370" }}>{d.lCPM ? fd(d.lCPM, 3) : "—"}</td>
                  <td style={{ color: "#f5c542" }}>{d.fCPM ? fd(d.fCPM, 3) : "—"}</td>
                  <td style={{ fontWeight: 700, color: d.cpm ? cpmColor(d.cpm) : "#5a6370" }}>{d.cpm ? fd(d.cpm, 3) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>FLEET TOTAL</td>
                <td>{fd(LABOR, 0)}</td>
                <td>{fd(FUEL_TOT, 0)}</td>
                <td>{fd(LABOR + FUEL_TOT, 0)}</td>
                <td>{fn(GALLONS, 0)}</td>
                <td>{fn(MILES, 0)}</td>
                <td>{fd(lCPM, 3)}</td>
                <td>{fd(fCPM, 3)}</td>
                <td>{fd((LABOR + FUEL_TOT) / MILES, 3)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

    </div>
  );
}

// ── DRIVER DETAIL ─────────────────────────────────────────────
function DriverDetail() {
  const [sel, setSel] = useState("");

  const d = DRIVERS.find(x => x.name === sel);
  const flCPM = (LABOR + FUEL_TOT + INS_TOT) / MILES;

  return (
    <div>
      <div className="ptitle">Driver Detail</div>
      <div className="psub">Per-driver CPM from real payroll + fuel card data</div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="ctit">Select Driver</div>
        <select className="inp" value={sel} onChange={e => { setSel(e.target.value); }}>
          <option value="">— Choose a driver —</option>
          {[...DRIVERS].sort((a, b) => a.name.localeCompare(b.name)).map(x => (
            <option key={x.name} value={x.name}>
              {x.name}{x.fuel === 0 ? " (no fuel data)" : ""}
            </option>
          ))}
        </select>
      </div>

      {d ? (
        <>
          <div className="g3" style={{ marginBottom: 14 }}>
            <div className="kpi">
              <div className="klbl">Labor Cost</div>
              <div className="kval" style={{ color: "#f47820" }}>{fd(d.totalCost, 0)}</div>
              <div className="ksub">{d.hours.toFixed(1)} hrs · {fd(d.totalCost / d.hours)}/hr</div>
            </div>
            <div className="kpi">
              <div className="klbl">Fuel Spend</div>
              <div className="kval" style={{ color: "#f5c542" }}>
                {d.fuel > 0 ? fd(d.fuel, 0) : <span style={{ color: "#5a6370" }}>No data</span>}
              </div>
              <div className="ksub">{d.gallons > 0 ? `${fn(d.gallons, 0)} gal · ${fd(d.fuel / d.gallons, 3)}/gal` : ""}</div>
            </div>
            <div className="kpi">
              <div className="klbl">Total (L + F)</div>
              <div className="kval" style={{ color: "#4fc3f7" }}>{d.combined > 0 ? fd(d.combined, 0) : "—"}</div>
              <div className="ksub">{d.miles > 0 ? `~${fn(d.miles, 0)} est miles` : ""}</div>
            </div>
          </div>

          <div className="g2" style={{ marginBottom: 14 }}>
            <div className="card">
              <div className="ctit">CPM Breakdown</div>
              {d.cpm ? (
                <>
                  <div className="gauge" style={{ padding: "10px 0" }}>
                    <div className="gval" style={{ color: cpmColor(d.cpm) }}>{fd(d.cpm, 3)}</div>
                    <div className="glbl">combined CPM</div>
                  </div>
                  <div className="sbar">
                    <div className="sseg" style={{ width: `${(1 - d.fCPM / d.cpm) * 100}%`, background: "#f47820" }}>Labor</div>
                    <div className="sseg" style={{ width: `${(d.fCPM / d.cpm) * 100}%`, background: "#c49a00" }}>Fuel</div>
                  </div>
                  <div className="g2" style={{ gap: 8 }}>
                    <div className="met" style={{ marginBottom: 0 }}>
                      <div className="mlbl">Labor CPM</div>
                      <div className="mval" style={{ fontSize: 20, color: "#f47820" }}>{fd(d.lCPM, 3)}</div>
                      <div className="msub">fleet avg {fd(LABOR / MILES, 3)}</div>
                    </div>
                    <div className="met" style={{ marginBottom: 0 }}>
                      <div className="mlbl">Fuel CPM</div>
                      <div className="mval" style={{ fontSize: 20, color: "#f5c542" }}>{fd(d.fCPM, 3)}</div>
                      <div className="msub">fleet avg {fd(FUEL_TOT / MILES, 3)}</div>
                    </div>
                  </div>
                  <div className="met" style={{ marginTop: 10 }}>
                    <div className="mlbl">vs Fleet Average CPM</div>
                    {(() => {
                      const diff = d.cpm - flCPM;
                      return (
                        <div className="mval" style={{ color: diff > 0 ? "#ff5252" : "#3ddc84" }}>
                          {diff > 0 ? "+" : ""}{fd(diff, 3)}
                        </div>
                      );
                    })()}
                    <div className="msub">fleet avg {fd(flCPM, 3)}/mi</div>
                  </div>
                  <div className="met" style={{ marginBottom: 0 }}>
                    <div className="mlbl">Rate Needed (15% margin)</div>
                    <div className="mval" style={{ color: "#3ddc84" }}>{fd(d.cpm / 0.85, 3)}/mi</div>
                  </div>
                </>
              ) : (
                <div style={{ color: "#5a6370", fontSize: 12, padding: "20px 0", textAlign: "center" }}>
                  No fuel card data matched for this driver.
                </div>
              )}
            </div>

            <div className="card">
              <div className="ctit">Efficiency Metrics</div>
              <div className="met">
                <div className="mlbl">Cost per Payroll Hour</div>
                <div className="mval" style={{ color: "#f47820" }}>{fd(d.totalCost / d.hours)}</div>
                <div className="msub">fully loaded employer rate</div>
              </div>
              {d.fuel > 0 && (
                <div className="met">
                  <div className="mlbl">Fuel per Hour Worked</div>
                  <div className="mval" style={{ color: "#f5c542" }}>{fd(d.fuel / d.hours)}</div>
                </div>
              )}
              <div className="met" style={{ marginBottom: 0 }}>
                <div className="mlbl">Share of Fleet Labor</div>
                <div className="mval">{fp(d.totalCost / LABOR * 100)}</div>
              </div>
            </div>
          </div>

        </>
      ) : (
        <div className="card empty">
          <div className="empty-icon">🚛</div>
          <div className="empty-text">Select a driver above</div>
        </div>
      )}
    </div>
  );
}

// ── FUEL ANALYSIS ─────────────────────────────────────────────
function FuelAnalysis() {

  const withFuel = [...DRIVERS].filter(d => d.fuel > 0).sort((a, b) => b.fuel - a.fuel);
  const avgPPG = FUEL_TOT / GALLONS;

  return (
    <div>
      <div className="ptitle">Fuel Analysis</div>
      <div className="psub">EFS + Mudflap combined · {PERIOD}</div>

      <div className="g4" style={{ marginBottom: 14 }}>
        <div className="kpi">
          <div className="klbl">EFS Card Spend</div>
          <div className="kval" style={{ color: "#f47820" }}>{fd(171999.62,0)}</div>
          <div className="ksub">{fn(36450.66,0)} gal · $4.541/gal avg</div>
        </div>
        <div className="kpi">
          <div className="klbl">Mudflap Spend</div>
          <div className="kval" style={{ color: "#f5c542" }}>{fd(10603.84,0)}</div>
          <div className="ksub">{fn(2799.19,0)} gal · $3.657/gal avg</div>
        </div>
        <div className="kpi">
          <div className="klbl">Combined Fuel</div>
          <div className="kval" style={{ color: "#4fc3f7" }}>{fd(FUEL_TOT, 0)}</div>
          <div className="ksub">{fn(GALLONS, 0)} total gallons</div>
        </div>
        <div className="kpi">
          <div className="klbl">Fuel CPM</div>
          <div className="kval" style={{ color: "#f5c542" }}>{fd(FUEL_TOT / MILES, 3)}</div>
          <div className="ksub">avg {fd(avgPPG, 3)}/gal</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="ctit">Fuel Spend by Driver</div>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th><th>Driver</th>
                <th>Fuel Spend</th><th>Gallons</th><th>Avg $/Gal</th>
                <th>Est Miles</th><th>Fuel CPM</th><th>% of Fleet</th>
              </tr>
            </thead>
            <tbody>
              {withFuel.map((d, i) => {
                const ppg = d.fuel / d.gallons;
                const pct = d.fuel / FUEL_TOT * 100;
                return (
                  <tr key={d.name}>
                    <td style={{ color: "#5a6370", textAlign: "center" }}>
                      {i < 3 ? ["🥇","🥈","🥉"][i] : i + 1}
                    </td>
                    <td style={{ fontWeight: 500 }}>{d.name}</td>
                    <td style={{ color: "#f47820" }}>{fd(d.fuel, 0)}</td>
                    <td style={{ color: "#5a6370" }}>{fn(d.gallons, 0)}</td>
                    <td style={{ color: ppg > avgPPG * 1.05 ? "#ff5252" : "#f5c542" }}>{fd(ppg, 3)}</td>
                    <td style={{ color: "#5a6370" }}>{fn(d.miles, 0)}</td>
                    <td style={{ color: d.fCPM > 0.75 ? "#ff5252" : d.fCPM > 0.65 ? "#f5c542" : "#3ddc84" }}>{fd(d.fCPM, 3)}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div className="bar" style={{ flex: 1, margin: 0 }}>
                          <div className="bfil" style={{ width: `${Math.min(100, pct * 3)}%`, background: "#f47820" }} />
                        </div>
                        <span style={{ color: "#5a6370", fontSize: 10 }}>{fp(pct)}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>FLEET TOTAL</td>
                <td>{fd(FUEL_TOT, 0)}</td>
                <td>{fn(GALLONS, 0)}</td>
                <td>{fd(avgPPG, 3)}</td>
                <td>{fn(MILES, 0)}</td>
                <td>{fd(FUEL_TOT / MILES, 3)}</td>
                <td>100.0%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

    </div>
  );
}



// ── MONTHLY REVENUE (Jan 2025 – Jan 2026) ────────────────────
let MONTHLY_REVENUE = [
  { m:"Jan 25", ce:497382.58,  di:1711.95,   sf:292888.00, total:791982.53,   gp:425681.70  },
  { m:"Feb 25", ce:686500.11,  di:9952.70,   sf:292092.07, total:988544.88,   gp:497290.85  },
  { m:"Mar 25", ce:592210.90,  di:289.80,    sf:284544.97, total:877045.67,   gp:431962.46  },
  { m:"Apr 25", ce:869265.27,  di:5760.98,   sf:358950.85, total:1233977.10,  gp:717272.72  },
  { m:"May 25", ce:862538.86,  di:3702.65,   sf:538481.33, total:1404722.84,  gp:759321.74  },
  { m:"Jun 25", ce:938510.81,  di:6187.50,   sf:481709.97, total:1426408.28,  gp:742241.86  },
  { m:"Jul 25", ce:527972.77,  di:13759.82,  sf:300008.34, total:841740.93,   gp:485307.97  },
  { m:"Aug 25", ce:410166.07,  di:28767.54,  sf:264170.48, total:703104.09,   gp:398559.76  },
  { m:"Sep 25", ce:1076320.01, di:22451.73,  sf:302688.84, total:1401460.58,  gp:687931.95  },
  { m:"Oct 25", ce:1395076.43, di:1679.60,   sf:349400.22, total:1746156.25,  gp:822352.46  },
  { m:"Nov 25", ce:1005762.30, di:14476.99,  sf:259241.07, total:1279480.36,  gp:591933.37  },
  { m:"Dec 25", ce:943893.79,  di:40732.01,  sf:232991.76, total:1222781.06,  gp:460955.04  },
  { m:"Jan 26", ce:663460.14,  di:14947.25,  sf:314754.40, total:993161.79,   gp:480933.50  },
  { m:"Feb 26", ce:1264154.09, di:6636.50,  sf:337043.15, total:1607833.74,  gp:683117.82  },
  { m:"Mar 26", ce:1734333.27, di:18161.70, sf:522550.51, total:2290040.48,  gp:1113857.96 },
  { m:"Apr 26", ce:1325895.61, di:1781.88,  sf:643584.16, total:2160721.16,  gp:1107479.39 },
  { m:"May 26", ce:1869803.06, di:17407.72, sf:714397.91, total:2725473.59,  gp:1375580.28 },
  { m:"Jun 26", ce:1958288.12, di:4293.45,  sf:836401.58, total:2940492.16,  gp:1371139.43 },  // full June
  { m:"Jul 26", ce:198116.75,  di:0,        sf:79262.47,  total:282797.47,   gp:122451.94  },  // partial — Jul 1-5 only
];





// ── TCI LEASING DATA ──────────────────────────────────────────
const TCI_LEASING = {
  vendor: "TCI Dedicated Logistics, Leasing & Rental",
  branch: "Henderson, NV",
  // 4x liftgate install service invoices — identical $556.33 each
  service: [
    { invoice:"31S337019", date:"Feb 9, 2026",  unit:"26440", vin:"3AKJHLDV7TSWN4160", meter:12225,  po:"Lift Gate Cord 2", total:556.33,
      parts:325.84, labor:186.00, misc:16.74, tax:27.75 },
    { invoice:"31S337022", date:"Feb 9, 2026",  unit:"26569", vin:"3AKJHLDV1TSWN4283", meter:119,    po:"Lift Gate Cord 3", total:556.33,
      parts:325.84, labor:186.00, misc:16.74, tax:27.75 },
    { invoice:"31S337023", date:"Feb 9, 2026",  unit:"26570", vin:"3AKJHLDV3TSWN4284", meter:1710,   po:"Lift Gate Cord 4", total:556.33,
      parts:325.84, labor:186.00, misc:16.74, tax:27.75 },
    { invoice:"31S337025", date:"Feb 9, 2026",  unit:"26441", vin:"3AKJHLDV9TSWN4161", meter:11799,  po:"Lift Gate Cord 5", total:556.33,
      parts:325.84, labor:186.00, misc:16.74, tax:27.75 },
  ],
  // 5x February lease invoices (initial + license/FHUT)
  lease: [
    { invoice:"31L1710001", date:"Feb 19, 2026", unit:"26440", vin:"3AKJHLDV7TSWN4160", contract:1710, period:"Feb 10–28, 2026",
      fixed:1684.00, license:1906.97, fhut:229.17, misc:2136.14, total:3820.14 },
    { invoice:"31L1711001", date:"Feb 19, 2026", unit:"26441", vin:"3AKJHLDV9TSWN4161", contract:1711, period:"Feb 11–28, 2026",
      fixed:1572.00, license:1651.14, fhut:229.17, misc:1880.31, total:3452.31 },
    { invoice:"31L1712001", date:"Feb 19, 2026", unit:"26569", vin:"3AKJHLDV1TSWN4283", contract:1712, period:"Feb 10–28, 2026",
      fixed:1684.00, license:1311.74, fhut:229.17, misc:1540.91, total:3224.91 },
    { invoice:"31L1713001", date:"Feb 19, 2026", unit:"26570", vin:"3AKJHLDV3TSWN4284", contract:1713, period:"Feb 10–28, 2026",
      fixed:1684.00, license:1311.74, fhut:229.17, misc:1540.91, total:3224.91 },
    { invoice:"31L1714001", date:"Feb 19, 2026", unit:"26573", vin:"3AKJHLDV9TSWN4287", contract:1714, period:"Feb 10–28, 2026",
      fixed:1684.00, license:1311.74, fhut:229.17, misc:1540.91, total:3224.91 },
  ],
  // 5x March lease invoices (fixed + variable mileage)
  leaseMar: [
    { invoice:"31L1710002", date:"Mar 4, 2026", unit:"26440", vin:"3AKJHLDV7TSWN4160", contract:1710, period:"Mar 1–31, 2026",
      fixed:2248.00, miles:1120, miRate:0.07, variable:78.40, total:2326.40, meterFrom:12225, meterTo:13345 },
    { invoice:"31L1711002", date:"Mar 4, 2026", unit:"26441", vin:"3AKJHLDV9TSWN4161", contract:1711, period:"Mar 1–31, 2026",
      fixed:2248.00, miles:1930, miRate:0.07, variable:135.10, total:2383.10, meterFrom:11858, meterTo:13788 },
    { invoice:"31L1712002", date:"Mar 4, 2026", unit:"26569", vin:"3AKJHLDV1TSWN4283", contract:1712, period:"Mar 1–31, 2026",
      fixed:2248.00, miles:768, miRate:0.07, variable:53.76, total:2301.76, meterFrom:160, meterTo:928 },
    { invoice:"31L1713002", date:"Mar 4, 2026", unit:"26570", vin:"3AKJHLDV3TSWN4284", contract:1713, period:"Mar 1–31, 2026",
      fixed:2248.00, miles:1, miRate:0.07, variable:0.07, total:2248.07, meterFrom:1741, meterTo:1742 },
    { invoice:"31L1714002", date:"Mar 4, 2026", unit:"26573", vin:"3AKJHLDV9TSWN4287", contract:1714, period:"Mar 1–31, 2026",
      fixed:2248.00, miles:1798, miRate:0.07, variable:125.86, total:2373.86, meterFrom:194, meterTo:1992 },
  ],
  // Box truck rental
  rental: [
    { invoice:"31R1700002", date:"Mar 4, 2026", unit:"19129", vin:"1FVACWD24KHKE5088", contract:1700, period:"Feb 1–28, 2026",
      make:"Freightliner", model:"M2106", year:2019, po:"BOX-101",
      fixed:1950.00, envFee:180.00, miles:275, miRate:0.09, variable:24.75, total:2154.75, meterFrom:188576, meterTo:188851 },
  ],
};

// ── PENSKE DATA ────────────────────────────────────────────────
const PENSKE = {
  vendor: "Penske Truck Leasing", customer:"69728500-0756",
  // All invoices
  invoices:[
    { invoice:"0032649248", date:"Feb 26, 2026", type:"Contract & Rental",         total:3018.99 },
    { invoice:"0032533089", date:"Feb 5, 2026",  type:"Contract — New Unit",        total:3650.75 },
    { invoice:"0032525482", date:"Feb 3, 2026",  type:"Special — Initial Fuel",     total:884.24  },
    { invoice:"0032497960", date:"Feb 3, 2026",  type:"Special — Tolls & Fees",     total:100.63  },
    { invoice:"0032469306", date:"Feb 2, 2026",  type:"Special — Fuel/Mileage Taxes Q4 2025", total:1620.97 },
    { invoice:"0032497959", date:"Feb 3, 2026",  type:"Fuel Invoice",               total:709.04  },
  ],
  // Main lease contract 0032649248 per-unit
  leaseUnits:[
    { unit:"585443", miles:-10057, variable:-804.56, fixed:-3368.62, tax:-349.51, total:-4522.69, note:"Out of service 1/25/26 — credit/adjustment" },
    { unit:"587120", miles:8270,   variable:661.60,  fixed:2737.00,  tax:284.63,  total:3683.23,  note:"Active" },
    { unit:"180539", miles:1087,   variable:86.96,   fixed:0,        tax:7.28,    total:94.24,    note:"Sub #587120 — Counter Rental 1wk 4day" },
    { unit:"587127", miles:69,     variable:5.52,    fixed:2737.00,  tax:229.68,  total:2972.20,  note:"Active" },
    { unit:"180539B",miles:5714,   variable:457.12,  fixed:0,        tax:38.29,   total:495.41,   note:"Sub #587127 — Subs Swapping 2wk 2day" },
  ],
  // New unit activation 0032533089
  newUnit:{ unit:"587127", invoice:"0032533089", date:"Feb 5, 2026",
    fixed:3368.62, tax:282.13, total:3650.75, note:"NEW IN SERVICE Jan 26 – Feb 28, 2026 · 0 miles" },
  // Rental 0032649248
  rental:{ unit:"449937", myUnit:"U-36P", miles:263, variable:21.04, fixed:252.64, tax:22.92, total:296.60,
    note:"Temp Replace — Swap Sub · Jan 25–27, 2026" },
  // Special charges
  specials:[
    { invoice:"0032525482", date:"Feb 3, 2026",  unit:"587127", total:884.24,
      items:[
        { desc:"Initial Fuel — 225 gal Diesel @ $3.5355",  amount:795.49, tax:0     },
        { desc:"Initial DEF — 18 gal @ $4.549",            amount:81.88,  tax:6.87  },
      ]},
    { invoice:"0032497960", date:"Feb 3, 2026",  unit:"449937", total:100.63,
      items:[
        { desc:"Toll Road Costs — 3 OTA-OK charges (Jan 4, 2026)", amount:71.13, tax:0 },
        { desc:"Processing Fees",                                    amount:29.50, tax:0 },
      ]},
    { invoice:"0032469306", date:"Feb 2, 2026",  unit:"Fleet",  total:1620.97,
      items:[
        { desc:"Fuel & Mileage Taxes — 4th Quarter 2025 (IFTA) — 48,686 mi, 6 states", amount:1620.97, tax:0 },
      ]},
  ],
  // Fuel invoice 0032497959
  fuel:{ invoice:"0032497959", date:"Feb 3, 2026", total:709.04,
    items:[
      { unit:"585443", type:"Lease",  diesel:140.0, def:4.1, rate:4.1290, total:598.27 },
      { unit:"449937", type:"Rental", diesel:26.7,  def:0,   rate:4.1490, total:110.77 },
    ]},
};

// ── TEC EQUIPMENT DATA ────────────────────────────────────────
const TEC_EQUIPMENT = {
  vendor: "TEC Equipment Leasing",
  customer: "001-10002608-000",
  // Lease Contract Invoice
  lease: {
    invoice:"60262649", date:"Mar 1, 2026", period:"Mar 1 – Mar 31, 2026",
    agreement:"875", total:34029.60, subtotal:31399.89, tax:2629.71,
    units:[
      { unit:"101149", fixed:2288.49, miRate:0.09205, miles:1919, miCharge:176.64, total:2465.13, odOut:462560, odIn:464479 },
      { unit:"101476", fixed:2288.49, miRate:0.09205, miles:3810, miCharge:350.71, total:2639.20, odOut:328223, odIn:332033 },
      { unit:"101568", fixed:2288.49, miRate:0.09205, miles:5571, miCharge:512.81, total:2801.30, odOut:454401, odIn:459972 },
      { unit:"101574", fixed:2288.49, miRate:0.09205, miles:3024, miCharge:278.36, total:2566.85, odOut:488706, odIn:491730 },
      { unit:"101577", fixed:2288.49, miRate:0.09205, miles:5908, miCharge:543.83, total:2832.32, odOut:464681, odIn:470589 },
      { unit:"101589", fixed:2083.28, miRate:0.09194, miles:1507, miCharge:138.55, total:2221.83, odOut:240866, odIn:242373 },
      { unit:"101676", fixed:2083.28, miRate:0.09194, miles:1860, miCharge:171.01, total:2254.29, odOut:201560, odIn:203420 },
      { unit:"101728", fixed:2288.49, miRate:0.09205, miles:4839, miCharge:445.43, total:2733.92, odOut:440970, odIn:445809 },
      { unit:"101729", fixed:2288.49, miRate:0.09205, miles:6702, miCharge:616.92, total:2905.41, odOut:456087, odIn:462789 },
      { unit:"101730", fixed:2288.49, miRate:0.09205, miles:4186, miCharge:385.32, total:2673.81, odOut:386296, odIn:390482 },
      { unit:"101731", fixed:2288.49, miRate:0.09205, miles:2090, miCharge:192.38, total:2480.87, odOut:292499, odIn:294589 },
      { unit:"101738", fixed:2288.49, miRate:0.09205, miles:5828, miCharge:536.47, total:2824.96, odOut:358289, odIn:364117 },
    ],
  },
  // Rental Invoices
  rentals:[
    { invoice:"60262220", date:"Feb 19, 2026", unit:"103951", type:"Daily Rental",   period:"Feb 19–28", total:802.08,  subtotal:740.10,  tax:61.98, note:"10 days @ $74.01/day" },
    { invoice:"60261742", date:"Feb 18, 2026", unit:"104020", type:"Weekly Rental",  period:"Feb 12–18", total:634.27,  subtotal:585.25,  tax:49.02, note:"$525/wk + 175mi + fees" },
    { invoice:"60262130", date:"Feb 25, 2026", unit:"104020", type:"Weekly Rental",  period:"Feb 19–25", total:617.30,  subtotal:569.59,  tax:47.71, note:"$525/wk + 1mi + fees" },
    { invoice:"60261732", date:"Feb 19, 2026", unit:"101579", type:"Distance Rental",period:"Feb 16–19", total:24.15,   subtotal:22.28,   tax:1.87,  note:"242 mi · replaced 101738" },
    { invoice:"60262221", date:"Feb 28, 2026", unit:"103951", type:"Distance Rental",period:"Feb 19–27", total:49.45,   subtotal:45.63,   tax:3.82,  note:"507 mi @ $0.09/mi" },
  ],
  // Shop Invoice
  shop:[
    { invoice:"20480427", date:"Feb 26, 2026", unit:"101476", vin:"4V4WC9EH9LN250045",
      total:126.19, subtotal:116.44, tax:9.75,
      description:"39x80 Mattress — Customer Requested",
      note:"90 Day DOT Inspection period · CARB CTC Mar/Sep" },
  ],
};

// ── TRUCKS TAB ────────────────────────────────────────────────
function TrucksTab() {
  const [view, setView] = useState("assets"); // assets | tci | penske | lease | rentals | shop
  const equipment = useEquipment();

  const lu   = TEC_EQUIPMENT.lease.units;
  const totalMiles = lu.reduce((s,u)=>s+u.miles,0);
  const totalFixed = lu.reduce((s,u)=>s+u.fixed,0);
  const totalMiChg = lu.reduce((s,u)=>s+u.miCharge,0);
  const rentalTotal= TEC_EQUIPMENT.rentals.reduce((s,r)=>s+r.total,0);
  const shopTotal  = TEC_EQUIPMENT.shop.reduce((s,r)=>s+r.total,0);
  const penskeTotal = PENSKE.invoices.reduce((s,i)=>s+i.total,0);
  const tciTotal    = TCI_LEASING.service.reduce((s,i)=>s+i.total,0) + TCI_LEASING.lease.reduce((s,i)=>s+i.total,0) + TCI_LEASING.leaseMar.reduce((s,i)=>s+i.total,0) + TCI_LEASING.rental.reduce((s,i)=>s+i.total,0);
  const grandTotal  = TEC_EQUIPMENT.lease.total + rentalTotal + shopTotal + penskeTotal + tciTotal;

  return (
    <div>
      <div className="ptitle">Trucks</div>
      <div className="psub">
        {equipment?.units?.length
          ? `${equipment.units.filter(u => u.category === "truck").length} trucks · ${new Set(equipment.units.filter(u => u.category === "truck").map(u => u.vendor)).size} vendors · live from AP Aging · ${PERIOD}`
          : `TEC Equipment · Penske · TCI Leasing · ${PERIOD}`}
      </div>

      {/* Grand summary KPIs */}
      {(() => {
        const tciUnits = TCI_LEASING.leaseMar.length + TCI_LEASING.rental.length; // 5 lease + 1 rental
        const penskeActive = PENSKE.leaseUnits.filter(u => u.total > 0).length;
        const tecUnits = lu.length;
        const allUnits = tciUnits + penskeActive + tecUnits;
        const tciMonthly = TCI_LEASING.leaseMar.reduce((s,i)=>s+i.fixed,0) + TCI_LEASING.rental.reduce((s,i)=>s+i.fixed+i.envFee,0);
        const penskeMonthly = PENSKE.leaseUnits.filter(u=>u.fixed>0).reduce((s,u)=>s+u.fixed,0);
        const tecMonthly = totalFixed;
        const allMonthly = tciMonthly + penskeMonthly + tecMonthly;
        const tciMiles = TCI_LEASING.leaseMar.reduce((s,i)=>s+i.miles,0) + TCI_LEASING.rental.reduce((s,i)=>s+i.miles,0);
        const penskeMiles = PENSKE.leaseUnits.filter(u=>u.miles>0).reduce((s,u)=>s+u.miles,0);
        const allMiles = totalMiles + tciMiles + penskeMiles;
        return (
          <div className="g4" style={{ marginBottom:14 }}>
            <div className="kpi">
              <div className="klbl">Total Truck Spend</div>
              <div className="kval" style={{ color:"#f47820" }}>{fd(grandTotal,0)}</div>
              <div className="ksub">TEC {fd(TEC_EQUIPMENT.lease.total+rentalTotal+shopTotal,0)} · Penske {fd(penskeTotal,0)} · TCI {fd(tciTotal,0)}</div>
            </div>
            <div className="kpi">
              <div className="klbl">Active Units</div>
              <div className="kval" style={{ color:"#3ddc84" }}>{allUnits}</div>
              <div className="ksub">TEC {tecUnits} · TCI {tciUnits} · Penske {penskeActive}</div>
            </div>
            <div className="kpi">
              <div className="klbl">Total Billed Miles</div>
              <div className="kval" style={{ color:"#4fc3f7" }}>{fn(allMiles,0)}</div>
              <div className="ksub">TEC {fn(totalMiles,0)} · TCI {fn(tciMiles,0)} · Penske {fn(penskeMiles,0)}</div>
            </div>
            <div className="kpi">
              <div className="klbl">Total Monthly Fixed</div>
              <div className="kval" style={{ color:"#f5c542" }}>{fd(allMonthly,0)}</div>
              <div className="ksub">avg {fd(allMonthly/allUnits,0)}/unit · {fd(allMonthly*12,0)}/yr</div>
            </div>
          </div>
        );
      })()}

      {/* View toggle */}
      <div style={{ display:"flex",gap:8,marginBottom:14,flexWrap:"wrap" }}>
        {[
          ["assets", "📋 Full Asset List"],
          ["tci",    `🔧 TCI (${TCI_LEASING.service.length + TCI_LEASING.lease.length + TCI_LEASING.leaseMar.length + TCI_LEASING.rental.length} inv)`],
          ["penske", `🚛 Penske (${PENSKE.invoices.length} inv)`],
          ["lease",  `📋 TEC Lease (${lu.length} units)`],
          ["rentals",`🔄 TEC Rentals (${TEC_EQUIPMENT.rentals.length})`],
          ["shop",   `🔧 TEC Shop`],
        ].map(([id,lbl]) => (
          <button key={id} onClick={() => setView(id)} style={{
            padding:"7px 16px",borderRadius:3,cursor:"pointer",
            fontFamily:"var(--f2)",fontSize:12,fontWeight:700,
            letterSpacing:1,textTransform:"uppercase",
            background:view===id?"var(--or)":"transparent",
            color:view===id?"#fff":"var(--mu)",
            border:`1px solid ${view===id?"var(--or)":"var(--bd)"}`,
          }}>{lbl}</button>
        ))}
      </div>

      {/* ── FULL ASSET LIST ── */}
      {view === "assets" && (() => {
        const trucks = equipment?.units?.filter(u => u.category === "truck") || [];
        const active = trucks.filter(a => a.status === "Active");
        const oos = trucks.filter(a => a.status !== "Active");
        const totalMonthly = active.reduce((s,a) => s+(a.monthlyCost||0), 0);
        const totalBilled = trucks.reduce((s,a) => s+(a.totalBilled||0), 0);
        const totalPaid = trucks.reduce((s,a) => s+(a.totalPaid||0), 0);
        const totalOutstanding = trucks.reduce((s,a) => s+(a.outstanding||0), 0);
        const typeColor = t => t?.includes("Sleeper") ? "#4fc3f7" : t?.includes("Day Cab") ? "#3ddc84" : "#b39ddb";
        const vendorColor = v => v === "TCI" ? "#f47820" : v === "Penske" ? "#ff5252" : v?.includes("TEC") || v?.includes("Transco") ? "#4fc3f7" : v === "Ryder" ? "#26a69a" : "#5a6370";

        if (!equipment) return <div style={{ padding:40,textAlign:"center",color:"var(--mu)" }}>Loading equipment data from AP Aging...</div>;

        return (
          <>
            <div className="g4" style={{ marginBottom:14 }}>
              <div className="kpi">
                <div className="klbl">Total Trucks</div>
                <div className="kval" style={{ color:"var(--or)" }}>{trucks.length}</div>
                <div className="ksub">{active.length} active · {oos.length} returned/OOS</div>
              </div>
              <div className="kpi">
                <div className="klbl">Monthly Lease Total</div>
                <div className="kval" style={{ color:"#f5c542" }}>{fd(totalMonthly,0)}</div>
                <div className="ksub">{fd(totalMonthly*12,0)}/yr</div>
              </div>
              <div className="kpi">
                <div className="klbl">Total Billed</div>
                <div className="kval" style={{ color:"#ff5252" }}>{fd(totalBilled,0)}</div>
                <div className="ksub">{fd(totalPaid,0)} paid</div>
              </div>
              <div className="kpi">
                <div className="klbl">Outstanding</div>
                <div className="kval" style={{ color:totalOutstanding > 0 ? "#ff5252" : "#3ddc84" }}>{fd(totalOutstanding,0)}</div>
              </div>
            </div>

            <div className="card">
              <div className="ctit">Truck Fleet — {trucks.length} Units <span style={{ fontSize:10,color:"#3ddc84",fontWeight:400 }}>· Live from AP Aging</span></div>
              <div style={{ overflowX:"auto" }}>
                <table className="tbl" style={{ fontSize:10 }}>
                  <thead>
                    <tr>
                      <th>Fleet #</th>
                      <th>Type</th>
                      <th>Vendor</th>
                      <th>Vendor Unit</th>
                      <th>Make/Model</th>
                      <th>Year</th>
                      <th>Monthly</th>
                      <th>Mi Rate</th>
                      <th>Invoices</th>
                      <th>Billed</th>
                      <th>Paid</th>
                      <th>Outstanding</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trucks.sort((a,b) => (a.fleetNumber||"").localeCompare(b.fleetNumber||"", undefined, {numeric:true})).map((a,i) => (
                      <tr key={a.id} style={{ background:i%2===0?"var(--s2)":"transparent", opacity:a.status==="Active"?1:0.5 }}>
                        <td style={{ fontFamily:"var(--f2)",fontSize:16,fontWeight:900,color:vendorColor(a.vendor),letterSpacing:1 }}>#{a.fleetNumber}</td>
                        <td><span style={{ fontSize:9,fontWeight:700,color:typeColor(a.type),background:`${typeColor(a.type)}15`,border:`1px solid ${typeColor(a.type)}40`,borderRadius:2,padding:"1px 6px" }}>{a.type}</span></td>
                        <td style={{ fontWeight:700,color:vendorColor(a.vendor) }}>{a.vendor}</td>
                        <td style={{ color:"var(--mu)",fontFamily:"var(--f2)",fontSize:11 }}>{a.vendorUnit}</td>
                        <td>{a.make && a.make !== "—" && a.make !== "\u00e2\u20ac\u201d" ? `${a.make} ${a.model||""}` : "—"}</td>
                        <td style={{ color:"var(--mu)" }}>{a.year && a.year !== "\u00e2\u20ac\u201d" ? a.year : "—"}</td>
                        <td style={{ color:(a.monthlyCost||0) > 0 ? "#f5c542" : "var(--mu)", fontWeight:600 }}>{(a.monthlyCost||0) > 0 ? fd(a.monthlyCost,0) : "—"}</td>
                        <td style={{ color:"var(--mu)",fontSize:9 }}>{(a.mileageRate||0) > 0 ? `$${a.mileageRate}/mi` : "—"}</td>
                        <td>{a.invoiceCount || 0}</td>
                        <td style={{ color:"#ff5252" }}>{(a.totalBilled||0) > 0 ? fd(a.totalBilled,0) : "—"}</td>
                        <td style={{ color:"#3ddc84" }}>{(a.totalPaid||0) > 0 ? fd(a.totalPaid,0) : "—"}</td>
                        <td style={{ color:(a.outstanding||0) > 0 ? "#ff5252" : "var(--mu)", fontWeight:600 }}>{(a.outstanding||0) > 0 ? fd(a.outstanding,0) : "—"}</td>
                        <td><span style={{ fontSize:9,fontWeight:700,color:a.status==="Active"?"#3ddc84":"#ff5252",background:a.status==="Active"?"rgba(61,220,132,.1)":"rgba(255,82,82,.1)",border:`1px solid ${a.status==="Active"?"rgba(61,220,132,.3)":"rgba(255,82,82,.3)"}`,borderRadius:2,padding:"1px 6px" }}>{a.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop:10,fontSize:10,color:equipment?._error ? "#ff5252" : "var(--mu)" }}>
                {equipment?._error
                  ? `⚠ AP Aging fetch failed: ${equipment._error} — Trucks data missing. Check ap-aging-v4.vercel.app/api/equipment.`
                  : <>Live data from AP Aging dashboard · Updated {equipment?.updatedAt ? new Date(equipment.updatedAt).toLocaleDateString() : "—"}</>}
              </div>
            </div>
          </>
        );
      })()}

      {/* ── TCI VIEW ── */}
      {view === "tci" && (
        <>
          {/* Summary KPIs */}
          <div className="g4" style={{ marginBottom:14 }}>
            <div className="kpi">
              <div className="klbl">Total TCI Spend</div>
              <div className="kval" style={{ color:"#f47820" }}>{fd(tciTotal,0)}</div>
              <div className="ksub">Feb lease {fd(TCI_LEASING.lease.reduce((s,i)=>s+i.total,0),0)} · Mar lease {fd(TCI_LEASING.leaseMar.reduce((s,i)=>s+i.total,0),0)}</div>
            </div>
            <div className="kpi">
              <div className="klbl">Lease Units</div>
              <div className="kval" style={{ color:"#3ddc84" }}>5</div>
              <div className="ksub">CA126DC × 5 + M2106 box truck × 1</div>
            </div>
            <div className="kpi">
              <div className="klbl">Mar Variable Miles</div>
              <div className="kval" style={{ color:"#f5c542" }}>{fn(TCI_LEASING.leaseMar.reduce((s,i)=>s+i.miles,0),0)}</div>
              <div className="ksub">@ $0.07/mi · {fd(TCI_LEASING.leaseMar.reduce((s,i)=>s+i.variable,0),2)} total</div>
            </div>
            <div className="kpi">
              <div className="klbl">Box Truck Rental</div>
              <div className="kval" style={{ color:"#4fc3f7" }}>{fd(TCI_LEASING.rental[0].total,0)}</div>
              <div className="ksub">Unit #19129 · Feb 2026</div>
            </div>
          </div>

          {/* Lease contracts */}
          <div className="card" style={{ marginBottom:14 }}>
            <div className="ctit">February Lease Contracts — 5 Freightliner CA126DC (2026)</div>
            <div style={{ fontSize:10,color:"var(--mu)",marginBottom:12 }}>
              Contract PO SCH 2026-1 · Fixed charges Feb 10–28, 2026 · Excess rate $0.16/mi · FHUT prorated Feb–Jul 2026
            </div>
            <div style={{ overflowX:"auto" }}>
              <table className="tbl" style={{ fontSize:11 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign:"left" }}>Invoice</th>
                    <th style={{ textAlign:"left" }}>Unit</th>
                    <th style={{ textAlign:"left" }}>VIN</th>
                    <th>Contract</th>
                    <th>Period</th>
                    <th>Fixed</th>
                    <th>License</th>
                    <th>FHUT</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {TCI_LEASING.lease.map((l,i) => (
                    <tr key={l.invoice} style={{ background:i%2===0?"var(--s2)":"transparent" }}>
                      <td style={{ fontFamily:"var(--f2)",fontSize:12,fontWeight:700,color:"var(--or)" }}>{l.invoice}</td>
                      <td style={{ fontWeight:700,color:"#3ddc84",fontFamily:"var(--f2)",fontSize:14 }}>#{l.unit}</td>
                      <td style={{ fontSize:10,color:"var(--mu)",fontFamily:"monospace" }}>{l.vin}</td>
                      <td style={{ color:"var(--mu)" }}>{l.contract}</td>
                      <td style={{ color:"var(--mu)",fontSize:10 }}>{l.period}</td>
                      <td style={{ color:"#4fc3f7" }}>{fd(l.fixed,2)}</td>
                      <td style={{ color:"#f5c542" }}>{fd(l.license,2)}</td>
                      <td style={{ color:"#b39ddb" }}>{fd(l.fhut,2)}</td>
                      <td style={{ color:"#f47820",fontWeight:700 }}>{fd(l.total,2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5}>TOTAL — 5 units</td>
                    <td style={{ color:"#4fc3f7" }}>{fd(TCI_LEASING.lease.reduce((s,i)=>s+i.fixed,0),0)}</td>
                    <td style={{ color:"#f5c542" }}>{fd(TCI_LEASING.lease.reduce((s,i)=>s+i.license,0),0)}</td>
                    <td style={{ color:"#b39ddb" }}>{fd(TCI_LEASING.lease.reduce((s,i)=>s+i.fhut,0),0)}</td>
                    <td style={{ color:"#f47820",fontWeight:800 }}>{fd(TCI_LEASING.lease.reduce((s,i)=>s+i.total,0),2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* March Lease Contracts */}
          <div className="card" style={{ marginBottom:14 }}>
            <div className="ctit">March Lease Contracts — Fixed + Variable Mileage</div>
            <div style={{ fontSize:10,color:"var(--mu)",marginBottom:12 }}>
              Contract PO SCH 2026-1 · Fixed $2,248/mo · Variable $0.07/mi · Excess rate $0.16/mi
            </div>
            <div style={{ overflowX:"auto" }}>
              <table className="tbl" style={{ fontSize:11 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign:"left" }}>Invoice</th>
                    <th style={{ textAlign:"left" }}>Unit</th>
                    <th>Contract</th>
                    <th>Period</th>
                    <th>Fixed</th>
                    <th>Miles</th>
                    <th>Rate</th>
                    <th>Variable</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {TCI_LEASING.leaseMar.map((l,i) => (
                    <tr key={l.invoice} style={{ background:i%2===0?"var(--s2)":"transparent" }}>
                      <td style={{ fontFamily:"var(--f2)",fontSize:12,fontWeight:700,color:"var(--or)" }}>{l.invoice}</td>
                      <td style={{ fontWeight:700,color:"#3ddc84",fontFamily:"var(--f2)",fontSize:14 }}>#{l.unit}</td>
                      <td style={{ color:"var(--mu)" }}>{l.contract}</td>
                      <td style={{ color:"var(--mu)",fontSize:10 }}>{l.period}</td>
                      <td style={{ color:"#4fc3f7" }}>{fd(l.fixed,2)}</td>
                      <td style={{ color:"#f5c542",fontWeight:600 }}>{fn(l.miles,0)}</td>
                      <td style={{ color:"var(--mu)" }}>${l.miRate}</td>
                      <td style={{ color:"#f47820" }}>{fd(l.variable,2)}</td>
                      <td style={{ color:"#f47820",fontWeight:700 }}>{fd(l.total,2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}>TOTAL — 5 units</td>
                    <td style={{ color:"#4fc3f7" }}>{fd(TCI_LEASING.leaseMar.reduce((s,i)=>s+i.fixed,0),0)}</td>
                    <td style={{ color:"#f5c542" }}>{fn(TCI_LEASING.leaseMar.reduce((s,i)=>s+i.miles,0),0)}</td>
                    <td>—</td>
                    <td style={{ color:"#f47820" }}>{fd(TCI_LEASING.leaseMar.reduce((s,i)=>s+i.variable,0),2)}</td>
                    <td style={{ color:"#f47820",fontWeight:800 }}>{fd(TCI_LEASING.leaseMar.reduce((s,i)=>s+i.total,0),2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Box Truck Rental */}
          <div className="card" style={{ marginBottom:14 }}>
            <div className="ctit">Box Truck Rental — Unit #19129</div>
            {TCI_LEASING.rental.map(r => (
              <div key={r.invoice} style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontFamily:"var(--f2)",fontSize:16,fontWeight:900,color:"#4fc3f7",letterSpacing:1,marginBottom:4 }}>
                    #{r.unit} — {r.make} {r.model} ({r.year})
                  </div>
                  <div style={{ display:"flex",gap:16,fontSize:10,color:"var(--mu)",flexWrap:"wrap" }}>
                    <span>📋 {r.invoice}</span>
                    <span>📅 {r.period}</span>
                    <span>🔢 {fn(r.miles,0)} mi @ ${r.miRate}/mi</span>
                    <span>📝 PO: {r.po}</span>
                  </div>
                  <div style={{ display:"flex",gap:12,marginTop:8,fontSize:11 }}>
                    <span>Fixed: <strong style={{ color:"#4fc3f7" }}>{fd(r.fixed,2)}</strong></span>
                    <span>Env Fee: <strong style={{ color:"#b39ddb" }}>{fd(r.envFee,2)}</strong></span>
                    <span>Variable: <strong style={{ color:"#f5c542" }}>{fd(r.variable,2)}</strong></span>
                  </div>
                </div>
                <div style={{ textAlign:"right",flexShrink:0,marginLeft:16 }}>
                  <div style={{ fontFamily:"var(--f2)",fontSize:30,fontWeight:900,color:"#f47820" }}>{fd(r.total,2)}</div>
                  <div style={{ fontSize:10,color:"var(--mu)" }}>Odometer {fn(r.meterFrom,0)} → {fn(r.meterTo,0)}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Service invoices — liftgate installs */}
          <div className="card">
            <div className="ctit">TCI Service Invoices — Liftgate Charging System Install (×4)</div>
            <div style={{ background:"rgba(244,120,32,.06)",border:"1px solid rgba(244,120,32,.2)",borderRadius:3,padding:"10px 14px",marginBottom:14,fontSize:11,color:"var(--mu)",lineHeight:1.7 }}>
              <strong style={{ color:"#f47820" }}>Same work · Same parts · Same price on all 4 trucks.</strong> Install charge socket, wiring, and 12' dual-pole 4-gauge liftgate cable per customer request.
              Parts include: dual-pole socket, 7-pin mounting bracket, battery lugs, 4GA wire (black+red), liftgate cable.
              Each: Parts $325.84 · Labor $186.00 · Misc $16.74 · Tax $27.75 = <strong style={{ color:"#f47820" }}>$556.33</strong>
            </div>
            <table className="tbl" style={{ fontSize:11 }}>
              <thead>
                <tr>
                  <th style={{ textAlign:"left" }}>Invoice</th>
                  <th style={{ textAlign:"left" }}>Unit</th>
                  <th style={{ textAlign:"left" }}>VIN</th>
                  <th>Odometer</th>
                  <th>Completed</th>
                  <th>Parts</th>
                  <th>Labor</th>
                  <th>Tax</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {TCI_LEASING.service.map((s,i) => (
                  <tr key={s.invoice} style={{ background:i%2===0?"var(--s2)":"transparent" }}>
                    <td style={{ fontFamily:"var(--f2)",fontSize:12,fontWeight:700,color:"var(--or)" }}>{s.invoice}</td>
                    <td style={{ fontWeight:700,color:"#3ddc84",fontFamily:"var(--f2)",fontSize:14 }}>#{s.unit}</td>
                    <td style={{ fontSize:10,color:"var(--mu)",fontFamily:"monospace" }}>{s.vin}</td>
                    <td style={{ color:"var(--mu)" }}>{fn(s.meter,0)} mi</td>
                    <td style={{ color:"var(--mu)" }}>{s.date}</td>
                    <td style={{ color:"#4fc3f7" }}>{fd(s.parts,2)}</td>
                    <td style={{ color:"#f5c542" }}>{fd(s.labor,2)}</td>
                    <td style={{ color:"var(--mu)" }}>{fd(s.tax,2)}</td>
                    <td style={{ color:"#f47820",fontWeight:700 }}>{fd(s.total,2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5}>TOTAL — 4 installs</td>
                  <td style={{ color:"#4fc3f7" }}>{fd(TCI_LEASING.service.reduce((s,i)=>s+i.parts,0),2)}</td>
                  <td style={{ color:"#f5c542" }}>{fd(TCI_LEASING.service.reduce((s,i)=>s+i.labor,0),2)}</td>
                  <td style={{ color:"var(--mu)" }}>{fd(TCI_LEASING.service.reduce((s,i)=>s+i.tax,0),2)}</td>
                  <td style={{ color:"#f47820",fontWeight:800 }}>{fd(TCI_LEASING.service.reduce((s,i)=>s+i.total,0),2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {/* ── PENSKE VIEW ── */}
      {view === "penske" && (
        <>
          {/* Invoice summary KPIs */}
          <div className="g4" style={{ marginBottom:14 }}>
            <div className="kpi">
              <div className="klbl">Total Penske Spend</div>
              <div className="kval" style={{ color:"#f47820" }}>{fd(PENSKE.invoices.reduce((s,i)=>s+i.total,0),0)}</div>
              <div className="ksub">{PENSKE.invoices.length} invoices · Jan–Feb 2026</div>
            </div>
            <div className="kpi">
              <div className="klbl">Lease Units</div>
              <div className="kval" style={{ color:"#3ddc84" }}>4</div>
              <div className="ksub">#585443 (credit) · #587120 · #587127 · subs</div>
            </div>
            <div className="kpi">
              <div className="klbl">Contract & Rental</div>
              <div className="kval" style={{ color:"#f5c542" }}>{fd(3018.99+3650.75,0)}</div>
              <div className="ksub">Invoices 0032649248 + 0032533089</div>
            </div>
            <div className="kpi">
              <div className="klbl">Specials + Fuel</div>
              <div className="kval" style={{ color:"#4fc3f7" }}>{fd(884.24+100.63+1620.97+709.04,0)}</div>
              <div className="ksub">Fuel · Tolls · IFTA Taxes · Fees</div>
            </div>
          </div>

          {/* Invoice list */}
          <div className="card" style={{ marginBottom:14 }}>
            <div className="ctit">All Penske Invoices</div>
            <table className="tbl" style={{ fontSize:11 }}>
              <thead>
                <tr>
                  <th style={{ textAlign:"left" }}>Invoice #</th>
                  <th style={{ textAlign:"left" }}>Date</th>
                  <th style={{ textAlign:"left" }}>Type</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {PENSKE.invoices.map((inv,i) => (
                  <tr key={inv.invoice} style={{ background:i%2===0?"var(--s2)":"transparent" }}>
                    <td style={{ fontFamily:"var(--f2)",fontSize:13,fontWeight:700,color:"var(--or)" }}>{inv.invoice}</td>
                    <td style={{ color:"var(--mu)" }}>{inv.date}</td>
                    <td>{inv.type}</td>
                    <td style={{ color:"#f47820",fontWeight:700 }}>{fd(inv.total,2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ fontWeight:800 }}>TOTAL</td>
                  <td style={{ color:"var(--or)",fontWeight:900,fontFamily:"var(--f2)",fontSize:16 }}>
                    {fd(PENSKE.invoices.reduce((s,i)=>s+i.total,0),2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Lease unit detail */}
          <div className="card" style={{ marginBottom:14 }}>
            <div className="ctit">Contract Unit Detail — Invoice 0032649248 + 0032533089</div>
            <table className="tbl" style={{ fontSize:11 }}>
              <thead>
                <tr>
                  <th style={{ textAlign:"left" }}>Unit #</th>
                  <th>Miles</th>
                  <th>Variable</th>
                  <th>Fixed</th>
                  <th>Tax</th>
                  <th>Total</th>
                  <th style={{ textAlign:"left" }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {PENSKE.leaseUnits.map((u,i) => (
                  <tr key={u.unit+i} style={{ background:i%2===0?"var(--s2)":"transparent" }}>
                    <td style={{ fontWeight:700,color:u.total<0?"#ff5252":"var(--or)",fontFamily:"var(--f2)",fontSize:14,letterSpacing:1 }}>#{u.unit}</td>
                    <td style={{ color:u.miles<0?"#ff5252":"var(--tx)" }}>{fn(u.miles,0)}</td>
                    <td style={{ color:u.variable<0?"#ff5252":"#f47820" }}>{fd(u.variable,2)}</td>
                    <td style={{ color:"#4fc3f7" }}>{u.fixed ? fd(u.fixed,2) : "—"}</td>
                    <td style={{ color:"var(--mu)" }}>{fd(u.tax,2)}</td>
                    <td style={{ color:u.total<0?"#ff5252":"var(--ye)",fontWeight:700 }}>{fd(u.total,2)}</td>
                    <td style={{ color:"var(--mu)",fontSize:10 }}>{u.note}</td>
                  </tr>
                ))}
                {/* New unit activation */}
                <tr style={{ background:"rgba(61,220,132,.05)" }}>
                  <td style={{ fontWeight:700,color:"#3ddc84",fontFamily:"var(--f2)",fontSize:14,letterSpacing:1 }}>#{PENSKE.newUnit.unit}</td>
                  <td style={{ color:"var(--mu)" }}>0</td>
                  <td style={{ color:"var(--mu)" }}>—</td>
                  <td style={{ color:"#4fc3f7" }}>{fd(PENSKE.newUnit.fixed,2)}</td>
                  <td style={{ color:"var(--mu)" }}>{fd(PENSKE.newUnit.tax,2)}</td>
                  <td style={{ color:"#3ddc84",fontWeight:700 }}>{fd(PENSKE.newUnit.total,2)}</td>
                  <td style={{ color:"#3ddc84",fontSize:10 }}>{PENSKE.newUnit.note}</td>
                </tr>
                {/* Rental */}
                <tr>
                  <td style={{ fontWeight:700,color:"#b39ddb",fontFamily:"var(--f2)",fontSize:14,letterSpacing:1 }}>#{PENSKE.rental.unit} <span style={{ fontSize:10 }}>({PENSKE.rental.myUnit})</span></td>
                  <td>{fn(PENSKE.rental.miles,0)}</td>
                  <td style={{ color:"#f47820" }}>{fd(PENSKE.rental.variable,2)}</td>
                  <td style={{ color:"#4fc3f7" }}>{fd(PENSKE.rental.fixed,2)}</td>
                  <td style={{ color:"var(--mu)" }}>{fd(PENSKE.rental.tax,2)}</td>
                  <td style={{ color:"#b39ddb",fontWeight:700 }}>{fd(PENSKE.rental.total,2)}</td>
                  <td style={{ color:"var(--mu)",fontSize:10 }}>{PENSKE.rental.note}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Special charges + Fuel */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
            <div className="card">
              <div className="ctit">Special Charges</div>
              {PENSKE.specials.map(s => (
                <div key={s.invoice} style={{ marginBottom:12,paddingBottom:12,borderBottom:"1px solid var(--bd)" }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 }}>
                    <div>
                      <div style={{ fontFamily:"var(--f2)",fontSize:12,fontWeight:800,color:"var(--or)",letterSpacing:1 }}>{s.invoice}</div>
                      <div style={{ fontSize:10,color:"var(--mu)" }}>{s.date} · Unit #{s.unit}</div>
                    </div>
                    <div style={{ fontFamily:"var(--f2)",fontSize:18,fontWeight:900,color:"#ff8a65" }}>{fd(s.total,2)}</div>
                  </div>
                  {s.items.map((item,i) => (
                    <div key={i} style={{ display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--mu)",padding:"3px 0" }}>
                      <span>{item.desc}</span>
                      <span style={{ color:"var(--or)" }}>{fd(item.amount,2)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="card">
              <div className="ctit">Fuel Invoice — 0032497959</div>
              <div style={{ fontSize:10,color:"var(--mu)",marginBottom:12 }}>{PENSKE.fuel.date} · PTL Las Vegas</div>
              {PENSKE.fuel.items.map((f,i) => (
                <div key={i} style={{ marginBottom:12,paddingBottom:12,borderBottom:"1px solid var(--bd)" }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4 }}>
                    <div>
                      <span style={{ fontFamily:"var(--f2)",fontSize:13,fontWeight:800,color:f.type==="Lease"?"#4fc3f7":"#b39ddb" }}>Unit #{f.unit}</span>
                      <span style={{ fontSize:10,color:"var(--mu)",marginLeft:8 }}>{f.type}</span>
                    </div>
                    <div style={{ fontFamily:"var(--f2)",fontSize:18,fontWeight:900,color:"#f47820" }}>{fd(f.total,2)}</div>
                  </div>
                  <div style={{ fontSize:10,color:"var(--mu)" }}>
                    Diesel: {f.diesel} gal @ ${f.rate.toFixed(4)}
                    {f.def > 0 && <span> · DEF: {f.def} gal @ $4.5490</span>}
                  </div>
                </div>
              ))}
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:8 }}>
                <span style={{ fontSize:11,color:"var(--mu)" }}>Total 170.8 gal · avg $4.1513/gal w/tax</span>
                <span style={{ fontFamily:"var(--f2)",fontSize:20,fontWeight:900,color:"#f47820" }}>{fd(PENSKE.fuel.total,2)}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── LEASE VIEW ── */}
      {view === "lease" && (
        <>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14 }}>
            <div className="kpi">
              <div className="klbl">Fixed Lease Total</div>
              <div className="kval" style={{ color:"#4fc3f7",fontSize:22 }}>{fd(totalFixed,0)}</div>
              <div className="ksub">{fp(totalFixed/TEC_EQUIPMENT.lease.subtotal*100)} of subtotal</div>
            </div>
            <div className="kpi">
              <div className="klbl">Mileage Charges</div>
              <div className="kval" style={{ color:"#f47820",fontSize:22 }}>{fd(totalMiChg,0)}</div>
              <div className="ksub">{fn(totalMiles,0)} mi @ ~$0.092/mi</div>
            </div>
            <div className="kpi">
              <div className="klbl">Sales Tax</div>
              <div className="kval" style={{ color:"#b39ddb",fontSize:22 }}>{fd(TEC_EQUIPMENT.lease.tax,0)}</div>
              <div className="ksub">{fp(TEC_EQUIPMENT.lease.tax/TEC_EQUIPMENT.lease.total*100)} of invoice</div>
            </div>
          </div>

          <div className="card">
            <div className="ctit" style={{ display:"flex",justifyContent:"space-between" }}>
              Lease Contract 60262649 — Per-Unit Detail
              <span style={{ color:"var(--or)",fontFamily:"var(--f2)",fontSize:18,fontWeight:900 }}>{fd(TEC_EQUIPMENT.lease.total,0)}</span>
            </div>
            <div style={{ fontSize:10,color:"var(--mu)",marginBottom:12 }}>
              Agreement #875 · Billing Mar 1–31, 2026 · Based on Feb odometer readings
            </div>
            <div style={{ overflowX:"auto" }}>
              <table className="tbl" style={{ fontSize:11 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign:"left" }}>Unit #</th>
                    <th>Odometer Out</th>
                    <th>Odometer In</th>
                    <th>Miles Feb</th>
                    <th>Fixed Rate</th>
                    <th>Mi Rate</th>
                    <th>Mi Charge</th>
                    <th>Unit Total</th>
                    <th>All-In $/mi</th>
                  </tr>
                </thead>
                <tbody>
                  {[...lu].sort((a,b)=>b.miles-a.miles).map((u,i) => {
                    const cpm = u.total/u.miles;
                    return (
                      <tr key={u.unit} style={{ background:i%2===0?"var(--s2)":"transparent" }}>
                        <td style={{ fontWeight:700,color:"var(--or)",fontFamily:"var(--f2)",fontSize:14,letterSpacing:1 }}>#{u.unit}</td>
                        <td style={{ color:"var(--mu)" }}>{fn(u.odOut,0)}</td>
                        <td style={{ color:"var(--mu)" }}>{fn(u.odIn,0)}</td>
                        <td style={{ color:u.miles>5000?"#f5c542":"var(--tx)",fontWeight:u.miles>5000?700:400 }}>{fn(u.miles,0)}</td>
                        <td style={{ color:"#4fc3f7" }}>{fd(u.fixed,2)}</td>
                        <td style={{ color:"var(--mu)" }}>${u.miRate.toFixed(5)}</td>
                        <td style={{ color:"#f47820" }}>{fd(u.miCharge,2)}</td>
                        <td style={{ color:"var(--ye)",fontWeight:700 }}>{fd(u.total,2)}</td>
                        <td style={{ color:cpm<0.6?"#3ddc84":cpm<1?"#f5c542":"#ff8a65",fontWeight:700 }}>{fd(cpm,3)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td>TOTAL</td>
                    <td colSpan={2}>12 units</td>
                    <td>{fn(totalMiles,0)}</td>
                    <td style={{ color:"#4fc3f7" }}>{fd(totalFixed,0)}</td>
                    <td>—</td>
                    <td style={{ color:"#f47820" }}>{fd(totalMiChg,0)}</td>
                    <td style={{ color:"var(--ye)",fontWeight:800 }}>{fd(TEC_EQUIPMENT.lease.subtotal,0)}</td>
                    <td style={{ color:"#f5c542" }}>{fd(TEC_EQUIPMENT.lease.total/totalMiles,3)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── RENTALS VIEW ── */}
      {view === "rentals" && (
        <>
          <div className="g3" style={{ marginBottom:14 }}>
            <div className="kpi">
              <div className="klbl">Rental Invoices</div>
              <div className="kval" style={{ color:"#3ddc84" }}>{TEC_EQUIPMENT.rentals.length}</div>
              <div className="ksub">Feb 2026</div>
            </div>
            <div className="kpi">
              <div className="klbl">Total Rental Spend</div>
              <div className="kval" style={{ color:"#f47820" }}>{fd(rentalTotal,0)}</div>
              <div className="ksub">Units 103951, 104020, 101579</div>
            </div>
            <div className="kpi">
              <div className="klbl">Unique Rental Units</div>
              <div className="kval" style={{ color:"#4fc3f7" }}>3</div>
              <div className="ksub">#103951 · #104020 · #101579</div>
            </div>
          </div>
          {TEC_EQUIPMENT.rentals.map((r,i) => (
            <div key={r.invoice} className="card" style={{ marginBottom:10 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontFamily:"var(--f2)",fontSize:16,fontWeight:900,color:"var(--or)",letterSpacing:1,marginBottom:4 }}>
                    Unit #{r.unit} — {r.type}
                  </div>
                  <div style={{ display:"flex",gap:16,fontSize:10,color:"var(--mu)",flexWrap:"wrap" }}>
                    <span>📋 Invoice {r.invoice}</span>
                    <span>📅 {r.date}</span>
                    <span>📆 {r.period}</span>
                    <span>📝 {r.note}</span>
                  </div>
                </div>
                <div style={{ textAlign:"right",flexShrink:0,marginLeft:16 }}>
                  <div style={{ fontFamily:"var(--f2)",fontSize:26,fontWeight:900,color:"#f47820" }}>{fd(r.total,2)}</div>
                  <div style={{ fontSize:10,color:"var(--mu)" }}>subtotal {fd(r.subtotal,2)} + tax {fd(r.tax,2)}</div>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {/* ── SHOP VIEW ── */}
      {view === "shop" && (
        <>
          {TEC_EQUIPMENT.shop.map(s => (
            <div key={s.invoice} className="card">
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,paddingBottom:12,borderBottom:"1px solid var(--bd)" }}>
                <div>
                  <div style={{ fontFamily:"var(--f2)",fontSize:18,fontWeight:900,color:"#f5c542",marginBottom:4 }}>
                    Unit #{s.unit} — {s.description}
                  </div>
                  <div style={{ display:"flex",gap:16,fontSize:10,color:"var(--mu)",flexWrap:"wrap" }}>
                    <span>📋 Invoice {s.invoice}</span>
                    <span>📅 {s.date}</span>
                    <span>🔢 VIN {s.vin}</span>
                    <span>📍 Las Vegas Facility</span>
                  </div>
                  <div style={{ fontSize:10,color:"var(--mu)",marginTop:6 }}>{s.note}</div>
                </div>
                <div style={{ textAlign:"right",flexShrink:0,marginLeft:16 }}>
                  <div style={{ fontFamily:"var(--f2)",fontSize:30,fontWeight:900,color:"#f5c542" }}>{fd(s.total,2)}</div>
                  <div style={{ fontSize:10,color:"var(--mu)" }}>parts {fd(s.subtotal,2)} + tax {fd(s.tax,2)}</div>
                </div>
              </div>
              <div style={{ background:"rgba(245,197,66,.06)",border:"1px solid rgba(245,197,66,.2)",borderRadius:3,padding:"12px 14px" }}>
                <div style={{ fontSize:10,color:"var(--mu)",lineHeight:1.7 }}>
                  <strong style={{ color:"#f5c542" }}>Note:</strong> Driver from Show Freight picked up mattress. 
                  Customer-requested per Juan. Billed directly to customer.
                  This vehicle was in for 90-day DOT inspection (CARB CTC Mar/Sep cycle).
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── TRAILER DATA (McKinney Invoice LSVR100905 · Feb 28, 2026) ──
const TRAILERS_INV = {
  invoice: "LSVR100905",
  vendor: "McKinney Trailers",
  date: "Feb 28, 2026",
  total: 12330.55,
  subtotal: 11377.68,
  tax: 952.87,
  repairs: [
    {
      invoice:"LSVN10317", date:"Feb 20, 2026", unit:"536461",
      vin:"3H3V532C4FT006012", workOrder:"806050",
      type:"ERS-Road Call", location:"3165 Sunset Rd, Las Vegas NV",
      completed:"Jan 28, 2026", mileage:52894,
      description:"Right Side Door Damaged",
      total:2022.20, subtotal:1908.49, tax:113.71,
      labor:550.00,
      items:[
        { desc:"Duraplate Door",                 qty:1,   unit:546.25, total:546.25 },
        { desc:"Mileage Charge",                 qty:45,  unit:1.15,   total:51.75  },
        { desc:"Mobile Service/Call Out Fee",    qty:1,   unit:28.75,  total:28.75  },
        { desc:"Door Seals",                     qty:2,   unit:51.75,  total:103.50 },
        { desc:"Corner Tabs",                    qty:1,   unit:0.67,   total:0.67   },
        { desc:"Glue",                           qty:4,   unit:21.02,  total:84.09  },
        { desc:"Bolt Kit",                       qty:1,   unit:63.25,  total:63.25  },
        { desc:"Grinding Wheels",                qty:1,   unit:7.45,   total:7.45   },
        { desc:"Hinge",                          qty:5,   unit:63.25,  total:316.25 },
        { desc:"Hinge Pins",                     qty:5,   unit:8.13,   total:40.65  },
        { desc:"Cotter Pins",                    qty:5,   unit:0.52,   total:2.60   },
        { desc:"DOT Tape",                       qty:6,   unit:2.42,   total:14.52  },
        { desc:"State Tax",                      qty:1,   unit:98.76,  total:98.76  },
      ],
    },
    {
      invoice:"LSVN10320", date:"Feb 27, 2026", unit:"561823",
      vin:"1UYVS2536K3723983", workOrder:"807936",
      type:"ERS-Road Call", location:"7050 Lindell Rd, Las Vegas NV",
      completed:"Feb 24, 2026", mileage:3171,
      description:"Mud Flap & Mount Damaged — Replaced Mudflaps and Bolts",
      total:432.83, subtotal:422.57, tax:10.26,
      labor:300.00,
      items:[
        { desc:"Mobile Service/Call Out Fee",    qty:1,   unit:28.75,  total:28.75  },
        { desc:"Mileage Charge",                 qty:45,  unit:1.15,   total:51.75  },
        { desc:"Mudflap",                        qty:1,   unit:29.62,  total:29.62  },
        { desc:"Bolt Kit",                       qty:1,   unit:12.45,  total:12.45  },
      ],
    },
  ],
  units: [
    { unit:"280860", type:"28ft Van Liftgate",  from:"Feb 1", to:"Feb 28", days:28, base:625.00,  miRate:0.070, miles:0,    total:677.34,  final:false },
    { unit:"280862", type:"28ft Van Liftgate",  from:"Feb 1", to:"Feb 28", days:28, base:625.00,  miRate:0.070, miles:1293, total:775.43,  final:false },
    { unit:"533809", type:"53ft Van AirRide",   from:"Feb 3", to:"Feb 27", days:25, base:295.00,  miRate:0.080, miles:1348, total:436.58,  final:true  },
    { unit:"534667", type:"53ft Van AirRide",   from:"Feb 1", to:"Feb 28", days:28, base:285.00,  miRate:0.080, miles:500,  total:352.22,  final:false },
    { unit:"535997", type:"53ft Van AirRide",   from:"Feb 11",to:"Feb 28", days:18, base:174.05,  miRate:0.080, miles:77,   total:195.30,  final:false },
    { unit:"536461", type:"53ft Van AirRide",   from:"Feb 1", to:"Feb 27", days:27, base:285.00,  miRate:0.080, miles:2766, total:548.68,  final:true  },
    { unit:"536533", type:"53ft Van AirRide",   from:"Feb 1", to:"Feb 27", days:27, base:295.00,  miRate:0.080, miles:1004, total:406.75,  final:true  },
    { unit:"536540", type:"53ft Van AirRide",   from:"Feb 1", to:"Feb 28", days:28, base:287.80,  miRate:0.080, miles:347,  total:341.99,  final:false },
    { unit:"536603", type:"53ft Van AirRide",   from:"Feb 5", to:"Feb 28", days:24, base:233.05,  miRate:0.080, miles:816,  total:323.32,  final:false },
    { unit:"536651", type:"53ft Van AirRide",   from:"Feb 1", to:"Feb 27", days:27, base:285.00,  miRate:0.080, miles:8810, total:1072.70, final:true  },
    { unit:"537965", type:"53ft Van AirRide",   from:"Feb 12",to:"Feb 27", days:16, base:295.00,  miRate:0.080, miles:53,   total:324.30,  final:true  },
    { unit:"538219", type:"53ft Van AirRide",   from:"Feb 1", to:"Feb 28", days:28, base:285.00,  miRate:0.080, miles:0,    total:308.87,  final:false },
    { unit:"538235", type:"53ft Van AirRide",   from:"Feb 5", to:"Feb 28", days:24, base:233.05,  miRate:0.080, miles:90,   total:260.37,  final:false },
    { unit:"538686", type:"53ft Van AirRide",   from:"Feb 1", to:"Feb 28", days:28, base:287.80,  miRate:0.080, miles:91,   total:319.79,  final:false },
    { unit:"538736", type:"53ft Van AirRide",   from:"Feb 1", to:"Feb 28", days:28, base:287.80,  miRate:0.080, miles:859,  total:386.38,  final:false },
    { unit:"539103", type:"53ft Van AirRide",   from:"Feb 1", to:"Feb 27", days:27, base:285.00,  miRate:0.080, miles:3818, total:639.89,  final:true  },
    { unit:"546889", type:"53ft Van AirRide",   from:"Feb 3", to:"Feb 28", days:26, base:250.75,  miRate:0.080, miles:111,  total:281.37,  final:false },
    { unit:"555089", type:"53ft Van AirRide",   from:"Feb 3", to:"Feb 28", days:26, base:250.75,  miRate:0.080, miles:55,   total:276.52,  final:false },
    { unit:"557269", type:"53ft Van AirRide",   from:"Feb 1", to:"Feb 27", days:27, base:285.00,  miRate:0.080, miles:386,  total:342.33,  final:true  },
    { unit:"557353", type:"53ft Van AirRide",   from:"Feb 11",to:"Feb 28", days:18, base:174.05,  miRate:0.080, miles:111,  total:198.25,  final:false },
    { unit:"557356", type:"53ft Van AirRide",   from:"Feb 1", to:"Feb 27", days:27, base:285.00,  miRate:0.080, miles:1188, total:411.87,  final:true  },
    { unit:"558971", type:"53ft Van AirRide",   from:"Feb 1", to:"Feb 28", days:28, base:287.80,  miRate:0.080, miles:3682, total:631.13,  final:false },
    { unit:"558974", type:"53ft Van AirRide",   from:"Feb 1", to:"Feb 27", days:27, base:287.80,  miRate:0.080, miles:1109, total:408.05,  final:true  },
    { unit:"561190", type:"53ft Van AirRide",   from:"Feb 3", to:"Feb 28", days:26, base:250.75,  miRate:0.080, miles:665,  total:329.41,  final:false },
    { unit:"561409", type:"53ft Van AirRide",   from:"Feb 1", to:"Feb 28", days:28, base:285.00,  miRate:0.080, miles:1842, total:468.57,  final:false },
    { unit:"561412", type:"53ft Van AirRide",   from:"Feb 1", to:"Feb 27", days:27, base:285.00,  miRate:0.080, miles:1488, total:437.88,  final:true  },
    { unit:"561823", type:"53ft Van AirRide",   from:"Feb 1", to:"Feb 28", days:28, base:287.80,  miRate:0.080, miles:110,  total:321.44,  final:false },
    { unit:"561826", type:"53ft Van AirRide",   from:"Feb 1", to:"Feb 28", days:28, base:285.00,  miRate:0.080, miles:1186, total:411.69,  final:false },
    { unit:"561827", type:"53ft Van AirRide",   from:"Feb 1", to:"Feb 28", days:28, base:285.00,  miRate:0.080, miles:1537, total:442.13,  final:false },
  ],
};


// ── XTRA LEASE DATA ───────────────────────────────────────────
const XTRA_LEASE = {
  rental: {
    invoice:"05469840", vendor:"XTRA Lease", date:"Mar 11, 2026",
    total:5362.39, subtotal:4951.24, tax:411.15,
    units: [
      { unit:"782991", type:"Road Van 53'",         auth:"Adrian M",     from:"Jan 16", to:"Feb 17", rental:670.00,  miRate:0.06, miles:562,   miCharge:33.72,   cdw:0,  total:703.72  },
      { unit:"F10777", type:"Road Van 28' Liftgate", auth:"Gabriel Colon",from:"Feb 11", to:"Mar 10", rental:695.00,  miRate:0.00, miles:1400,  miCharge:126.00,  cdw:0,  total:821.00  },
      { unit:"H10068", type:"Road Van 53' Liftgate", auth:"Arthur Jackson",from:"Feb 11",to:"Feb 17", rental:325.00,  miRate:0.10, miles:9984,  miCharge:-181.60, cdw:21, total:164.40  },
      { unit:"W07968", type:"Road Van 53'",          auth:"Adrian M",     from:"Jan 16", to:"Feb 12", rental:495.00,  miRate:0.06, miles:2668,  miCharge:160.08,  cdw:0,  total:655.08  },
      { unit:"W28413", type:"Road Van 53'",          auth:"Adrian M",     from:"Jan 16", to:"Feb 12", rental:495.00,  miRate:0.06, miles:5139,  miCharge:308.34,  cdw:0,  total:803.34  },
      { unit:"W83192", type:"Road Van 53' Liftgate", auth:"Gabriel Colon",from:"Feb 4",  to:"Feb 11", rental:330.00,  miRate:0.10, miles:635,   miCharge:63.50,   cdw:0,  total:393.50  },
      { unit:"W95465", type:"Road Van 53' Liftgate", auth:"Arthur Jackson",from:"Feb 11",to:"Feb 17", rental:275.00,  miRate:0.10, miles:14177, miCharge:62.70,   cdw:21, total:358.70  },
      { unit:"W97050", type:"Road Van 53' Liftgate", auth:"Chris Adamson",from:"Feb 11", to:"Feb 19", rental:385.00,  miRate:0.10, miles:6665,  miCharge:666.50,  cdw:0,  total:1051.50 },
    ],
  },
  service: {
    invoice:"05464181", vendor:"XTRA Lease", date:"Feb 27, 2026",
    total:1141.55, subtotal:1102.60, tax:38.95,
    unit:"H10068", type:"Road Van 53' Liftgate",
    items:[
      { desc:"Replace Roll Door Bottom Panel",        labor:375.00, parts:408.60, total:783.60 },
      { desc:"Replace Roll Door Intermediate Panel",  labor:262.50, parts:56.50,  total:319.00 },
    ],
  },
};


// ── MOUNTAIN WEST UTILITY TRAILER DATA ───────────────────────
const MTN_WEST = {
  invoice:"BA101000767:01", vendor:"Mountain West Utility Trailer, Inc",
  date:"Feb 27, 2026", period:"Mar 1 – Mar 31, 2026",
  total:12600.00, subtotal:12600.00, tax:0.00,
  ratePerUnit:600.00,
  units: [
    { unit:"159171", vin:"1UYVS2533R3032016", year:2024 },
    { unit:"159172", vin:"1UYVS2535R3032017", year:2024 },
    { unit:"159173", vin:"1UYVS2537R3032018", year:2024 },
    { unit:"159174", vin:"1UYVS2539R3032019", year:2024 },
    { unit:"159175", vin:"1UYVS2535R3032020", year:2024 },
    { unit:"159176", vin:"1UYVS2537R3032021", year:2024 },
    { unit:"159177", vin:"1UYVS2539R3032022", year:2024 },
    { unit:"159178", vin:"1UYVS2530R3032023", year:2024 },
    { unit:"159160", vin:"1UYVS2539R3032005", year:2024 },
    { unit:"159164", vin:"1UYVS2536R3032009", year:2024 },
    { unit:"159166", vin:"1UYVS2534R3032011", year:2024 },
    { unit:"159167", vin:"1UYVS2536R3032012", year:2024 },
    { unit:"159168", vin:"1UYVS2538R3032013", year:2024 },
    { unit:"159169", vin:"1UYVS253XR3032014", year:2024 },
    { unit:"159170", vin:"1UYVS2531R3032015", year:2024 },
    { unit:"158992", vin:"1UYVS2538P3850712", year:2023 },
    { unit:"158993", vin:"1UYVS253XP3850713", year:2023 },
    { unit:"158994", vin:"1UYVS2531P3850714", year:2023 },
    { unit:"158995", vin:"1UYVS2533P3850715", year:2023 },
    { unit:"158996", vin:"1UYVS2535P3850716", year:2023 },
    { unit:"158997", vin:"1UYVS2537P3850717", year:2023 },
  ],
};

// ── TRAILER FLEET ─────────────────────────────────────────────
function TrailerFleet() {
  const [sortKey, setSortKey] = useState("total");
  const [filter, setFilter]   = useState("all"); // all | active | final
  const [view, setView]       = useState("assets"); // assets | fleet | repairs
  const [vendor, setVendor]   = useState("all"); // all | mckinney | xtra | mtnwest
  const equipment = useEquipment();

  const units = TRAILERS_INV.units;
  const active   = units.filter(u => !u.final);
  const returning= units.filter(u =>  u.final);
  const withMiles= units.filter(u => u.miles > 0);
  const totalMiles = units.reduce((s,u) => s+u.miles, 0);
  const avgCPM = withMiles.reduce((s,u) => s + u.total/u.miles, 0) / withMiles.length;

  const filtered = (() => {
    let arr = filter === "active" ? active : filter === "final" ? returning : units;
    return [...arr].sort((a,b) => {
      if (sortKey === "total")  return b.total - a.total;
      if (sortKey === "miles")  return b.miles - a.miles;
      if (sortKey === "cpm")    return (b.miles>0 ? b.total/b.miles : 0) - (a.miles>0 ? a.total/a.miles : 0);
      if (sortKey === "base")   return b.base - a.base;
      if (sortKey === "unit")   return a.unit.localeCompare(b.unit);
      return 0;
    });
  })();

  return (
    <div>
      <div className="ptitle">Trailers</div>
      <div className="psub">
        {equipment?.units?.length
          ? `${equipment.units.filter(u => u.category === "trailer").length} trailers · ${new Set(equipment.units.filter(u => u.category === "trailer").map(u => u.vendor)).size} vendors · live from AP Aging · ${PERIOD}`
          : `McKinney · XTRA Lease · Mountain West · ${PERIOD}`}
      </div>

      {/* View toggle */}
      <div style={{ display:"flex",gap:8,marginBottom:14 }}>
        {[["assets","📋 Full Asset List"],["fleet","🚜 Fleet & Rentals"],["repairs","🔧 Repairs & Maintenance"]].map(([id,lbl]) => (
          <button key={id} onClick={() => setView(id)} style={{
            padding:"7px 16px",borderRadius:3,cursor:"pointer",
            fontFamily:"var(--f2)",fontSize:12,fontWeight:700,
            letterSpacing:1,textTransform:"uppercase",
            background:view===id?"var(--or)":"transparent",
            color:view===id?"#fff":"var(--mu)",
            border:`1px solid ${view===id?"var(--or)":"var(--bd)"}`,
          }}>{lbl}</button>
        ))}
      </div>

      {/* ── FULL TRAILER ASSET LIST (Live from AP Aging) ── */}
      {view === "assets" && (() => {
        const trailers = equipment?.units?.filter(u => u.category === "trailer") || [];
        const active = trailers.filter(a => a.status === "Active");
        const returned = trailers.filter(a => a.status !== "Active");
        const totalMonthly = active.reduce((s,a) => s+(a.monthlyCost||0), 0);
        const totalBilled = trailers.reduce((s,a) => s+(a.totalBilled||0), 0);
        const totalPaid = trailers.reduce((s,a) => s+(a.totalPaid||0), 0);
        const totalOutstanding = trailers.reduce((s,a) => s+(a.outstanding||0), 0);
        const vendorColor = v => v === "McKinney" ? "#f47820" : v === "Xtra" || v === "Xtra Lease" ? "#4fc3f7" : v?.includes("Utility") || v?.includes("Mountain") ? "#3ddc84" : v === "Premier" ? "#b39ddb" : v === "Boxwheel" ? "#26a69a" : "#5a6370";
        const byVendor = {};
        trailers.forEach(a => { byVendor[a.vendor] = (byVendor[a.vendor]||0) + 1; });

        if (!equipment) return <div style={{ padding:40,textAlign:"center",color:"var(--mu)" }}>Loading equipment data from AP Aging...</div>;

        return (
          <>
            <div className="g4" style={{ marginBottom:14 }}>
              <div className="kpi">
                <div className="klbl">Total Trailers</div>
                <div className="kval" style={{ color:"var(--or)" }}>{trailers.length}</div>
                <div className="ksub">{active.length} active · {returned.length} returned</div>
              </div>
              <div className="kpi">
                <div className="klbl">Monthly Base Rental</div>
                <div className="kval" style={{ color:"#f5c542" }}>{fd(totalMonthly,0)}</div>
                <div className="ksub">{fd(totalMonthly*12,0)}/yr</div>
              </div>
              <div className="kpi">
                <div className="klbl">Total Billed</div>
                <div className="kval" style={{ color:"#ff5252" }}>{fd(totalBilled,0)}</div>
                <div className="ksub">{fd(totalPaid,0)} paid</div>
              </div>
              <div className="kpi">
                <div className="klbl">Outstanding</div>
                <div className="kval" style={{ color:totalOutstanding > 0 ? "#ff5252" : "#3ddc84" }}>{fd(totalOutstanding,0)}</div>
              </div>
            </div>

            <div className="card">
              <div className="ctit">Trailer Fleet — {trailers.length} Units <span style={{ fontSize:10,color:"#3ddc84",fontWeight:400 }}>· Live from AP Aging</span></div>
              <div style={{ overflowX:"auto" }}>
                <table className="tbl" style={{ fontSize:10 }}>
                  <thead>
                    <tr>
                      <th>Unit #</th>
                      <th>Vendor</th>
                      <th style={{ textAlign:"left" }}>Type</th>
                      <th>Monthly</th>
                      <th>Mi Rate</th>
                      <th>Invoices</th>
                      <th>Billed</th>
                      <th>Paid</th>
                      <th>Outstanding</th>
                      <th>Last Invoice</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trailers.sort((a,b) => (a.vendor||"").localeCompare(b.vendor||"") || (a.fleetNumber||"").localeCompare(b.fleetNumber||"", undefined, {numeric:true})).map((a,i) => (
                      <tr key={a.id} style={{ background:i%2===0?"var(--s2)":"transparent", opacity:a.status==="Active"?1:0.5 }}>
                        <td style={{ fontFamily:"var(--f2)",fontSize:14,fontWeight:900,color:vendorColor(a.vendor),letterSpacing:1 }}>#{a.fleetNumber}</td>
                        <td style={{ fontWeight:700,color:vendorColor(a.vendor),fontSize:10 }}>{a.vendor}</td>
                        <td style={{ textAlign:"left",fontSize:10 }}>{a.type}</td>
                        <td style={{ color:(a.monthlyCost||0) > 0 ? "#f5c542" : "var(--mu)", fontWeight:600 }}>{(a.monthlyCost||0) > 0 ? fd(a.monthlyCost,0) : "—"}</td>
                        <td style={{ color:"var(--mu)",fontSize:9 }}>{(a.mileageRate||0) > 0 ? `$${a.mileageRate}/mi` : "—"}</td>
                        <td>{a.invoiceCount || 0}</td>
                        <td style={{ color:"#ff5252" }}>{(a.totalBilled||0) > 0 ? fd(a.totalBilled,0) : "—"}</td>
                        <td style={{ color:"#3ddc84" }}>{(a.totalPaid||0) > 0 ? fd(a.totalPaid,0) : "—"}</td>
                        <td style={{ color:(a.outstanding||0) > 0 ? "#ff5252" : "var(--mu)", fontWeight:600 }}>{(a.outstanding||0) > 0 ? fd(a.outstanding,0) : "—"}</td>
                        <td style={{ fontSize:9,color:"var(--mu)" }}>{a.lastInvoiceDate || "—"}</td>
                        <td><span style={{ fontSize:9,fontWeight:700,color:a.status==="Active"?"#3ddc84":"#ff8a65",background:a.status==="Active"?"rgba(61,220,132,.1)":"rgba(255,138,101,.1)",border:`1px solid ${a.status==="Active"?"rgba(61,220,132,.3)":"rgba(255,138,101,.3)"}`,borderRadius:2,padding:"1px 6px" }}>{a.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop:10,fontSize:10,color:equipment?._error ? "#ff5252" : "var(--mu)" }}>
                {equipment?._error
                  ? `⚠ AP Aging fetch failed: ${equipment._error} — Trailers data missing. Check ap-aging-v4.vercel.app/api/equipment.`
                  : <>Live data from AP Aging dashboard · Updated {equipment?.updatedAt ? new Date(equipment.updatedAt).toLocaleDateString() : "—"} ·
                    {Object.entries(byVendor).map(([v,c]) => <span key={v}> <span style={{ color:vendorColor(v) }}>■ {v}</span> ({c})</span>)}</>}
              </div>
            </div>
          </>
        );
      })()}

      {/* ── FLEET & RENTALS ── */}
      {view === "fleet" && (() => {
        const mcUnits   = TRAILERS_INV.units;
        const xtraUnits = XTRA_LEASE.rental.units;
        const mwUnits   = MTN_WEST.units.map(u => ({
          ...u, type:"Dry Van", from:"Mar 1", to:"Mar 31",
          rental:MTN_WEST.ratePerUnit, miRate:0, miles:0,
          miCharge:0, cdw:0, total:MTN_WEST.ratePerUnit, final:false,
          auth:"—",
        }));
        const allUnits = [...mcUnits, ...xtraUnits, ...mwUnits];
        const displayUnits = vendor==="mckinney" ? mcUnits
                           : vendor==="xtra"     ? xtraUnits
                           : vendor==="mtnwest"  ? mwUnits
                           : allUnits;

        const totalRent = (vendor==="mckinney"?TRAILERS_INV.total:0) + (vendor==="xtra"?XTRA_LEASE.rental.total:0) + (vendor==="all"?(TRAILERS_INV.total+XTRA_LEASE.rental.total):0);
        const totalMiles = displayUnits.reduce((s,u)=>s+Math.abs(u.miles||u.miles||0),0);

        return (<>

        {/* Vendor tabs */}
        <div style={{ display:"flex",gap:8,marginBottom:14 }}>
          {[["all","All Vendors"],["mckinney","McKinney"],["xtra","XTRA Lease"],["mtnwest","Mtn West"]].map(([id,lbl]) => (
            <button key={id} onClick={()=>setVendor(id)} style={{
              padding:"6px 14px",borderRadius:3,cursor:"pointer",
              fontFamily:"var(--f2)",fontSize:11,fontWeight:700,
              letterSpacing:1,textTransform:"uppercase",
              background:vendor===id?"var(--s1)":"transparent",
              color:vendor===id?"var(--or)":"var(--mu)",
              border:`1px solid ${vendor===id?"var(--or)":"var(--bd)"}`,
            }}>{lbl}</button>
          ))}
        </div>

        {/* Summary KPIs — reactive to vendor selection */}
      <div className="g4" style={{ marginBottom:14 }}>
        {(() => {
          const vCost  = vendor==="mckinney" ? TRAILERS_INV.total
                       : vendor==="xtra"     ? XTRA_LEASE.rental.total
                       : vendor==="mtnwest"  ? MTN_WEST.total
                       : TRAILERS_INV.total + XTRA_LEASE.rental.total + MTN_WEST.total;
          const vUnits = displayUnits.length;
          const vMiles = displayUnits.reduce((s,u)=>s+Math.abs(u.miles||0),0);
          const vAvg   = vUnits > 0 ? vCost / vUnits : 0;
          const vSub   = vendor==="mckinney" ? "LSVR100905 · Feb 28, 2026"
                       : vendor==="xtra"     ? "05469840 · Mar 11, 2026"
                       : vendor==="mtnwest"  ? "BA101000767 · Feb 27, 2026"
                       : `McKinney ${fd(TRAILERS_INV.total,0)} · XTRA ${fd(XTRA_LEASE.rental.total,0)} · Mtn West ${fd(MTN_WEST.total,0)}`;
          return (<>
            <div className="kpi">
              <div className="klbl">Total Rental Cost</div>
              <div className="kval" style={{ color:"#f47820" }}>{fd(vCost,0)}</div>
              <div className="ksub" style={{ fontSize:9 }}>{vSub}</div>
            </div>
            <div className="kpi">
              <div className="klbl">Units</div>
              <div className="kval" style={{ color:"#3ddc84" }}>{vUnits}</div>
              <div className="ksub">{
                vendor==="mckinney" ? "29 units · 10 returning" :
                vendor==="xtra"     ? "8 units" :
                vendor==="mtnwest"  ? "21 units · $600 flat/ea" :
                "29 McKinney · 8 XTRA · 21 Mtn West"
              }</div>
            </div>
            <div className="kpi">
              <div className="klbl">Avg Cost / Unit</div>
              <div className="kval" style={{ color:"#f5c542" }}>{fd(vAvg,0)}</div>
              <div className="ksub">this billing period</div>
            </div>
            <div className="kpi">
              <div className="klbl">Total Miles</div>
              <div className="kval" style={{ color:"#4fc3f7" }}>{fn(vMiles,0)}</div>
              <div className="ksub">{
                vendor==="all"    ? "McKinney 35,342 · XTRA 41,230" :
                vendor==="mtnwest"? "no mileage billing" : ""
              }</div>
            </div>
          </>);
        })()}
      </div>

      {/* Type breakdown + Cost breakdown — reactive to vendor */}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14 }}>
        <div className="card">
          <div className="ctit">Fleet Composition</div>
          {(() => {
            const types = {};
            displayUnits.forEach(u => {
              const t = u.type || "Dry Van";
              types[t] = (types[t]||0) + 1;
            });
            const total = displayUnits.length;
            const active   = displayUnits.filter(u => !u.final).length;
            const returning= displayUnits.filter(u =>  u.final).length;
            return (
              <>
                {Object.entries(types).sort((a,b)=>b[1]-a[1]).map(([label,count],i) => {
                  const colors = ["#4fc3f7","#b39ddb","#3ddc84","#f5c542","#f47820"];
                  const col = colors[i % colors.length];
                  return (
                    <div key={label} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",
                      padding:"10px 0",borderBottom:"1px solid var(--bd)" }}>
                      <div>
                        <div style={{ fontSize:12,fontWeight:600,color:"var(--tx)" }}>{label}</div>
                        <div className="bar" style={{ width:200,marginTop:5 }}>
                          <div className="bfil" style={{ width:`${count/total*100}%`,background:col }} />
                        </div>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontFamily:"var(--f2)",fontSize:28,fontWeight:900,color:col }}>{count}</div>
                        <div style={{ fontSize:10,color:"var(--mu)" }}>{fp(count/total*100)}</div>
                      </div>
                    </div>
                  );
                })}
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:12 }}>
                  <div style={{ display:"flex",gap:16 }}>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:9,color:"#3ddc84",letterSpacing:2,textTransform:"uppercase" }}>Active</div>
                      <div style={{ fontFamily:"var(--f2)",fontSize:22,fontWeight:900,color:"#3ddc84" }}>{active}</div>
                    </div>
                    {returning > 0 && (
                      <div style={{ textAlign:"center" }}>
                        <div style={{ fontSize:9,color:"#ff5252",letterSpacing:2,textTransform:"uppercase" }}>Returning</div>
                        <div style={{ fontFamily:"var(--f2)",fontSize:22,fontWeight:900,color:"#ff5252" }}>{returning}</div>
                      </div>
                    )}
                  </div>
                  <div style={{ fontFamily:"var(--f2)",fontSize:32,fontWeight:900,color:"var(--tx)" }}>{total} total</div>
                </div>
              </>
            );
          })()}
        </div>

        <div className="card">
          <div className="ctit">Cost Breakdown</div>
          {(() => {
            const vCost     = vendor==="mckinney" ? TRAILERS_INV.total
                            : vendor==="xtra"     ? XTRA_LEASE.rental.total
                            : vendor==="mtnwest"  ? MTN_WEST.total
                            : TRAILERS_INV.total + XTRA_LEASE.rental.total + MTN_WEST.total;
            const baseRent  = displayUnits.reduce((s,u)=>s+(u.rental||u.base||MTN_WEST.ratePerUnit||0),0);
            const miCharge  = displayUnits.reduce((s,u)=>s+Math.abs(u.miCharge||0),0);
            const taxAmt    = vendor==="mckinney" ? TRAILERS_INV.tax
                            : vendor==="xtra"     ? XTRA_LEASE.rental.tax
                            : vendor==="mtnwest"  ? 0
                            : TRAILERS_INV.tax + XTRA_LEASE.rental.tax;
            return (
              <>
                {[
                  { label:"Base Rental",    val:baseRent, color:"#4fc3f7" },
                  { label:"Mileage Charges",val:miCharge, color:"#f47820" },
                  { label:"Tax",            val:taxAmt,   color:"#b39ddb" },
                ].map(item => (
                  <div key={item.label} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",
                    padding:"10px 0",borderBottom:"1px solid var(--bd)" }}>
                    <div>
                      <div style={{ fontSize:12,fontWeight:600,color:"var(--tx)" }}>{item.label}</div>
                      <div style={{ fontSize:10,color:"var(--mu)" }}>{fp(item.val/vCost*100)} of total</div>
                    </div>
                    <div style={{ fontFamily:"var(--f2)",fontSize:22,fontWeight:900,color:item.color }}>{fd(item.val,0)}</div>
                  </div>
                ))}
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:12 }}>
                  <div style={{ fontFamily:"var(--f2)",fontSize:12,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"var(--or)" }}>Total Invoice</div>
                  <div style={{ fontFamily:"var(--f2)",fontSize:26,fontWeight:900,color:"var(--or)" }}>{fd(vCost,0)}</div>
                </div>
              </>
            );
          })()}
        </div>
      </div>


      {/* Per-unit table */}
      <div className="card">
        <div className="ctit" style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          Per-Unit Detail
          <div style={{ display:"flex",gap:8,alignItems:"center" }}>
            {[["all","All"],["active","Active"],["final","Returning"]].map(([id,lbl]) => (
              <button key={id} onClick={() => setFilter(id)} style={{
                padding:"4px 10px",borderRadius:3,cursor:"pointer",fontSize:10,fontWeight:700,
                fontFamily:"var(--f2)",letterSpacing:1,textTransform:"uppercase",
                background:filter===id?"var(--or)":"transparent",
                color:filter===id?"#fff":"var(--mu)",
                border:`1px solid ${filter===id?"var(--or)":"var(--bd)"}`,
              }}>{lbl}</button>
            ))}
            <select className="inp" style={{ width:"auto",fontSize:10,padding:"3px 7px" }}
              value={sortKey} onChange={e => setSortKey(e.target.value)}>
              <option value="total">Sort: Total Cost</option>
              <option value="miles">Sort: Miles</option>
              <option value="cpm">Sort: Cost/Mile</option>
              <option value="base">Sort: Base Rent</option>
              <option value="unit">Sort: Unit #</option>
            </select>
          </div>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table className="tbl" style={{ fontSize:11 }}>
            <thead>
              <tr>
                <th style={{ textAlign:"left" }}>Unit #</th>
                <th style={{ textAlign:"left" }}>Type</th>
                <th>Date Range</th>
                <th>Days</th>
                <th>Base Rent</th>
                <th>$/mi Rate</th>
                <th>Miles</th>
                <th>All-In Cost</th>
                <th>Cost/Mile</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {[...displayUnits].sort((a,b)=>{
                    if (sortKey==="total") return b.total-a.total;
                    if (sortKey==="miles") return Math.abs(b.miles)-Math.abs(a.miles);
                    if (sortKey==="base") return b.rental-a.rental;
                    if (sortKey==="unit") return a.unit.localeCompare(b.unit);
                    return 0;
                  }).filter(u => filter==="all" || (filter==="active"&&!u.final) || (filter==="final"&&u.final)).map((u,i) => {
                const cpm = u.miles > 0 ? u.total/u.miles : null;
                return (
                  <tr key={u.unit} style={{ background:i%2===0?"var(--s2)":"transparent" }}>
                    <td style={{ fontWeight:700,color:"var(--or)",fontFamily:"var(--f2)",fontSize:14,letterSpacing:1 }}>{u.unit}</td>
                    <td style={{ color:"var(--mu)",fontSize:10 }}>{u.type}</td>
                    <td style={{ color:"var(--mu)" }}>{u.from} – {u.to}</td>
                    <td style={{ color:"var(--mu)" }}>{u.days}</td>
                    <td style={{ color:"#4fc3f7" }}>{fd(u.base,2)}</td>
                    <td style={{ color:"var(--mu)" }}>${u.miRate.toFixed(3)}</td>
                    <td style={{ color:u.miles>1000?"#f5c542":"var(--tx)", fontWeight:u.miles>1000?700:400 }}>
                      {u.miles > 0 ? fn(u.miles,0) : <span style={{ color:"var(--mu)" }}>0</span>}
                    </td>
                    <td style={{ color:"#f47820",fontWeight:700 }}>{fd(u.total,2)}</td>
                    <td style={{ color:cpm?cpm>1?"#ff8a65":"#3ddc84":"var(--mu)" }}>
                      {cpm ? fd(cpm,3) : "—"}
                    </td>
                    <td>
                      <span style={{
                        fontSize:9,letterSpacing:1,textTransform:"uppercase",padding:"2px 7px",borderRadius:2,
                        background:u.final?"rgba(255,82,82,.12)":"rgba(61,220,132,.1)",
                        color:u.final?"#ff5252":"#3ddc84",
                        border:`1px solid ${u.final?"rgba(255,82,82,.3)":"rgba(61,220,132,.3)"}`,
                      }}>
                        {u.final ? "Returning" : "Active"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>{filtered.length} units shown</td>
                <td style={{ color:"#4fc3f7" }}>{fd(filtered.reduce((s,u)=>s+u.base,0),0)}</td>
                <td>—</td>
                <td>{fn(filtered.reduce((s,u)=>s+u.miles,0),0)}</td>
                <td style={{ color:"#f47820",fontWeight:700 }}>{fd(filtered.reduce((s,u)=>s+u.total,0),2)}</td>
                <td>—</td>
                <td>—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      </>);
      })()} /* end fleet view */

      {view === "repairs" && (
        <>
          {/* Repair summary */}
          <div className="g3" style={{ marginBottom:14 }}>
            <div className="kpi">
              <div className="klbl">Total Repair Invoices</div>
              <div className="kval" style={{ color:"#ff5252" }}>{fd(TRAILERS_INV.repairs.reduce((s,r)=>s+r.total,0)+XTRA_LEASE.service.total,0)}</div>
              <div className="ksub">{TRAILERS_INV.repairs.length + 1} invoices · McKinney + XTRA Lease</div>
            </div>
            <div className="kpi">
              <div className="klbl">Total Labor</div>
              <div className="kval" style={{ color:"#f5c542" }}>{fd(TRAILERS_INV.repairs.reduce((s,r)=>s+r.labor,0)+XTRA_LEASE.service.items.reduce((s,i)=>s+i.labor,0),0)}</div>
              <div className="ksub">McKinney $850 + XTRA $637.50</div>
            </div>
            <div className="kpi">
              <div className="klbl">Total Parts + Fees</div>
              <div className="kval" style={{ color:"#f47820" }}>{fd(TRAILERS_INV.repairs.reduce((s,r)=>s+r.total-r.labor,0)+(XTRA_LEASE.service.total-XTRA_LEASE.service.items.reduce((s,i)=>s+i.labor,0)),0)}</div>
              <div className="ksub">parts, fees & tax across all invoices</div>
            </div>
          </div>

          {/* Repair cards */}
          {/* XTRA Service Invoice */}
          <div className="card" style={{ marginBottom:14 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,paddingBottom:12,borderBottom:"1px solid var(--bd)" }}>
              <div>
                <div style={{ fontFamily:"var(--f2)",fontSize:18,fontWeight:900,letterSpacing:2,color:"#4fc3f7",marginBottom:4 }}>
                  Unit #{XTRA_LEASE.service.unit} — Roll Door Repairs
                </div>
                <div style={{ display:"flex",gap:20,fontSize:10,color:"var(--mu)",flexWrap:"wrap" }}>
                  <span>📋 Invoice {XTRA_LEASE.service.invoice}</span>
                  <span>📅 {XTRA_LEASE.service.date}</span>
                  <span>🏢 XTRA Lease</span>
                  <span>{XTRA_LEASE.service.type}</span>
                </div>
              </div>
              <div style={{ textAlign:"right",flexShrink:0,marginLeft:16 }}>
                <div style={{ fontSize:9,color:"var(--mu)",letterSpacing:2,textTransform:"uppercase",marginBottom:2 }}>Total Due</div>
                <div style={{ fontFamily:"var(--f2)",fontSize:32,fontWeight:900,color:"#4fc3f7" }}>{fd(XTRA_LEASE.service.total,2)}</div>
                <div style={{ fontSize:10,color:"var(--mu)" }}>subtotal {fd(XTRA_LEASE.service.subtotal,2)} + tax {fd(XTRA_LEASE.service.tax,2)}</div>
              </div>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14 }}>
              <div style={{ background:"rgba(245,197,66,.08)",border:"1px solid rgba(245,197,66,.2)",borderRadius:3,padding:"12px 14px" }}>
                <div style={{ fontSize:9,color:"#f5c542",letterSpacing:2,textTransform:"uppercase",marginBottom:4 }}>Total Labor</div>
                <div style={{ fontFamily:"var(--f2)",fontSize:26,fontWeight:900,color:"#f5c542" }}>{fd(XTRA_LEASE.service.items.reduce((s,i)=>s+i.labor,0),2)}</div>
              </div>
              <div style={{ background:"rgba(244,120,32,.08)",border:"1px solid rgba(244,120,32,.2)",borderRadius:3,padding:"12px 14px" }}>
                <div style={{ fontSize:9,color:"var(--or)",letterSpacing:2,textTransform:"uppercase",marginBottom:4 }}>Total Parts</div>
                <div style={{ fontFamily:"var(--f2)",fontSize:26,fontWeight:900,color:"var(--or)" }}>{fd(XTRA_LEASE.service.items.reduce((s,i)=>s+i.parts,0),2)}</div>
              </div>
            </div>
            <table className="tbl" style={{ fontSize:11 }}>
              <thead><tr><th style={{ textAlign:"left" }}>Description</th><th>Labor</th><th>Parts</th><th>Total</th></tr></thead>
              <tbody>
                {XTRA_LEASE.service.items.map((item,i) => (
                  <tr key={i} style={{ background:i%2===0?"var(--s2)":"transparent" }}>
                    <td>{item.desc}</td>
                    <td style={{ color:"#f5c542" }}>{fd(item.labor,2)}</td>
                    <td style={{ color:"var(--or)" }}>{fd(item.parts,2)}</td>
                    <td style={{ fontWeight:700 }}>{fd(item.total,2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={3}>Sub Total</td><td>{fd(XTRA_LEASE.service.subtotal,2)}</td></tr>
                <tr><td colSpan={3}>Tax (NV 4.6% + Clark 3.775%)</td><td>{fd(XTRA_LEASE.service.tax,2)}</td></tr>
                <tr><td colSpan={3} style={{ fontWeight:800,color:"#4fc3f7" }}>TOTAL</td><td style={{ fontWeight:900,color:"#4fc3f7",fontFamily:"var(--f2)",fontSize:16 }}>{fd(XTRA_LEASE.service.total,2)}</td></tr>
              </tfoot>
            </table>
          </div>

          {/* McKinney Repairs */}
          {TRAILERS_INV.repairs.map(r => (
            <div key={r.invoice} className="card" style={{ marginBottom:14 }}>
              {/* Header */}
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,paddingBottom:12,borderBottom:"1px solid var(--bd)" }}>
                <div>
                  <div style={{ fontFamily:"var(--f2)",fontSize:18,fontWeight:900,letterSpacing:2,color:"var(--or)",marginBottom:4 }}>
                    Unit #{r.unit} — {r.description}
                  </div>
                  <div style={{ display:"flex",gap:20,fontSize:10,color:"var(--mu)",flexWrap:"wrap" }}>
                    <span>📋 Invoice {r.invoice}</span>
                    <span>📅 Completed {r.completed}</span>
                    <span>🔧 {r.type}</span>
                    <span>📍 {r.location}</span>
                    <span>🔢 Odometer {fn(r.mileage,0)} mi</span>
                  </div>
                </div>
                <div style={{ textAlign:"right",flexShrink:0,marginLeft:16 }}>
                  <div style={{ fontSize:9,color:"var(--mu)",letterSpacing:2,textTransform:"uppercase",marginBottom:2 }}>Total Due</div>
                  <div style={{ fontFamily:"var(--f2)",fontSize:32,fontWeight:900,color:"#ff5252" }}>{fd(r.total,2)}</div>
                  <div style={{ fontSize:10,color:"var(--mu)" }}>subtotal {fd(r.subtotal,2)} + tax {fd(r.tax,2)}</div>
                </div>
              </div>

              {/* Labor + Parts summary */}
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14 }}>
                <div style={{ background:"rgba(245,197,66,.08)",border:"1px solid rgba(245,197,66,.2)",borderRadius:3,padding:"12px 14px" }}>
                  <div style={{ fontSize:9,color:"#f5c542",letterSpacing:2,textTransform:"uppercase",marginBottom:4 }}>Labor</div>
                  <div style={{ fontFamily:"var(--f2)",fontSize:26,fontWeight:900,color:"#f5c542" }}>{fd(r.labor,2)}</div>
                  <div style={{ fontSize:10,color:"var(--mu)",marginTop:2 }}>${(r.labor/100).toFixed(1)} hrs @ $100/hr</div>
                </div>
                <div style={{ background:"rgba(244,120,32,.08)",border:"1px solid rgba(244,120,32,.2)",borderRadius:3,padding:"12px 14px" }}>
                  <div style={{ fontSize:9,color:"var(--or)",letterSpacing:2,textTransform:"uppercase",marginBottom:4 }}>Parts & Fees</div>
                  <div style={{ fontFamily:"var(--f2)",fontSize:26,fontWeight:900,color:"var(--or)" }}>{fd(r.subtotal-r.labor,2)}</div>
                  <div style={{ fontSize:10,color:"var(--mu)",marginTop:2 }}>{r.items.length} line items</div>
                </div>
              </div>

              {/* Line items */}
              <table className="tbl" style={{ fontSize:11 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign:"left" }}>Description</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ background:"rgba(245,197,66,.05)" }}>
                    <td style={{ color:"#f5c542",fontWeight:700 }}>Labor — {r.description}</td>
                    <td style={{ color:"#f5c542" }}>{(r.labor/100).toFixed(1)} hrs</td>
                    <td style={{ color:"#f5c542" }}>$100.00</td>
                    <td style={{ color:"#f5c542",fontWeight:700 }}>{fd(r.labor,2)}</td>
                  </tr>
                  {r.items.map((item,i) => (
                    <tr key={i} style={{ background:i%2===0?"var(--s2)":"transparent" }}>
                      <td>{item.desc}</td>
                      <td style={{ color:"var(--mu)" }}>{item.qty}</td>
                      <td style={{ color:"var(--mu)" }}>{fd(item.unit,2)}</td>
                      <td style={{ color:"var(--or)" }}>{fd(item.total,2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>Subtotal</td>
                    <td>{fd(r.subtotal,2)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3}>Tax (8.37%)</td>
                    <td>{fd(r.tax,2)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} style={{ fontWeight:800,color:"#ff5252" }}>TOTAL</td>
                    <td style={{ fontWeight:900,color:"#ff5252",fontFamily:"var(--f2)",fontSize:16 }}>{fd(r.total,2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── INCOME DATA ───────────────────────────────────────────────
const INCOME_2026 = {
  period: "Jan 1 – Jul 5, 2026",
  ce: 9014051.04, sf: 3447994.18, di: 63228.50, ceEast: 475246.67,
  total: 13000520.39,
  cogs: 6745960.07, grossProfit: 6254560.32,
  totalExp: 5498143.43, netOpIncome: 756416.89,
  netIncome: 833088.75,
  carrierPay: 6658397.09, merchantFees: 55079.60, flexentFees: 32483.38,
  weeks: [
    { label:"Jan 1-4",    rev:86886.02,  gp:52052.64,  ce:71474.65,  sf:14362.37,  di:1049.00,  carrier:34100.00,  netInc:25492.50 },
    { label:"Jan 5-11",   rev:167335.63, gp:76449.43,  ce:103721.70, sf:63463.93,  di:150.00,   carrier:88060.25,  netInc:-73568.84 },
    { label:"Jan 12-18",  rev:239072.36, gp:96713.35,  ce:164803.92, sf:68403.04,  di:5865.40,  carrier:138771.76, netInc:-16212.64 },
    { label:"Jan 19-25",  rev:249993.50, gp:109470.39, ce:157601.79, sf:89058.86,  di:3332.85,  carrier:136472.50, netInc:-25127.46 },
    { label:"Jan 26-F1",  rev:249874.28, gp:146247.69, ce:165858.08, sf:79466.20,  di:4550.00,  carrier:99818.75,  netInc:-3909.53 },
    { label:"Feb 2-8",    rev:441729.58, gp:156641.30, ce:355998.69, sf:85296.04,  di:434.85,   carrier:276707.25, netInc:19207.96 },
    { label:"Feb 9-15",   rev:526250.37, gp:235956.79, ce:403325.58, sf:121889.79, di:1035.00,  carrier:280000.50, netInc:63020.31 },
    { label:"Feb 16-22",  rev:259947.62, gp:121921.58, ce:200471.24, sf:58840.48,  di:635.90,   carrier:133235.00, netInc:-67590.54 },
    { label:"Feb 23-M1",  rev:379906.17, gp:168598.15, ce:304358.58, sf:71016.84,  di:4530.75,  carrier:204298.25, netInc:43510.38 },
    { label:"Mar 2-8",    rev:369704.58, gp:165061.53, ce:286145.38, sf:68554.20,  di:15005.00, carrier:198170.00, netInc:20925.01 },
    { label:"Mar 9-15",   rev:201670.91, gp:107577.81, ce:123160.85, sf:78440.06,  di:70.00,    carrier:90966.50,  netInc:-46874.00 },
    { label:"Mar 16-22",  rev:683445.61, gp:309971.85, ce:557108.00, sf:125457.61, di:880.00,   carrier:372483.00, netInc:113348.36 },
    { label:"Mar 23-29",  rev:840185.44, gp:441062.85, ce:652624.29, sf:187561.15, di:0,        carrier:397038.76, netInc:221646.74 },
    { label:"Mar 30-A5",  rev:413053.60, gp:219323.44, ce:238980.74, sf:153613.17, di:2767.68,  carrier:191634.46, netInc:54437.74 },
    { label:"Apr 6-12",   rev:461936.30, gp:231959.80, ce:284152.00, sf:135504.80, di:200.00,   carrier:228544.25, netInc:16017.14 },
    { label:"Apr 13-19",  rev:357473.97, gp:177626.95, ce:213785.03, sf:109382.04, di:729.90,   carrier:178386.21, netInc:-16291.62 },
    { label:"Apr 20-26",  rev:475020.61, gp:236992.07, ce:289391.50, sf:128863.11, di:291.00,   carrier:236591.25, netInc:25057.61 },
    { label:"Apr 27-M3",  rev:721584.63, gp:367666.31, ce:460519.09, sf:198383.54, di:0,        carrier:351777.50, netInc:71777.47 },
    { label:"May 4-10",   rev:591995.23, gp:298394.05, ce:395010.95, sf:170301.98, di:0,        carrier:291650.38, netInc:79646.91 },
    { label:"May 11-17",  rev:837219.55, gp:403319.86, ce:573500.50, sf:237565.05, di:629.00,   carrier:431256.00, netInc:190395.40 },
    { label:"May 18-24",  rev:784311.67, gp:379189.05, ce:619783.65, sf:141802.81, di:945.86,   carrier:403415.27, netInc:100835.51 },
    { label:"May 25-31",  rev:438633.13, gp:258772.06, ce:235869.96, sf:145103.06, di:15832.86, carrier:178132.00, netInc:-103605.08 },  // full week (May 31 added expenses only, no new rev)
    { label:"Jun 1-7",    rev:307673.56, gp:188160.30, ce:150520.00, sf:122912.56, di:3036.00,  carrier:117797.50, netInc:15977.64 },
    { label:"Jun 8-14",   rev:498582.95, gp:266256.73, ce:269034.50, sf:187119.50, di:241.45,   carrier:229810.00, netInc:-5865.56 },  // full week — CE East $42,187.50 not in ce/sf/di (netInc swung negative as Jun expenses accrued)
    { label:"Jun 15-21",  rev:418836.45, gp:159067.50, ce:307631.62, sf:109161.45, di:366.00,   carrier:258198.75, netInc:-18679.55 },  // full week — CE East $1,677.38 not in ce/sf/di
    { label:"Jun 22-28",  rev:1338712.94,gp:557692.20, ce:1003807.00,sf:287846.81, di:250.00,   carrier:777342.25, netInc:247747.51 },  // big close-of-June week — CE East $46,809.13 not in ce/sf/di
    { label:"Jun 29-J5",  rev:659483.73, gp:322414.64, ce:425411.75, sf:208623.73, di:400.00,   carrier:333738.75, netInc:-31114.73 },  // CE East $25,048.25 not in ce/sf/di
  ],
  months: [
    { m: "Jan", rev: 993161.79,  gp: 480933.50,  ce:663460.14,  sf:314754.40, di:14947.25, carrier:497223.26,  exp:598682.35,  netInc:-92214.12 },
    { m: "Feb", rev: 1607833.74, gp: 683117.82,  ce:1264154.09, sf:337043.15, di:6636.50,  carrier:894241.00,  exp:647766.79,  netInc:60883.96 },
    { m: "Mar", rev: 2290040.48, gp: 1113857.96, ce:1734333.27, sf:522550.51, di:18161.70, carrier:1162575.47, exp:789424.77,  netInc:349980.48 },
    { m: "Apr", rev: 2160721.16, gp: 1107479.39, ce:1325895.61, sf:643584.16, di:1781.88,  carrier:1045803.96, exp:888173.85,  netInc:219330.30 },
    { m: "May", rev: 2725473.59, gp: 1375580.28, ce:1869803.06, sf:714397.91, di:17407.72, carrier:1341666.15, exp:1221441.87, netInc:154158.71 },
    { m: "Jun", rev: 2940492.16, gp: 1371139.43, ce:1958288.12, sf:836401.58, di:4293.45,  carrier:1557929.75, exp:1149138.78, netInc:222012.50 },  // full June
    { m: "Jul", rev: 282797.47,  gp: 122451.94,  ce:198116.75,  sf:79262.47,  di:0,        carrier:158957.50,  exp:203515.02,  netInc:-81063.08 },  // partial — Jul 1-5 only
  ],
};

const INCOME_2025 = {
  period: "Jan 1 – Dec 31, 2025",
  ce: 9805599.90, sf: 3957167.90, di: 149473.27, ceEast: 5163.50,
  total: 13917404.57,
  cogs: 6896592.69, grossProfit: 7020811.88,
  totalExp: 7332493.70, netOpIncome: -311681.82,
  netIncome: -260423.41,
  // Q1 approx (Jan 1 – Mar 16, 2025, first 11 weeks)
  q1Rev: 1985533.19, q1GP: 1127978.33, q1NI: -3002.65,
  months: [
    { m: "Jan", rev: 791982.53,  gp: 425681.70 },
    { m: "Feb", rev: 988544.88,  gp: 497290.85 },
    { m: "Mar", rev: 877045.67,  gp: 431962.46 },
    { m: "Apr", rev: 1111191.90, gp: 571000 },
    { m: "May", rev: 2018619.22, gp: 973000 },
    { m: "Jun", rev: 1503709.47, gp: 793000 },
    { m: "Jul", rev: 776405.99,  gp: 418000 },
    { m: "Aug", rev: 691137.84,  gp: 378000 },
    { m: "Sep", rev: 1238921.45, gp: 636000 },
    { m: "Oct", rev: 1911941.28, gp: 965000 },
    { m: "Nov", rev: 1276234.46, gp: 655000 },
    { m: "Dec", rev: 1222781.06, gp: 499857 },
  ],
};

// ── INCOME DASHBOARD ──────────────────────────────────────────
// Shared tooltip for Recharts
const CustomTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--s2)", border: "1px solid var(--bd)", borderRadius: 3, padding: "10px 14px", fontSize: 11 }}>
      <div style={{ color: "var(--or)", fontFamily: "var(--f2)", fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {typeof p.value === "number" && Math.abs(p.value) >= 1 ? fd(p.value, p.value % 1 === 0 ? 0 : 2) : p.value}
        </div>
      ))}
    </div>
  );
};

function IncomeDashboard() {
  const [view, setView]           = useState("live"); // live | overview | trend | yoy
  const [trendMode, setTrendMode] = useState("combined"); // combined | byco | monthly
  const [simAmount, setSimAmount] = useState(300000);
  const [qbPeriod, setQbPeriod]   = useState("ytd");
  const [qbData, setQbData]       = useState(null);
  const [qbLoading, setQbLoading] = useState(false);
  const [qbError, setQbError]     = useState(null);

  useEffect(() => {
    if (view !== "live") return;
    setQbLoading(true); setQbError(null);
    fetch(`/api/qbo-pnl?company=ce_sf_combined&period=${qbPeriod}`)
      .then(r => r.json())
      .then(d => { if (d.error) { setQbError(d.error); setQbData(null); } else setQbData(d); })
      .catch(e => setQbError(e.message))
      .finally(() => setQbLoading(false));
  }, [view, qbPeriod]);

  const ytdDays    = PERIOD_DAYS;
  const gpMargin26 = INCOME_2026.grossProfit / INCOME_2026.total * 100;
  const gpMargin25 = INCOME_2025.grossProfit / INCOME_2025.total * 100;

  // Same-window YoY: compare 2026 closed months against the same months in
  // 2025. Excludes the trailing partial month from BOTH sides so the
  // comparison is apples-to-apples (a partial May 1-3 vs full 2025 May would
  // make 2026 look like it cratered). Heuristic: if the last entry's revenue
  // is < 50% of the prior month, treat it as partial.
  const lastIdx26 = INCOME_2026.months.length - 1;
  const lastM26   = INCOME_2026.months[lastIdx26];
  const priorM26  = INCOME_2026.months[lastIdx26 - 1];
  const isPartialLast = priorM26 && lastM26 && lastM26.rev < priorM26.rev * 0.5;
  const fullMonths26 = isPartialLast ? INCOME_2026.months.slice(0, -1) : INCOME_2026.months;
  const ytd26FullRev = fullMonths26.reduce((s, m) => s + m.rev, 0);
  const ytd26FullGP  = fullMonths26.reduce((s, m) => s + m.gp,  0);
  const ytd26FullNI  = fullMonths26.reduce((s, m) => s + m.netInc, 0);
  const ytd25SameRev = fullMonths26.reduce((s, m26) => {
    const m25 = INCOME_2025.months.find(m => m.m === m26.m);
    return s + (m25 ? m25.rev : 0);
  }, 0);
  const ytd25SameGP = fullMonths26.reduce((s, m26) => {
    const m25 = INCOME_2025.months.find(m => m.m === m26.m);
    return s + (m25 ? m25.gp : 0);
  }, 0);
  // 2025 monthly net income isn't broken out, so prorate annual NI by
  // same-window revenue share. Approximation, but better than comparing
  // against a stale Q1 figure.
  const ytd25SameNI = INCOME_2025.total > 0
    ? INCOME_2025.netIncome * (ytd25SameRev / INCOME_2025.total)
    : 0;
  const yoyRevChg = ytd25SameRev > 0 ? (ytd26FullRev / ytd25SameRev - 1) * 100 : 0;
  const yoyGPChg  = ytd25SameGP  > 0 ? (ytd26FullGP  / ytd25SameGP  - 1) * 100 : 0;
  const sameWindowLabel = fullMonths26.length === 0
    ? "no full months yet"
    : fullMonths26.length === 1
      ? `${fullMonths26[0].m} 2026 vs ${fullMonths26[0].m} 2025`
      : `${fullMonths26[0].m}–${fullMonths26[fullMonths26.length - 1].m} ${fullMonths26[0].m === "Jan" ? "(YTD)" : ""}`.trim();

  // Custom tooltip for recharts
  // Month comparison data — pair every 2026 month present with the same month in 2025.
  // Includes partial month so users can see it; the v25 value is prorated to
  // the same fraction of the month (rough proration via day count, falling
  // back to full-month if we can't infer).
  const monthCompare = INCOME_2026.months.map((m26, i) => {
    const m25 = INCOME_2025.months.find(m => m.m === m26.m);
    let v25 = m25 ? m25.rev : 0;
    // For partial last month, prorate 2025 by the rev ratio against 2026's
    // full prior month. Imperfect but keeps the bar from misleading.
    if (i === lastIdx26 && isPartialLast && priorM26 && m25) {
      const fullPrior25 = INCOME_2025.months.find(m => m.m === priorM26.m);
      if (fullPrior25 && fullPrior25.rev > 0) {
        const ratio = m26.rev / priorM26.rev; // ≈ fraction of month elapsed
        v25 = m25.rev * Math.min(1, Math.max(0, ratio));
      }
    }
    return { m: m26.m, v26: m26.rev, v25, partial: i === lastIdx26 && isPartialLast };
  });

  return (
    <div>
      <div className="ptitle">Income</div>
      <div className="psub">CE + SF + DI Combined · {INCOME_2026.period} vs Full Year 2025</div>

      {/* Sub-nav */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {[["live","⚡","Live QB"],["overview","📊","Overview"],["trend","📈","Weekly Trend"],["yoy","🔄","YoY Comparison"]].map(([id,ico,lbl]) => (
          <button key={id} onClick={() => setView(id)} style={{
            background: view === id ? "var(--or)" : "transparent",
            color: view === id ? "#fff" : "var(--mu)",
            border: `1px solid ${view === id ? "var(--or)" : "var(--bd)"}`,
            borderRadius: 3, padding: "7px 16px",
            fontFamily: "var(--f2)", fontSize: 12, fontWeight: 700,
            letterSpacing: 1, textTransform: "uppercase", cursor: "pointer",
          }}>{ico} {lbl}</button>
        ))}
      </div>

      {/* ── LIVE QUICKBOOKS ── */}
      {view === "live" && (
        <>
          {/* Period selector */}
          <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:14 }}>
            {[
              ["ytd","YTD"],["this_week","This Week"],["last_week","Last Week"],
              ["jan","Jan"],["feb","Feb"],["mar","Mar"],["apr","Apr"],["may","May"],["jun","Jun"],
              ["jul","Jul"],["aug","Aug"],["sep","Sep"],["oct","Oct"],["nov","Nov"],["dec","Dec"],
            ].map(([id,lbl]) => (
              <button key={id} onClick={() => setQbPeriod(id)} style={{
                padding:"6px 14px",borderRadius:3,cursor:"pointer",
                fontFamily:"var(--f2)",fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",
                background:qbPeriod===id?"#3ddc84":"transparent",
                color:qbPeriod===id?"#0b0d10":"var(--mu)",
                border:`1px solid ${qbPeriod===id?"#3ddc84":"var(--bd)"}`,
              }}>{lbl}</button>
            ))}
          </div>

          {qbLoading && <div style={{ textAlign:"center",padding:40,color:"var(--mu)" }}>Loading from QuickBooks...</div>}
          {qbError && <div style={{ padding:16,background:"rgba(255,82,82,.1)",border:"1px solid rgba(255,82,82,.3)",borderRadius:4,color:"#ff5252",fontSize:12,marginBottom:14 }}>{qbError}</div>}

          {qbData && (() => { const q = qbData.fiq; const p = qbData.period; return (
            <>
              <div style={{ fontSize:10,color:"var(--mu)",marginBottom:12,letterSpacing:2,textTransform:"uppercase" }}>
                QuickBooks Live — {p.start_date} to {p.end_date}
              </div>

              {/* Revenue hero */}
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14 }}>
                {[
                  { label:"CE Revenue", val:q.revenue_ce, color:"#f47820" },
                  { label:"SF Revenue", val:q.revenue_sf, color:"#4fc3f7" },
                  { label:"DI Revenue", val:q.revenue_di, color:"#b39ddb" },
                ].map(co => (
                  <div key={co.label} style={{ background:"var(--s1)",border:`1px solid ${co.color}50`,borderRadius:6,padding:"22px",textAlign:"center" }}>
                    <div style={{ fontSize:9,letterSpacing:3,textTransform:"uppercase",color:co.color,marginBottom:6 }}>{co.label}</div>
                    <div style={{ fontFamily:"var(--f2)",fontSize:38,fontWeight:900,color:co.color,lineHeight:1 }}>{fd(co.val,0)}</div>
                    <div style={{ fontSize:10,color:"var(--mu)",marginTop:6 }}>{q.total_revenue > 0 ? fp(co.val/q.total_revenue*100) : "0%"} of total</div>
                  </div>
                ))}
              </div>

              {/* P&L summary cards */}
              <div className="g4" style={{ marginBottom:14 }}>
                {[
                  { label:"Total Revenue", val:q.total_revenue, color:"#3ddc84" },
                  { label:"Gross Profit", val:q.gross_profit, color:"#f5c542", sub:q.total_revenue > 0 ? `${(q.gross_profit/q.total_revenue*100).toFixed(1)}% margin` : "" },
                  { label:"Net Op Income", val:q.net_op_income, color:q.net_op_income >= 0 ? "#3ddc84" : "#ff5252" },
                  { label:"Net Income", val:q.net_income, color:q.net_income >= 0 ? "#3ddc84" : "#ff5252" },
                ].map(k => (
                  <div key={k.label} style={{ background:"var(--s1)",border:`1px solid ${k.color}40`,borderRadius:6,padding:"18px",textAlign:"center" }}>
                    <div style={{ fontSize:9,letterSpacing:3,textTransform:"uppercase",color:k.color,marginBottom:6 }}>{k.label}</div>
                    <div style={{ fontFamily:"var(--f2)",fontSize:28,fontWeight:900,color:k.color,lineHeight:1 }}>{fd(k.val,0)}</div>
                    {k.sub && <div style={{ fontSize:10,color:"var(--mu)",marginTop:6 }}>{k.sub}</div>}
                  </div>
                ))}
              </div>

              {/* COGS breakdown */}
              <div className="g2" style={{ gap:14,marginBottom:14 }}>
                <div className="card">
                  <div className="ctit">Cost of Goods Sold</div>
                  <table className="tbl" style={{ fontSize:11 }}>
                    <tbody>
                      {[
                        ["Carrier Pay", q.carrier_pay],
                        ["Flexent Fees", q.flexent_fees],
                        ["Triumph Merchant Fees", q.merchant_fees],
                        ["Total COGS", q.total_cogs],
                      ].map(([lbl,val]) => (
                        <tr key={lbl} style={{ fontWeight:lbl.startsWith("Total") ? 800 : 400 }}>
                          <td>{lbl}</td>
                          <td style={{ textAlign:"right",fontFamily:"var(--f2)",color:lbl.startsWith("Total")?"#ff5252":"var(--tx)" }}>{fd(val)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="card">
                  <div className="ctit">Truck / Trailer (CPM Components)</div>
                  <table className="tbl" style={{ fontSize:11 }}>
                    <tbody>
                      {[
                        ["SF Truck Insurance", q.ins_tot, "#f5c542"],
                        ["Truck Rentals", q.truck_tot, "#4fc3f7"],
                        ["Trailer Rentals", q.trailer_tot, "#b39ddb"],
                        ["Truck Maintenance", q.truck_maint, "var(--tx)"],
                        ["Trailer Maintenance", q.trail_maint, "var(--tx)"],
                        ["Storage/Parking", q.storage, "var(--tx)"],
                        ["Uniforms", q.uniforms, "var(--tx)"],
                        ["Fuel (QB)", q.fuel_qb, "#f47820"],
                      ].map(([lbl,val,col]) => (
                        <tr key={lbl}>
                          <td>{lbl}</td>
                          <td style={{ textAlign:"right",fontFamily:"var(--f2)",color:col }}>{fd(val)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CE East if present */}
              {q.revenue_ce_east > 0 && (
                <div style={{ padding:12,background:"rgba(79,195,247,.06)",border:"1px solid rgba(79,195,247,.15)",borderRadius:4,fontSize:11,color:"var(--mu)",marginBottom:14 }}>
                  CE East Revenue: {fd(q.revenue_ce_east,0)}
                </div>
              )}

              <div style={{ padding:12,background:"rgba(61,220,132,.06)",border:"1px solid rgba(61,220,132,.15)",borderRadius:4,fontSize:11,color:"var(--mu)",textAlign:"center" }}>
                Live from QuickBooks · CE & SF Combined P&L · Updated in real-time
              </div>
            </>
          ); })()}
        </>
      )}

      {/* ── OVERVIEW ── */}
      {view === "overview" && (
        <>
          {/* Revenue hero row — 3 companies prominent */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14 }}>
            {[
              { label:"CE Revenue", val:INCOME_2026.ce, color:"#f47820", pct:INCOME_2026.ce/INCOME_2026.total*100 },
              { label:"SF Revenue", val:INCOME_2026.sf, color:"#4fc3f7", pct:INCOME_2026.sf/INCOME_2026.total*100 },
              { label:"DI Revenue", val:INCOME_2026.di, color:"#b39ddb", pct:INCOME_2026.di/INCOME_2026.total*100 },
            ].map(co => (
              <div key={co.label} style={{
                background:"var(--s1)",border:`1px solid ${co.color}50`,borderRadius:6,
                padding:"22px",position:"relative",overflow:"hidden",
              }}>
                <div style={{ position:"absolute",inset:0,opacity:.04,
                  backgroundImage:`repeating-linear-gradient(0deg,${co.color} 0px,${co.color} 1px,transparent 1px,transparent 32px),repeating-linear-gradient(90deg,${co.color} 0px,${co.color} 1px,transparent 1px,transparent 32px)` }} />
                <div style={{ fontSize:9,letterSpacing:3,textTransform:"uppercase",color:co.color,marginBottom:6,position:"relative" }}>{co.label}</div>
                <div style={{ fontFamily:"var(--f2)",fontSize:46,fontWeight:900,lineHeight:1,color:co.color,position:"relative" }}>{fd(co.val,0)}</div>
                <div style={{ fontSize:11,color:"var(--mu)",marginTop:8,position:"relative" }}>{fp(co.pct)} of {fd(INCOME_2026.total,0)} total</div>
                <div style={{ fontSize:11,color:"var(--mu)",marginTop:3,position:"relative" }}>({fd(co.val/ytdDays*365,0)} proj. full year)</div>
                <div className="bar" style={{ marginTop:8,position:"relative" }}>
                  <div className="bfil" style={{ width:`${co.pct}%`,background:co.color }} />
                </div>
              </div>
            ))}
          </div>

          {/* Carrier Pay · Gross Profit · Net Income */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14 }}>
            <div className="kpi">
              <div className="klbl">Carrier Pay (COGS)</div>
              <div style={{ fontFamily:"var(--f2)",fontSize:28,fontWeight:900,color:"#ff5252",lineHeight:1 }}>{fd(INCOME_2026.carrierPay,0)}</div>
              <div style={{ fontSize:10,color:"var(--mu)",marginTop:4 }}>{fp(INCOME_2026.carrierPay/INCOME_2026.total*100)} of revenue</div>
              <div className="bar" style={{ marginTop:6 }}><div className="bfil" style={{ width:`${Math.min(100,INCOME_2026.carrierPay/INCOME_2026.total*100)}%`,background:"#ff5252" }} /></div>
            </div>
            <div className="kpi">
              <div className="klbl">Gross Profit</div>
              <div style={{ fontFamily:"var(--f2)",fontSize:28,fontWeight:900,color:"#3ddc84",lineHeight:1 }}>{fd(INCOME_2026.grossProfit,0)}</div>
              <div style={{ fontSize:10,color:"var(--mu)",marginTop:4 }}>{fp(gpMargin26)} GP margin</div>
              <div className="bar" style={{ marginTop:6 }}><div className="bfil" style={{ width:`${gpMargin26}%`,background:"#3ddc84" }} /></div>
            </div>
            <div className="kpi">
              <div className="klbl">Net Income</div>
              <div style={{ fontFamily:"var(--f2)",fontSize:28,fontWeight:900,color:INCOME_2026.netIncome>=0?"#3ddc84":"#ff5252",lineHeight:1 }}>{fd(INCOME_2026.netIncome,0)}</div>
              <div style={{ fontSize:10,color:"var(--mu)",marginTop:4 }}>{fp(INCOME_2026.netIncome/INCOME_2026.total*100)} net margin</div>
            </div>
          </div>

          {/* P&L Summary table */}
          <div className="card">
            <div className="ctit">P&L Summary · YoY = same closed months ({sameWindowLabel})</div>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ textAlign:"left" }}>Line Item</th>
                  <th>2026 YTD ({PERIOD_DAYS}d)</th>
                  <th>2025 Same Window</th>
                  <th>2025 Full Year</th>
                  <th>YoY (Same Window)</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label:"Total Revenue",   v26:INCOME_2026.total,       sw26:ytd26FullRev, sw25:ytd25SameRev, fy:INCOME_2025.total,      hi:true },
                  { label:"COGS",            v26:-INCOME_2026.cogs,       sw26:null,         sw25:null,         fy:-INCOME_2025.cogs,      neg:true },
                  { label:"Gross Profit",    v26:INCOME_2026.grossProfit, sw26:ytd26FullGP,  sw25:ytd25SameGP,  fy:INCOME_2025.grossProfit,hi:true },
                  { label:"GP Margin",       v26:gpMargin26,              sw26:ytd26FullRev>0?(ytd26FullGP/ytd26FullRev*100):0, sw25:ytd25SameRev>0?(ytd25SameGP/ytd25SameRev*100):0, fy:gpMargin25, pct:true },
                  { label:"Net Income",      v26:INCOME_2026.netIncome,   sw26:ytd26FullNI,  sw25:ytd25SameNI,  fy:INCOME_2025.netIncome,  color:true,hi:true },
                ].map((r,i) => {
                  // YoY is closed-months-only on BOTH sides for apples-to-apples.
                  // Three cases for the YoY cell:
                  //  - pct row (margin): show point delta (sw26 - sw25)
                  //  - sign-cross ($ row): % is undefined → show $ swing instead
                  //  - same-sign $ row: standard % change vs |sw25|
                  let chgText = "—";
                  let chgSign = 0;
                  if (r.sw26 != null && r.sw25 != null && r.sw25 !== 0) {
                    if (r.pct) {
                      const d = r.sw26 - r.sw25;
                      chgSign = d;
                      chgText = `${d>=0?"+":""}${d.toFixed(1)} pts`;
                    } else if ((r.sw25 < 0) !== (r.sw26 < 0)) {
                      // Sign cross — % is meaningless. Show $ swing + categorical label.
                      const swing = r.sw26 - r.sw25;
                      chgSign = swing;
                      const tag = (r.sw25 < 0 && r.sw26 >= 0) ? "loss→profit" : "profit→loss";
                      chgText = `${swing>=0?"+":""}${fd(swing,0)} (${tag})`;
                    } else {
                      const pct = (r.sw26/Math.abs(r.sw25)-1)*100;
                      chgSign = pct;
                      chgText = `${pct>=0?"+":""}${pct.toFixed(1)}%`;
                    }
                  }
                  return (
                    <tr key={r.label} style={{ background:i%2===0?"var(--s2)":"transparent" }}>
                      <td style={{ fontWeight:r.hi?700:400 }}>{r.label}</td>
                      <td style={{ color:r.pct?undefined:r.color?(r.v26>=0?"var(--gn)":"var(--rd)"):r.neg?"var(--rd)":"var(--ye)", fontWeight:r.hi?700:400 }}>
                        {r.pct ? fp(r.v26) : fd(r.v26,0)}
                      </td>
                      <td style={{ color:"var(--mu)" }}>{r.sw25!=null?(r.pct?fp(r.sw25):fd(r.sw25,0)):"—"}</td>
                      <td style={{ color:"var(--mu)" }}>{r.pct?fp(r.fy):fd(r.fy,0)}</td>
                      <td style={{ color:chgText==="—"?"var(--mu)":chgSign>=0?"var(--gn)":"var(--rd)",fontWeight:700 }}>
                        {chgText}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Operational Efficiency · Per-Worker Productivity */}
          {(() => {
            const daysInYear = 365;
            const annFactor = daysInYear / ytdDays;
            const projRevEff = INCOME_2026.total * annFactor;

            const activeDrivers = PAYROLL.filter(p => p.hours > 0).length;
            const activeContractors = CONTRACTORS.filter(c => c.total > 0).length;
            // Office = not *Former (terminated) and not dual (those count as contractors)
            const activeOffice = OFFICE_W2.filter(e => {
              const n = e.note || "";
              if (e.dual) return false;
              if (n.includes("*Former")) return false;
              return true;
            }).length;
            const warehouseCount = WAREHOUSE.length;
            const totalFTE = activeDrivers + activeOffice + warehouseCount + activeContractors;
            const truckCount = TRUCK_COUNT;
            const driverOffice = activeOffice > 0 ? activeDrivers / activeOffice : 0;

            const revPerDriver = projRevEff / activeDrivers;
            const revPerTruck  = projRevEff / truckCount;
            const revPerFTE    = projRevEff / totalFTE;

            const tiles = [
              {
                label: "Revenue / Driver", val: revPerDriver, color: "#f47820",
                sub: `${activeDrivers} active drivers · annualized`,
                bench: "OTR industry avg ~$200K/yr (ATA)",
                benchPass: revPerDriver >= 200000,
              },
              {
                label: "Revenue / Truck", val: revPerTruck, color: "#4fc3f7",
                sub: `${truckCount} trucks · annualized`,
                bench: "Asset carrier avg ~$210K/yr",
                benchPass: revPerTruck >= 210000,
              },
              {
                label: "Revenue / Total FTE", val: revPerFTE, color: "#3ddc84",
                sub: `${activeDrivers}D · ${activeOffice}O · ${warehouseCount}W · ${activeContractors}C = ${totalFTE} FTE`,
                bench: "Asset+broker hybrid · varies wide",
                benchPass: null,
              },
              {
                label: "Driver : Office Leverage", val: null, ratio: driverOffice, color: "#b39ddb",
                sub: `${activeDrivers} drivers ÷ ${activeOffice} office FTE`,
                bench: "Brokerage 5:1+ · Asset 10:1+",
                benchPass: driverOffice >= 5,
              },
            ];

            return (
              <div className="card" style={{ marginTop:14 }}>
                <div className="ctit">⚙️ Operational Efficiency · Per-Worker Productivity</div>
                <div className="ibox" style={{ marginBottom:14 }}>
                  <strong style={{ color:"#4fc3f7" }}>Investor-grade unit economics.</strong> Revenue per worker normalized
                  to a full-year run rate ({fd(projRevEff,0)} projected from {ytdDays} actual days). Compare against industry
                  benchmarks for asset-based trucking and freight brokerage.
                </div>
                <div className="g4">
                  {tiles.map(t => (
                    <div key={t.label} className="kpi" style={{ borderTop:`3px solid ${t.color}` }}>
                      <div className="klbl">{t.label}</div>
                      <div style={{ fontFamily:"var(--f2)", fontSize:30, fontWeight:900, color:t.color, lineHeight:1, marginTop:4 }}>
                        {t.val != null ? fd(t.val, 0) : `${t.ratio.toFixed(1)}:1`}
                      </div>
                      <div className="ksub" style={{ marginTop:6 }}>{t.sub}</div>
                      <div style={{
                        fontSize:10, marginTop:8, padding:"4px 7px", borderRadius:2,
                        background: t.benchPass===true?"rgba(61,220,132,.1)":t.benchPass===false?"rgba(255,82,82,.08)":"rgba(90,99,112,.1)",
                        color: t.benchPass===true?"var(--gn)":t.benchPass===false?"var(--rd)":"var(--mu)",
                        border: `1px solid ${t.benchPass===true?"rgba(61,220,132,.3)":t.benchPass===false?"rgba(255,82,82,.25)":"var(--bd)"}`,
                      }}>
                        {t.benchPass===true?"✓ ":t.benchPass===false?"⚠ ":""}{t.bench}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Run Rate / Full-Year Projections */}
          {(() => {
            const daysInYear = 365;
            const annFactor = daysInYear / ytdDays;
            const projRev = INCOME_2026.total * annFactor;
            const projGP  = INCOME_2026.grossProfit * annFactor;
            const projNet = INCOME_2026.netIncome * annFactor;
            const projCE  = INCOME_2026.ce * annFactor;
            const projSF  = INCOME_2026.sf * annFactor;
            const projDI  = INCOME_2026.di * annFactor;
            const projCarrier = INCOME_2026.carrierPay * annFactor;
            const projExp = INCOME_2026.totalExp * annFactor;
            const vsRev25 = (projRev / INCOME_2025.total - 1) * 100;
            const vsGP25  = (projGP / INCOME_2025.grossProfit - 1) * 100;
            const vsNet25 = INCOME_2025.netIncome !== 0 ? (projNet / Math.abs(INCOME_2025.netIncome)) : null;
            const weeksInYear = 52;
            const weeksSoFar = INCOME_2026.weeks.length;
            const weeklyAvgRev = INCOME_2026.total / weeksSoFar;
            const weeklyAvgGP  = INCOME_2026.grossProfit / weeksSoFar;
            const monthlyAvgRev = INCOME_2026.total / (ytdDays / 30.44);
            const monthlyAvgGP  = INCOME_2026.grossProfit / (ytdDays / 30.44);

            return (
              <div className="card" style={{ marginTop:14 }}>
                <div className="ctit">📈 Run Rate — Full-Year 2026 Projection</div>
                <div className="ibox" style={{ marginBottom:14 }}>
                  <strong style={{ color:"#4fc3f7" }}>Based on {ytdDays} days of actual data</strong> ({PERIOD}), annualized at current pace.
                  These are straight-line projections — seasonal swings (summer slowdown, Q4 peak) will affect actual results.
                </div>

                {/* Hero projection KPIs */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:14 }}>
                  {[
                    { label:"Projected Revenue", val:projRev, color:"#f5c542", vs25:vsRev25, actual25:INCOME_2025.total },
                    { label:"Projected Gross Profit", val:projGP, color:"#3ddc84", vs25:vsGP25, actual25:INCOME_2025.grossProfit },
                    { label:"Projected Net Income", val:projNet, color:projNet >= 0 ? "#3ddc84" : "#ff5252", vs25:null, actual25:INCOME_2025.netIncome },
                  ].map(p => (
                    <div key={p.label} style={{
                      background:"var(--s1)", border:`1px solid ${p.color}40`, borderRadius:6,
                      padding:"22px", textAlign:"center", position:"relative", overflow:"hidden",
                    }}>
                      <div style={{ position:"absolute",inset:0,opacity:.03,
                        backgroundImage:`repeating-linear-gradient(0deg,${p.color} 0px,${p.color} 1px,transparent 1px,transparent 28px),repeating-linear-gradient(90deg,${p.color} 0px,${p.color} 1px,transparent 1px,transparent 28px)` }} />
                      <div style={{ fontSize:9,letterSpacing:3,textTransform:"uppercase",color:p.color,marginBottom:6,position:"relative" }}>{p.label}</div>
                      <div style={{ fontFamily:"var(--f2)",fontSize:42,fontWeight:900,lineHeight:1,color:p.color,position:"relative" }}>{fd(p.val,0)}</div>
                      <div style={{ fontSize:11,color:"var(--mu)",marginTop:8,position:"relative" }}>
                        2025 actual: {fd(p.actual25,0)}
                      </div>
                      {p.vs25 != null && (
                        <div style={{ fontSize:12,fontWeight:700,color:p.vs25>=0?"#3ddc84":"#ff5252",marginTop:4,position:"relative" }}>
                          {p.vs25>=0?"+":""}{p.vs25.toFixed(1)}% vs 2025
                        </div>
                      )}
                      {p.label.includes("Net") && (
                        <div style={{ fontSize:12,fontWeight:700,color:projNet>=0?"#3ddc84":"#ff5252",marginTop:4,position:"relative" }}>
                          {INCOME_2025.netIncome < 0 && projNet > 0 ? "🔄 Loss → Profit" : INCOME_2025.netIncome < 0 && projNet < 0 ? "Still negative" : ""}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Pace metrics */}
                <div className="g4" style={{ marginBottom:14 }}>
                  <div className="kpi">
                    <div className="klbl">Weekly Avg Revenue</div>
                    <div className="kval" style={{ color:"#f5c542", fontSize:20 }}>{fd(weeklyAvgRev,0)}</div>
                    <div className="ksub">{fd(weeklyAvgGP,0)} GP/wk · {fp(weeklyAvgGP/weeklyAvgRev*100)} margin</div>
                  </div>
                  <div className="kpi">
                    <div className="klbl">Monthly Avg Revenue</div>
                    <div className="kval" style={{ color:"#f47820", fontSize:20 }}>{fd(monthlyAvgRev,0)}</div>
                    <div className="ksub">{fd(monthlyAvgGP,0)} GP/mo</div>
                  </div>
                  <div className="kpi">
                    <div className="klbl">Daily Run Rate</div>
                    <div className="kval" style={{ color:"#4fc3f7", fontSize:20 }}>{fd(INCOME_2026.total / ytdDays,0)}</div>
                    <div className="ksub">{fd(INCOME_2026.grossProfit / ytdDays,0)} GP/day</div>
                  </div>
                  <div className="kpi">
                    <div className="klbl">Revenue per Driver/Wk</div>
                    <div className="kval" style={{ color:"#b39ddb", fontSize:20 }}>{fd(weeklyAvgRev / ACTIVE_DRIVERS_COUNT,0)}</div>
                    <div className="ksub">{ACTIVE_DRIVERS_COUNT} drivers · {fd(weeklyAvgGP / ACTIVE_DRIVERS_COUNT,0)} GP each</div>
                  </div>
                </div>

                {/* Projection detail table */}
                <div style={{ overflowX:"auto" }}>
                  <table className="tbl" style={{ fontSize:11 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign:"left" }}>Metric</th>
                        <th>YTD Actual ({ytdDays}d)</th>
                        <th>Projected Full Year</th>
                        <th>2025 Actual</th>
                        <th>Proj vs 2025</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label:"Total Revenue",   ytd:INCOME_2026.total,       proj:projRev,     act25:INCOME_2025.total,       hi:true },
                        { label:"  CE Revenue",    ytd:INCOME_2026.ce,          proj:projCE,      act25:INCOME_2025.ce,          indent:true, color:"#f47820" },
                        { label:"  SF Revenue",    ytd:INCOME_2026.sf,          proj:projSF,      act25:INCOME_2025.sf,          indent:true, color:"#4fc3f7" },
                        { label:"  DI Revenue",    ytd:INCOME_2026.di,          proj:projDI,      act25:INCOME_2025.di,          indent:true, color:"#b39ddb" },
                        { label:"Carrier Pay",     ytd:INCOME_2026.carrierPay,  proj:projCarrier, act25:INCOME_2025.cogs,        neg:true },
                        { label:"Gross Profit",    ytd:INCOME_2026.grossProfit, proj:projGP,      act25:INCOME_2025.grossProfit, hi:true, color:"#3ddc84" },
                        { label:"GP Margin",       ytd:gpMargin26,              proj:gpMargin26,  act25:gpMargin25,              pct:true },
                        { label:"Operating Expenses", ytd:INCOME_2026.totalExp, proj:projExp,     act25:INCOME_2025.totalExp,    neg:true },
                        { label:"Net Income",      ytd:INCOME_2026.netIncome,   proj:projNet,     act25:INCOME_2025.netIncome,   hi:true, bold:true },
                      ].map((r,i) => {
                        const vsChg = r.pct
                          ? r.proj - r.act25
                          : r.act25 !== 0 ? (r.proj / Math.abs(r.act25) - 1) * 100 : null;
                        return (
                          <tr key={r.label} style={{ background:i%2===0?"var(--s2)":"transparent" }}>
                            <td style={{ fontWeight:r.hi||r.bold?700:400, color:r.indent?r.color:"var(--tx)", paddingLeft:r.indent?24:9 }}>{r.label}</td>
                            <td style={{ color:r.pct?undefined:r.bold?(r.ytd>=0?"#3ddc84":"#ff5252"):r.neg?"#ff5252":r.color||"var(--ye)", fontWeight:r.hi?700:400 }}>
                              {r.pct ? fp(r.ytd) : fd(r.ytd,0)}
                            </td>
                            <td style={{ color:r.pct?undefined:r.bold?(r.proj>=0?"#3ddc84":"#ff5252"):r.color||"var(--or)", fontWeight:r.hi?800:500, fontFamily:r.hi?"var(--f2)":"var(--f1)" }}>
                              {r.pct ? fp(r.proj) : fd(r.proj,0)}
                            </td>
                            <td style={{ color:"var(--mu)" }}>{r.pct ? fp(r.act25) : fd(r.act25,0)}</td>
                            <td style={{ color:vsChg==null?"var(--mu)":r.neg?(vsChg<=0?"#3ddc84":"#ff5252"):(vsChg>=0?"#3ddc84":"#ff5252"), fontWeight:700 }}>
                              {vsChg==null ? "—" : r.pct ? `${vsChg>=0?"+":""}${vsChg.toFixed(1)} pts` : `${vsChg>=0?"+":""}${vsChg.toFixed(1)}%`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop:14, fontSize:10, color:"var(--mu)", lineHeight:1.7 }}>
                  <strong style={{ color:"var(--or)" }}>Note:</strong> Projections assume current pace continues for the full year.
                  2025 had seasonal peaks (May/Jun, Sep/Oct) and valleys (Jul/Aug). Actual 2026 will vary.
                  {projNet > 0 && INCOME_2025.netIncome < 0 && (
                    <span style={{ color:"#3ddc84" }}> At current pace, 2026 reverses the 2025 loss of {fd(INCOME_2025.netIncome,0)} into a projected profit of {fd(projNet,0)}.</span>
                  )}
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* ── WEEKLY TREND ── */}
      {view === "trend" && (
        <>
          <div className="g3" style={{ marginBottom:14 }}>
            <div className="kpi">
              <div className="klbl">Best Week (Total)</div>
              <div className="kval" style={{ color:"var(--gn)",fontSize:20 }}>{INCOME_2026.weeks.reduce((best,w) => w.rev > best.rev ? w : best, INCOME_2026.weeks[0]).label}</div>
              <div className="ksub">{fd(Math.max(...INCOME_2026.weeks.map(w=>w.rev)),0)} revenue</div>
            </div>
            <div className="kpi">
              <div className="klbl">Avg Weekly Revenue</div>
              <div className="kval" style={{ color:"var(--ye)",fontSize:20 }}>{fd(INCOME_2026.total/INCOME_2026.weeks.length,0)}</div>
              <div className="ksub">over {INCOME_2026.weeks.length} periods</div>
            </div>
            <div className="kpi">
              <div className="klbl">Best Week (Net Income)</div>
              <div className="kval" style={{ color:"var(--gn)",fontSize:20 }}>{INCOME_2026.weeks.reduce((best,w) => w.netInc > best.netInc ? w : best, INCOME_2026.weeks[0]).label}</div>
              <div className="ksub">{fd(Math.max(...INCOME_2026.weeks.map(w=>w.netInc)),0)} net income</div>
            </div>
          </div>

          {/* Toggle */}
          <div style={{ display:"flex",gap:8,marginBottom:14 }}>
            {[["combined","📊 Total Revenue"],["monthly","📅 Monthly Trend"]].map(([id,lbl]) => (
              <button key={id} onClick={() => setTrendMode(id)} style={{
                padding:"8px 18px", borderRadius:3, cursor:"pointer",
                fontFamily:"var(--f2)", fontSize:12, fontWeight:700,
                letterSpacing:1, textTransform:"uppercase",
                background: trendMode===id ? "var(--or)" : "transparent",
                color:       trendMode===id ? "#fff"     : "var(--mu)",
                border:      `1px solid ${trendMode===id ? "var(--or)" : "var(--bd)"}`,
              }}>{lbl}</button>
            ))}
          </div>

          {trendMode === "combined" && (
            <div className="card">
              <div className="ctit">Weekly Revenue, Gross Profit &amp; Carrier Pay</div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={INCOME_2026.weeks} margin={{ top:8,right:10,left:10,bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" />
                  <XAxis dataKey="label" tick={{ fill:"var(--mu)",fontSize:9 }} />
                  <YAxis tick={{ fill:"var(--mu)",fontSize:9 }} tickFormatter={v=>"$"+Math.round(v/1000)+"k"} />
                  <Tooltip content={<CustomTip />} />
                  <Bar dataKey="rev" name="Revenue" fill="#3ddc84" radius={[2,2,0,0]} />
                  <Bar dataKey="gp"  name="Gross Profit" fill="#f47820" radius={[2,2,0,0]} />
                  <Bar dataKey="carrier" name="Carrier Pay" fill="#ff525280" radius={[2,2,0,0]} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display:"flex",gap:20,fontSize:10,color:"var(--mu)",marginTop:8 }}>
                <span><span style={{ color:"#3ddc84" }}>■</span> Revenue</span>
                <span><span style={{ color:"#f47820" }}>■</span> Gross Profit</span>
                <span><span style={{ color:"#ff5252" }}>■</span> Carrier Pay</span>
              </div>
              {/* Weekly detail table */}
              <div style={{ marginTop:14,overflowX:"auto" }}>
                <table className="tbl" style={{ fontSize:10 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign:"left" }}>Week</th>
                      <th style={{ color:"#f47820" }}>CE</th>
                      <th style={{ color:"#4fc3f7" }}>SF</th>
                      <th style={{ color:"#b39ddb" }}>DI</th>
                      <th>Revenue</th>
                      <th style={{ color:"#ff5252" }}>Carrier Pay</th>
                      <th style={{ color:"#3ddc84" }}>GP</th>
                      <th>GP %</th>
                      <th style={{ color:undefined }}>Net Inc</th>
                    </tr>
                  </thead>
                  <tbody>
                    {INCOME_2026.weeks.map((w,i) => (
                      <tr key={w.label} style={{ background:i%2===0?"var(--s2)":"transparent" }}>
                        <td style={{ fontWeight:600,fontSize:11 }}>{w.label}</td>
                        <td style={{ color:"#f47820" }}>{fd(w.ce,0)}</td>
                        <td style={{ color:"#4fc3f7" }}>{fd(w.sf,0)}</td>
                        <td style={{ color:"#b39ddb" }}>{fd(w.di,0)}</td>
                        <td style={{ fontWeight:600 }}>{fd(w.rev,0)}</td>
                        <td style={{ color:"#ff5252" }}>{fd(w.carrier,0)}</td>
                        <td style={{ color:"#3ddc84" }}>{fd(w.gp,0)}</td>
                        <td style={{ color:"#3ddc84" }}>{fp(w.gp/w.rev*100)}</td>
                        <td style={{ color:w.netInc>=0?"#3ddc84":"#ff5252",fontWeight:600 }}>{fd(w.netInc,0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>TOTAL</td>
                      <td style={{ color:"#f47820" }}>{fd(INCOME_2026.ce,0)}</td>
                      <td style={{ color:"#4fc3f7" }}>{fd(INCOME_2026.sf,0)}</td>
                      <td style={{ color:"#b39ddb" }}>{fd(INCOME_2026.di,0)}</td>
                      <td style={{ fontWeight:700 }}>{fd(INCOME_2026.total,0)}</td>
                      <td style={{ color:"#ff5252" }}>{fd(INCOME_2026.carrierPay,0)}</td>
                      <td style={{ color:"#3ddc84" }}>{fd(INCOME_2026.grossProfit,0)}</td>
                      <td style={{ color:"#3ddc84" }}>{fp(INCOME_2026.grossProfit/INCOME_2026.total*100)}</td>
                      <td style={{ color:INCOME_2026.netIncome>=0?"#3ddc84":"#ff5252",fontWeight:700 }}>{fd(INCOME_2026.netIncome,0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

                    {trendMode === "monthly" && (
            <div className="card">
              <div className="ctit">Monthly Revenue — Jan 2025 through Jan 2026</div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={MONTHLY_REVENUE} margin={{ top:8,right:10,left:10,bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" />
                  <XAxis dataKey="m" tick={{ fill:"var(--mu)",fontSize:9 }} />
                  <YAxis tick={{ fill:"var(--mu)",fontSize:9 }} tickFormatter={v=>"$"+Math.round(v/1000)+"k"} />
                  <Tooltip content={<CustomTip />} />
                  <Bar dataKey="ce" name="CE Revenue" fill="#f47820" stackId="a" />
                  <Bar dataKey="sf" name="SF Revenue" fill="#4fc3f7" stackId="a" />
                  <Bar dataKey="di" name="DI Revenue" fill="#b39ddb" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display:"flex",gap:20,fontSize:10,color:"var(--mu)",marginTop:8,marginBottom:20 }}>
                <span><span style={{ color:"#f47820" }}>■</span> CE Revenue</span>
                <span><span style={{ color:"#4fc3f7" }}>■</span> SF Revenue</span>
                <span><span style={{ color:"#b39ddb" }}>■</span> DI Revenue</span>
              </div>

              {/* GP line overlay */}
              <div style={{ fontSize:10,color:"var(--mu)",letterSpacing:2,textTransform:"uppercase",marginBottom:8 }}>
                Gross Profit by Month
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={MONTHLY_REVENUE} margin={{ top:8,right:10,left:10,bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" />
                  <XAxis dataKey="m" tick={{ fill:"var(--mu)",fontSize:9 }} />
                  <YAxis tick={{ fill:"var(--mu)",fontSize:9 }} tickFormatter={v=>"$"+Math.round(v/1000)+"k"} />
                  <Tooltip content={<CustomTip />} />
                  <Line dataKey="total" name="Total Revenue" stroke="#3ddc84" strokeWidth={2} dot={{ r:3,fill:"#3ddc84" }} strokeDasharray="4 2" />
                  <Line dataKey="gp"    name="Gross Profit"  stroke="#f5c542" strokeWidth={2} dot={{ r:3,fill:"#f5c542" }} />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ display:"flex",gap:20,fontSize:10,color:"var(--mu)",marginTop:8 }}>
                <span><span style={{ color:"#3ddc84" }}>- -</span> Total Revenue</span>
                <span><span style={{ color:"#f5c542" }}>■</span> Gross Profit</span>
              </div>

              {/* Monthly summary table */}
              <div style={{ marginTop:20,overflowX:"auto" }}>
                <table className="tbl" style={{ fontSize:11 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign:"left" }}>Month</th>
                      <th style={{ color:"#f47820" }}>CE</th>
                      <th style={{ color:"#4fc3f7" }}>SF</th>
                      <th style={{ color:"#b39ddb" }}>DI</th>
                      <th>Total</th>
                      <th style={{ color:"#f5c542" }}>Gross Profit</th>
                      <th style={{ color:"#f5c542" }}>GP %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MONTHLY_REVENUE.map((row,i) => (
                      <tr key={row.m} style={{ background:i%2===0?"var(--s2)":"transparent",
                        fontWeight:row.m==="Jan 26"?700:400,
                        borderTop:row.m==="Jan 26"?"2px solid var(--or)":undefined }}>
                        <td style={{ color:row.m==="Jan 26"?"var(--or)":"var(--tx)" }}>{row.m}</td>
                        <td style={{ color:"#f47820" }}>{fd(row.ce,0)}</td>
                        <td style={{ color:"#4fc3f7" }}>{fd(row.sf,0)}</td>
                        <td style={{ color:"#b39ddb" }}>{fd(row.di,0)}</td>
                        <td style={{ fontWeight:600 }}>{fd(row.total,0)}</td>
                        <td style={{ color:"#f5c542" }}>{fd(row.gp,0)}</td>
                        <td style={{ color:"#f5c542" }}>{fp(row.gp/row.total*100)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>2025 Total</td>
                      <td>{fd(MONTHLY_REVENUE.slice(0,12).reduce((s,r)=>s+r.ce,0),0)}</td>
                      <td>{fd(MONTHLY_REVENUE.slice(0,12).reduce((s,r)=>s+r.sf,0),0)}</td>
                      <td>{fd(MONTHLY_REVENUE.slice(0,12).reduce((s,r)=>s+r.di,0),0)}</td>
                      <td>{fd(MONTHLY_REVENUE.slice(0,12).reduce((s,r)=>s+r.total,0),0)}</td>
                      <td>{fd(MONTHLY_REVENUE.slice(0,12).reduce((s,r)=>s+r.gp,0),0)}</td>
                      <td>{fp(MONTHLY_REVENUE.slice(0,12).reduce((s,r)=>s+r.gp,0)/MONTHLY_REVENUE.slice(0,12).reduce((s,r)=>s+r.total,0)*100)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── YoY COMPARISON ── */}
      {view === "yoy" && (
        <>
          {/* YoY KPIs */}
          <div className="g4" style={{ marginBottom:14 }}>
            <div className="kpi">
              <div className="klbl">2026 Same-Window Revenue</div>
              <div className="kval" style={{ color:"var(--gn)" }}>{fd(ytd26FullRev,0)}</div>
              <div className="ksub">{sameWindowLabel} · closed months</div>
            </div>
            <div className="kpi">
              <div className="klbl">2025 Same-Window Revenue</div>
              <div className="kval" style={{ color:"var(--mu)" }}>{fd(ytd25SameRev,0)}</div>
              <div className="ksub">same months in 2025</div>
            </div>
            <div className="kpi">
              <div className="klbl">YoY Revenue Change</div>
              <div className="kval" style={{ color:yoyRevChg>=0?"var(--gn)":"var(--rd)" }}>{yoyRevChg>=0?"+":""}{yoyRevChg.toFixed(1)}%</div>
              <div className="ksub">{yoyRevChg>=0?"+":""}{fd(ytd26FullRev-ytd25SameRev,0)} apples-to-apples</div>
            </div>
            <div className="kpi">
              <div className="klbl">2025 Full Year</div>
              <div className="kval" style={{ color:"var(--ye)" }}>{fd(INCOME_2025.total,0)}</div>
              <div className="ksub">GP {fp(gpMargin25)}</div>
            </div>
          </div>

          {/* Month by month side by side */}
          <div className="card" style={{ marginBottom:14 }}>
            <div className="ctit">Monthly Revenue — 2026 vs 2025 (Same Months)</div>
            {/* % change labels above each month */}
            <div style={{ display:"flex",justifyContent:"space-around",marginBottom:6,paddingLeft:40 }}>
              {monthCompare.map(d => {
                const chg = (d.v26/d.v25 - 1)*100;
                const up  = chg >= 0;
                return (
                  <div key={d.m} style={{ textAlign:"center" }}>
                    <span style={{
                      fontFamily:"var(--f2)",fontSize:15,fontWeight:900,
                      color:up?"#3ddc84":"#ff5252",
                      background:up?"rgba(61,220,132,.12)":"rgba(255,82,82,.12)",
                      border:`1px solid ${up?"rgba(61,220,132,.3)":"rgba(255,82,82,.3)"}`,
                      borderRadius:3,padding:"2px 8px",
                    }}>
                      {up?"↑":"↓"}{Math.abs(chg).toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthCompare} margin={{ top:8,right:10,left:10,bottom:5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" />
                <XAxis dataKey="m" tick={{ fill:"var(--mu)",fontSize:11 }} />
                <YAxis tick={{ fill:"var(--mu)",fontSize:9 }} tickFormatter={v=>"$"+Math.round(v/1000)+"k"} />
                <Tooltip content={<CustomTip />} />
                <Bar dataKey="v26" name="2026" fill="#3ddc84" radius={[2,2,0,0]} />
                <Bar dataKey="v25" name="2025" fill="#5a6370" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display:"flex",gap:20,fontSize:10,color:"var(--mu)",marginTop:8 }}>
              <span><span style={{ color:"#3ddc84" }}>■</span> 2026</span>
              <span><span style={{ color:"#5a6370" }}>■</span> 2025 (same period)</span>
            </div>
          </div>

          {/* Monthly detail table */}
          <div className="card" style={{ marginBottom:14 }}>
            <div className="ctit">2025 Monthly Revenue — Full Year</div>
            <div style={{ overflowX:"auto" }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ textAlign:"left" }}>Month</th>
                    <th>Revenue</th>
                    <th>vs Monthly Avg</th>
                    <th>% of Annual</th>
                  </tr>
                </thead>
                <tbody>
                  {INCOME_2025.months.map((m,i) => {
                    const avg = INCOME_2025.total/12;
                    const vsAvg = (m.rev/avg-1)*100;
                    return (
                      <tr key={m.m} style={{ background:i%2===0?"var(--s2)":"transparent" }}>
                        <td style={{ fontWeight:600 }}>{m.m} 2025</td>
                        <td style={{ color:"var(--ye)" }}>{fd(m.rev,0)}</td>
                        <td style={{ color:vsAvg>=0?"var(--gn)":"var(--rd)", fontWeight:600 }}>
                          {vsAvg>=0?"+":""}{vsAvg.toFixed(1)}%
                        </td>
                        <td style={{ color:"var(--mu)" }}>{fp(m.rev/INCOME_2025.total*100)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td>FULL YEAR</td>
                    <td>{fd(INCOME_2025.total,0)}</td>
                    <td>{fd(INCOME_2025.total/12,0)}/mo avg</td>
                    <td>100.0%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Net income comparison */}
          <div className="card">
            <div className="ctit">Net Income — 2026 vs 2025 (same window: {sameWindowLabel})</div>
            <div className="g3" style={{ gap:10 }}>
              <div className="kpi">
                <div className="klbl">2026 Same-Window Net</div>
                <div className="kval" style={{ color:ytd26FullNI>=0?"var(--gn)":"var(--rd)" }}>{fd(ytd26FullNI,0)}</div>
                <div className="ksub">{sameWindowLabel} closed months</div>
              </div>
              <div className="kpi">
                <div className="klbl">2025 Same-Window Net (est.)</div>
                <div className="kval" style={{ color:ytd25SameNI>=0?"var(--gn)":"var(--rd)" }}>{fd(ytd25SameNI,0)}</div>
                <div className="ksub">prorated from full-year ({fp(ytd25SameRev/INCOME_2025.total*100)} of yr)</div>
              </div>
              <div className="kpi">
                <div className="klbl">2025 Full Year Net</div>
                <div className="kval" style={{ color:INCOME_2025.netIncome>=0?"var(--gn)":"var(--rd)" }}>{fd(INCOME_2025.netIncome,0)}</div>
                <div className="ksub">{INCOME_2025.netIncome<0?"loss":"profit"}</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Revenue Simulation */}
      <div style={{
        marginTop:14, padding:"24px", borderRadius:6,
        background:"linear-gradient(135deg,#12151c,#181c26)",
        border:"2px solid #4fc3f740",
      }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <div>
            <div style={{ fontFamily:"var(--f2)",fontSize:18,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"#4fc3f7" }}>
              Revenue Simulator
            </div>
            <div style={{ fontSize:10,color:"var(--mu)",marginTop:2 }}>What if we add straight revenue? See the impact on net income.</div>
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
            <span style={{ color:"var(--mu)",fontSize:16 }}>$</span>
            <input type="number" min={0} step={50000} value={simAmount}
              onChange={e => setSimAmount(Math.max(0, +e.target.value || 0))}
              style={{
                width:140, fontFamily:"var(--f2)", fontSize:24, fontWeight:900, color:"#4fc3f7",
                background:"var(--bg)", border:"1px solid var(--bd)", borderRadius:3,
                padding:"6px 10px", textAlign:"right", outline:"none",
              }} />
          </div>
        </div>

        <div style={{ display:"flex",gap:6,marginBottom:16,flexWrap:"wrap" }}>
          {[100000,200000,300000,500000,1000000].map(amt => (
            <button key={amt} onClick={() => setSimAmount(amt)} style={{
              padding:"4px 12px",borderRadius:3,cursor:"pointer",
              fontFamily:"var(--f2)",fontSize:11,fontWeight:700,
              background:simAmount===amt?"#4fc3f7":"transparent",
              color:simAmount===amt?"#000":"var(--mu)",
              border:`1px solid ${simAmount===amt?"#4fc3f7":"var(--bd)"}`,
            }}>{fd(amt,0)}</button>
          ))}
        </div>

        {(() => {
          const curRev = INCOME_2026.total;
          const curGP = INCOME_2026.grossProfit;
          const curExp = INCOME_2026.totalExp;
          const curNet = INCOME_2026.netIncome;
          const newRev = curRev + simAmount;
          const newGP = curGP + simAmount; // straight revenue = 100% to GP
          const newNet = curNet + simAmount;
          const curNetMargin = curNet / curRev * 100;
          const newNetMargin = newNet / newRev * 100;
          return (
            <div style={{ display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:20,alignItems:"start" }}>
              {/* Current */}
              <div>
                <div style={{ fontSize:9,color:"var(--mu)",letterSpacing:2,textTransform:"uppercase",marginBottom:10 }}>Current</div>
                {[
                  { label:"Revenue",     val:curRev, color:"#3ddc84" },
                  { label:"Gross Profit", val:curGP,  color:"#f5c542" },
                  { label:"Expenses",    val:curExp, color:"#ff5252" },
                  { label:"Net Income",  val:curNet, color:curNet>=0?"#3ddc84":"#ff5252" },
                  { label:"Net Margin",  val:null,   pct:curNetMargin, color:curNetMargin>=0?"#3ddc84":"#ff5252" },
                ].map(r => (
                  <div key={r.label} style={{ display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid var(--bd)" }}>
                    <span style={{ fontSize:11,color:"var(--mu)" }}>{r.label}</span>
                    <span style={{ fontFamily:"var(--f2)",fontSize:13,fontWeight:700,color:r.color }}>
                      {r.val !== null ? fd(r.val,0) : fp(r.pct)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Arrow */}
              <div style={{ display:"flex",alignItems:"center",paddingTop:40 }}>
                <div style={{ fontFamily:"var(--f2)",fontSize:28,color:"#4fc3f7" }}>→</div>
              </div>

              {/* Simulated */}
              <div>
                <div style={{ fontSize:9,color:"#4fc3f7",letterSpacing:2,textTransform:"uppercase",marginBottom:10 }}>
                  + {fd(simAmount,0)} Revenue
                </div>
                {[
                  { label:"Revenue",     val:newRev, color:"#3ddc84" },
                  { label:"Gross Profit", val:newGP,  color:"#f5c542" },
                  { label:"Expenses",    val:curExp, color:"#ff5252" },
                  { label:"Net Income",  val:newNet, color:newNet>=0?"#3ddc84":"#ff5252" },
                  { label:"Net Margin",  val:null,   pct:newNetMargin, color:newNetMargin>=0?"#3ddc84":"#ff5252" },
                ].map(r => (
                  <div key={r.label} style={{ display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid var(--bd)" }}>
                    <span style={{ fontSize:11,color:"var(--mu)" }}>{r.label}</span>
                    <span style={{ fontFamily:"var(--f2)",fontSize:13,fontWeight:700,color:r.color }}>
                      {r.val !== null ? fd(r.val,0) : fp(r.pct)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Net income delta */}
        <div style={{ marginTop:16,padding:"14px",background:"rgba(61,220,132,.08)",border:"1px solid rgba(61,220,132,.2)",borderRadius:3,textAlign:"center" }}>
          <div style={{ fontSize:9,color:"#3ddc84",letterSpacing:2,textTransform:"uppercase",marginBottom:4 }}>Net Income Impact</div>
          <div style={{ fontFamily:"var(--f2)",fontSize:36,fontWeight:900,color:"#3ddc84" }}>
            {fd(INCOME_2026.netIncome + simAmount,0)}
          </div>
          <div style={{ fontSize:11,color:"var(--mu)",marginTop:4 }}>
            from {fd(INCOME_2026.netIncome,0)} → +{fd(simAmount,0)} straight revenue
          </div>
        </div>
      </div>
    </div>
  );
}


// ── CE EAST ───────────────────────────────────────────────────
// ── ASCEND REVENUE DATA (Jan 1 – Mar 29, 2026) — HISTORICAL ──
const ASCEND = {
  period: "Jan 1 – Mar 29, 2026 (Ascend TMS — historical)",
  totalLoads: 1785, totalRev: 3293924.25, totalExp: 2275881.98, totalGP: 1018042.27,
  totalMiles: 689286, avgRPM: 4.78, avgGPPerLoad: 570.33, overallMargin: 30.91,
  months: [
    { m:"Jan 2026", loads:490, rev:895756.00, exp:655524.22, gp:240231.78, miles:212802, rpm:4.21, cpm:3.08, gpPct:26.82 },
    { m:"Feb 2026", loads:683, rev:1260417.25, exp:851606.25, gp:408811.00, miles:245136, rpm:5.14, cpm:3.47, gpPct:32.43 },
    { m:"Mar 2026", loads:612, rev:1137751.00, exp:768751.51, gp:368999.49, miles:231348, rpm:4.92, cpm:3.32, gpPct:32.43 },
  ],
  weeks: [
    { label:"Dec 29-Jan 4", loads:36, rev:44575.00, exp:32748.75, gp:11826.25, miles:7630, rpm:5.84, gpPct:26.53 },
    { label:"Jan 5-11",  loads:77,  rev:153503.00, exp:118183.75, gp:35319.25, miles:43463, rpm:3.53, gpPct:23.01 },
    { label:"Jan 12-18", loads:81,  rev:151383.50, exp:131176.47, gp:20207.03, miles:44434, rpm:3.41, gpPct:13.35 },
    { label:"Jan 19-25", loads:130, rev:258409.50, exp:173239.00, gp:85170.50, miles:49563, rpm:5.21, gpPct:32.96 },
    { label:"Jan 26-Feb 1", loads:191, rev:342555.00, exp:238851.75, gp:103703.25, miles:77908, rpm:4.40, gpPct:30.27 },
    { label:"Feb 2-8",   loads:195, rev:359514.00, exp:241565.50, gp:117948.50, miles:62520, rpm:5.75, gpPct:32.81 },
    { label:"Feb 9-15",  loads:199, rev:304285.75, exp:193813.75, gp:110472.00, miles:52501, rpm:5.80, gpPct:36.31 },
    { label:"Feb 16-22", loads:137, rev:289610.00, exp:205520.50, gp:84089.50, miles:62449, rpm:4.64, gpPct:29.04 },
    { label:"Feb 23-Mar 1", loads:149, rev:276962.50, exp:189747.25, gp:87215.25, miles:61339, rpm:4.52, gpPct:31.49 },
    { label:"Mar 2-8",   loads:144, rev:257413.00, exp:180620.25, gp:76792.75, miles:54152, rpm:4.75, gpPct:29.83 },
    { label:"Mar 9-15",  loads:141, rev:280524.00, exp:188552.50, gp:91971.50, miles:57341, rpm:4.89, gpPct:32.79 },
    { label:"Mar 16-22", loads:192, rev:342043.00, exp:223620.01, gp:118422.99, miles:59873, rpm:5.71, gpPct:34.62 },
    { label:"Mar 23-29", loads:110, rev:229096.00, exp:155167.50, gp:73928.50, miles:54504, rpm:4.20, gpPct:32.27 },
    { label:"Mar 30",    loads:3,   rev:4050.00,   exp:3075.00,   gp:975.00,   miles:1609,  rpm:2.52, gpPct:24.07 },
  ],
};

// ── ALVYS REVENUE DATA (Live TMS) ──────────────────────────────
const ALVYS = {
  period: "Current — Alvys TMS (live)",
  totalLoads: 407, totalRev: 613009.50,
  ceLoads: 340, ceRev: 548910.50,
  sfLoads: 67, sfRev: 64099.00,
  byStatus: [
    { status:"Queued", loads:194, rev:304604.50 },
    { status:"Covered", loads:132, rev:199175.00 },
    { status:"Open", loads:60, rev:77330.00 },
    { status:"In Transit", loads:9, rev:16025.00 },
    { status:"Delivered", loads:8, rev:9575.00 },
    { status:"Invoiced", loads:4, rev:6300.00 },
  ],
  topCustomers: [
    { name:"4Wall Entertainment", loads:74, rev:187150.00 },
    { name:"Rentex Massachusetts", loads:41, rev:52600.00 },
    { name:"Insomniac / Night Owl", loads:43, rev:49950.00 },
    { name:"Fuse Technical Group", loads:30, rev:49504.50 },
    { name:"ON-Services", loads:10, rev:40750.00 },
    { name:"Sierra Live Productions", loads:21, rev:33800.00 },
    { name:"Firehouse Productions", loads:7, rev:20800.00 },
    { name:"Creative Technology", loads:24, rev:18650.00 },
    { name:"SGPS Showrig Inc.", loads:9, rev:15875.00 },
    { name:"Rentex AV & Computer", loads:14, rev:12605.00 },
  ],
};

function RevenueDashboard() {
  const [view, setView] = useState("alvys");
  const [alvysLive, setAlvysLive] = useState(null);
  useEffect(() => {
    fetch("/api/alvys-loads").then(r => r.json()).then(dd => {
      if (!dd || dd.error || !dd.loads) return;
      const rev = a => a.reduce((s, l) => s + (l.revenue || 0), 0);
      const ce = dd.loads.filter(l => /capacity express/i.test(l.invoiceAs || ""));
      const sf = dd.loads.filter(l => /show freight/i.test(l.invoiceAs || ""));
      const byStatus = Object.entries(dd.byStatus || {}).map(([status, v]) => ({ status, loads: v.loads, rev: v.revenue })).filter(s => s.loads > 0);
      setAlvysLive({
        period: "Live — Alvys TMS",
        totalLoads: dd.total || dd.loads.length, totalRev: byStatus.reduce((s, x) => s + x.rev, 0),
        ceLoads: ce.length, ceRev: rev(ce), sfLoads: sf.length, sfRev: rev(sf),
        byStatus,
        topCustomers: (dd.topCustomers || []).map(c => ({ name: c.name, loads: c.loads, rev: c.revenue })),
        fetchedAt: dd.fetchedAt,
      });
    }).catch(() => {});
  }, []);
  const AV = alvysLive || ALVYS;
  const d = ASCEND;
  const latest = d.months[d.months.length - 1];
  const best = d.weeks.reduce((b,w) => w.rev > b.rev ? w : b, d.weeks[0]);
  const bestMargin = d.weeks.filter(w=>w.loads>10).reduce((b,w) => w.gpPct > b.gpPct ? w : b, d.weeks[0]);

  return (
    <div>
      <div className="ptitle">Revenue — TMS</div>
      <div className="psub">Load-level revenue, margins, per-mile economics</div>

      {/* TMS toggle */}
      <div style={{ display:"flex",gap:8,marginBottom:14 }}>
        {[["alvys","🟢 Alvys (Current)"],["ascend","📁 Ascend (Jan–Mar Historical)"]].map(([id,lbl]) => (
          <button key={id} onClick={() => setView(id)} style={{
            padding:"7px 16px",borderRadius:3,cursor:"pointer",
            fontFamily:"var(--f2)",fontSize:12,fontWeight:700,letterSpacing:1,textTransform:"uppercase",
            background:view===id?"var(--or)":"transparent",
            color:view===id?"#fff":"var(--mu)",
            border:`1px solid ${view===id?"var(--or)":"var(--bd)"}`,
          }}>{lbl}</button>
        ))}
      </div>

      {/* ── ALVYS SECTION ── */}
      {view === "alvys" && (
        <>
          <div style={{ fontSize:11, marginBottom:10, color: alvysLive ? "#3ddc84" : "#f5c542" }}>
            {alvysLive ? `🟢 Live from Alvys · ${fn(AV.totalLoads,0)} loads · as of ${new Date(alvysLive.fetchedAt).toLocaleString()}` : "🟡 Static snapshot (live fetch pending/failed)"}
          </div>
          <div className="g4" style={{ marginBottom:14 }}>
            {[
              { label:"Total Pipeline", val:fd(AV.totalRev,0), color:"#3ddc84", sub:`${fn(AV.totalLoads,0)} loads across all statuses` },
              { label:"CE Revenue", val:fd(AV.ceRev,0), color:"#4fc3f7", sub:`${AV.ceLoads} loads · Capacity Express` },
              { label:"SF Revenue", val:fd(AV.sfRev,0), color:"#f47820", sub:`${AV.sfLoads} loads · Show Freight` },
              { label:"Avg Revenue/Load", val:fd(AV.totalRev/AV.totalLoads,0), color:"#f5c542", sub:`Across ${AV.totalLoads} total loads` },
            ].map(k => (
              <div key={k.label} style={{ background:"var(--s1)",border:`1px solid ${k.color}40`,borderRadius:6,padding:"22px",textAlign:"center" }}>
                <div style={{ fontSize:9,letterSpacing:3,textTransform:"uppercase",color:k.color,marginBottom:6 }}>{k.label}</div>
                <div style={{ fontFamily:"var(--f2)",fontSize:38,fontWeight:900,color:k.color,lineHeight:1 }}>{k.val}</div>
                <div style={{ fontSize:10,color:"var(--mu)",marginTop:6 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          <div className="g2" style={{ gap:14,marginBottom:14 }}>
            <div className="card">
              <div className="ctit">Pipeline by Status</div>
              {AV.byStatus.map(s => (
                <div key={s.status} style={{ marginBottom:10 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3 }}>
                    <span style={{ fontWeight:600 }}>{s.status}</span>
                    <span style={{ fontFamily:"var(--f2)",fontWeight:800 }}>{fd(s.rev,0)} <span style={{ color:"var(--mu)",fontWeight:400 }}>({s.loads} loads)</span></span>
                  </div>
                  <div className="bar" style={{ height:20 }}>
                    <div className="bfil" style={{ width:`${(s.rev/AV.totalRev*100)}%`,background:s.status==="Delivered"?"#3ddc84":s.status==="Invoiced"?"#f5c542":s.status==="In Transit"?"#4fc3f7":"#666" }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="ctit">Top 10 Customers</div>
              <table className="tbl" style={{ fontSize:11 }}>
                <thead><tr><th style={{ textAlign:"left" }}>Customer</th><th>Loads</th><th>Revenue</th></tr></thead>
                <tbody>
                  {AV.topCustomers.map((c,i) => (
                    <tr key={c.name} style={{ background:i%2===0?"var(--s2)":"transparent" }}>
                      <td style={{ fontWeight:600 }}>{c.name}</td>
                      <td>{c.loads}</td>
                      <td style={{ color:"#3ddc84" }}>{fd(c.rev,0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ padding:12,background:"rgba(61,220,132,.06)",border:"1px solid rgba(61,220,132,.15)",borderRadius:4,fontSize:11,color:"var(--mu)",textAlign:"center" }}>
            Alvys TMS data is live. As more loads are completed, this dashboard will build history automatically.
          </div>
        </>
      )}

      {/* ── ASCEND HISTORICAL SECTION ── */}
      {(view === "overview" || view === "weekly" || view === "monthly" || view === "ascend") && (() => { const aView = view === "ascend" ? "overview" : view; return (
        <>
      <div style={{ padding:8,background:"rgba(244,120,32,.08)",border:"1px solid rgba(244,120,32,.2)",borderRadius:4,fontSize:11,color:"var(--mu)",textAlign:"center",marginBottom:14 }}>
        📁 Ascend TMS Historical Data — Jan 1 – Mar 29, 2026 · Ascend has been replaced by Alvys
      </div>

      {/* Sub-view toggle */}
      <div style={{ display:"flex",gap:8,marginBottom:14 }}>
        {[["overview","📊 Overview"],["weekly","📈 Weekly"],["monthly","📅 Monthly"]].map(([id,lbl]) => (
          <button key={id} onClick={() => setView(id)} style={{
            padding:"7px 16px",borderRadius:3,cursor:"pointer",
            fontFamily:"var(--f2)",fontSize:12,fontWeight:700,letterSpacing:1,textTransform:"uppercase",
            background:(aView===id||view===id)?"var(--or)":"transparent",
            color:(aView===id||view===id)?"#fff":"var(--mu)",
            border:`1px solid ${(aView===id||view===id)?"var(--or)":"var(--bd)"}`,
          }}>{lbl}</button>
        ))}
      </div>

      {/* Hero KPIs */}
      <div className="g4" style={{ marginBottom:14 }}>
        {[
          { label:"Total Revenue", val:fd(d.totalRev,0), color:"#3ddc84", sub:`${fn(d.totalLoads,0)} loads · ${fn(d.totalMiles,0)} miles` },
          { label:"Total Expenses", val:fd(d.totalExp,0), color:"#ff5252", sub:`Avg ${fd(d.totalExp/d.totalLoads,0)}/load · $${(d.totalExp/d.totalMiles).toFixed(2)}/mi` },
          { label:"Gross Profit", val:fd(d.totalGP,0), color:"#f5c542", sub:`${fp(d.overallMargin)} margin · ${fd(d.avgGPPerLoad,0)}/load` },
          { label:"Revenue/Mile", val:`$${d.avgRPM.toFixed(2)}`, color:"#4fc3f7", sub:`vs $${(d.totalExp/d.totalMiles).toFixed(2)} cost/mi · $${(d.avgRPM - d.totalExp/d.totalMiles).toFixed(2)} spread` },
        ].map(k => (
          <div key={k.label} style={{ background:"var(--s1)",border:`1px solid ${k.color}40`,borderRadius:6,padding:"22px",textAlign:"center" }}>
            <div style={{ fontSize:9,letterSpacing:3,textTransform:"uppercase",color:k.color,marginBottom:6 }}>{k.label}</div>
            <div style={{ fontFamily:"var(--f2)",fontSize:38,fontWeight:900,color:k.color,lineHeight:1 }}>{k.val}</div>
            <div style={{ fontSize:10,color:"var(--mu)",marginTop:6 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* View toggle */}
      <div style={{ display:"flex",gap:8,marginBottom:14 }}>
        {[["overview","📊 Overview"],["weekly","📈 Weekly"],["monthly","📅 Monthly"]].map(([id,lbl]) => (
          <button key={id} onClick={() => setView(id)} style={{
            padding:"7px 16px",borderRadius:3,cursor:"pointer",
            fontFamily:"var(--f2)",fontSize:12,fontWeight:700,letterSpacing:1,textTransform:"uppercase",
            background:view===id?"var(--or)":"transparent",
            color:view===id?"#fff":"var(--mu)",
            border:`1px solid ${view===id?"var(--or)":"var(--bd)"}`,
          }}>{lbl}</button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {aView === "overview" && (
        <>
          {/* Monthly trend chart */}
          <div className="card" style={{ marginBottom:14 }}>
            <div className="ctit">Monthly Revenue vs Expenses</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={d.months} margin={{ top:8,right:10,left:10,bottom:5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" />
                <XAxis dataKey="m" tick={{ fill:"var(--mu)",fontSize:10 }} />
                <YAxis tick={{ fill:"var(--mu)",fontSize:9 }} tickFormatter={v=>"$"+Math.round(v/1000)+"k"} />
                <Tooltip content={<CustomTip />} />
                <Bar dataKey="rev" name="Revenue" fill="#3ddc84" radius={[2,2,0,0]} />
                <Bar dataKey="exp" name="Expenses" fill="#ff525280" radius={[2,2,0,0]} />
                <Bar dataKey="gp"  name="Gross Profit" fill="#f5c542" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display:"flex",gap:20,fontSize:10,color:"var(--mu)",marginTop:8 }}>
              <span><span style={{ color:"#3ddc84" }}>■</span> Revenue</span>
              <span><span style={{ color:"#ff5252" }}>■</span> Expenses</span>
              <span><span style={{ color:"#f5c542" }}>■</span> Gross Profit</span>
            </div>
          </div>

          {/* Monthly summary + margin trend */}
          <div className="g2" style={{ gap:14,marginBottom:14 }}>
            <div className="card">
              <div className="ctit">Monthly Summary</div>
              <table className="tbl" style={{ fontSize:11 }}>
                <thead>
                  <tr><th style={{ textAlign:"left" }}>Month</th><th>Loads</th><th>Revenue</th><th>Expenses</th><th style={{ color:"#f5c542" }}>GP</th><th>Margin</th><th>$/Mile</th></tr>
                </thead>
                <tbody>
                  {d.months.map((m,i) => (
                    <tr key={m.m} style={{ background:i%2===0?"var(--s2)":"transparent" }}>
                      <td style={{ fontWeight:700 }}>{m.m}</td>
                      <td>{m.loads}</td>
                      <td style={{ color:"#3ddc84" }}>{fd(m.rev,0)}</td>
                      <td style={{ color:"#ff5252" }}>{fd(m.exp,0)}</td>
                      <td style={{ color:"#f5c542",fontWeight:700 }}>{fd(m.gp,0)}</td>
                      <td style={{ color:m.gpPct>=30?"#3ddc84":"#f5c542",fontWeight:700 }}>{fp(m.gpPct)}</td>
                      <td style={{ color:"#4fc3f7" }}>${m.rpm.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td>{fn(d.totalLoads,0)}</td>
                    <td style={{ color:"#3ddc84" }}>{fd(d.totalRev,0)}</td>
                    <td style={{ color:"#ff5252" }}>{fd(d.totalExp,0)}</td>
                    <td style={{ color:"#f5c542",fontWeight:800 }}>{fd(d.totalGP,0)}</td>
                    <td style={{ fontWeight:800 }}>{fp(d.overallMargin)}</td>
                    <td style={{ color:"#4fc3f7" }}>${d.avgRPM.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="card">
              <div className="ctit">Margin Trend</div>
              <div style={{ fontSize:10,color:"var(--mu)",marginBottom:8 }}>GP margin improving month-over-month</div>
              {d.months.map(m => {
                const color = m.gpPct >= 35 ? "#3ddc84" : m.gpPct >= 25 ? "#f5c542" : "#ff5252";
                return (
                  <div key={m.m} style={{ marginBottom:12 }}>
                    <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4 }}>
                      <span style={{ fontWeight:600 }}>{m.m}</span>
                      <span style={{ fontFamily:"var(--f2)",fontWeight:800,color }}>{fp(m.gpPct)}</span>
                    </div>
                    <div className="bar" style={{ height:24 }}>
                      <div className="bfil" style={{ width:`${m.gpPct}%`,background:color,display:"flex",alignItems:"center",paddingLeft:8 }}>
                        <span style={{ fontSize:9,color:"#fff",fontWeight:700 }}>{fd(m.gp,0)}</span>
                      </div>
                    </div>
                    <div style={{ display:"flex",justifyContent:"space-between",fontSize:9,color:"var(--mu)",marginTop:2 }}>
                      <span>{m.loads} loads · {fn(m.miles,0)} mi</span>
                      <span>{fd(m.gp/m.loads,0)}/load · ${m.rpm.toFixed(2)}/mi</span>
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop:14,padding:"12px",background:"rgba(61,220,132,.08)",border:"1px solid rgba(61,220,132,.2)",borderRadius:3,textAlign:"center" }}>
                <div style={{ fontSize:9,color:"#3ddc84",letterSpacing:2,textTransform:"uppercase",marginBottom:4 }}>Margin Improvement Jan → Mar</div>
                <div style={{ fontFamily:"var(--f2)",fontSize:28,fontWeight:900,color:"#3ddc84" }}>+{(d.months[d.months.length-1].gpPct - d.months[0].gpPct).toFixed(1)} pts</div>
              </div>
            </div>
          </div>

          {/* Per-mile comparison vs fleet CPM */}
          <div className="card">
            <div className="ctit">Revenue/Mile vs Fleet All-In CPM</div>
            <div style={{ display:"flex",gap:20,alignItems:"center",padding:"20px",justifyContent:"center" }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:9,color:"#4fc3f7",letterSpacing:2,textTransform:"uppercase" }}>TMS Rev/Mi</div>
                <div style={{ fontFamily:"var(--f2)",fontSize:48,fontWeight:900,color:"#4fc3f7" }}>${d.avgRPM.toFixed(2)}</div>
              </div>
              <div style={{ fontFamily:"var(--f2)",fontSize:24,color:"var(--mu)" }}>vs</div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:9,color:"#ff8a65",letterSpacing:2,textTransform:"uppercase" }}>Fleet All-In CPM</div>
                <div style={{ fontFamily:"var(--f2)",fontSize:48,fontWeight:900,color:"#ff8a65" }}>${ALLIN_CPM_V.toFixed(2)}</div>
              </div>
              <div style={{ fontFamily:"var(--f2)",fontSize:24,color:"var(--mu)" }}>=</div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:9,color:"#3ddc84",letterSpacing:2,textTransform:"uppercase" }}>Net Spread/Mi</div>
                <div style={{ fontFamily:"var(--f2)",fontSize:48,fontWeight:900,color:"#3ddc84" }}>${(d.avgRPM - ALLIN_CPM_V).toFixed(2)}</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── WEEKLY VIEW ── */}
      {aView === "weekly" && (
        <>
          <div className="g3" style={{ marginBottom:14 }}>
            <div className="kpi">
              <div className="klbl">Best Revenue Week</div>
              <div className="kval" style={{ color:"#3ddc84",fontSize:18 }}>{best.label}</div>
              <div className="ksub">{fd(best.rev,0)} · {best.loads} loads</div>
            </div>
            <div className="kpi">
              <div className="klbl">Best Margin Week</div>
              <div className="kval" style={{ color:"#f5c542",fontSize:18 }}>{bestMargin.label}</div>
              <div className="ksub">{fp(bestMargin.gpPct)} · {fd(bestMargin.gp,0)} GP</div>
            </div>
            <div className="kpi">
              <div className="klbl">Avg Weekly Revenue</div>
              <div className="kval" style={{ color:"var(--or)",fontSize:18 }}>{fd(d.totalRev / d.weeks.length,0)}</div>
              <div className="ksub">{fn(d.totalLoads / d.weeks.length,0)} loads/wk</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom:14 }}>
            <div className="ctit">Weekly Revenue + Gross Profit</div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={d.weeks.filter(w=>w.loads>5)} margin={{ top:8,right:10,left:10,bottom:5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" />
                <XAxis dataKey="label" tick={{ fill:"var(--mu)",fontSize:8 }} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fill:"var(--mu)",fontSize:9 }} tickFormatter={v=>"$"+Math.round(v/1000)+"k"} />
                <Tooltip content={<CustomTip />} />
                <Bar dataKey="rev" name="Revenue" fill="#3ddc84" radius={[2,2,0,0]} />
                <Bar dataKey="gp"  name="Gross Profit" fill="#f5c542" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="ctit">Weekly Detail — {d.weeks.length} Periods</div>
            <div style={{ overflowX:"auto" }}>
              <table className="tbl" style={{ fontSize:10 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign:"left" }}>Week</th>
                    <th>Loads</th>
                    <th style={{ color:"#3ddc84" }}>Revenue</th>
                    <th style={{ color:"#ff5252" }}>Expenses</th>
                    <th style={{ color:"#f5c542" }}>GP</th>
                    <th>Margin</th>
                    <th>Miles</th>
                    <th style={{ color:"#4fc3f7" }}>$/Mile</th>
                    <th>$/Load</th>
                  </tr>
                </thead>
                <tbody>
                  {d.weeks.map((w,i) => (
                    <tr key={w.label} style={{ background:i%2===0?"var(--s2)":"transparent", opacity:w.loads<5?0.4:1 }}>
                      <td style={{ fontWeight:600 }}>{w.label}</td>
                      <td>{w.loads}</td>
                      <td style={{ color:"#3ddc84" }}>{fd(w.rev,0)}</td>
                      <td style={{ color:"#ff5252" }}>{fd(w.exp,0)}</td>
                      <td style={{ color:"#f5c542",fontWeight:700 }}>{fd(w.gp,0)}</td>
                      <td style={{ color:w.gpPct>=35?"#3ddc84":w.gpPct>=25?"#f5c542":"#ff5252",fontWeight:700 }}>{fp(w.gpPct)}</td>
                      <td>{fn(w.miles,0)}</td>
                      <td style={{ color:"#4fc3f7",fontWeight:600 }}>${w.rpm.toFixed(2)}</td>
                      <td style={{ color:"var(--mu)" }}>{w.loads>0?fd(w.gp/w.loads,0):"—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>TOTAL</td>
                    <td>{fn(d.totalLoads,0)}</td>
                    <td style={{ color:"#3ddc84" }}>{fd(d.totalRev,0)}</td>
                    <td style={{ color:"#ff5252" }}>{fd(d.totalExp,0)}</td>
                    <td style={{ color:"#f5c542",fontWeight:800 }}>{fd(d.totalGP,0)}</td>
                    <td style={{ fontWeight:800 }}>{fp(d.overallMargin)}</td>
                    <td>{fn(d.totalMiles,0)}</td>
                    <td style={{ color:"#4fc3f7" }}>${d.avgRPM.toFixed(2)}</td>
                    <td>{fd(d.avgGPPerLoad,0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── MONTHLY VIEW ── */}
      {aView === "monthly" && (
        <>
          <div className="card" style={{ marginBottom:14 }}>
            <div className="ctit">Monthly Margin Chart</div>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={d.months} margin={{ top:8,right:10,left:10,bottom:5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" />
                <XAxis dataKey="m" tick={{ fill:"var(--mu)",fontSize:10 }} />
                <YAxis yAxisId="left" tick={{ fill:"var(--mu)",fontSize:9 }} tickFormatter={v=>"$"+Math.round(v/1000)+"k"} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill:"var(--mu)",fontSize:9 }} tickFormatter={v=>v+"%"} domain={[0,50]} />
                <Tooltip content={<CustomTip />} />
                <Bar yAxisId="left" dataKey="rev" name="Revenue" fill="#3ddc8460" radius={[2,2,0,0]} />
                <Bar yAxisId="left" dataKey="gp"  name="Gross Profit" fill="#f5c542" radius={[2,2,0,0]} />
                <Line yAxisId="right" dataKey="gpPct" name="Margin %" stroke="#4fc3f7" strokeWidth={3}
                  dot={{ r:6, fill:"#4fc3f7", strokeWidth:0 }} type="monotone" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly deep-dive cards */}
          {d.months.map(m => {
            const color = m.gpPct >= 35 ? "#3ddc84" : m.gpPct >= 25 ? "#f5c542" : "#ff5252";
            return (
              <div key={m.m} className="card" style={{ marginBottom:14, borderLeft:`3px solid ${color}` }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
                  <div>
                    <div style={{ fontFamily:"var(--f2)",fontSize:20,fontWeight:800,letterSpacing:2,color }}>
                      {m.m}
                    </div>
                    <div style={{ fontSize:11,color:"var(--mu)",marginTop:4 }}>
                      {m.loads} loads · {fn(m.miles,0)} miles · avg {fn(m.miles/m.loads,0)} mi/load
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontFamily:"var(--f2)",fontSize:14,fontWeight:800,color }}>
                      {fp(m.gpPct)} MARGIN
                    </div>
                  </div>
                </div>
                <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginTop:14 }}>
                  {[
                    { label:"Revenue", val:fd(m.rev,0), c:"#3ddc84" },
                    { label:"Expenses", val:fd(m.exp,0), c:"#ff5252" },
                    { label:"GP", val:fd(m.gp,0), c:"#f5c542" },
                    { label:"Rev/Mile", val:`$${m.rpm.toFixed(2)}`, c:"#4fc3f7" },
                    { label:"GP/Load", val:fd(m.gp/m.loads,0), c:"#b39ddb" },
                  ].map(k => (
                    <div key={k.label} style={{ textAlign:"center" }}>
                      <div style={{ fontSize:9,color:"var(--mu)",letterSpacing:2,textTransform:"uppercase" }}>{k.label}</div>
                      <div style={{ fontFamily:"var(--f2)",fontSize:18,fontWeight:800,color:k.c }}>{k.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}
        </>); })()}
    </div>
  );
}

const CE_EAST = {
  // Balance Sheet — as of May 2, 2026
  bs: {
    cash: 9430.29,
    arFunding: 0, arReleased: 0, arUnreleased: 0,
    arFlexentReserves: 7806.35,
    arTotal: 7806.35, dueFromAnthony: 25000.00,
    totalAssets: 42236.64,
    shareholderChris: 0, shareholderAnthony: 6810.24,
    totalLiab: 0,
    retainedEarnings: -51572.93, netIncome2026: 60560.67,
    totalEquity: 42236.64,
  },
  // P&L — All Dates (lifetime)
  pl: {
    revenue: 1117598.77, directRevenue: 6100, revenueLoss: -13600,
    totalIncome: 1110098.77,
    cogs: 947767.90,
    grossProfit: 162330.87, expenses: 153343.13,
    netIncome: 8987.74,
    salaries: 89675.90, freightIns: 14990.24, computers: 19579.00,
    travel: 11621.19, utilities: 2984.96, officeSup: 4884.83,
    rent: 4390.00, meals: 598.11, commissions: 2880.75,
    costOfLabor: 818.15,
    carrierPay: 931650.00, merchantFees: 16117.90,
    // Salary breakdown
    salCEEmployee: 9900.00, salColombia: 55775.90, salNelly: 4000.00, salShareholder: 20000.00,
  },
  // CE East monthly 2026 (from monthly P&L)
  months2026: [
    { m:"Jan 26", rev:258555.00, gp:33360.69, carrier:220755.00, fees:4439.31, exp:24581.60, netInc:8779.09 },
    { m:"Feb 26", rev:156830.01, gp:30796.68, carrier:123492.50, fees:2540.83, exp:16162.62, netInc:14634.06 },
    { m:"Mar 26", rev:197566.25, gp:51934.39, carrier:144850.00, fees:781.86,  exp:13491.87, netInc:38442.52 },
    { m:"Apr 26", rev:15370.00,  gp:2930.00,  carrier:12440.00,  fees:0,       exp:4225.00,  netInc:-1295.00 },
  ],
  // 2026 YTD totals from monthly P&L
  ytd2026: {
    revenue: 628321.26, carrier: 501537.50, fees: 7762.00, cogs: 509299.50,
    grossProfit: 119021.76, expenses: 58461.09, netIncome: 60560.67,
  },
  ytdDays: 122,  // Jan 1 – May 2, 2026
};

function CEEast() {
  const [ceView, setCeView]   = useState("live");
  const [cePeriod, setCePeriod] = useState("ytd");
  const [ceQb, setCeQb]       = useState(null);
  const [ceBs, setCeBs]       = useState(null);
  const [ceMonths, setCeMonths] = useState(null); // live monthly P&L
  const [ceLifetime, setCeLifetime] = useState(null); // all-dates P&L
  const [ceLoading, setCeLoading] = useState(false);
  const [ceError, setCeError] = useState(null);

  // Fetch live P&L for selected period + Balance Sheet
  useEffect(() => {
    if (ceView !== "live") return;
    setCeLoading(true); setCeError(null);
    Promise.all([
      fetch(`/api/qbo-pnl?company=ce_east&period=${cePeriod}`).then(r => r.json()),
      fetch(`/api/qbo-bs?company=ce_east`).then(r => r.json()),
    ]).then(([pnl, bs]) => {
      if (pnl.error) { setCeError(pnl.error); setCeQb(null); } else setCeQb(pnl);
      if (!bs.error) setCeBs(bs);
    }).catch(e => setCeError(e.message))
      .finally(() => setCeLoading(false));
  }, [ceView, cePeriod]);

  // Fetch monthly P&L + lifetime on mount for payback calculator
  useEffect(() => {
    const year = new Date().getFullYear();
    const monthNames = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
    const currentMonth = new Date().getMonth(); // 0-indexed
    const monthsToFetch = monthNames.slice(0, currentMonth + 1);
    Promise.all([
      ...monthsToFetch.map(m => fetch(`/api/qbo-pnl?company=ce_east&period=${m}`).then(r => r.json())),
      fetch(`/api/qbo-pnl?company=ce_east&start_date=2024-01-01&end_date=${new Date().toISOString().split("T")[0]}`).then(r => r.json()),
      fetch(`/api/qbo-bs?company=ce_east`).then(r => r.json()),
    ]).then(results => {
      const bsResult = results.pop();
      const lifetimeResult = results.pop();
      const months = results.filter(r => !r.error).map(r => {
        const t = r.parsed?.totals || {};
        const cogs = r.parsed?.cogs || {};
        return {
          m: r.period?.label?.charAt(0).toUpperCase() + r.period?.label?.slice(1) + " 26",
          rev: t.totalIncome || 0,
          gp: t.grossProfit || 0,
          carrier: cogs["Carrier Pay"] || 0,
          fees: (cogs["Triumph Merchant Fees"] || 0) + (cogs["Flexent Funding Fees"] || 0),
          exp: t.totalExpenses || 0,
          netInc: t.netIncome || 0,
        };
      });
      setCeMonths(months);
      if (!lifetimeResult.error) setCeLifetime(lifetimeResult);
      if (!bsResult.error) setCeBs(bsResult);
    }).catch(() => {});
  }, []);

  // Use live data for payback if available, otherwise fall back to hardcoded
  const months2026 = ceMonths && ceMonths.length > 0 ? ceMonths : CE_EAST.months2026;
  const liveBs = ceBs?.bs || {};
  const bs = {
    ...CE_EAST.bs,
    shareholderChris: liveBs.equity?.["Shareholder Contributions - Chris"] || liveBs.equity?.["Due to Shareholder - Chris"] || CE_EAST.bs.shareholderChris,
    shareholderAnthony: liveBs.equity?.["Shareholder Contributions - Anthony"] || liveBs.equity?.["Due to Shareholder - Anthony"] || CE_EAST.bs.shareholderAnthony,
    totalAssets: liveBs.totals?.totalAssets || CE_EAST.bs.totalAssets,
    totalEquity: liveBs.totals?.totalEquity || CE_EAST.bs.totalEquity,
    dueFromAnthony: liveBs.assets?.["Due from Anthony"] || CE_EAST.bs.dueFromAnthony,
    cash: liveBs.assets?.["Checking"] || liveBs.assets?.["Cash and Cash Equivalents"] || CE_EAST.bs.cash,
    netIncome2026: ceLifetime?.parsed?.totals?.netIncome || CE_EAST.bs.netIncome2026,
    retainedEarnings: liveBs.equity?.["Retained Earnings"] || CE_EAST.bs.retainedEarnings,
  };
  const pl = {
    ...CE_EAST.pl,
    grossProfit: ceLifetime?.parsed?.totals?.grossProfit || CE_EAST.pl.grossProfit,
    netIncome: ceLifetime?.parsed?.totals?.netIncome || CE_EAST.pl.netIncome,
    revenue: ceLifetime?.parsed?.totals?.totalIncome || CE_EAST.pl.revenue,
  };

  const [distAmt, setDistAmt] = useState(Math.round(months2026.reduce((s,r)=>s+r.gp,0) / months2026.length * 0.5));

  // ── Shareholder obligations ──
  const dueToChr  = bs.shareholderChris;
  const dueToAnt  = bs.shareholderAnthony;
  const totalDue  = dueToChr + dueToAnt;
  const dueFromAnt = bs.dueFromAnthony;

  const gpAllTime = pl.grossProfit;
  const gap       = totalDue - gpAllTime;

  // ── 2026 GP pace — from actual monthly data ──
  const monthlyGP  = months2026.reduce((s,r)=>s+r.gp,0) / months2026.length; // avg of Jan/Feb/Mar
  const monthsLeft = Math.max(0, gap / monthlyGP);

  // ── Distribution date ──
  const distDate = new Date(2026, 2, 18);
  distDate.setDate(distDate.getDate() + Math.ceil(monthsLeft * 30.44));
  const distStr  = distDate.toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" });

  // ── Distribution splits ──
  const OWNERS = [
    { name:"Chris",         pct:0.45, color:"#ff5252" },
    { name:"Anthony",       pct:0.45, color:"#4fc3f7" },
    { name:"Gabriel Colon", pct:0.04, color:"#3ddc84" },
    { name:"Jon Marcus",    pct:0.06, color:"#f5c542" },
  ];
  const monthlyDist = distAmt;
  const annualDist  = monthlyDist * 12;

  // ── 2026 monthly revenue (from MONTHLY_REVENUE) ──
  const rev2026 = MONTHLY_REVENUE.filter(r => r.m.includes("26"));
  const rev2025Total = INCOME_2025.total;
  const rev2025GP    = INCOME_2025.grossProfit;

  return (
    <div>
      <div className="ptitle">CE East</div>
      <div className="psub">Capacity Express East LLC</div>

      {/* View toggle */}
      <div style={{ display:"flex",gap:8,marginBottom:14 }}>
        {[["live","⚡ Live QB"],["payback","📊 Owner Payback"]].map(([id,lbl]) => (
          <button key={id} onClick={() => setCeView(id)} style={{
            padding:"7px 16px",borderRadius:3,cursor:"pointer",
            fontFamily:"var(--f2)",fontSize:12,fontWeight:700,letterSpacing:1,textTransform:"uppercase",
            background:ceView===id?"var(--or)":"transparent",
            color:ceView===id?"#fff":"var(--mu)",
            border:`1px solid ${ceView===id?"var(--or)":"var(--bd)"}`,
          }}>{lbl}</button>
        ))}
      </div>

      {/* ── LIVE QB VIEW ── */}
      {ceView === "live" && (
        <>
          <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:14 }}>
            {[
              ["ytd","YTD"],["this_week","This Week"],["last_week","Last Week"],
              ["jan","Jan"],["feb","Feb"],["mar","Mar"],["apr","Apr"],["may","May"],["jun","Jun"],
              ["jul","Jul"],["aug","Aug"],["sep","Sep"],["oct","Oct"],["nov","Nov"],["dec","Dec"],
            ].map(([id,lbl]) => (
              <button key={id} onClick={() => setCePeriod(id)} style={{
                padding:"6px 14px",borderRadius:3,cursor:"pointer",
                fontFamily:"var(--f2)",fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",
                background:cePeriod===id?"#4fc3f7":"transparent",
                color:cePeriod===id?"#0b0d10":"var(--mu)",
                border:`1px solid ${cePeriod===id?"#4fc3f7":"var(--bd)"}`,
              }}>{lbl}</button>
            ))}
          </div>

          {ceLoading && <div style={{ textAlign:"center",padding:40,color:"var(--mu)" }}>Loading CE East from QuickBooks...</div>}
          {ceError && <div style={{ padding:16,background:"rgba(255,82,82,.1)",border:"1px solid rgba(255,82,82,.3)",borderRadius:4,color:"#ff5252",fontSize:12,marginBottom:14 }}>{ceError}</div>}

          {ceQb && (() => { const t = ceQb.parsed.totals; const p = ceQb.period; const inc = ceQb.parsed.income; const exp = ceQb.parsed.expenses; const cogs = ceQb.parsed.cogs; return (
            <>
              <div style={{ fontSize:10,color:"var(--mu)",marginBottom:12,letterSpacing:2,textTransform:"uppercase" }}>
                QuickBooks Live — CE East — {p.start_date} to {p.end_date}
              </div>

              {/* Hero KPIs */}
              <div className="g4" style={{ marginBottom:14 }}>
                {[
                  { label:"Revenue", val:t.totalIncome || 0, color:"#3ddc84" },
                  { label:"Gross Profit", val:t.grossProfit || 0, color:"#f5c542", sub:t.totalIncome > 0 ? `${(t.grossProfit/t.totalIncome*100).toFixed(1)}% margin` : "" },
                  { label:"Total Expenses", val:t.totalExpenses || 0, color:"#ff8a65" },
                  { label:"Net Income", val:t.netIncome || 0, color:(t.netIncome||0) >= 0 ? "#3ddc84" : "#ff5252" },
                ].map(k => (
                  <div key={k.label} style={{ background:"var(--s1)",border:`1px solid ${k.color}40`,borderRadius:6,padding:"18px",textAlign:"center" }}>
                    <div style={{ fontSize:9,letterSpacing:3,textTransform:"uppercase",color:k.color,marginBottom:6 }}>{k.label}</div>
                    <div style={{ fontFamily:"var(--f2)",fontSize:28,fontWeight:900,color:k.color,lineHeight:1 }}>{fd(k.val,0)}</div>
                    {k.sub && <div style={{ fontSize:10,color:"var(--mu)",marginTop:6 }}>{k.sub}</div>}
                  </div>
                ))}
              </div>

              <div className="g2" style={{ gap:14,marginBottom:14 }}>
                {/* Income breakdown */}
                <div className="card">
                  <div className="ctit">Income</div>
                  <table className="tbl" style={{ fontSize:11 }}>
                    <tbody>
                      {Object.entries(inc).filter(([k]) => !k.startsWith("Total")).map(([k,v]) => (
                        <tr key={k}><td>{k}</td><td style={{ textAlign:"right",fontFamily:"var(--f2)",color:"#3ddc84" }}>{fd(v)}</td></tr>
                      ))}
                      <tr style={{ fontWeight:800,borderTop:"1px solid var(--bd)" }}><td>Total Income</td><td style={{ textAlign:"right",fontFamily:"var(--f2)",color:"#3ddc84" }}>{fd(t.totalIncome)}</td></tr>
                    </tbody>
                  </table>
                </div>

                {/* COGS */}
                <div className="card">
                  <div className="ctit">Cost of Goods Sold</div>
                  <table className="tbl" style={{ fontSize:11 }}>
                    <tbody>
                      {Object.entries(cogs).filter(([k]) => !k.startsWith("Total")).map(([k,v]) => (
                        <tr key={k}><td>{k}</td><td style={{ textAlign:"right",fontFamily:"var(--f2)",color:"#ff5252" }}>{fd(v)}</td></tr>
                      ))}
                      <tr style={{ fontWeight:800,borderTop:"1px solid var(--bd)" }}><td>Total COGS</td><td style={{ textAlign:"right",fontFamily:"var(--f2)",color:"#ff5252" }}>{fd(t.totalCOGS)}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Expenses */}
              <div className="card" style={{ marginBottom:14 }}>
                <div className="ctit">Expenses</div>
                <table className="tbl" style={{ fontSize:11 }}>
                  <tbody>
                    {Object.entries(exp).filter(([k,v]) => !k.startsWith("Total") && v !== 0).sort((a,b) => b[1]-a[1]).map(([k,v]) => (
                      <tr key={k}><td>{k.replace(/^[^>]+> /,"")}</td><td style={{ textAlign:"right",fontFamily:"var(--f2)" }}>{fd(v)}</td></tr>
                    ))}
                    <tr style={{ fontWeight:800,borderTop:"1px solid var(--bd)" }}><td>Total Expenses</td><td style={{ textAlign:"right",fontFamily:"var(--f2)",color:"#ff5252" }}>{fd(t.totalExpenses)}</td></tr>
                  </tbody>
                </table>
              </div>

              {/* Balance Sheet */}
              {ceBs && ceBs.bs && (() => { const b = ceBs.bs; return (
                <>
                  <div style={{ fontSize:10,color:"var(--mu)",marginBottom:8,marginTop:8,letterSpacing:2,textTransform:"uppercase" }}>
                    Balance Sheet — as of {ceBs.as_of}
                  </div>
                  <div className="g3" style={{ gap:14,marginBottom:14 }}>
                    {/* Assets */}
                    <div className="card">
                      <div className="ctit" style={{ color:"#3ddc84" }}>Assets</div>
                      <table className="tbl" style={{ fontSize:11 }}>
                        <tbody>
                          {Object.entries(b.assets).filter(([k,v]) => v !== 0).map(([k,v]) => (
                            <tr key={k} style={{ fontWeight:k.startsWith("Total") ? 800 : 400 }}>
                              <td style={{ paddingLeft:k.startsWith("Total") ? 0 : 8 }}>{k}</td>
                              <td style={{ textAlign:"right",fontFamily:"var(--f2)",color:k.startsWith("Total")?"#3ddc84":"var(--tx)" }}>{fd(v)}</td>
                            </tr>
                          ))}
                          <tr style={{ fontWeight:800,borderTop:"2px solid var(--bd)" }}>
                            <td>TOTAL ASSETS</td>
                            <td style={{ textAlign:"right",fontFamily:"var(--f2)",color:"#3ddc84",fontSize:14 }}>{fd(b.totals.totalAssets)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Liabilities */}
                    <div className="card">
                      <div className="ctit" style={{ color:"#ff5252" }}>Liabilities</div>
                      <table className="tbl" style={{ fontSize:11 }}>
                        <tbody>
                          {Object.entries(b.liabilities).filter(([k,v]) => v !== 0).length > 0
                            ? Object.entries(b.liabilities).filter(([k,v]) => v !== 0).map(([k,v]) => (
                                <tr key={k} style={{ fontWeight:k.startsWith("Total") ? 800 : 400 }}>
                                  <td style={{ paddingLeft:k.startsWith("Total") ? 0 : 8 }}>{k}</td>
                                  <td style={{ textAlign:"right",fontFamily:"var(--f2)" }}>{fd(v)}</td>
                                </tr>
                              ))
                            : <tr><td colSpan={2} style={{ color:"var(--mu)",textAlign:"center" }}>No liabilities</td></tr>
                          }
                          <tr style={{ fontWeight:800,borderTop:"2px solid var(--bd)" }}>
                            <td>TOTAL LIABILITIES</td>
                            <td style={{ textAlign:"right",fontFamily:"var(--f2)",color:"#ff5252",fontSize:14 }}>{fd(b.totals.totalLiabilities || 0)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Equity */}
                    <div className="card">
                      <div className="ctit" style={{ color:"#f5c542" }}>Equity</div>
                      <table className="tbl" style={{ fontSize:11 }}>
                        <tbody>
                          {Object.entries(b.equity).filter(([k,v]) => v !== 0).map(([k,v]) => (
                            <tr key={k} style={{ fontWeight:k.startsWith("Total") ? 800 : 400 }}>
                              <td style={{ paddingLeft:k.startsWith("Total") ? 0 : 8 }}>{k}</td>
                              <td style={{ textAlign:"right",fontFamily:"var(--f2)",color:v < 0 ? "#ff5252" : "var(--tx)" }}>{fd(v)}</td>
                            </tr>
                          ))}
                          <tr style={{ fontWeight:800,borderTop:"2px solid var(--bd)" }}>
                            <td>TOTAL EQUITY</td>
                            <td style={{ textAlign:"right",fontFamily:"var(--f2)",color:"#f5c542",fontSize:14 }}>{fd(b.totals.totalEquity)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ); })()}

              <div style={{ padding:12,background:"rgba(79,195,247,.06)",border:"1px solid rgba(79,195,247,.15)",borderRadius:4,fontSize:11,color:"var(--mu)",textAlign:"center" }}>
                Live from QuickBooks · CE East P&L + Balance Sheet · Updated in real-time
              </div>
            </>
          ); })()}
        </>
      )}

      {/* ── OWNER PAYBACK VIEW ── */}
      {ceView === "payback" && (<>

      {/* 2025 + 2026 revenue — top horizontal */}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 2fr",gap:14,marginBottom:14 }}>
        <div className="card">
          <div className="ctit">2025 Full Year — CE East</div>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid var(--bd)" }}>
            <div>
              <div style={{ fontSize:11,fontWeight:700,color:"var(--tx)" }}>Gross Profit</div>
              <div style={{ fontSize:10,color:"var(--mu)" }}>{fp(43372.61/481841.01*100)} GP margin</div>
            </div>
            <div style={{ fontFamily:"var(--f2)",fontSize:28,fontWeight:900,color:"#f5c542" }}>{fd(43372.61,0)}</div>
          </div>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0" }}>
            <div style={{ fontSize:11,color:"var(--tx)" }}>Total Revenue</div>
            <div style={{ fontFamily:"var(--f2)",fontSize:18,fontWeight:700,color:"#3ddc84" }}>{fd(481841.01,0)}</div>
          </div>
        </div>
        <div className="card">
          <div className="ctit">2026 Monthly Revenue — CE East</div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10 }}>
            {months2026.map(row => (
              <div key={row.m} style={{ background:"var(--bg)",border:"1px solid var(--bd)",borderRadius:3,padding:"12px 14px" }}>
                <div style={{ fontFamily:"var(--f2)",fontSize:13,fontWeight:800,letterSpacing:1,color:"var(--or)",marginBottom:6 }}>{row.m}</div>
                <div style={{ fontFamily:"var(--f2)",fontSize:26,fontWeight:900,color:"#f5c542",lineHeight:1 }}>{fd(row.gp,0)}</div>
                <div style={{ fontSize:9,color:"var(--mu)",letterSpacing:2,textTransform:"uppercase",marginTop:2,marginBottom:6 }}>Gross Profit</div>
                <div style={{ fontSize:12,color:"#3ddc84" }}>{fd(row.rev,0)}</div>
                <div style={{ fontSize:9,color:"var(--mu)" }}>Revenue · {fp(row.gp/row.rev*100)}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0 0",borderTop:"1px solid var(--bd)",marginTop:10 }}>
            <div style={{ fontSize:11,fontWeight:800,color:"var(--tx)" }}>2026 YTD Total</div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontFamily:"var(--f2)",fontSize:20,fontWeight:900,color:"#f5c542" }}>
                {fd(months2026.reduce((s,r)=>s+r.gp,0),0)} GP
              </div>
              <div style={{ fontSize:10,color:"var(--mu)" }}>
                {fd(months2026.reduce((s,r)=>s+r.rev,0),0)} revenue
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="g2" style={{ marginBottom:14 }}>
        {/* Left: Distribution estimator */}
        <div>
          <div className="card" style={{ marginBottom:14 }}>
            <div className="ctit">Distribution Estimator</div>

            {/* Slider + input */}
            <div style={{ marginBottom:16 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
                <label className="lbl" style={{ margin:0 }}>Monthly Distribution Amount</label>
                <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                  <span style={{ color:"var(--mu)",fontSize:14 }}>$</span>
                  <input type="number" min={0} max={Math.round(monthlyGP)} step={500} value={distAmt}
                    onChange={e => setDistAmt(Math.min(Math.round(monthlyGP), Math.max(0, +e.target.value || 0)))}
                    style={{
                      width:120, fontFamily:"var(--f2)", fontSize:22, fontWeight:900, color:"#3ddc84",
                      background:"var(--bg)", border:"1px solid var(--bd)", borderRadius:3,
                      padding:"4px 8px", textAlign:"right", outline:"none",
                    }} />
                </div>
              </div>
              <input type="range" min={0} max={Math.round(monthlyGP)} step={500} value={distAmt}
                onChange={e => setDistAmt(+e.target.value)}
                style={{ width:"100%",accentColor:"#3ddc84" }} />
              <div style={{ display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--mu)",marginTop:4 }}>
                <span>$0</span><span>$8K</span><span>$16K</span><span>$24K</span><span>{fd(monthlyGP,0)}</span>
              </div>
            </div>

            {/* Total distribution result */}
            <div style={{ background:"rgba(61,220,132,.08)",border:"1px solid rgba(61,220,132,.2)",
              borderRadius:3,padding:"14px",marginBottom:14,textAlign:"center" }}>
              <div style={{ fontSize:9,color:"#3ddc84",letterSpacing:3,textTransform:"uppercase",marginBottom:4 }}>Total Monthly Distribution</div>
              <div style={{ fontFamily:"var(--f2)",fontSize:44,fontWeight:900,color:"#3ddc84",lineHeight:1 }}>
                {fd(monthlyDist,0)}<span style={{ fontSize:16,color:"var(--mu)" }}>/mo</span>
              </div>
              <div style={{ fontSize:11,color:"var(--mu)",marginTop:4 }}>{fd(annualDist,0)}/yr · {fp(monthlyGP > 0 ? monthlyDist/monthlyGP*100 : 0)} of {fd(monthlyGP,0)}/mo avg GP</div>
            </div>

            {/* Owner splits */}
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14 }}>
              {OWNERS.map(o => (
                <div key={o.name} style={{ background:"var(--bg)",border:`1px solid ${o.color}30`,
                  borderRadius:3,padding:"12px",textAlign:"center" }}>
                  <div style={{ fontSize:9,color:o.color,letterSpacing:2,textTransform:"uppercase",marginBottom:4 }}>
                    {o.name} · {fp(o.pct*100)}
                  </div>
                  <div style={{ fontFamily:"var(--f2)",fontSize:24,fontWeight:900,color:o.color }}>{fd(monthlyDist*o.pct,0)}</div>
                  <div style={{ fontSize:10,color:"var(--mu)",marginTop:2 }}>per month · {fd(monthlyDist*o.pct*12,0)}/yr</div>
                </div>
              ))}
            </div>

            {/* Quick reference table */}
            <div style={{ fontSize:10,color:"var(--mu)",letterSpacing:2,textTransform:"uppercase",marginBottom:8 }}>Quick Reference</div>
            {[25,50,75,100].map(pct => {
              const mo = Math.round(monthlyGP * pct/100);
              const sel = distAmt === mo;
              return (
                <div key={pct} onClick={() => setDistAmt(mo)} style={{
                  display:"flex",justifyContent:"space-between",alignItems:"center",
                  padding:"8px 12px",marginBottom:4,borderRadius:3,cursor:"pointer",
                  background:sel?"rgba(61,220,132,.1)":"var(--bg)",
                  border:`1px solid ${sel?"#3ddc84":"var(--bd)"}`,
                }}>
                  <span style={{ fontFamily:"var(--f2)",fontSize:14,fontWeight:700,color:sel?"#3ddc84":"var(--mu)" }}>{pct}% of GP</span>
                  <div style={{ display:"flex",gap:12,alignItems:"center" }}>
                    <span style={{ fontFamily:"var(--f2)",fontSize:16,fontWeight:800,color:sel?"#3ddc84":"var(--tx)" }}>{fd(mo,0)}/mo</span>
                    <span style={{ fontSize:10,color:"var(--mu)" }}>{fd(mo*12,0)}/yr</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Shareholder breakdown */}
          <div className="card">
            <div className="ctit">Shareholder Breakdown — Contributions</div>

            {/* Chris */}
            <div style={{ padding:"12px 0",borderBottom:"1px solid var(--bd)" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11,color:"var(--tx)",fontWeight:600,marginBottom:4 }}>Chris Contribution</div>
                  <div className="bar"><div className="bfil" style={{ width:"100%",background:"#3ddc84" }} /></div>
                  <div style={{ fontSize:10,color:"#3ddc84",fontWeight:700,marginTop:4 }}>✓ Repaid in full — March 2026 via gross profits</div>
                </div>
                <div style={{ textAlign:"right",marginLeft:16 }}>
                  <div style={{ fontFamily:"var(--f2)",fontSize:24,fontWeight:900,color:"#3ddc84" }}>{fd(dueToChr,0)}</div>
                  <div style={{ fontSize:9,color:"var(--mu)" }}>100% repaid</div>
                </div>
              </div>
            </div>

            {/* Anthony */}
            <div style={{ padding:"12px 0",borderBottom:"1px solid var(--bd)" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11,color:"var(--tx)",fontWeight:600,marginBottom:4 }}>Anthony Contribution</div>
                  <div className="bar"><div className="bfil" style={{ width:"50%",background:"#f5c542" }} /></div>
                  <div style={{ fontSize:10,color:"#f5c542",fontWeight:600,marginTop:4 }}>🔄 $6,810 repaid — $6,810 remaining (50%)</div>
                </div>
                <div style={{ textAlign:"right",marginLeft:16 }}>
                  <div style={{ fontFamily:"var(--f2)",fontSize:24,fontWeight:900,color:"#ff8a65" }}>{fd(dueToAnt,0)}</div>
                  <div style={{ fontSize:9,color:"var(--mu)" }}>50% repaid</div>
                </div>
              </div>
            </div>

            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:12 }}>
              <div style={{ fontFamily:"var(--f2)",fontSize:12,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"var(--mu)" }}>Total Contributions</div>
              <div style={{ fontFamily:"var(--f2)",fontSize:26,fontWeight:900,color:"var(--tx)" }}>{fd(totalDue,0)}</div>
            </div>
            {/* Anthony offset */}
            <div style={{ marginTop:12,padding:"12px 14px",
              background:"rgba(79,195,247,.07)",border:"1px solid rgba(79,195,247,.25)",borderRadius:3 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:9,color:"#4fc3f7",letterSpacing:2,textTransform:"uppercase",marginBottom:3 }}>Separate — Due FROM Anthony</div>
                  <div style={{ fontSize:10,color:"var(--mu)" }}>Anthony owes the company · not part of threshold</div>
                </div>
                <div style={{ fontFamily:"var(--f2)",fontSize:22,fontWeight:900,color:"#4fc3f7",marginLeft:16 }}>{fd(dueFromAnt,0)}</div>
              </div>
            </div>
          </div>
        </div>

        <div>
          {/* All-Time P&L — GP and Net Income prominent */}
          <div className="card">
            <div className="ctit">All-Time P&L — CE East</div>
            <div style={{ fontSize:9,color:"var(--mu)",marginBottom:14 }}>All dates · as of May 2, 2026</div>

            {/* Two hero numbers */}
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16 }}>
              <div style={{ background:"rgba(245,197,66,.08)",border:"1px solid rgba(245,197,66,.25)",borderRadius:4,padding:"16px",textAlign:"center" }}>
                <div style={{ fontSize:9,color:"#f5c542",letterSpacing:3,textTransform:"uppercase",marginBottom:6 }}>Gross Profit</div>
                <div style={{ fontFamily:"var(--f2)",fontSize:36,fontWeight:900,color:"#f5c542",lineHeight:1 }}>{fd(pl.grossProfit,0)}</div>
                <div style={{ fontSize:10,color:"var(--mu)",marginTop:4 }}>{fp(pl.grossProfit/pl.revenue*100)} margin</div>
              </div>
              <div style={{ background:pl.netIncome>=0?"rgba(61,220,132,.08)":"rgba(255,82,82,.08)",border:`1px solid ${pl.netIncome>=0?"rgba(61,220,132,.25)":"rgba(255,82,82,.25)"}`,borderRadius:4,padding:"16px",textAlign:"center" }}>
                <div style={{ fontSize:9,color:pl.netIncome>=0?"#3ddc84":"#ff5252",letterSpacing:3,textTransform:"uppercase",marginBottom:6 }}>Net Income</div>
                <div style={{ fontFamily:"var(--f2)",fontSize:36,fontWeight:900,color:pl.netIncome>=0?"#3ddc84":"#ff5252",lineHeight:1 }}>{fd(pl.netIncome,0)}</div>
                <div style={{ fontSize:10,color:"var(--mu)",marginTop:4 }}>{fp(pl.netIncome/pl.revenue*100)} net margin</div>
              </div>
            </div>

            {/* Full breakdown */}
            {[
              { label:"Total Revenue",         val:pl.revenue,       color:"#3ddc84" },
              { label:"Carrier Pay",            val:-pl.carrierPay,   color:"#ff5252" },
              { label:"Triumph/Flexent Fees",   val:-pl.merchantFees, color:"#ff8a65" },
              { label:"Gross Profit",           val:pl.grossProfit,   color:"#f5c542", bold:true },
              { label:"Salaries & Wages",       val:-pl.salaries,     color:"#ff5252" },
              { label:"Freight Insurance",      val:-pl.freightIns,   color:"#ff5252" },
              { label:"Computers & Software",   val:-pl.computers,    color:"#ff5252" },
              { label:"Travel Expenses",        val:-pl.travel,       color:"#ff5252" },
              { label:"Other Expenses",         val:-(pl.expenses-pl.salaries-pl.freightIns-pl.computers-pl.travel), color:"#ff5252" },
              { label:"Net Income",             val:pl.netIncome,     color:pl.netIncome>=0?"#3ddc84":"#ff5252", bold:true },
            ].map(item => (
              <div key={item.label} style={{
                display:"flex",justifyContent:"space-between",alignItems:"center",
                padding:"7px 0",borderBottom:"1px solid var(--bd)",
                background:item.bold?"rgba(245,197,66,.04)":"transparent",
              }}>
                <div>
                  <div style={{ fontSize:11,color:item.bold?item.color:"var(--tx)",fontWeight:item.bold?700:400 }}>{item.label}</div>
                  {!item.bold && <div style={{ fontSize:9,color:"var(--mu)" }}>{fp(Math.abs(item.val)/pl.revenue*100)} of revenue</div>}
                </div>
                <div style={{ fontFamily:"var(--f2)",fontSize:item.bold?18:14,fontWeight:item.bold?900:600,color:item.color }}>
                  {fd(item.val,0)}
                </div>
              </div>
            ))}
          </div>

          {/* Reserves Due */}
          <div style={{
            marginTop:14,padding:"20px 22px",borderRadius:6,
            background:"linear-gradient(135deg,rgba(245,197,66,.12),rgba(245,197,66,.04))",
            border:"2px solid rgba(245,197,66,.4)",
          }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <div>
                <div style={{ fontFamily:"var(--f2)",fontSize:14,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"#f5c542",marginBottom:4 }}>Reserves Due</div>
                <div style={{ fontSize:12,color:"var(--mu)" }}>Reserves held — released upon customer payment</div>
              </div>
              <div style={{ fontFamily:"var(--f2)",fontSize:36,fontWeight:900,color:"#f5c542",marginLeft:16 }}>{fd(13683.50,0)}</div>
            </div>
          </div>

          {/* Monthly Expense Snapshot */}
          <div className="card" style={{ marginTop:14 }}>
            <div className="ctit">Avg Monthly Expense Snapshot</div>
            <div style={{ fontSize:10,color:"var(--mu)",marginBottom:10 }}>Fixed/recurring monthly costs — CE East operations</div>
            {(() => {
              const items = [
                { label:"CE East Staff",       amt:7250,    color:"#4fc3f7" },
                { label:"Computer & Software", amt:2280,    color:"#b39ddb" },
                { label:"Freight Insurance",   amt:1930.73, color:"#ff8a65" },
                { label:"Rent",                amt:1100,    color:"#f47820" },
                { label:"Nelly",               amt:1000,    color:"#3ddc84" },
                { label:"Sales Commission",    amt:750,     color:"#f5c542" },
                { label:"Utilities",           amt:600,     color:"#26a69a" },
                { label:"Vinix",               amt:188.64,  color:"#ef5350" },
              ];
              const total = items.reduce((s,i) => s+i.amt, 0);
              return (
                <>
                  {items.map(item => (
                    <div key={item.label} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",
                      padding:"6px 0",borderBottom:"1px solid var(--bd)" }}>
                      <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                        <div style={{ width:8,height:8,borderRadius:2,background:item.color,flexShrink:0 }} />
                        <span style={{ fontSize:11,color:"var(--tx)" }}>{item.label}</span>
                      </div>
                      <span style={{ fontFamily:"var(--f2)",fontSize:13,fontWeight:700,color:item.color }}>{fd(item.amt,0)}/mo</span>
                    </div>
                  ))}
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:10 }}>
                    <span style={{ fontFamily:"var(--f2)",fontSize:12,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"var(--or)" }}>Total Monthly</span>
                    <span style={{ fontFamily:"var(--f2)",fontSize:20,fontWeight:900,color:"var(--or)" }}>{fd(total,0)}/mo</span>
                  </div>
                  <div style={{ display:"flex",justifyContent:"flex-end",fontSize:10,color:"var(--mu)",marginTop:2 }}>
                    {fd(total*12,0)}/yr
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      </>)}

    </div>
  );
}





async function askClaudeForClassification(prompt) {
  const r = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const d = await r.json();
  return d.content?.[0]?.text || "{}";
}

async function classifyAndMap(headers, sampleRows, fileName, pdfText) {
  const sample = sampleRows.slice(0, 8).map(r =>
    headers.map(h => r[h] ?? "").join(" | ")
  ).join("\n");

  const pdfContext = pdfText ? `\n\nRAW PDF TEXT (first 3000 chars):\n${pdfText.slice(0, 3000)}` : "";

  const prompt = `You are a freight company data classifier. Given a spreadsheet's column headers and sample rows, do TWO things:

1) CLASSIFY the report as exactly one of: payroll, fuel, mileage, income, insurance, truck_payments, trailer, maintenance, ce_east
2) MAP the source columns to the target schema for that type.

Target schemas:
- payroll: { name, hours, totalCost }  (totalCost = all-in employer cost per driver)
- fuel: { name, fuel, gallons }  (fuel = dollar amount spent)
- mileage: { truck, local, regional, miles, states_json }  (states_json = JSON of state:miles)
- income: { label, rev, gp, ce, sf, di }  (weekly or monthly P&L rows)
- insurance: { key, value }  (key-value pairs like INS_WEEK, INS_TOT)
- truck_payments: { key, value }  (key-value pairs like TRUCK_TOT or line items)
- trailer: { key, value }
- maintenance: { key, value }
- ce_east: { key, value }

Filename: ${fileName}
Column headers: ${headers.join(", ")}
Sample data (first rows, pipe-separated):
${sample}

Respond with ONLY valid JSON, no markdown, no explanation:
{
  "type": "payroll",
  "confidence": "high",
  "mapping": { "targetCol": "sourceCol", ... },
  "notes": "Brief explanation of what you detected",
  "constants": { "KEY": value, ... }
}

For mapping: each key is the target schema field, each value is the source column header that best matches.
If the report is from QuickBooks (payroll, income, P&L), it may contain summary/total values — put those in "constants" as key-value pairs using the constant names: LABOR, MILES, INS_WEEK, INS_TOT, TRUCK_TOT, TRAILER_TOT, TRUCK_MAINT, TRAIL_MAINT, STORAGE, UNIFORMS, TOTAL_HRS, FLEET_LOCAL, FLEET_REGIONAL, PERIOD. Do NOT include FUEL_TOT or GALLONS from QuickBooks — fuel comes only from EFS/Mudflap exports.
If the report is from EFS or Mudflap (fuel card), put FUEL_TOT and GALLONS in constants.
IMPORTANT: For truck_payments, trailer, maintenance, and insurance types, NEVER set constants. These are invoice-level detail only — they do not affect fleet CPM calculations. Only QuickBooks/payroll/fuel reports should set constants.
If no per-row mapping is possible (e.g. a summary report), set mapping to {} and put everything in constants (unless it's an invoice type).
If this is a PDF document, use the raw PDF text to extract structured data. For invoices, extract line items as rows. For reports, extract key totals as constants.${pdfContext}`;

  const text = await askClaudeForClassification(prompt);
  try {
    const cleaned = text.replace(/`/g, "").replace(/^json\s*/i, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return { type: "unknown", confidence: "low", mapping: {}, notes: "Failed to parse response — select type manually.", constants: {} };
  }
}

// ── SMART UPLOAD CENTER ───────────────────────────────────────
// Drop any raw report (QuickBooks, EFS, Samsara, etc.) —
// AI reads the headers, detects the type, maps columns, loads data.

const REPORT_TYPES = {
  payroll:        { label:"Payroll",         icon:"👷", color:"#f47820", desc:"Driver names, hours, pay" },
  fuel:           { label:"Fuel",            icon:"⛽", color:"#f5c542", desc:"Fuel card transactions by driver" },
  mileage:        { label:"Truck Mileage",   icon:"📍", color:"#4fc3f7", desc:"GPS/Samsara mileage per truck" },
  income:         { label:"Income / P&L",    icon:"💵", color:"#3ddc84", desc:"Revenue, carrier pay, expenses" },
  insurance:      { label:"Insurance",       icon:"🛡️", color:"#b39ddb", desc:"Premium payments" },
  truck_payments: { label:"Truck Payments",  icon:"🚛", color:"#ff8a65", desc:"Lease/rental invoices" },
  trailer:        { label:"Trailer Payments", icon:"🚜", color:"#26a69a", desc:"Trailer lease/rental" },
  maintenance:    { label:"Maintenance",     icon:"🔧", color:"#ef5350", desc:"Repair/wash/tow invoices" },
  ce_east:        { label:"CE East",         icon:"🏦", color:"#ab47bc", desc:"CE East financials" },
  unknown:        { label:"Unknown",         icon:"❓", color:"#5a6370", desc:"Couldn't auto-detect" },
};

function applyMappedData(type, mapping, rows, constants) {
  // ═══════════════════════════════════════════════════════════════
  // CRITICAL DATA SEPARATION:
  //
  // Fleet Overview + CPM Calculator = QuickBooks + EFS/Mudflap
  //   → LABOR, TRUCK_TOT, TRAILER_TOT, INS_TOT,
  //     TRUCK_MAINT, TRAIL_MAINT, STORAGE, UNIFORMS, MILES
  //   → Updated by: payroll, income, or QuickBooks P&L uploads
  //
  // FUEL_TOT = EFS + Mudflap ONLY (never QuickBooks)
  //   → Updated ONLY by: fuel type uploads (EFS/Mudflap exports)
  //   → QuickBooks P&L fuel number is ignored for CPM
  //
  // Trucks tab + Trailers tab = individual vendor invoices
  //   → Updated by: truck_payments, trailer, maintenance uploads
  //   → These NEVER affect CPM numbers
  // ═══════════════════════════════════════════════════════════════

  // Invoice-based types: NEVER touch fleet constants (CPM stays clean)
  const invoiceOnlyTypes = ["truck_payments", "trailer", "maintenance", "insurance"];
  const isInvoiceType = invoiceOnlyTypes.includes(type);

  // Apply constants ONLY from QuickBooks / P&L / payroll uploads (NOT invoices)
  if (!isInvoiceType && constants && Object.keys(constants).length > 0) {
    const c = constants;
    if (c.LABOR) LABOR = Number(c.LABOR);
    // FUEL_TOT only from fuel-type uploads (EFS/Mudflap), never from QB P&L
    if (c.FUEL_TOT && type === "fuel") FUEL_TOT = Number(c.FUEL_TOT);
    if (c.GALLONS && type === "fuel") GALLONS = Number(c.GALLONS);
    if (c.MILES) MILES = Number(c.MILES);
    if (c.INS_WEEK) INS_WEEK = Number(c.INS_WEEK);
    if (c.INS_TOT) INS_TOT = Number(c.INS_TOT);
    if (c.TRUCK_TOT) TRUCK_TOT = Number(c.TRUCK_TOT);
    if (c.TRAILER_TOT) TRAILER_TOT = Number(c.TRAILER_TOT);
    if (c.TRUCK_MAINT) TRUCK_MAINT = Number(c.TRUCK_MAINT);
    if (c.TRAIL_MAINT) TRAIL_MAINT = Number(c.TRAIL_MAINT);
    if (c.STORAGE) STORAGE = Number(c.STORAGE);
    if (c.UNIFORMS) UNIFORMS = Number(c.UNIFORMS);
    if (c.TOTAL_HRS) TOTAL_HRS = Number(c.TOTAL_HRS);
    if (c.FLEET_LOCAL) FLEET_LOCAL = Number(c.FLEET_LOCAL);
    if (c.FLEET_REGIONAL) FLEET_REGIONAL = Number(c.FLEET_REGIONAL);
    if (c.PERIOD) PERIOD = String(c.PERIOD);
  }

  if (!mapping || Object.keys(mapping).length === 0) return;

  const get = (row, targetField) => {
    const srcCol = mapping[targetField];
    if (!srcCol) return null;
    return row[srcCol] ?? null;
  };
  const getNum = (row, field) => {
    const v = get(row, field);
    if (v == null) return 0;
    const cleaned = String(v).replace(/[$,()]/g, "").trim();
    return Number(cleaned) || 0;
  };

  if (type === "payroll") {
    const mapped = rows.filter(r => get(r, "name")).map(r => ({
      name: String(get(r, "name")).trim(),
      hours: getNum(r, "hours"),
      totalCost: getNum(r, "totalCost"),
    })).filter(r => r.name && r.name !== "TOTAL" && r.name !== "Total");
    if (mapped.length > 0) {
      PAYROLL.length = 0;
      PAYROLL.push(...mapped);
    }
  }

  if (type === "fuel") {
    const mapped = rows.filter(r => get(r, "name")).map(r => ({
      name: String(get(r, "name")).trim(),
      fuel: getNum(r, "fuel"),
      gallons: getNum(r, "gallons"),
    })).filter(r => r.name && r.name !== "TOTAL" && r.name !== "Total");
    if (mapped.length > 0) {
      Object.keys(FUEL).forEach(k => delete FUEL[k]);
      mapped.forEach(r => { FUEL[r.name] = { fuel: r.fuel, gallons: r.gallons }; });
    }
  }

  if (type === "mileage") {
    const mapped = rows.filter(r => get(r, "truck")).map(r => {
      let states = {};
      const sj = get(r, "states_json");
      if (sj) try { states = JSON.parse(sj); } catch {}
      return {
        truck: String(get(r, "truck")).trim(),
        local: getNum(r, "local"),
        regional: getNum(r, "regional"),
        miles: getNum(r, "miles"),
        states,
      };
    }).filter(r => r.truck);
    if (mapped.length > 0) {
      TRUCK_MILES.length = 0;
      TRUCK_MILES.push(...mapped);
    }
  }

  if (type === "income") {
    const mapped = rows.filter(r => get(r, "label") || get(r, "rev")).map(r => ({
      label: String(get(r, "label") || "").trim(),
      rev: getNum(r, "rev"),
      gp: getNum(r, "gp"),
      ce: getNum(r, "ce"),
      sf: getNum(r, "sf"),
      di: getNum(r, "di"),
    })).filter(r => r.label || r.rev);
    if (mapped.length > 0) {
      INCOME_2026.weeks = mapped;
    }
  }
}

// ── INVOICE DUPLICATE REGISTRY ───────────────────────────────
// Seeds with all built-in invoice numbers, persists additions in localStorage.
// Covers trucks (TCI, Penske, TEC) and trailers (McKinney, Xtra, Utility).

const BUILTIN_INVOICES = [
  // TCI service
  "31S337019","31S337022","31S337023","31S337025",
  // TCI Feb leases
  "31L1710001","31L1711001","31L1712001","31L1713001","31L1714001",
  // TCI Mar leases
  "31L1710002","31L1711002","31L1712002","31L1713002","31L1714002",
  // TCI rental
  "31R1700002",
  // Penske
  "0032649248","0032533089","0032525482","0032497960","0032469306","0032497959",
  // TEC Equipment lease + rentals + shop
  "60262649","60262220","60261742","60262130","60261732","60262221","20480427",
  // McKinney
  "LSVR100905","LSVN10317","LSVN10320",
  // Xtra Lease
  "05469840","05464181",
  // Mountain West Utility
  "BA101000767:01",
];

function loadInvoiceRegistry() {
  try {
    const stored = localStorage.getItem("freightiq_invoices");
    const extra = stored ? JSON.parse(stored) : [];
    return new Set([...BUILTIN_INVOICES, ...extra]);
  } catch {
    return new Set(BUILTIN_INVOICES);
  }
}

function saveInvoiceRegistry(registry) {
  // Only save non-builtin additions
  const builtinSet = new Set(BUILTIN_INVOICES);
  const extras = [...registry].filter(id => !builtinSet.has(id));
  try { localStorage.setItem("freightiq_invoices", JSON.stringify(extras)); } catch {}
}

function findInvoiceColumn(headers) {
  const h = headers.map(c => c.toLowerCase());
  const idx = h.findIndex(c =>
    c.includes("invoice") || c.includes("inv_num") || c.includes("inv #") ||
    c.includes("inv#") || c.includes("document") || c.includes("doc_num") ||
    c.includes("reference") || c.includes("ref_num") || c === "inv" || c === "ref"
  );
  return idx >= 0 ? headers[idx] : null;
}

function checkForDuplicates(headers, rows, registry) {
  const invCol = findInvoiceColumn(headers);
  if (!invCol) return { invCol: null, dupes: [], newInvs: [] };

  const dupes = [];
  const newInvs = [];
  rows.forEach((row, i) => {
    const val = String(row[invCol] || "").trim();
    if (!val) return;
    if (registry.has(val)) {
      dupes.push({ row: i, invoice: val });
    } else {
      newInvs.push(val);
    }
  });
  return { invCol, dupes, newInvs };
}

function DataSettings() {
  const ctx = useDataCtx();
  const [uploads, setUploads] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [history, setHistory] = useState([]);
  const [invoiceRegistry, setInvoiceRegistry] = useState(() => loadInvoiceRegistry());

  // Load upload history from storage
  useEffect(() => {
    (async () => {
      try {
        const stored = localStorage.getItem("freightiq_history");
        if (stored) setHistory(JSON.parse(stored));
      } catch {}
    })();
  }, []);

  const saveHistory = async (h) => {
    try { localStorage.setItem("freightiq_history", JSON.stringify(h.slice(-20))); } catch {}
  };

  const parseFile = (file) => {
    return new Promise((resolve, reject) => {
      const ext = file.name.split(".").pop().toLowerCase();

      if (ext === "csv" || ext === "tsv") {
        Papa.parse(file, {
          header: true, skipEmptyLines: true, dynamicTyping: true,
          complete: (res) => resolve({ headers: res.meta.fields || [], rows: res.data }),
          error: (err) => reject(err),
        });
      } else if (ext === "xlsx" || ext === "xls" || ext === "xlsm") {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const wb = XLSX.read(e.target.result, { type: "array" });
            // Parse all sheets, let user pick or auto-detect
            const allSheets = {};
            wb.SheetNames.forEach(name => {
              const data = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: "" });
              if (data.length > 0) {
                allSheets[name] = { headers: Object.keys(data[0]), rows: data };
              }
            });
            // Use first sheet with data by default
            const firstKey = Object.keys(allSheets)[0];
            if (firstKey) {
              resolve({ ...allSheets[firstKey], allSheets, sheetNames: wb.SheetNames });
            } else {
              reject(new Error("No data found in any sheet"));
            }
          } catch (err) { reject(err); }
        };
        reader.readAsArrayBuffer(file);
      } else if (ext === "pdf") {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const pdf = await window.pdfjsLib.getDocument({ data: e.target.result }).promise;
            const lines = [];
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const content = await page.getTextContent();
              const pageLines = [];
              let lastY = null;
              let curLine = "";
              for (const item of content.items) {
                if (lastY !== null && Math.abs(item.transform[5] - lastY) > 3) {
                  if (curLine.trim()) pageLines.push(curLine.trim());
                  curLine = "";
                }
                curLine += (curLine ? "\t" : "") + item.str;
                lastY = item.transform[5];
              }
              if (curLine.trim()) pageLines.push(curLine.trim());
              lines.push(...pageLines);
            }
            // Try to parse as tabular data — find header row and build rows
            let headers = [];
            let rows = [];
            if (lines.length > 1) {
              // Use first non-empty line as header
              const headerIdx = lines.findIndex(l => l.includes("\t") || l.split(/\s{2,}/).length > 2);
              if (headerIdx >= 0) {
                headers = lines[headerIdx].split("\t").map(h => h.trim()).filter(Boolean);
                for (let j = headerIdx + 1; j < lines.length; j++) {
                  const vals = lines[j].split("\t");
                  if (vals.length >= headers.length * 0.5) {
                    const row = {};
                    headers.forEach((h, k) => { row[h] = (vals[k] || "").trim(); });
                    rows.push(row);
                  }
                }
              }
              // If tabular parse failed, send raw text lines for AI classification
              if (rows.length === 0) {
                headers = ["line_number", "text"];
                rows = lines.map((l, i) => ({ line_number: i + 1, text: l }));
              }
            }
            resolve({ headers, rows, pdfText: lines.join("\n"), pdfPages: pdf.numPages });
          } catch (err) { reject(new Error("PDF parse failed: " + err.message)); }
        };
        reader.readAsArrayBuffer(file);
      } else {
        reject(new Error(`Unsupported file type: .${ext}`));
      }
    });
  };

  const processFile = async (file) => {
    const id = Date.now() + Math.random();
    const entry = { id, fileName: file.name, status: "parsing", type: null, mapping: null, rows: [], headers: [], preview: [], notes: "", confidence: "", constants: {} };
    setUploads(prev => [entry, ...prev]);

    try {
      const { headers, rows, allSheets, sheetNames, pdfText, pdfPages } = await parseFile(file);
      entry.headers = headers;
      entry.rows = rows;
      entry.status = "classifying";
      entry.preview = rows.slice(0, 5);
      if (pdfText) entry.pdfText = pdfText;
      if (pdfPages) entry.pdfPages = pdfPages;
      setUploads(prev => prev.map(u => u.id === id ? { ...entry } : u));

      const result = await classifyAndMap(headers, rows, file.name, pdfText);
      entry.type = result.type || "unknown";
      entry.mapping = result.mapping || {};
      entry.notes = result.notes || "";
      entry.confidence = result.confidence || "low";
      entry.constants = result.constants || {};
      entry.allSheets = allSheets;
      entry.sheetNames = sheetNames;

      // Duplicate check for invoice-based types
      const invoiceTypes = ["truck_payments","trailer","maintenance","insurance"];
      if (invoiceTypes.includes(entry.type)) {
        const { invCol, dupes, newInvs } = checkForDuplicates(headers, rows, invoiceRegistry);
        entry.dupes = dupes;
        entry.newInvs = newInvs;
        entry.invCol = invCol;
        if (dupes.length > 0) {
          entry.notes += ` ⚠️ ${dupes.length} duplicate invoice(s) found — already in system.`;
        }
      } else {
        entry.dupes = [];
        entry.newInvs = [];
        entry.invCol = null;
      }

      entry.status = "ready";
      setUploads(prev => prev.map(u => u.id === id ? { ...entry } : u));
    } catch (err) {
      entry.status = "error";
      entry.notes = err.message;
      setUploads(prev => prev.map(u => u.id === id ? { ...entry } : u));
    }
  };

  const handleFiles = (files) => {
    Array.from(files).forEach(f => {
      if (/\.(csv|tsv|xlsx|xls|xlsm)$/i.test(f.name)) processFile(f);
    });
  };

  const applyUpload = (upload, skipDupes = true) => {
    let rowsToApply = upload.rows;

    // If skipping dupes, filter them out for invoice-based types
    if (skipDupes && upload.dupes && upload.dupes.length > 0 && upload.invCol) {
      const dupeInvSet = new Set(upload.dupes.map(d => d.invoice));
      rowsToApply = upload.rows.filter(r => {
        const inv = String(r[upload.invCol] || "").trim();
        return !dupeInvSet.has(inv);
      });
    }

    applyMappedData(upload.type, upload.mapping, rowsToApply, upload.constants);
    recomputeDerived();
    if (ctx?.bumpVersion) ctx.bumpVersion();

    // Register new invoice numbers
    if (upload.newInvs && upload.newInvs.length > 0) {
      const updated = new Set(invoiceRegistry);
      upload.newInvs.forEach(inv => updated.add(inv));
      setInvoiceRegistry(updated);
      saveInvoiceRegistry(updated);
    }

    const skipped = skipDupes ? (upload.dupes?.length || 0) : 0;
    const h = [{
      fileName: upload.fileName, type: upload.type,
      rows: rowsToApply.length, skippedDupes: skipped,
      date: new Date().toISOString(), notes: upload.notes,
    }, ...history];
    setHistory(h);
    saveHistory(h);

    setUploads(prev => prev.map(u => u.id === upload.id ? {
      ...u, status: "applied",
      appliedNote: skipped > 0 ? `${skipped} duplicate(s) skipped, ${rowsToApply.length} rows applied` : `${rowsToApply.length} rows applied`,
    } : u));
  };

  const switchSheet = async (upload, sheetName) => {
    if (!upload.allSheets?.[sheetName]) return;
    const { headers, rows } = upload.allSheets[sheetName];
    const entry = { ...upload, headers, rows, preview: rows.slice(0, 5), status: "classifying" };
    setUploads(prev => prev.map(u => u.id === upload.id ? entry : u));

    const result = await classifyAndMap(headers, rows, `${upload.fileName} → ${sheetName}`);
    setUploads(prev => prev.map(u => u.id === upload.id ? {
      ...entry, type: result.type || "unknown", mapping: result.mapping || {},
      notes: result.notes || "", confidence: result.confidence || "low",
      constants: result.constants || {}, status: "ready",
    } : u));
  };

  const confColor = c => c === "high" ? "#3ddc84" : c === "medium" ? "#f5c542" : "#ff8a65";

  return (
    <div>
      <div className="ptitle">Upload Center</div>
      <div className="psub">Drop any report — AI auto-detects format and maps columns</div>

      <div className="ibox" style={{ marginBottom:14 }}>
        <strong style={{ color:"#4fc3f7" }}>Supported sources:</strong>{" "}
        QuickBooks P&L, EFS fuel card exports, Mudflap statements, Samsara mileage reports, payroll summaries, 
        insurance invoices, Penske/TEC/TCI lease statements, trailer invoices, or any CSV/XLSX/PDF with relevant data.
        The AI reads your column headers and figures out the rest. PDFs are parsed and sent to AI for extraction.
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => { const inp = document.createElement("input"); inp.type = "file"; inp.multiple = true; inp.accept = ".csv,.tsv,.xlsx,.xls,.xlsm,.pdf"; inp.onchange = e => handleFiles(e.target.files); inp.click(); }}
        style={{
          border: `2px dashed ${dragging ? "var(--or)" : "var(--bd)"}`,
          borderRadius: 6, padding: "40px 20px", textAlign: "center",
          cursor: "pointer", marginBottom: 14,
          background: dragging ? "rgba(244,120,32,.08)" : "var(--s1)",
          transition: "all .2s",
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
        <div style={{ fontFamily:"var(--f2)", fontSize: 18, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: dragging ? "var(--or)" : "var(--tx)", marginBottom: 6 }}>
          {dragging ? "Drop files here" : "Drop reports or click to upload"}
        </div>
        <div style={{ fontSize: 11, color: "var(--mu)" }}>
          CSV · XLSX · XLS · TSV · PDF — any column structure, any vendor format
        </div>
      </div>

      {/* Active uploads */}
      {uploads.map(u => {
        const rt = REPORT_TYPES[u.type] || REPORT_TYPES.unknown;
        return (
          <div key={u.id} className="card" style={{ marginBottom: 12, borderLeft: `3px solid ${rt.color}` }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <div style={{ fontFamily: "var(--f2)", fontSize: 16, fontWeight: 800, letterSpacing: 1, color: "var(--tx)" }}>
                  📄 {u.fileName}
                </div>
                <div style={{ fontSize: 10, color: "var(--mu)", marginTop: 2 }}>
                  {u.headers.length} columns · {u.rows.length} rows
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                {u.status === "parsing" && <span style={{ fontSize: 11, color: "var(--or)" }}>⏳ Parsing...</span>}
                {u.status === "classifying" && <span style={{ fontSize: 11, color: "var(--or)" }}>🤖 Classifying...</span>}
                {u.status === "error" && <span style={{ fontSize: 11, color: "#ff5252" }}>✕ Error</span>}
                {u.status === "applied" && <span style={{ fontSize: 11, color: "#3ddc84" }}>✓ Applied</span>}
                {u.status === "ready" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 20 }}>{rt.icon}</span>
                    <div>
                      <div style={{ fontFamily: "var(--f2)", fontSize: 14, fontWeight: 800, color: rt.color }}>{rt.label}</div>
                      <div style={{ fontSize: 9, color: confColor(u.confidence) }}>
                        {u.confidence} confidence
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sheet selector for multi-sheet xlsx */}
            {u.sheetNames && u.sheetNames.length > 1 && (
              <div style={{ marginBottom: 10 }}>
                <div className="lbl">Sheet</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {u.sheetNames.filter(n => u.allSheets?.[n]).map(name => (
                    <button key={name} onClick={() => switchSheet(u, name)} style={{
                      padding: "4px 12px", borderRadius: 3, cursor: "pointer",
                      fontFamily: "var(--f1)", fontSize: 10,
                      background: u.allSheets?.[name]?.headers === u.headers ? "var(--or)" : "transparent",
                      color: u.allSheets?.[name]?.headers === u.headers ? "#fff" : "var(--mu)",
                      border: `1px solid ${u.allSheets?.[name]?.headers === u.headers ? "var(--or)" : "var(--bd)"}`,
                    }}>{name} ({u.allSheets[name]?.rows.length})</button>
                  ))}
                </div>
              </div>
            )}

            {/* AI notes */}
            {u.notes && (
              <div style={{ fontSize: 11, color: "var(--mu)", lineHeight: 1.7, marginBottom: 10,
                background: "var(--bg)", padding: "8px 12px", borderRadius: 3, border: "1px solid var(--bd)" }}>
                🤖 {u.notes}
              </div>
            )}

            {/* Column mapping preview */}
            {u.mapping && Object.keys(u.mapping).length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div className="lbl">Column Mapping</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {Object.entries(u.mapping).map(([target, source]) => (
                    <div key={target} style={{
                      background: "var(--bg)", border: "1px solid var(--bd)", borderRadius: 3,
                      padding: "4px 10px", fontSize: 10,
                    }}>
                      <span style={{ color: rt.color, fontWeight: 700 }}>{target}</span>
                      <span style={{ color: "var(--mu)", margin: "0 4px" }}>←</span>
                      <span style={{ color: "var(--tx)" }}>{source}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Constants detected */}
            {u.constants && Object.keys(u.constants).length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div className="lbl">Values Detected</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {Object.entries(u.constants).map(([key, val]) => (
                    <div key={key} style={{
                      background: "rgba(244,120,32,.06)", border: "1px solid rgba(244,120,32,.2)", borderRadius: 3,
                      padding: "4px 10px", fontSize: 10,
                    }}>
                      <span style={{ color: "var(--or)", fontWeight: 700 }}>{key}</span>
                      <span style={{ color: "var(--mu)", margin: "0 4px" }}>=</span>
                      <span style={{ color: "var(--ye)", fontFamily: "var(--f1)" }}>{typeof val === "number" ? fd(val, 2) : val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Data preview */}
            {u.preview && u.preview.length > 0 && u.status !== "applied" && (
              <div style={{ marginBottom: 10, overflowX: "auto" }}>
                <div className="lbl">Data Preview (first 5 rows)</div>
                <table className="tbl" style={{ fontSize: 10 }}>
                  <thead>
                    <tr>
                      {u.headers.slice(0, 8).map(h => <th key={h}>{h}</th>)}
                      {u.headers.length > 8 && <th>+{u.headers.length - 8} more</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {u.preview.map((row, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? "var(--s2)" : "transparent" }}>
                        {u.headers.slice(0, 8).map(h => (
                          <td key={h} style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {row[h] != null ? String(row[h]) : ""}
                          </td>
                        ))}
                        {u.headers.length > 8 && <td style={{ color: "var(--mu)" }}>...</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Duplicate warning */}
            {u.status === "ready" && u.dupes && u.dupes.length > 0 && (
              <div style={{
                marginBottom: 10, padding: "12px 14px", borderRadius: 3,
                background: "rgba(255,82,82,.08)", border: "1px solid rgba(255,82,82,.25)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>⚠️</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#ff5252" }}>
                      {u.dupes.length} Duplicate Invoice{u.dupes.length > 1 ? "s" : ""} Detected
                    </div>
                    <div style={{ fontSize: 10, color: "var(--mu)" }}>
                      These invoices are already in the system and will be skipped by default
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {u.dupes.map(d => (
                    <span key={d.invoice} style={{
                      background: "rgba(255,82,82,.12)", border: "1px solid rgba(255,82,82,.3)",
                      borderRadius: 3, padding: "3px 8px", fontSize: 10,
                      color: "#ff5252", fontFamily: "var(--f1)", fontWeight: 600,
                    }}>
                      {d.invoice}
                    </span>
                  ))}
                </div>
                {u.newInvs && u.newInvs.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 10, color: "#3ddc84" }}>
                    ✓ {u.newInvs.length} new invoice{u.newInvs.length > 1 ? "s" : ""} will be applied: {u.newInvs.slice(0, 5).join(", ")}{u.newInvs.length > 5 ? ` +${u.newInvs.length - 5} more` : ""}
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            {u.status === "ready" && (
              <div style={{ display: "flex", gap: 8 }}>
                {u.dupes && u.dupes.length > 0 ? (
                  <>
                    <button className="btn" onClick={() => applyUpload(u, true)} style={{ flex: 1 }}>
                      ✓ Apply New Only ({u.rows.length - u.dupes.length} rows, skip {u.dupes.length} dupes)
                    </button>
                    <button className="btn btn-o" onClick={() => applyUpload(u, false)} style={{ flex: "none", padding: "10px 14px", fontSize: 10 }}>
                      Force All
                    </button>
                  </>
                ) : (
                  <button className="btn" onClick={() => applyUpload(u)} style={{ flex: 1 }}>
                    ✓ Apply {rt.label} Data ({u.rows.length} rows)
                  </button>
                )}
                <button className="btn btn-o" onClick={() => setUploads(prev => prev.filter(x => x.id !== u.id))} style={{ flex: "none", width: 100 }}>
                  Dismiss
                </button>
              </div>
            )}
            {u.status === "applied" && (
              <div style={{
                padding: "8px 14px", borderRadius: 3, fontSize: 11,
                background: "rgba(61,220,132,.08)", border: "1px solid rgba(61,220,132,.25)",
                color: "#3ddc84", textAlign: "center",
              }}>
                ✓ {u.appliedNote || `${u.rows.length} rows applied`} — {rt.label} updated
              </div>
            )}
            {u.status === "error" && (
              <div style={{ padding: "8px 14px", borderRadius: 3, fontSize: 11, background: "rgba(255,82,82,.08)", border: "1px solid rgba(255,82,82,.25)", color: "#ff5252" }}>
                {u.notes}
              </div>
            )}
          </div>
        );
      })}

      {/* Upload history */}
      {history.length > 0 && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="ctit">Upload History</div>
          {history.slice(0, 10).map((h, i) => {
            const rt = REPORT_TYPES[h.type] || REPORT_TYPES.unknown;
            return (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 0", borderBottom: "1px solid var(--bd)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 16 }}>{rt.icon}</span>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--tx)" }}>{h.fileName}</div>
                    <div style={{ fontSize: 9, color: "var(--mu)" }}>{h.notes}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: rt.color, fontWeight: 700 }}>{rt.label}</div>
                  <div style={{ fontSize: 9, color: "var(--mu)" }}>
                    {h.rows} rows · {new Date(h.date).toLocaleDateString()}
                  </div>
                </div>
              </div>
            );
          })}
          <button className="btn btn-o" style={{ marginTop: 10, fontSize: 10, padding: "6px 12px" }}
            onClick={() => { setHistory([]); saveHistory([]); }}>
            Clear History
          </button>
        </div>
      )}

      {/* Current data summary */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="ctit">Loaded Data Summary</div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)", gap: 8 }}>
          <div className="kpi">
            <div className="klbl">Drivers</div>
            <div className="kval" style={{ color: "var(--or)" }}>{PAYROLL.length}</div>
          </div>
          <div className="kpi">
            <div className="klbl">Trucks</div>
            <div className="kval" style={{ color: "#4fc3f7" }}>{TRUCK_MILES.length}</div>
          </div>
          <div className="kpi">
            <div className="klbl">Period</div>
            <div className="kval" style={{ color: "#3ddc84", fontSize: 14 }}>{PERIOD}</div>
          </div>
          <div className="kpi">
            <div className="klbl">All-In CPM</div>
            <div className="kval" style={{ color: cpmColor(ALLIN_CPM_V) }}>{fd(ALLIN_CPM_V, 3)}</div>
          </div>
          <div className="kpi">
            <div className="klbl">Invoices Tracked</div>
            <div className="kval" style={{ color: "#b39ddb" }}>{invoiceRegistry.size}</div>
            <div className="ksub">Duplicate protection active</div>
          </div>
        </div>
      </div>
    </div>
  );
}


// ── OFFICE STAFF DATA ─────────────────────────────────────────
// Combined from Show Freight Inc + J&A Management Group LLC
// Period: Jan 1 – ~Jul 2, 2026 (payroll ~1wk ahead of Jun 28 dashboard baseline)
// Categories: Office (salary), Warehouse (hourly/salary), Contractors

// ATL designation moved to ATL_WEEKLY_LOG (per-week roster, not sticky tag).
// Bini's atlEntity/atlPreYtd dropped here too.
const OFFICE_W2 = [
  // Show Freight Inc employees (thru ~Jul 2, 2026)
  { name:"Adrian Arias",        entity:"SF",  gross:44618.66, taxes:4751.03, contrib:1776.74, totalCost:51146.43, salary:42796.00,    bonus:1622.66, reimb:200.00,    commission:0.00,       note:"Salary + bonus" },
  { name:"Gabriel Gonzalez",    entity:"SF",  gross:30484.83, taxes:3285.33, contrib:0.00,       totalCost:33770.16, salary:30203.83, bonus:250.00,     reimb:31.00,     commission:0.00,       note:"Salary + bonus" },
  { name:"Scot Grosser",        entity:"SF",  gross:34174.31, taxes:2727.60, contrib:1157.33, totalCost:38059.24, salary:-533.42,    bonus:5640.22, reimb:67.09,  commission:0.00,       note:"Salary + wellness + reimb" },
  { name:"Bartosz Naruszewicz", entity:"SF",  gross:16647.30, taxes:1814.94, contrib:0.00,       totalCost:18462.24, salary:16647.30, bonus:0.00,     reimb:0.00,      commission:0.00,       note:"Hourly · new hire May 2026" },
  { name:"Cecilia Rivera",      entity:"SF",  gross:35210.00,    taxes:3787.07, contrib:1406.60, totalCost:40403.67, salary:33625.00,    bonus:1540.00,     reimb:45.00,     commission:0.00,       note:"Salary + bonus" },
  { name:"Nathan Youngblood",   entity:"SF",  gross:31200.00,    taxes:3364.80, contrib:0.00,       totalCost:34564.80, salary:31200.00,    bonus:0.00,       reimb:0.00,      commission:0.00,       note:"Salary" },
  { name:"Tasha Mahan",         entity:"SF",  gross:6500.00,     taxes:731.25,  contrib:0.00,       totalCost:7231.25,  salary:6500.00,     bonus:0.00,       reimb:0.00,      commission:0.00,       note:"NEW · started Jun 2026 · office/warehouse" },
  { name:"Antionette Wilson",   entity:"SF",  gross:2260.00,     taxes:254.25,  contrib:0.00,       totalCost:2514.25,  salary:2260.00,     bonus:0.00,       reimb:0.00,      commission:0.00,       note:"ATL office support (reclassified from driver Jul 2026)" },
  // J&A Management employees (thru ~Jul 2, 2026 YTD)
  { name:"Valeria Abrego",      entity:"J&A", gross:21550.10, taxes:2266.42, contrib:0.00,       totalCost:23816.52, salary:20985.10, bonus:0.00,       reimb:565.00,    commission:0.00,       note:"Hourly + OT" },
  { name:"Christopher Adamson", entity:"J&A", gross:44000.00,    taxes:4697.15,    contrib:1760.00,    totalCost:50457.15,    salary:44000.00,    bonus:0.00,       reimb:0.00,      commission:0.00,       note:"Salary + 401K" },
  { name:"Debra Adamson",       entity:"J&A", gross:8750.00,     taxes:934.68,  contrib:0.00,       totalCost:9684.68,  salary:8750.00,     bonus:0.00,       reimb:0.00,      commission:0.00,       note:"*Former · W2 → Contractor (UNCHANGED WoW × 5)", dual:true },
  { name:"Elizabeth Delgado",   entity:"J&A", gross:8541.11,  taxes:852.13,  contrib:0.00,       totalCost:9393.24,  salary:5940.00,     bonus:0.00,       reimb:898.35, commission:1702.76, note:"*Former · W2 → Contractor · commission (UNCHANGED WoW × 5)", dual:true },
  { name:"Abigail Dillon",      entity:"J&A", gross:3596.13,  taxes:402.77,  contrib:0.00,       totalCost:3998.90,  salary:3596.13,  bonus:0.00,       reimb:0.00,      commission:0.00,       note:"Hourly (UNCHANGED WoW × 5)" },
  { name:"Biniyam Fissehaye",   entity:"J&A", gross:19077.07, taxes:2045.40, contrib:0.00,       totalCost:21122.47, salary:18900.00,    bonus:0.00,       reimb:177.07, commission:0.00,       note:"*Former · J&A W2 → 1099 ENM Trucking LLC (transitioned May 11) · J&A side only; SF side $1,501.88 (UNCHANGED WoW × 5)", dual:true },
  { name:"Harold Galvis",       entity:"J&A", gross:5650.00,     taxes:632.81,  contrib:0.00,       totalCost:6282.81,  salary:5650.00,     bonus:0.00,       reimb:0.00,      commission:0.00,       note:"NEW · started Jun 2026" },
  { name:"Kidist Gelaw",        entity:"J&A", gross:4520.00,     taxes:506.25,  contrib:0.00,       totalCost:5026.25,  salary:4520.00,     bonus:0.00,       reimb:0.00,      commission:0.00,       note:"NEW · started Jun 2026" },
  { name:"Kirsten Hall",        entity:"J&A", gross:2250.00,     taxes:252.01,  contrib:0.00,       totalCost:2502.01,  salary:2250.00,     bonus:0.00,       reimb:0.00,      commission:0.00,       note:"*Former employee" },
  { name:"Ben Hoffman",         entity:"J&A", gross:35210.16, taxes:3752.01, contrib:376.95,  totalCost:39339.12, salary:35000.16, bonus:0.00,       reimb:210.00,     commission:0.00,       note:"Salary + 401K + PTO" },
  { name:"Joshua Law",         entity:"J&A", gross:2906.17,  taxes:258.47,  contrib:0.00,       totalCost:3164.64,  salary:2906.17,  bonus:0.00,       reimb:0.00,      commission:0.00,       note:"NEW · started Jun/Jul 2026" },
  { name:"Branden Parnell",     entity:"J&A", gross:5769.20,  taxes:646.15,  contrib:0.00,       totalCost:6415.35,  salary:5769.20,  bonus:0.00,       reimb:0.00,      commission:0.00,       note:"*Former employee (UNCHANGED WoW × 4)" },
  { name:"Ayelen Sanchez",      entity:"J&A", gross:1809.26,  taxes:198.25,  contrib:0.00,       totalCost:2007.51,  salary:1770.00,     bonus:0.00,       reimb:39.26,  commission:0.00,       note:"*Former · Hourly (UNCHANGED WoW × 4)" },
  { name:"Christopher Simpson", entity:"J&A", gross:8998.46,  taxes:961.01,  contrib:359.94,  totalCost:10319.41, salary:6300.00,     bonus:0.00,       reimb:0.00,      commission:2698.46, note:"*Former · W2 → Contractor · commission (UNCHANGED WoW × 5)", dual:true },
];

const WAREHOUSE = [
  { name:"Gentry Eagleton",  entity:"SF", gross:22620.50, taxes:2440.43, contrib:0.00, totalCost:25060.93, type:"Hourly", hours:1092.16, regHrs:1024.43, otHrs:67.73, note:"Regular + OT" },
  { name:"Andres Figueroa",  entity:"SF", gross:40262.50, taxes:4266.07, contrib:0.00, totalCost:44528.57, type:"Salary", hours:1080.00,    regHrs:0.00,      otHrs:0.00,     note:"Salary + PTO" },
];

// ATL designation tracked in ATL_WEEKLY_LOG (per-week roster).
// Mellody and ENM no longer tagged here.
const CONTRACTORS = [
  { name:"Jon Marcus Zengotita", dba:"", weekly:2800, payments:26, weeklyTotal:72800, car:350, carPayments:6, carTotal:2100, commission:0, healthIns:0, healthInsTotal:0, other:0, total:74900, note:"$2,800/wk + $350/mo car (6 months · June car now paid)" },
  { name:"Mellody Abrego",       dba:"Neon Vibes Enterprise", weekly:2250, payments:26, weeklyTotal:56700, car:334.86, carPayments:7, carTotal:2694.02, commission:5133.21, healthIns:368.34, healthInsTotal:9576.84, other:0, total:74104.07, note:"$2,250/wk + $334.86/mo car · July car paid (carTotal = 5×334.86 + June 684.86 bump + July 334.86 = 2,694.02) + commission YTD $5,133 (+$300 this wk) + health ins $368.34/wk (26wk)" },
  { name:"Gabriel Colon",        dba:"", weekly:0, payments:25, weeklyTotal:55495.88, car:0, carPayments:0, carTotal:0, commission:0, healthIns:0, healthInsTotal:0, other:0, total:55495.88, note:"Variable weekly — +$2,000 this wk" },
  { name:"Hilda Salman",         dba:"Salman Enterprises LLC", weekly:1730, payments:26, weeklyTotal:44980, car:0, carPayments:0, carTotal:0, commission:0, healthIns:118.82, healthInsTotal:3089.32, other:0, total:48069.32, note:"$1,730/wk + health ins $118.82/wk (26wk)" },
  { name:"Maria Con",            dba:"", weekly:650, payments:25, weeklyTotal:15250, car:0, carPayments:0, carTotal:0, commission:0, healthIns:0, healthInsTotal:0, other:0, total:15250, note:"$550/wk → $650/wk starting Mar 2026" },
  { name:"Logic Consultants",    dba:"Logic Consultants LLC / Prestige Development", weekly:500, payments:25, weeklyTotal:12500, car:0, carPayments:0, carTotal:0, commission:0, healthIns:0, healthInsTotal:0, other:0, total:12500, note:"$500/wk" },
  { name:"ENM Trucking",         dba:"ENM Trucking LLC (Biniyam Fissehaye)", weekly:1850, payments:8, weeklyTotal:14800, car:0, carPayments:0, carTotal:0, commission:0, healthIns:0, healthInsTotal:0, other:0, total:14800, note:"$1,850/wk · W2 (J&A) → 1099 May 11 2026 · ATL contractor (also in ATL_WEEKLY_LOG)" },
  { name:"Elizabeth Delgado",    dba:"", weekly:900, payments:19, weeklyTotal:17100, car:0, carPayments:0, carTotal:0, commission:3597.62, healthIns:0, healthInsTotal:0, other:131.99, total:20829.61, note:"$900/wk base + commission YTD $3,598 (none this wk) + $131.99 reimb (May 18-24) · W2 → 1099 Feb 2026", dual:true },
  { name:"Christopher Simpson",  dba:"", weekly:834.97, payments:19, weeklyTotal:16289.58, car:0, carPayments:0, carTotal:0, commission:2551.20, healthIns:53.79, healthInsTotal:1398.54, other:0, total:20239.32, note:"~$835/wk base + commission YTD $2,551 (none this wk) + health ins $53.79/wk (26wk) · W2 → 1099 Feb 2026", dual:true },
  { name:"Debra Adamson",        dba:"", weekly:1750, payments:19, weeklyTotal:25214.73, car:0, carPayments:0, carTotal:0, commission:0, healthIns:53.79, healthInsTotal:1398.54, other:984.97, total:27598.24, note:"$985/wk (Chase) → $1,750/wk new normal May 2026 + $985 (QuickBooks) + health ins $53.79/wk (26wk) · excl $2K loan", dual:true },
];


// ── OFFICE_PAYCHECKS — per-employee weekly paycheck grid (QB Paycheck History) ──
// Total pay (gross) per employee per week. Source: QB Paycheck History export
// (SF + J&A) dropped into incoming-freightiq/. Drivers excluded (office/warehouse
// + J&A only). Refresh each weekly drop via scripts/_build_paycheck_grid.py.
const DRIVER_WEEKLY = {"weeks": ["1/2", "1/9", "1/16", "1/23", "1/30", "2/6", "2/13", "2/20", "2/27", "3/6", "3/13", "3/20", "3/27", "4/3", "4/10", "4/17", "4/24", "5/1", "5/8", "5/15", "5/22", "5/29", "6/5", "6/12", "6/18", "6/26", "7/2"], "fleet": {"7/2": 49922.63, "6/26": 59817.49, "6/18": 54046.1, "6/12": 67537.46, "6/5": 56568.51, "5/29": 56154.55, "5/22": 57915.04, "5/15": 52670.45, "5/8": 51596.0, "5/1": 51489.27, "4/24": 53559.87, "4/17": 48265.89, "4/10": 41455.99, "4/3": 38717.08, "3/27": 47456.75, "3/20": 54255.78, "3/13": 43756.64, "3/6": 43924.05, "2/27": 31072.45, "2/20": 32437.21, "2/13": 32091.56, "2/6": 30980.45, "1/30": 32568.78, "1/23": 35428.76, "1/16": 35189.18, "1/9": 22564.05, "1/2": 16473.07}, "otr": {"7/2": 7350.62, "6/26": 7435.24}};

const OFFICE_PAYCHECKS = {"source": "W-2 paychecks (loaded) + contractors ALL-IN (cash + car + health, excl reimbursements) \u00b7 27 weeks \u00b7 columns = pay day", "weeks": ["1/2", "1/9", "1/16", "1/23", "1/30", "2/6", "2/13", "2/20", "2/27", "3/6", "3/13", "3/20", "3/27", "4/3", "4/10", "4/17", "4/24", "5/1", "5/8", "5/15", "5/22", "5/29", "6/5", "6/12", "6/18", "6/26", "7/2"], "sections": [{"name": "CE", "rows": [{"name": "Bartosz Naruszewicz (50%)", "former": false, "amts": {"7/2": 998.12, "6/26": 1042.04, "6/18": 1063.5, "6/12": 998.12, "6/5": 998.12, "5/29": 998.12, "5/22": 1164.47, "5/15": 990.3, "5/8": 978.32}, "camts": {}, "total": 9231.11}, {"name": "Cecilia Rivera", "former": false, "amts": {"7/2": 1721.26, "6/26": 1721.26, "6/18": 1721.26, "6/12": 1778.63, "6/5": 1491.76, "5/29": 1491.76, "5/22": 1474.54, "5/15": 1474.54, "5/8": 1721.26, "5/1": 1474.54, "4/24": 1474.54, "4/17": 1474.54, "4/10": 1721.26, "4/3": 1474.54, "3/27": 1474.54, "3/20": 1474.54, "3/13": 1474.54, "3/6": 1474.54, "2/27": 1721.26, "2/20": 1721.26, "2/13": 1474.54, "2/6": 1474.54, "1/30": 1474.54, "1/23": 1474.54, "1/16": 1474.54, "1/9": 1474.54}, "camts": {}, "total": 40403.61}, {"name": "Harold Galvis (50%)", "former": false, "amts": {"7/2": 628.28, "6/26": 628.28, "6/18": 628.28, "6/12": 628.28, "6/5": 628.28}, "camts": {}, "total": 3141.4}, {"name": "Kidist Gelaw (50%)", "former": false, "amts": {"7/2": 628.28, "6/26": 628.28, "6/18": 628.28, "6/12": 628.28}, "camts": {}, "total": 2513.12}, {"name": "Nathan Youngblood", "former": false, "amts": {"7/2": 1329.42, "6/26": 1329.42, "6/18": 1329.42, "6/12": 1329.42, "6/5": 1329.42, "5/29": 1329.42, "5/22": 1329.42, "5/15": 1329.42, "5/8": 1329.42, "5/1": 1329.42, "4/24": 1329.42, "4/17": 1329.42, "4/10": 1329.42, "4/3": 1329.42, "3/27": 1329.42, "3/20": 1329.42, "3/13": 1329.42, "3/6": 1329.42, "2/27": 1329.42, "2/20": 1329.42, "2/13": 1329.42, "2/6": 1329.42, "1/30": 1329.42, "1/23": 1329.42, "1/16": 1329.42, "1/9": 1329.42}, "camts": {}, "total": 34564.92}, {"name": "Gabriel Colon \u00b7 1099 (50%)", "former": false, "amts": {}, "camts": {"6/18": 1000.0, "6/12": 1100.0, "6/5": 1066.66, "5/29": 1000.0, "5/22": 1000.0, "5/15": 1165.82, "5/8": 1000.0, "5/1": 1105.32, "4/24": 1123.82, "4/17": 1000.0, "4/10": 1250.0, "4/3": 1416.65, "3/27": 1099.99, "3/20": 1125.82, "3/13": 1000.0, "3/6": 1178.82, "2/27": 1184.14, "2/20": 1177.48, "2/13": 1220.31, "2/6": 1174.98, "1/30": 1000.0, "1/23": 1000.0, "1/16": 1212.81, "1/9": 1000.0, "6/26": 1145.32, "7/2": 1000.0}, "total": 28747.94}, {"name": "Jon Marcus \u00b7 1099", "former": false, "amts": {}, "camts": {"6/18": 2800.0, "6/12": 2800.0, "6/5": 2800.0, "5/29": 3150.0, "5/22": 2800.0, "5/15": 2800.0, "5/8": 3150.0, "5/1": 3150.0, "4/24": 2800.0, "4/17": 2800.0, "4/10": 3150.0, "4/3": 3150.0, "3/27": 2800.0, "3/20": 2800.0, "3/13": 2800.0, "3/6": 3150.0, "2/27": 3150.0, "2/20": 2800.0, "2/13": 2800.0, "2/6": 3150.0, "1/30": 3150.0, "1/23": 2800.0, "1/16": 2800.0, "1/9": 3150.0, "6/26": 2800.0, "7/2": 3150.0}, "total": 76650.0}, {"name": "Mairena Tapias \u00b7 1099", "former": false, "amts": {}, "camts": {"4/24": 193.04, "5/8": 900.0, "5/22": 882.0, "5/29": 695.0, "6/5": 140.0, "6/12": 950.0, "6/18": 475.0, "6/26": 475.0, "7/2": 475.0}, "total": 5185.04}], "totals": {"1/9": 2803.96, "1/16": 2803.96, "1/23": 2803.96, "1/30": 2803.96, "2/6": 2803.96, "2/13": 2803.96, "2/20": 3050.68, "2/27": 3050.68, "3/6": 2803.96, "3/13": 2803.96, "3/20": 2803.96, "3/27": 2803.96, "4/3": 2803.96, "4/10": 3050.68, "4/17": 2803.96, "4/24": 2803.96, "5/1": 2803.96, "5/8": 4029.0, "5/15": 3794.26, "5/22": 3968.43, "5/29": 3819.3, "6/5": 4447.58, "6/12": 5362.73, "6/18": 5370.74, "6/26": 5349.28, "7/2": 5305.36}, "ctotals": {"1/9": 4150.0, "1/16": 4012.81, "1/23": 3800.0, "1/30": 4150.0, "2/6": 4324.98, "2/13": 4020.31, "2/20": 3977.48, "2/27": 4334.14, "3/6": 4328.82, "3/13": 3800.0, "3/20": 3925.82, "3/27": 3899.99, "4/3": 4566.65, "4/10": 4400.0, "4/17": 3800.0, "4/24": 4116.86, "5/1": 4255.32, "5/8": 5050.0, "5/15": 3965.82, "5/22": 4682.0, "5/29": 4845.0, "6/5": 4006.66, "6/12": 4850.0, "6/18": 4275.0, "6/26": 4420.32, "7/2": 4625.0}}, {"name": "SF", "rows": [{"name": "Adrian Arias", "former": false, "amts": {"7/2": 1886.81, "6/26": 2202.04, "6/18": 1886.81, "6/12": 1886.81, "6/5": 1886.81, "5/29": 1886.81, "5/22": 1886.81, "5/15": 1886.81, "5/8": 1886.81, "5/1": 2200.9, "4/24": 1886.81, "4/17": 1886.81, "4/10": 1886.81, "4/3": 1886.81, "3/27": 1886.81, "3/20": 2717.88, "3/13": 1886.81, "3/6": 1886.81, "2/27": 1886.81, "2/20": 1886.81, "2/13": 1886.81, "2/6": 1886.81, "1/30": 1886.81, "1/23": 2201.28, "1/16": 2201.28, "1/9": 1886.81}, "camts": {}, "total": 51146.39}, {"name": "Andres Figueroa", "former": false, "amts": {"7/2": 1838.65, "6/26": 1838.65, "6/18": 1797.18, "6/12": 1838.65, "6/5": 1838.65, "5/29": 1949.25, "5/22": 1575.99, "5/15": 1575.99, "5/8": 1575.99, "5/1": 1575.99, "4/24": 1575.99, "4/17": 1575.99, "4/10": 1575.99, "4/3": 1575.99, "3/27": 1575.99, "3/20": 1575.99, "3/13": 1575.99, "3/6": 1575.99, "2/27": 1575.99, "2/20": 1575.99, "2/13": 1575.99, "2/6": 1575.99, "1/30": 1575.99, "1/23": 1741.88, "1/16": 1575.99, "1/9": 1741.88, "1/2": 1575.99}, "camts": {}, "total": 44528.6}, {"name": "Antionette Wilson", "former": false, "amts": {"7/2": 1257.12, "6/26": 1257.12}, "camts": {}, "total": 2514.24}, {"name": "Bartosz Naruszewicz (50%)", "former": false, "amts": {"7/2": 998.12, "6/26": 1042.04, "6/18": 1063.5, "6/12": 998.12, "6/5": 998.12, "5/29": 998.12, "5/22": 1164.47, "5/15": 990.3, "5/8": 978.32}, "camts": {}, "total": 9231.11}, {"name": "Gabriel Gonzalez", "former": false, "amts": {"7/2": 1329.32, "6/26": 1329.32, "6/18": 1329.32, "6/12": 1329.32, "6/5": 1329.32, "5/29": 1329.32, "5/22": 1329.32, "5/15": 1329.32, "5/8": 1329.32, "5/1": 1329.32, "4/24": 1363.66, "4/17": 1329.32, "4/10": 1329.32, "4/3": 1329.32, "3/27": 1329.32, "3/20": 1329.32, "3/13": 1329.32, "3/6": 1329.32, "2/27": 1329.32, "2/20": 1171.68, "2/13": 1171.68, "2/6": 1171.68, "1/30": 1171.68, "1/23": 1448.62, "1/16": 1171.68, "1/9": 1171.68}, "camts": {}, "total": 33770.12}, {"name": "Gentry Eagleton", "former": false, "amts": {"7/2": 1071.77, "6/26": 1171.81, "6/18": 930.51, "6/12": 1023.91, "6/5": 911.24, "5/29": 1003.3, "5/22": 956.77, "5/15": 889.3, "5/8": 944.14, "5/1": 947.46, "4/24": 947.46, "4/17": 976.05, "4/10": 1061.47, "4/3": 1016.49, "3/27": 932.29, "3/20": 899.16, "3/13": 1014.93, "3/6": 905.81, "2/27": 876.23, "2/20": 892.07, "2/13": 901.82, "2/6": 733.2, "1/30": 966.41, "1/23": 921.87, "1/16": 1273.51, "1/9": 891.96}, "camts": {}, "total": 25060.94}, {"name": "Tasha Mahan", "former": false, "amts": {"7/2": 1446.25, "6/26": 1446.25, "6/18": 1446.25, "6/12": 1446.25, "6/5": 1446.25}, "camts": {}, "total": 7231.25}, {"name": "Gabriel Colon \u00b7 1099 (50%)", "former": false, "amts": {}, "camts": {"6/18": 1000.0, "6/12": 1100.0, "6/5": 1066.66, "5/29": 1000.0, "5/22": 1000.0, "5/15": 1165.82, "5/8": 1000.0, "5/1": 1105.32, "4/24": 1123.82, "4/17": 1000.0, "4/10": 1250.0, "4/3": 1416.65, "3/27": 1099.99, "3/20": 1125.82, "3/13": 1000.0, "3/6": 1178.82, "2/27": 1184.14, "2/20": 1177.48, "2/13": 1220.31, "2/6": 1174.98, "1/30": 1000.0, "1/23": 1000.0, "1/16": 1212.81, "1/9": 1000.0, "6/26": 1145.32, "7/2": 1000.0}, "total": 28747.94}, {"name": "Maria Con \u00b7 1099", "former": false, "amts": {}, "camts": {"1/9": 550.0, "1/16": 550.0, "1/23": 550.0, "1/30": 550.0, "2/6": 550.0, "2/13": 550.0, "2/20": 550.0, "2/27": 550.0, "3/6": 550.0, "3/13": 550.0, "3/20": 650.0, "3/27": 650.0, "4/3": 650.0, "4/10": 650.0, "4/17": 650.0, "4/24": 650.0, "5/1": 650.0, "5/8": 650.0, "5/15": 650.0, "5/22": 650.0, "5/29": 650.0, "6/5": 650.0, "6/12": 650.0, "6/18": 650.0, "6/26": 650.0, "7/2": 650.0}, "total": 15900.0}, {"name": "Scot Grosser", "former": true, "amts": {"5/22": 2079.24, "5/15": 1937.13, "5/8": 2121.91, "5/1": 1862.42, "4/24": 1862.42, "4/17": 1862.42, "4/10": 1862.42, "4/3": 2122.27, "3/27": 1862.42, "3/20": 1862.42, "3/13": 1862.42, "3/6": 1862.42, "2/27": 1862.42, "2/20": 1862.42, "2/13": 1862.42, "2/6": 1862.42, "1/30": 1862.42, "1/23": 1862.42, "1/16": 1862.42, "1/9": 1862.42}, "camts": {}, "total": 38059.27}], "totals": {"1/2": 1575.99, "1/9": 7554.75, "1/16": 8084.88, "1/23": 8176.07, "1/30": 7463.31, "2/6": 7230.1, "2/13": 7398.72, "2/20": 7388.97, "2/27": 7530.77, "3/6": 7560.35, "3/13": 7669.47, "3/20": 8384.77, "3/27": 7586.83, "4/3": 7930.88, "4/10": 7716.01, "4/17": 7630.59, "4/24": 7636.34, "5/1": 7916.09, "5/8": 8836.49, "5/15": 8608.85, "5/22": 8992.6, "5/29": 7166.8, "6/5": 8410.39, "6/12": 8523.06, "6/18": 8453.57, "6/26": 10287.23, "7/2": 9828.04}, "ctotals": {"1/9": 1550.0, "1/16": 1762.81, "1/23": 1550.0, "1/30": 1550.0, "2/6": 1724.98, "2/13": 1770.31, "2/20": 1727.48, "2/27": 1734.14, "3/6": 1728.82, "3/13": 1550.0, "3/20": 1775.82, "3/27": 1749.99, "4/3": 2066.65, "4/10": 1900.0, "4/17": 1650.0, "4/24": 1773.82, "5/1": 1755.32, "5/8": 1650.0, "5/15": 1815.82, "5/22": 1650.0, "5/29": 1650.0, "6/5": 1716.66, "6/12": 1750.0, "6/18": 1650.0, "6/26": 1795.32, "7/2": 1650.0}}, {"name": "CE East", "rows": [{"name": "Harold Galvis (50%)", "former": false, "amts": {"7/2": 628.28, "6/26": 628.28, "6/18": 628.28, "6/12": 628.28, "6/5": 628.28}, "camts": {}, "total": 3141.4}, {"name": "Kidist Gelaw (50%)", "former": false, "amts": {"7/2": 628.28, "6/26": 628.28, "6/18": 628.28, "6/12": 628.28}, "camts": {}, "total": 2513.12}], "totals": {"6/5": 628.28, "6/12": 1256.56, "6/18": 1256.56, "6/26": 1256.56, "7/2": 1256.56}, "ctotals": {}}, {"name": "J&A", "rows": [{"name": "Abigail Dillon", "former": false, "amts": {"4/24": 222.4, "4/17": 731.29, "4/10": 528.76, "4/3": 141.78, "3/20": 170.14, "3/13": 446.19, "3/6": 277.72, "2/27": 189.6, "2/20": 56.99, "2/13": 274.39, "2/6": 271.61, "1/30": 174.58, "1/23": 187.65, "1/16": 325.82}, "camts": {}, "total": 3998.92}, {"name": "Ben Hoffman", "former": false, "amts": {"7/2": 1504.02, "6/26": 1693.95, "6/18": 1504.02, "6/12": 1504.02, "6/5": 1504.02, "5/29": 1504.02, "5/22": 1504.02, "5/15": 1504.02, "5/8": 1504.02, "5/1": 1504.02, "4/24": 1548.71, "4/17": 1504.02, "4/10": 1504.02, "4/3": 1504.02, "3/27": 1504.02, "3/20": 1504.02, "3/13": 1504.02, "3/6": 1504.02, "2/27": 1504.02, "2/20": 1504.02, "2/13": 1504.02, "2/6": 1504.02, "1/30": 1504.02, "1/23": 1504.02, "1/16": 1504.02, "1/9": 1504.02}, "camts": {}, "total": 39339.14}, {"name": "Christopher Adamson", "former": false, "amts": {"7/2": 2293.51, "6/26": 2293.51, "6/18": 2293.51, "6/12": 2293.51, "6/5": 2293.51, "5/29": 2293.51, "5/22": 2293.51, "5/15": 2293.51, "5/8": 2293.51, "5/1": 2293.51, "4/24": 2293.51, "4/17": 2293.51, "4/10": 2293.51, "4/3": 2293.51, "3/27": 2293.51, "3/20": 2293.51, "3/13": 2293.51, "3/6": 2293.51, "2/27": 2293.51, "2/20": 2293.51, "2/13": 2293.51, "2/6": 2293.51}, "camts": {}, "total": 50457.22}, {"name": "Joshua Law", "former": false, "amts": {"7/2": 3164.64}, "camts": {}, "total": 3164.64}, {"name": "Valeria Abrego", "former": false, "amts": {"7/2": 884.14, "6/26": 884.14, "6/18": 884.14, "6/12": 994.65, "6/5": 1105.17, "5/29": 884.14, "5/22": 884.14, "5/15": 884.14, "5/8": 1038.86, "5/1": 884.14, "4/24": 884.14, "4/17": 884.14, "4/10": 1022.28, "4/3": 884.14, "3/27": 906.35, "3/20": 1066.49, "3/13": 884.14, "3/6": 884.14, "2/27": 884.14, "2/20": 884.14, "2/13": 884.14, "2/6": 884.14, "1/30": 884.14, "1/23": 884.14, "1/16": 884.14, "1/9": 884.14}, "camts": {}, "total": 23816.6}, {"name": "Hilda Salman \u00b7 1099", "former": false, "amts": {}, "camts": {"6/18": 1848.82, "6/12": 1848.82, "6/5": 1848.82, "5/29": 1848.82, "5/22": 1848.82, "5/15": 1848.82, "5/8": 1848.82, "5/1": 1848.82, "4/24": 1848.82, "4/17": 1848.82, "4/10": 1848.82, "4/3": 1848.82, "3/27": 1848.82, "3/6": 1848.82, "1/23": 1848.82, "1/16": 1848.82, "1/9": 1848.82, "3/20": 1848.82, "3/13": 1848.82, "2/27": 1848.82, "2/20": 1848.82, "2/13": 1848.82, "2/6": 1848.82, "1/30": 1848.82, "6/26": 1848.82, "7/2": 1848.82}, "total": 48069.32}, {"name": "Logic Consultants \u00b7 1099", "former": false, "amts": {}, "camts": {"1/9": 500.0, "1/16": 500.0, "1/23": 500.0, "1/30": 500.0, "2/6": 500.0, "2/13": 500.0, "2/20": 500.0, "2/27": 500.0, "3/6": 500.0, "3/13": 500.0, "3/20": 500.0, "3/27": 500.0, "4/3": 500.0, "4/10": 500.0, "4/17": 500.0, "4/24": 500.0, "5/1": 500.0, "5/8": 500.0, "5/15": 500.0, "5/22": 500.0, "5/29": 500.0, "6/5": 500.0, "6/12": 500.0, "6/18": 500.0, "6/26": 500.0, "7/2": 500.0}, "total": 13000.0}, {"name": "Mellody Abrego \u00b7 1099", "former": false, "amts": {}, "camts": {"6/18": 2918.34, "6/12": 2918.34, "6/5": 3603.2, "5/29": 2918.34, "5/22": 2918.34, "5/15": 3618.34, "5/8": 2853.2, "5/1": 2518.34, "4/24": 2518.34, "4/17": 2518.34, "4/10": 2853.2, "4/3": 2518.34, "3/27": 2518.34, "3/20": 2518.34, "3/13": 2518.34, "3/6": 2853.2, "2/27": 2518.34, "2/20": 4551.55, "2/13": 2518.34, "2/6": 2853.2, "1/30": 2518.34, "1/23": 2518.34, "1/16": 2518.34, "1/9": 2853.2, "6/26": 2918.34, "7/2": 3253.2}, "total": 74104.07}, {"name": "Ayelen Sanchez", "former": true, "amts": {"2/6": 750.92, "1/23": 291.26, "1/16": 493.76, "1/9": 471.57}, "camts": {}, "total": 2007.51}, {"name": "Biniyam Fissehaye", "former": true, "amts": {"5/8": 1494.74, "5/1": 1660.83, "4/24": 1494.74, "4/17": 1494.74, "4/10": 1494.74, "4/3": 1494.74, "3/27": 1494.74, "3/20": 1494.74, "3/13": 1494.74, "3/6": 1494.74, "2/27": 1494.74, "2/20": 1494.74, "2/13": 1494.74, "2/6": 1524.72}, "camts": {"6/18": 1850.0, "6/12": 1850.0, "6/5": 1850.0, "5/29": 1850.0, "5/22": 1850.0, "5/15": 1850.0, "6/26": 1850.0, "7/2": 1850.0}, "total": 35922.43}, {"name": "Branden Parnell", "former": true, "amts": {"1/30": 2566.14, "1/23": 1283.07, "1/16": 1283.07, "1/9": 1283.07}, "camts": {}, "total": 6415.35}, {"name": "Christopher Simpson", "former": true, "amts": {"2/20": 1032.12, "2/13": 1420.23, "2/6": 1420.23, "1/30": 1032.12, "1/23": 1032.12, "1/16": 2191.3, "1/9": 2191.3}, "camts": {"6/18": 888.76, "6/12": 888.76, "6/5": 1040.56, "5/29": 1759.15, "5/22": 888.76, "5/15": 888.76, "5/8": 1069.13, "5/1": 888.76, "4/24": 888.76, "4/17": 888.76, "4/10": 988.76, "4/3": 1205.82, "3/27": 888.76, "3/20": 953.79, "3/13": 1469.58, "3/6": 1469.58, "2/27": 953.79, "6/26": 888.76, "7/2": 888.76, "1/9": 53.79, "1/16": 53.79, "1/23": 53.79, "1/30": 53.79, "2/6": 53.79, "2/13": 53.79, "2/20": 53.79}, "total": 30493.71}, {"name": "Debra Adamson", "former": true, "amts": {"2/20": 1383.53, "2/13": 1383.53, "2/6": 1383.53, "1/30": 1383.53, "1/23": 1383.53, "1/16": 1383.53, "1/9": 1383.53}, "camts": {"6/18": 1803.79, "6/12": 1803.79, "6/5": 1803.79, "5/29": 1803.79, "5/22": 1803.79, "5/15": 1803.79, "5/8": 1803.79, "5/1": 1038.76, "4/24": 1038.76, "4/17": 1038.76, "4/10": 1038.76, "4/3": 1038.76, "3/27": 1038.76, "3/20": 1038.76, "3/13": 1238.76, "3/6": 1238.76, "2/27": 1238.76, "6/26": 1803.79, "7/2": 1803.79, "1/9": 53.79, "1/16": 53.79, "1/23": 53.79, "1/30": 53.79, "2/6": 53.79, "2/13": 53.79, "2/20": 53.79}, "total": 37282.95}, {"name": "Elizabeth Delgado", "former": true, "amts": {"2/20": 1825.51, "2/13": 2014.51, "2/6": 1152.51, "1/30": 1251.13, "1/23": 1326.02, "1/16": 833.77, "1/9": 989.79}, "camts": {"6/18": 900.0, "6/12": 900.0, "6/5": 900.0, "5/29": 900.0, "5/22": 900.0, "5/15": 2476.25, "5/8": 900.0, "5/1": 900.0, "4/24": 900.0, "4/17": 900.0, "4/10": 900.0, "4/3": 900.0, "3/27": 1803.63, "3/20": 1098.16, "3/13": 1155.23, "3/6": 2056.84, "2/27": 1045.53, "6/26": 900.0, "7/2": 900.0}, "total": 30728.88}, {"name": "Kirsten Hall", "former": true, "amts": {"1/23": 834.0, "1/16": 834.0, "1/9": 834.0}, "camts": {}, "total": 2502.0}], "totals": {"1/9": 9541.42, "1/16": 9733.41, "1/23": 8725.81, "1/30": 8795.66, "2/6": 11185.19, "2/13": 11269.07, "2/20": 10474.56, "2/27": 6366.01, "3/6": 6454.13, "3/13": 6622.6, "3/20": 6528.9, "3/27": 6198.62, "4/3": 6318.19, "4/10": 6843.31, "4/17": 6907.7, "4/24": 6443.5, "5/1": 6342.5, "5/8": 6331.13, "5/15": 4681.67, "5/22": 4681.67, "5/29": 4681.67, "6/5": 4902.7, "6/12": 4792.18, "6/18": 4681.67, "6/26": 4871.6, "7/2": 7846.31}, "ctotals": {"1/9": 5309.6, "1/16": 4974.74, "1/23": 4974.74, "1/30": 4974.74, "2/6": 5309.6, "2/13": 4974.74, "2/20": 7007.95, "2/27": 8105.24, "3/6": 9967.2, "3/13": 8730.73, "3/20": 7957.87, "3/27": 8598.31, "4/3": 8011.74, "4/10": 8129.54, "4/17": 7694.68, "4/24": 7694.68, "5/1": 7694.68, "5/8": 8974.94, "5/15": 12985.96, "5/22": 10709.71, "5/29": 11580.1, "6/5": 11546.37, "6/12": 10709.71, "6/18": 10709.71, "6/26": 10709.71, "7/2": 11044.57}}]};

// ── AGENTS ────────────────────────────────────────────────────
// Agent payments are categorized as Owner Draws in QBO but tracked
// separately on the dashboard because they're a distinct expense lens
// (recruiter/finder model, not operational contractor).
const AGENTS = [
  { name:"Kevin Deveraux", dba:"Nixon Graye Associates", weekly:500, payments:5, weeklyTotal:2500, total:2500, note:"$500/wk · Agent · paid via Owner Draws in QBO · started May 11 2026" },
];

// ── ATL_WEEKLY_LOG ──────────────────────────────────────────
// Per-week ATL roster + concrete contribution amounts.
// ATL designations toggle week-to-week — tag a driver/contractor/agent
// for the SPECIFIC week(s) they were ATL. There is NO sticky entity:"ATL"
// tag on PAYROLL/FUEL/CONTRACTORS anymore. Each weekly drop, the user
// confirms the roster + we estimate that week's $/hrs.
//
// Historical weeks (May 4-10, May 11-17) are BEST-EFFORT allocations
// derived from YTD snapshots; the latest week (May 18-24) is exact
// (computed from PAYROLL YTD delta vs the prior weekly drop).
const ATL_WEEKLY_LOG = [
  {
    weekStart: "2026-05-04",
    weekEnd: "2026-05-10",
    drivers: ["Davis Anthoni D", "Denman Samuel E", "Wainwright Michael W"],
    // Manar/Tucker started May 11 → not in this week.
    driverPay: 6966.01,        // best-effort: 7/13 of May 4-16 ATL labor (Davis+Denman+Wainwright)
    driverHours: 188.81,
    fuelAmt: 3928.05,          // 7/13 of May 4-16 ATL fuel (same 3 drivers)
    fuelGallons: 699.00,
    contractors: [
      { name: "Mellody Abrego",   entity: "Neon Vibes Enterprise (pre-rate-change at $2,150/wk)", base: 2150, commission: 0, car: 0, health: 368.34, total: 2518.34 },
      { name: "Biniyam Fissehaye",entity: "J&A W2 (last week before 1099 transition)", total: 1902.31 },
    ],
    agents: [],                // Kevin started May 11
    contractorPay: 4420.65,
    agentPay: 0,
    note: "First ATL week. Mellody at $2,150/wk pre-rate-change. Bini's final W2 phase.",
  },
  {
    weekStart: "2026-05-11",
    weekEnd: "2026-05-17",
    drivers: ["Davis Anthoni D", "Denman Samuel E", "Wainwright Michael W", "Alshamaa Manar", "Tucker Robert", "Johnson Christopher"],
    // Denman + Mellody ATL only this week (per Ben).
    driverPay: 9499.30,        // best-effort: May 11-16 driver totals + 1/8 of May 18-24 delta (for May 17) — incl Denman
    driverHours: 268.84,
    fuelAmt: 5424.06,          // best-effort similar allocation incl Denman
    fuelGallons: 933.69,
    contractors: [
      { name: "Mellody Abrego",   entity: "Neon Vibes Enterprise (1 paycheck for May 11-17 work, paid May 22)", base: 2250, commission: 300, car: 0, health: 368.34, total: 2918.34 },
      { name: "ENM Trucking LLC", entity: "ENM Trucking LLC (Biniyam Fissehaye 1099 phase)", total: 1850 },
    ],
    contractorPay: 4768.34,
    note: "Denman + Mellody ATL this week only (week-to-week designation).",
  },
  {
    weekStart: "2026-05-18",
    weekEnd: "2026-05-24",
    drivers: ["Davis Anthoni D", "Wainwright Michael W", "Alshamaa Manar", "Tucker Robert", "Johnson Christopher"],
    driverPay: 11168.86,       // exact: sum of weekly delta in PAYROLL YTD for these 5 drivers
    driverHours: 350.00,
    fuelAmt: 8591.14,          // exact: sum of weekly delta in FUEL YTD for these 5 drivers
    fuelGallons: 1548.71,
    contractors: [
      { name: "ENM Trucking LLC", entity: "ENM Trucking LLC", total: 1850 },
    ],
    contractorPay: 1850,
    note: "Exact deltas from weekly drop (May 24 vs May 16 PAYROLL/FUEL).",
  },
  {
    weekStart: "2026-05-25",
    weekEnd: "2026-05-31",
    drivers: ["Davis Anthoni D", "Wainwright Michael W", "Alshamaa Manar", "Tucker Robert", "Johnson Christopher"],
    driverPay: 11019.19,       // exact: 5-driver delta May 29 vs May 24 PAYROLL YTD (partial week — payroll closes Fri May 29)
    driverHours: 356.33,
    fuelAmt: 5167.53,          // exact: 5-driver delta May 29 vs May 24 FUEL YTD (partial — EFS closes May 29; Sat/Sun fuel not yet captured)
    fuelGallons: 919.80,
    contractors: [
      { name: "ENM Trucking LLC", entity: "ENM Trucking LLC", total: 1850 },
    ],
    contractorPay: 1850,
    note: "Partial week — labor/fuel YTDs cover only Mon May 25 – Fri May 29 (5 days). Sat May 30 + Sun May 31 will land in next weekly drop.",
  },
  {
    weekStart: "2026-06-01",
    weekEnd: "2026-06-07",
    drivers: ["Alshamaa Manar", "Johnson Christopher", "Logan LaDyle", "Tucker Robert", "Wainwright Michael W"],
    // Davis Anthoni D transferred OFF ATL — back to CE/SF. Logan LaDyle joined.
    driverPay: 9107.42,        // exact: 5-driver delta Jun 5 vs May 29 PAYROLL YTD (LaDyle is brand-new — all $1,293 of his YTD lands this week)
    driverHours: 304.72,
    fuelAmt: 7100.53,          // exact: 5-driver delta Jun 5 vs May 29 FUEL YTD (LaDyle contribution = card 57457 delta of $630.49)
    fuelGallons: 1333.86,
    contractors: [
      { name: "ENM Trucking LLC", entity: "ENM Trucking LLC", total: 1850 },
    ],
    contractorPay: 1850,
    note: "Davis OFF ATL → CE/SF. Logan LaDyle joined (new SF W2 driver, first paycheck this week). Mon Jun 1 – Fri Jun 5 only (5 days; payroll/EFS close Fri).",
  },
  {
    weekStart: "2026-06-08",
    weekEnd: "2026-06-14",
    drivers: ["Alshamaa Manar", "Johnson Christopher", "Logan LaDyle", "Tucker Robert", "Wainwright Michael W"],
    // Same 5 as last week (Ben confirmed). Davis stays OFF ATL.
    driverPay: 11056.32,       // exact: 5-driver delta Jun 12 vs Jun 5 PAYROLL YTD
    driverHours: 362.18,
    fuelAmt: 5370.50,          // exact: 5-driver delta Jun 12 vs Jun 5 FUEL YTD
    fuelGallons: 1033.77,
    contractors: [
      { name: "ENM Trucking LLC", entity: "ENM Trucking LLC", total: 1850 },
    ],
    contractorPay: 1850,
    note: "Same roster as prior week. Mon Jun 8 – Fri Jun 12 (5 days; payroll/EFS close Fri Jun 12).",
  },
  {
    weekStart: "2026-06-15",
    weekEnd: "2026-06-21",
    drivers: ["Alshamaa Manar", "Johnson Christopher", "Logan LaDyle", "Tucker Robert", "Wainwright Michael W"],
    // Same 5 as last week (Ben confirmed Jun 20). No joins/leaves/transfers.
    driverPay: 10464.34,       // exact: 5-driver delta Jun 19 vs Jun 12 PAYROLL YTD
    driverHours: 328.99,
    fuelAmt: 7834.55,          // exact: 5-driver delta Jun 19 vs Jun 12 FUEL YTD (Manar card 87454 unchanged this week)
    fuelGallons: 1608.18,
    contractors: [
      { name: "ENM Trucking LLC", entity: "ENM Trucking LLC", total: 1850 },
    ],
    contractorPay: 1850,
    note: "Same roster as prior week (Ben confirmed). Mon Jun 15 – Fri Jun 19 (5 days; payroll/EFS close Fri Jun 19). Mellody no longer ATL — ENM Trucking is the only ATL contractor.",
  },
  {
    weekStart: "2026-06-22",
    weekEnd: "2026-06-28",
    drivers: ["Alshamaa Manar", "Johnson Christopher", "Logan LaDyle", "Tucker Robert", "Wainwright Michael W"],
    // Same 5 (Ben confirmed Jun 29). Manar had no pay/fuel activity this week ($0).
    driverPay: 9323.37,        // exact: 5-driver delta Jun 26 vs Jun 19 PAYROLL YTD
    driverHours: 309.32,
    fuelAmt: 5883.41,          // exact: 5-driver delta Jun 26 vs Jun 19 FUEL YTD
    fuelGallons: 1276.01,
    contractors: [
      { name: "ENM Trucking LLC", entity: "ENM Trucking LLC", total: 1850 },
    ],
    contractorPay: 1850,
    note: "Same roster. Mon Jun 22 – Fri Jun 26 (5 days; payroll/EFS close Fri Jun 26).",
  },
  {
    weekStart: "2026-06-29",
    weekEnd: "2026-07-05",
    drivers: ["Johnson Christopher", "Logan LaDyle", "Tucker Robert", "Wainwright Michael W", "Pacitti Michael R"],
    // Manar terminated (was ATL) — dropped. Pacitti was ATL this week INSTEAD of OTR
    // (per Ben) — his pay/fuel counts here, not in OTR_WEEKLY_LOG for this week.
    driverPay: 9393.50,        // exact: fleet 4 delta (Jul 2 vs Jun 26) $7,279.97 + Pacitti $2,113.53 (his 6/29-wk gross $1,899.80 × 1.1125 loaded factor)
    driverHours: 282.25,       // fleet 217.85 + Pacitti 64.40
    fuelAmt: 6210.17,          // exact: fleet 4 $4,858.77 + Pacitti $1,351.40 (card 87455 txns 6/29+7/2+7/3)
    fuelGallons: 1347.45,
    contractors: [
      { name: "ENM Trucking LLC", entity: "ENM Trucking LLC", total: 1850 },
    ],
    contractorPay: 1850,
    note: "Mon Jun 29 – Fri Jul 3 (payroll/EFS close). Roster: CJ/LaDyle/Tucker/Wainwright + Pacitti (moved from OTR to ATL this week). All figures exact (Pacitti pay from PaycheckHistory × loaded factor, fuel from card 87455 txns). Agent Kevin $500 separate (not in ATL total).",
  },
];

// Aggregate accessors — used by AtlOperations() to roll up the per-week log.
// Agents (Kevin/Nixon Graye) are NOT tracked here — they're a completely
// separate bucket (AGENTS[] + Budgeting tab), unrelated to ATL or any entity.
function atlSum() {
  const sum = { driverPay: 0, driverHours: 0, fuelAmt: 0, fuelGallons: 0, contractorPay: 0, weeks: ATL_WEEKLY_LOG.length };
  for (const w of ATL_WEEKLY_LOG) {
    sum.driverPay      += w.driverPay      || 0;
    sum.driverHours    += w.driverHours    || 0;
    sum.fuelAmt        += w.fuelAmt        || 0;
    sum.fuelGallons    += w.fuelGallons    || 0;
    sum.contractorPay  += w.contractorPay  || 0;
  }
  sum.total = sum.driverPay + sum.fuelAmt + sum.contractorPay;
  return sum;
}

// ── OTR_WEEKLY_LOG ──────────────────────────────────────────
// Over-the-road drivers — a SEPARATE operation, like ATL. Per-week roster;
// drivers move in/out week to week. OTR drivers are NOT in PAYROLL/FUEL and
// are EXCLUDED from the fleet CPM (LABOR/FUEL_TOT/TOTAL_HRS carve them out).
const OTR_WEEKLY_LOG = [
  {
    weekStart: "2026-06-22",
    weekEnd: "2026-06-28",
    drivers: ["Baker Anthony", "Dawson Brian", "Pacitti Michael R"],
    driverPay: 7435.23,        // YTD-to-first-report (Baker $2,074.59 + Dawson $2,896.28 + Pacitti $2,464.36)
    driverHours: 75.09,        // Pacitti 75.09; Baker & Dawson 0 hrs (signed/fueling, not yet logging hours)
    fuelAmt: 9476.55,          // EFS cards 27450 (Baker) + 17451 (Dawson) + 87455 (Pacitti)
    fuelGallons: 1973.82,
    contractors: [],
    contractorPay: 0,
    note: "OTR launch week. Amounts are YTD-to-first-appearance in payroll/EFS. Per-week deltas from next drop forward.",
  },
  {
    weekStart: "2026-06-29",
    weekEnd: "2026-07-05",
    drivers: ["Baker Anthony", "Dawson Brian"],
    // Pacitti was ATL this week (moved to ATL_WEEKLY_LOG), so OTR = Baker + Dawson only.
    driverPay: 5237.09,        // exact: Baker $2,460.07 + Dawson $2,777.02 (6/29-wk PaycheckHistory gross × 1.1125 loaded)
    driverHours: 0,            // Baker & Dawson not logging hours (same as launch)
    fuelAmt: 3080.09,          // exact: Baker card 27450 $1,252.72 + Dawson card 17451 $1,827.37 (6/29-7/5 txns)
    fuelGallons: 647.33,
    contractors: [],
    contractorPay: 0,
    note: "Mon Jun 29 – Fri Jul 3. Pacitti moved to ATL this week (not here). Baker/Dawson exact from PaycheckHistory + EFS cards 27450/17451.",
  },
];

// Aggregate accessor for OtrOperations() — mirrors atlSum().
function otrSum() {
  const sum = { driverPay: 0, driverHours: 0, fuelAmt: 0, fuelGallons: 0, contractorPay: 0, weeks: OTR_WEEKLY_LOG.length };
  for (const w of OTR_WEEKLY_LOG) {
    sum.driverPay     += w.driverPay     || 0;
    sum.driverHours   += w.driverHours   || 0;
    sum.fuelAmt       += w.fuelAmt       || 0;
    sum.fuelGallons   += w.fuelGallons   || 0;
    sum.contractorPay += w.contractorPay || 0;
  }
  sum.total = sum.driverPay + sum.fuelAmt + sum.contractorPay;
  return sum;
}

// ── ATL BILLING (Atlanta load-level revenue) ────────────────
// Source of truth: "2026-Atlanta Billing.xlsx" — drop into incoming-freightiq/
// each week. Run scripts/parse_atl_billing.py to regenerate these totals.
// EVERY load in the sheet counts as ATL revenue, regardless of the
// "Assigned" column (which only reflects QBO booking routing — some loads
// are invoiced under SF/Corp or CE East, but the load itself is ATL ops).
// First-name → PAYROLL name map: Anthoni→Davis Anthoni D, Sam→Denman Samuel E,
// Michael→Wainwright Michael W, CJ→Johnson Christopher, Manar→Alshamaa Manar,
// Robert→Tucker Robert.
const ATL_BILLING = {
  asOf: "Jul 3, 2026",
  loads: 120,
  revenue: 289297.64,      // sum of Invoice Amount ("ATLANTA 2026 ALL LOADS THRU 7.3"). Driver-less format, so per-driver breakdown below is HISTORICAL (May 4-29) and stale until format restores Driver column
  carrierPay: 88871.25,    // sum of Carrier Amount = EXTERNAL carrier pay only. 84 of 120 loads have blank Carrier Amount because SF hauled them itself (SF IS the carrier) — those are full income with no external carrier cost (SF's cost is in LABOR/FUEL fleet buckets, not here). Blank ≠ pending.
  grossProfit: 200426.39,  // revenue − external carrier pay. Correct — the SF-self-haul loads legitimately have no carrier deduction.
  grossMargin: 69.3,       // % — real brokerage margin (high because most loads ran on SF's own trucks, not outside carriers)
  byDriver: [
    // HISTORICAL — these are the May 4-29 per-driver figures. The new ATL sheet
    // (Jun 9 drop) has no Driver column; can't refresh until format restores it.
    { name: "Davis Anthoni D",     short: "Anthoni", loads: 9, revenue: 28200.00, carrier: 16460.00, gross: 11740.00 },
    { name: "Wainwright Michael W",short: "Michael", loads: 9, revenue: 21500.00, carrier:  7372.50, gross: 14127.50 },
    { name: "Tucker Robert",       short: "Robert",  loads: 8, revenue: 18675.00, carrier:  3461.25, gross: 15213.75 },
    { name: "Alshamaa Manar",      short: "Manar",   loads: 5, revenue: 18350.00, carrier:  8180.00, gross: 10170.00 },
    { name: "Johnson Christopher", short: "CJ",      loads: 8, revenue: 15100.00, carrier:  1300.00, gross: 13800.00 },
    { name: "Denman Samuel E",     short: "Sam",     loads: 7, revenue: 13850.00, carrier:  5800.00, gross:  8050.00 },
  ],
};

// ── OFFICE STAFF COMPONENT ───────────────────────────────────
function OfficeStaff() {
  const [view, setView] = useState("summary");
  const [catFilter, setCatFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [sortCol, setSortCol] = useState("grandTotal");
  const [sortDir, setSortDir] = useState("desc"); // summary | w2 | warehouse | contractors

  const w2Total = OFFICE_W2.reduce((s,e) => s + e.totalCost, 0);
  const whTotal = WAREHOUSE.reduce((s,e) => s + e.totalCost, 0);
  const conTotal = CONTRACTORS.reduce((s,e) => s + e.total, 0);
  const grandTotal = w2Total + whTotal + conTotal;
  const commissionW2 = OFFICE_W2.reduce((s,e) => s + e.commission, 0);
  const commissionCon = CONTRACTORS.reduce((s,e) => s + e.commission, 0);
  const carTotal = CONTRACTORS.reduce((s,e) => s + e.carTotal, 0);
  const healthInsTotal = CONTRACTORS.reduce((s,e) => s + e.healthInsTotal, 0);
  const dualPeople = [...OFFICE_W2.filter(e=>e.dual), ...CONTRACTORS.filter(e=>e.dual)];

  // ── This Week — All-In Payroll (owner asks for this every week) ──
  // Latest pay-week totals across ALL buckets: fleet drivers + OTR (from
  // DRIVER_WEEKLY, PaycheckHistory-derived) + office/warehouse W-2 + contractors
  // all-in (from OFFICE_PAYCHECKS). Pay-day keyed; WoW vs prior column.
  const payWeeks = OFFICE_PAYCHECKS.weeks || [];
  const lastWk  = payWeeks[payWeeks.length - 1];
  const priorWk = payWeeks[payWeeks.length - 2];
  const wkPay = (wk) => {
    let office = 0, con = 0;
    (OFFICE_PAYCHECKS.sections || []).forEach(s => { office += s.totals?.[wk] || 0; con += s.ctotals?.[wk] || 0; });
    const fleet = DRIVER_WEEKLY.fleet?.[wk] || 0;
    const otr   = DRIVER_WEEKLY.otr?.[wk] || 0;
    return { fleet, otr, office, con, total: fleet + otr + office + con };
  };
  const wkCur  = lastWk  ? wkPay(lastWk)  : null;
  const wkPrev = priorWk ? wkPay(priorWk) : null;
  const wkWoW  = (wkCur && wkPrev) ? wkCur.total - wkPrev.total : 0;

  return (
    <div>
      <div className="ptitle">Office Staff</div>
      <div className="psub">W2 Employees + Warehouse + Contractors · {PERIOD} · Combined SF + J&A</div>

      {/* This Week — All-In Payroll (owner weekly ask) */}
      {wkCur && (
      <div className="card" style={{ marginBottom:14, borderLeft:"3px solid var(--or)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", flexWrap:"wrap", gap:8 }}>
          <div className="ctit" style={{ margin:0 }}>This Week — All-In Payroll <span style={{ color:"var(--mu)", fontWeight:400 }}>· pay day {lastWk}</span></div>
          {wkPrev && (
            <div style={{ fontSize:12, fontFamily:"var(--f1)", color: wkWoW <= 0 ? "#3ddc84" : "#ff5252" }}>
              {wkWoW <= 0 ? "▼" : "▲"} {fd(Math.abs(wkWoW),0)} WoW <span style={{ color:"var(--mu)" }}>(vs {priorWk})</span>
            </div>
          )}
        </div>
        <div style={{ fontFamily:"var(--f2)", fontSize:36, fontWeight:900, color:"var(--or)", lineHeight:1.1, margin:"6px 0 12px" }}>{fd(wkCur.total,0)}</div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          {[
            ["Fleet Drivers", wkCur.fleet, "#f47820"],
            ["OTR Drivers",   wkCur.otr,   "#b39ddb"],
            ["Office + Warehouse", wkCur.office, "#4fc3f7"],
            ["Contractors (all-in)", wkCur.con, "#f5c542"],
          ].map(([lbl,val,col]) => (
            <div key={lbl} style={{ flex:"1 1 140px", background:"var(--s2)", borderRadius:4, padding:"8px 12px" }}>
              <div style={{ fontSize:10, color:"var(--mu)", textTransform:"uppercase", letterSpacing:1 }}>{lbl}</div>
              <div style={{ fontFamily:"var(--f1)", fontSize:16, fontWeight:600, color:col }}>{fd(val,0)}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize:10, color:"var(--mu)", marginTop:8 }}>
          Loaded cost (gross + employer taxes + 401k) · contractors incl car allowance + company health · reimbursements excluded
        </div>
      </div>
      )}

      {/* Summary KPIs */}
      <div className="g4" style={{ marginBottom:14 }}>
        <div className="kpi">
          <div className="klbl">Total Office + Staff</div>
          <div className="kval" style={{ color:"var(--or)" }}>{fd(grandTotal,0)}</div>
          <div className="ksub">{OFFICE_W2.length + WAREHOUSE.length} W2 + {CONTRACTORS.length} contractors</div>
        </div>
        <div className="kpi">
          <div className="klbl">W2 Office (Salary)</div>
          <div className="kval" style={{ color:"#4fc3f7" }}>{fd(w2Total,0)}</div>
          <div className="ksub">{OFFICE_W2.length} employees</div>
        </div>
        <div className="kpi">
          <div className="klbl">Warehouse</div>
          <div className="kval" style={{ color:"#3ddc84" }}>{fd(whTotal,0)}</div>
          <div className="ksub">{WAREHOUSE.length} employees</div>
        </div>
        <div className="kpi">
          <div className="klbl">Contractors</div>
          <div className="kval" style={{ color:"#f5c542" }}>{fd(conTotal,0)}</div>
          <div className="ksub">{CONTRACTORS.filter(c=>c.total>0).length} active / {CONTRACTORS.length} total</div>
        </div>
      </div>

      {/* Cost split bar */}
      <div className="card" style={{ marginBottom:14 }}>
        <div className="ctit">Cost Breakdown</div>
        <div className="sbar" style={{ height:32, marginBottom:10 }}>
          <div className="sseg" style={{ width:`${w2Total/grandTotal*100}%`, background:"#4fc3f7" }}>W2 {fp(w2Total/grandTotal*100)}</div>
          <div className="sseg" style={{ width:`${whTotal/grandTotal*100}%`, background:"#3ddc84" }}>WH {fp(whTotal/grandTotal*100)}</div>
          <div className="sseg" style={{ width:`${conTotal/grandTotal*100}%`, background:"#f5c542" }}>1099 {fp(conTotal/grandTotal*100)}</div>
        </div>
        <div style={{ display:"flex", gap:20, fontSize:11 }}>
          <span><span style={{color:"#4fc3f7"}}>■</span> W2 Office: {fd(w2Total,0)}</span>
          <span><span style={{color:"#3ddc84"}}>■</span> Warehouse: {fd(whTotal,0)}</span>
          <span><span style={{color:"#f5c542"}}>■</span> Contractors: {fd(conTotal,0)}</span>
        </div>
        <div style={{ display:"flex", gap:20, fontSize:10, color:"var(--mu)", marginTop:8 }}>
          <span>Commissions (W2): {fd(commissionW2,0)}</span>
          <span>Commissions (1099): {fd(commissionCon,0)}</span>
          <span>Car allowances: {fd(carTotal,0)}</span>
          <span>Health ins (company): {fd(healthInsTotal,0)}</span>
        </div>
      </div>

      {/* Weekly cost trend */}
      {(() => {
        const _PC = OFFICE_PAYCHECKS;
        const wk = _PC.weeks.map(w => ({ label:w, total: _PC.sections.reduce((s,sec)=> s + (sec.totals[w]||0) + ((sec.ctotals&&sec.ctotals[w])||0), 0) }));
        const last = wk[wk.length-1], prev = wk[wk.length-2];
        const delta = prev ? last.total - prev.total : 0;
        const full = wk.slice(1); // drop partial first week (4-day stub flattens the axis)
        const avg = full.reduce((s,w)=>s+w.total,0)/full.length;
        return (
          <div className="card" style={{ marginBottom:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4 }}>
              <div className="ctit">Weekly Cost Trend</div>
              <div style={{ fontSize:11, color:"var(--mu)" }}>
                Latest <b style={{color:"var(--tx)"}}>{fd(last.total,0)}</b>
                <span style={{ color: delta>0?"#ff5252":"#3ddc84", marginLeft:8 }}>
                  {delta>0?"▲":"▼"} {fd(Math.abs(delta),0)} WoW
                </span>
                <span style={{ marginLeft:12 }}>avg {fd(avg,0)}/wk</span>
              </div>
            </div>
            <div style={{ fontSize:10, color:"var(--mu)", marginBottom:8 }}>
              Total weekly payroll cost (W-2 loaded + 1099) — same data as the Weekly Checks grid below
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={full} margin={{ top:6, right:12, left:4, bottom:4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize:9, fill:"var(--mu)" }} interval={1} angle={-25} textAnchor="end" height={42} />
                <YAxis tick={{ fontSize:10, fill:"var(--mu)" }} tickFormatter={v=>"$"+(v/1000).toFixed(1)+"k"} width={48} domain={['dataMin - 2000', 'dataMax + 2000']} allowDecimals={false} />
                <Tooltip content={<CustomTip />} />
                <ReferenceLine y={avg} stroke="var(--mu)" strokeDasharray="4 4" label={{ value:`avg ${fd(avg,0)}`, position:'insideTopRight', fill:'var(--mu)', fontSize:9 }} />
                <Line type="monotone" dataKey="total" name="Office cost" stroke="var(--or)" strokeWidth={2} dot={{ r:2.5 }} activeDot={{ r:4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      })()}

      {/* View toggle */}
      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        {[
          ["summary","📊 Summary"],
          ["weekly","📅 Weekly Checks"],
          ["w2","👔 W2 Office ("+OFFICE_W2.length+")"],
          ["warehouse","🏗️ Warehouse ("+WAREHOUSE.length+")"],
          ["contractors","📋 Contractors ("+CONTRACTORS.length+")"],
        ].map(([id,lbl]) => (
          <button key={id} onClick={() => setView(id)} style={{
            padding:"7px 16px",borderRadius:3,cursor:"pointer",
            fontFamily:"var(--f2)",fontSize:12,fontWeight:700,
            letterSpacing:1,textTransform:"uppercase",
            background:view===id?"var(--or)":"transparent",
            color:view===id?"#fff":"var(--mu)",
            border:`1px solid ${view===id?"var(--or)":"var(--bd)"}`,
          }}>{lbl}</button>
        ))}
      </div>

      {/* ── WEEKLY CHECKS VIEW ── */}
      {view === "weekly" && (() => {
        const PC = OFFICE_PAYCHECKS;
        const fc = v => v ? "$"+Math.round(v).toLocaleString() : "";
        const grand = PC.sections.reduce((s,sec)=> s + sec.rows.reduce((a,r)=>a+r.total,0), 0);
        const wkTot = w => PC.sections.reduce((s,sec)=> s + (sec.totals[w]||0) + ((sec.ctotals&&sec.ctotals[w])||0), 0);
        const colW = 78, nameW = 150;
        const cell = { padding:"4px 8px", textAlign:"right", fontFamily:"var(--f3,Consolas,monospace)", fontSize:11, whiteSpace:"nowrap", borderBottom:"1px solid var(--bd)" };
        const nameCell = { ...cell, textAlign:"left", position:"sticky", left:0, background:"var(--s2)", minWidth:nameW, maxWidth:nameW, zIndex:1 };
        return (
          <div className="card" style={{ marginBottom:14, padding:0 }}>
            <div style={{ padding:"12px 14px 8px" }}>
              <div className="ctit">Weekly Payroll Cost — by company</div>
              <div style={{ fontSize:10, color:"var(--mu)", marginTop:2 }}>{PC.source} · {PC.weeks.length} weeks · drivers excluded · <span style={{color:"var(--tx)"}}>white = W-2 (loaded)</span> · <span style={{color:"#f5c542"}}>amber = 1099 contractor</span> · split employees at their % per company · former dimmed</div>
            </div>
            <div style={{ overflowX:"auto", maxWidth:"100%" }}>
              <table style={{ borderCollapse:"collapse", minWidth:nameW + colW*(PC.weeks.length+1) }}>
                <thead>
                  <tr>
                    <th style={{ ...nameCell, top:0, zIndex:3, textTransform:"uppercase", fontSize:10, color:"var(--mu)", borderBottom:"2px solid var(--or)", verticalAlign:"bottom" }}>Employee</th>
                    {PC.weeks.map(w => (
                      <th key={w} style={{ ...cell, minWidth:colW, borderBottom:"2px solid var(--or)", verticalAlign:"top" }}>
                        <div style={{ color:"var(--or)", fontWeight:700 }}>{w}</div>
                        <div style={{ color:"var(--gr,#3ddc84)", fontWeight:700, fontSize:13, marginTop:2 }}>{fc(wkTot(w))}</div>
                      </th>
                    ))}
                    <th style={{ ...cell, minWidth:colW, borderBottom:"2px solid var(--or)", verticalAlign:"top" }}>
                      <div style={{ color:"var(--tx)", fontWeight:700 }}>Total</div>
                      <div style={{ color:"var(--or)", fontWeight:700, fontSize:13, marginTop:2 }}>{fc(grand)}</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PC.sections.map(sec => [
                    <tr key={sec.name+"-h"}>
                      <td style={{ ...nameCell, fontWeight:700, color:"var(--tx)", textTransform:"uppercase", fontSize:10, background:"var(--s1,#0e1116)" }}>{sec.name}</td>
                      <td colSpan={PC.weeks.length+1} style={{ ...cell, background:"var(--s1,#0e1116)" }}></td>
                    </tr>,
                    ...sec.rows.map(r => (
                      <tr key={sec.name+r.name} style={{ opacity:(r.former && !(r.camts && Object.keys(r.camts).length)) ? 0.5 : 1 }}>
                        <td style={nameCell}>{r.name}</td>
                        {PC.weeks.map(w => {
                          const a=r.amts[w], c=r.camts&&r.camts[w];
                          return <td key={w} style={{ ...cell, color:a?"var(--tx)":"var(--bd)" }}>
                            {a ? fc(a) : ""}
                            {c ? <span style={{ color:"#f5c542", display:a?"block":"inline" }}>{fc(c)}</span> : null}
                          </td>;
                        })}
                        <td style={{ ...cell, fontWeight:700, color:"var(--gr,#3ddc84)" }}>{fc(r.total)}</td>
                      </tr>
                    )),
                    <tr key={sec.name+"-t"}>
                      <td style={{ ...nameCell, fontWeight:700, color:"var(--or)", textTransform:"uppercase", fontSize:10 }}>Total {sec.name}</td>
                      {PC.weeks.map(w => <td key={w} style={{ ...cell, fontWeight:700, color:"var(--mu)", borderTop:"1px solid var(--or)" }}>{fc((sec.totals[w]||0)+((sec.ctotals&&sec.ctotals[w])||0))}</td>)}
                      <td style={{ ...cell, fontWeight:700, color:"var(--or)", borderTop:"1px solid var(--or)" }}>{fc(sec.rows.reduce((a,r)=>a+r.total,0))}</td>
                    </tr>
                  ])}
                </tbody>
              </table>
            </div>
            <div style={{ padding:"8px 14px", fontSize:11, color:"var(--mu)" }}>
              Grand total (W-2 loaded + 1099 actual payments, all weeks): <b style={{ color:"var(--tx)" }}>{fc(grand)}</b> · contractor cells = actual dated payments (QB + Chase, car incl · reimbursements excluded) · Maria Con from $550→$650/wk rule · agent excluded · CE East = only Harold/Kidi split halves
            </div>
          </div>
        );
      })()}

      {/* ── SUMMARY VIEW ── */}
      {view === "summary" && (() => {
        // Build unified roster — merge W2 + contractor for dual people
        const roster = {};
        OFFICE_W2.forEach(e => {
          const key = e.name;
          if (!roster[key]) roster[key] = { name:key, entities:[], cats:[], w2Gross:0, w2Tax:0, w2Contrib:0, w2Total:0, w2Commission:0, conPaid:0, conCommission:0, conCar:0, conHealth:0, conOther:0, conTotal:0, dual:false, note:"" };
          if (!roster[key].cats.includes("W2 Office")) roster[key].cats.push("W2 Office");
          if (!roster[key].entities.includes(e.entity)) roster[key].entities.push(e.entity);
          roster[key].entity = roster[key].entities.join("+");
          roster[key].w2Gross += e.gross;
          roster[key].w2Tax += e.taxes;
          roster[key].w2Contrib += e.contrib;
          roster[key].w2Total += e.totalCost;
          roster[key].w2Commission += e.commission;
          if (e.dual) roster[key].dual = true;
          if (e.note) roster[key].note = e.note;
        });
        WAREHOUSE.forEach(e => {
          const key = e.name;
          if (!roster[key]) roster[key] = { name:key, entities:[], cats:[], w2Gross:0, w2Tax:0, w2Contrib:0, w2Total:0, w2Commission:0, conPaid:0, conCommission:0, conCar:0, conHealth:0, conOther:0, conTotal:0, dual:false, note:"" };
          if (!roster[key].cats.includes("Warehouse")) roster[key].cats.push("Warehouse");
          if (!roster[key].entities.includes(e.entity)) roster[key].entities.push(e.entity);
          roster[key].entity = roster[key].entities.join("+");
          roster[key].w2Gross += e.gross;
          roster[key].w2Tax += e.taxes;
          roster[key].w2Contrib += e.contrib;
          roster[key].w2Total += e.totalCost;
          if (e.note) roster[key].note = e.note;
        });
        CONTRACTORS.forEach(c => {
          // Match dual people by name
          const matchKey = Object.keys(roster).find(k => {
            if (c.name === "Christopher Simpson" && k === "Christopher Simpson") return true;
            if (c.name === "Debra Adamson" && k === "Debra Adamson") return true;
            if (c.name === "Elizabeth Delgado" && k === "Elizabeth Delgado") return true;
            return false;
          });
          const key = matchKey || c.name;
          if (!roster[key]) roster[key] = { name:key, entities:[], cats:[], w2Gross:0, w2Tax:0, w2Contrib:0, w2Total:0, w2Commission:0, conPaid:0, conCommission:0, conCar:0, conHealth:0, conOther:0, conTotal:0, dual:false, note:"" };
          if (!roster[key].cats.includes("Contractor")) roster[key].cats.push("Contractor");
          if (!roster[key].entities.includes("1099")) roster[key].entities.push("1099");
          roster[key].entity = roster[key].entities.join("+");
          roster[key].conPaid += c.weeklyTotal;
          roster[key].conCommission += c.commission;
          roster[key].conCar += c.carTotal;
          roster[key].conHealth += c.healthInsTotal;
          roster[key].conOther += c.other;
          roster[key].conTotal += c.total;
          if (c.dual) roster[key].dual = true;
          if (c.dba) roster[key].note = (roster[key].note ? roster[key].note + " · " : "") + "DBA: " + c.dba;
        });

        const allPeople = Object.values(roster).map(p => ({
          ...p,
          grandTotal: p.w2Total + p.conTotal,
          totalCommission: p.w2Commission + p.conCommission,
          catLabel: p.cats.join(" + "),
        }));

        // Filter state is at component level

        const filtered = allPeople
          .filter(p => catFilter === "all" || p.cats.includes(catFilter))
          .filter(p => entityFilter === "all" || p.entities.includes(entityFilter) || (entityFilter === "dual" && p.dual))
          .sort((a,b) => {
            const av = a[sortCol], bv = b[sortCol];
            if (typeof av === "string") return sortDir === "desc" ? bv.localeCompare(av) : av.localeCompare(bv);
            return sortDir === "desc" ? bv - av : av - bv;
          });

        const doSort = (col) => {
          if (sortCol === col) setSortDir(d => d === "desc" ? "asc" : "desc");
          else { setSortCol(col); setSortDir("desc"); }
        };
        const sortIcon = (col) => sortCol === col ? (sortDir === "desc" ? " ▼" : " ▲") : "";

        const fTot = (key) => filtered.reduce((s,p) => s + p[key], 0);

        return (
          <>
            {/* Filters */}
            <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
              <div>
                <div className="lbl">Category</div>
                <select className="inp" value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ width:"auto", padding:"5px 10px", fontSize:11 }}>
                  <option value="all">All Categories</option>
                  <option value="W2 Office">W2 Office</option>
                  <option value="Warehouse">Warehouse</option>
                  <option value="Contractor">Contractor</option>
                </select>
              </div>
              <div>
                <div className="lbl">Entity</div>
                <select className="inp" value={entityFilter} onChange={e => setEntityFilter(e.target.value)} style={{ width:"auto", padding:"5px 10px", fontSize:11 }}>
                  <option value="all">All Entities</option>
                  <option value="SF">Show Freight</option>
                  <option value="J&A">J&A Management</option>
                  <option value="1099">1099 Only</option>
                  <option value="dual">⚡ Dual (W2+1099)</option>
                </select>
              </div>
              <div style={{ marginLeft:"auto", fontSize:11, color:"var(--mu)" }}>
                Showing {filtered.length} of {allPeople.length} · Click headers to sort
              </div>
            </div>

            {/* Grand unified table */}
            <div className="card" style={{ marginBottom:14 }}>
              <div className="ctit">Grand Overview — All Staff &amp; Contractors</div>
              <div style={{ overflowX:"auto" }}>
                <table className="tbl" style={{ fontSize:11 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign:"left", cursor:"pointer" }} onClick={() => doSort("name")}>Name{sortIcon("name")}</th>
                      <th style={{ cursor:"pointer" }} onClick={() => doSort("catLabel")}>Category{sortIcon("catLabel")}</th>
                      <th style={{ cursor:"pointer", color:"#4fc3f7" }} onClick={() => doSort("w2Total")}>W2 Cost{sortIcon("w2Total")}</th>
                      <th style={{ cursor:"pointer", color:"#f5c542" }} onClick={() => doSort("conTotal")}>1099 Paid{sortIcon("conTotal")}</th>
                      <th style={{ cursor:"pointer", color:"#f5c542" }} onClick={() => doSort("totalCommission")}>Commission{sortIcon("totalCommission")}</th>
                      <th style={{ cursor:"pointer", color:"#b39ddb" }} onClick={() => doSort("conCar")}>Car{sortIcon("conCar")}</th>
                      <th style={{ cursor:"pointer", color:"#ff8a65" }} onClick={() => doSort("conHealth")}>Health Ins{sortIcon("conHealth")}</th>
                      <th style={{ cursor:"pointer", color:"var(--or)" }} onClick={() => doSort("grandTotal")}>Grand Total{sortIcon("grandTotal")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p,i) => {
                      const catColors = { "W2 Office":"#4fc3f7", "Warehouse":"#3ddc84", "Contractor":"#f5c542" };
                      return (
                        <tr key={p.name} style={{ background:i%2===0?"var(--s2)":"transparent" }}>
                          <td style={{ fontWeight:600 }}>
                            {p.name}
                            {p.dual && <span style={{ color:"#ff8a65", fontSize:9, marginLeft:4 }}>⚡</span>}
                          </td>
                          <td>
                            {p.cats.map(c => (
                              <span key={c} style={{
                                display:"inline-block", fontSize:9, fontWeight:700, color:catColors[c]||"var(--mu)",
                                background:`${catColors[c]||"var(--mu)"}15`, border:`1px solid ${catColors[c]||"var(--mu)"}40`,
                                borderRadius:2, padding:"1px 6px", marginRight:3,
                              }}>{c}</span>
                            ))}
                          </td>
                          <td style={{ color:p.w2Total > 0 ? "#4fc3f7" : "var(--mu)" }}>{p.w2Total > 0 ? fd(p.w2Total,0) : "—"}</td>
                          <td style={{ color:p.conTotal > 0 ? "#f5c542" : "var(--mu)" }}>{p.conTotal > 0 ? fd(p.conTotal,0) : "—"}</td>
                          <td style={{ color:p.totalCommission > 0 ? "#f5c542" : "var(--mu)" }}>{p.totalCommission > 0 ? fd(p.totalCommission,0) : "—"}</td>
                          <td style={{ color:p.conCar > 0 ? "#b39ddb" : "var(--mu)" }}>{p.conCar > 0 ? fd(p.conCar,0) : "—"}</td>
                          <td style={{ color:p.conHealth > 0 ? "#ff8a65" : "var(--mu)" }}>{p.conHealth > 0 ? fd(p.conHealth,0) : "—"}</td>
                          <td style={{ color:"var(--or)", fontWeight:700, fontFamily:"var(--f2)", fontSize:13 }}>{fd(p.grandTotal,0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>{filtered.length} people</td>
                      <td></td>
                      <td style={{ color:"#4fc3f7" }}>{fd(fTot("w2Total"),0)}</td>
                      <td style={{ color:"#f5c542" }}>{fd(fTot("conTotal"),0)}</td>
                      <td style={{ color:"#f5c542" }}>{fd(fTot("totalCommission"),0)}</td>
                      <td style={{ color:"#b39ddb" }}>{fd(fTot("conCar"),0)}</td>
                      <td style={{ color:"#ff8a65" }}>{fd(fTot("conHealth"),0)}</td>
                      <td style={{ color:"var(--or)", fontWeight:900, fontFamily:"var(--f2)", fontSize:15 }}>{fd(fTot("grandTotal"),0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Commission + Dual summaries side by side */}
            <div className="g2" style={{ gap:14 }}>
              {/* Dual people */}
              <div className="card">
                <div className="ctit" style={{ color:"#ff8a65" }}>⚡ W2 → Contractor Transitions</div>
                {allPeople.filter(p => p.dual).map(p => (
                  <div key={p.name} style={{ padding:"10px 0", borderBottom:"1px solid var(--bd)" }}>
                    <div style={{ fontFamily:"var(--f2)", fontSize:14, fontWeight:800, marginBottom:4 }}>{p.name}</div>
                    <div style={{ display:"flex", gap:16, fontSize:11 }}>
                      <span><span style={{ color:"#4fc3f7" }}>W2:</span> {fd(p.w2Total,0)}</span>
                      <span><span style={{ color:"#f5c542" }}>1099:</span> {fd(p.conTotal,0)}</span>
                      <span style={{ color:"var(--or)", fontWeight:700 }}>Total: {fd(p.grandTotal,0)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Commission eligible */}
              <div className="card">
                <div className="ctit" style={{ color:"#f5c542" }}>💰 Commission-Eligible</div>
                {[
                  { name:"Elizabeth Delgado", w2comm:1702.76, concomm:1117.74 },
                  { name:"Christopher Simpson", w2comm:2698.46, concomm:1031.58 },
                  { name:"Mellody Abrego", w2comm:0, concomm:2033.21 },
                ].map(p => (
                  <div key={p.name} style={{ padding:"10px 0", borderBottom:"1px solid var(--bd)" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div style={{ fontSize:12, fontWeight:600 }}>{p.name}</div>
                      <div style={{ fontFamily:"var(--f2)", fontSize:20, fontWeight:900, color:"#f5c542" }}>{fd(p.w2comm+p.concomm,0)}</div>
                    </div>
                    <div style={{ fontSize:10, color:"var(--mu)" }}>
                      {p.w2comm > 0 && p.concomm > 0
                        ? `W2 ${fd(p.w2comm,0)} + 1099 ${fd(p.concomm,0)}`
                        : p.w2comm > 0 ? "W2 commission" : "1099 commission"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        );
      })()}

      {/* ── W2 OFFICE VIEW ── */}
      {view === "w2" && (
        <div className="card">
          <div className="ctit">W2 Office Employees — {fd(w2Total,0)} Total Cost</div>
          <div style={{ overflowX:"auto" }}>
            <table className="tbl" style={{ fontSize:11 }}>
              <thead>
                <tr>
                  <th style={{ textAlign:"left" }}>Name</th>
                  <th>Entity</th>
                  <th>Salary</th>
                  <th>Commission</th>
                  <th>Bonus</th>
                  <th>Gross Pay</th>
                  <th>Employer Tax</th>
                  <th>401K Match</th>
                  <th>Total Cost</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {[...OFFICE_W2].sort((a,b) => b.totalCost - a.totalCost).map((e,i) => (
                  <tr key={e.name+e.entity} style={{ background:i%2===0?"var(--s2)":"transparent" }}>
                    <td style={{ fontWeight:600 }}>
                      {e.name}
                      {e.dual && <span style={{ color:"#ff8a65", fontSize:9, marginLeft:4 }}>⚡ DUAL</span>}
                    </td>
                    <td style={{ color:"var(--mu)", fontSize:10 }}>{e.entity}</td>
                    <td style={{ color:"#4fc3f7" }}>{e.salary > 0 ? fd(e.salary,0) : "—"}</td>
                    <td style={{ color:e.commission > 0 ? "#f5c542" : "var(--mu)" }}>{e.commission > 0 ? fd(e.commission,0) : "—"}</td>
                    <td style={{ color:e.bonus > 0 ? "#3ddc84" : "var(--mu)" }}>{e.bonus > 0 ? fd(e.bonus,0) : "—"}</td>
                    <td style={{ color:"var(--tx)" }}>{fd(e.gross,0)}</td>
                    <td style={{ color:"#ff8a65" }}>{fd(e.taxes,0)}</td>
                    <td style={{ color:e.contrib > 0 ? "#b39ddb" : "var(--mu)" }}>{e.contrib > 0 ? fd(e.contrib,0) : "—"}</td>
                    <td style={{ color:"var(--or)", fontWeight:700 }}>{fd(e.totalCost,0)}</td>
                    <td style={{ fontSize:9, color:"var(--mu)", maxWidth:140 }}>{e.note}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>TOTAL — {OFFICE_W2.length}</td>
                  <td></td>
                  <td style={{ color:"#4fc3f7" }}>{fd(OFFICE_W2.reduce((s,e)=>s+e.salary,0),0)}</td>
                  <td style={{ color:"#f5c542" }}>{fd(commissionW2,0)}</td>
                  <td style={{ color:"#3ddc84" }}>{fd(OFFICE_W2.reduce((s,e)=>s+e.bonus,0),0)}</td>
                  <td>{fd(OFFICE_W2.reduce((s,e)=>s+e.gross,0),0)}</td>
                  <td style={{ color:"#ff8a65" }}>{fd(OFFICE_W2.reduce((s,e)=>s+e.taxes,0),0)}</td>
                  <td style={{ color:"#b39ddb" }}>{fd(OFFICE_W2.reduce((s,e)=>s+e.contrib,0),0)}</td>
                  <td style={{ color:"var(--or)", fontWeight:800 }}>{fd(w2Total,0)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── WAREHOUSE VIEW ── */}
      {view === "warehouse" && (
        <div className="card">
          <div className="ctit" style={{ color:"#3ddc84" }}>🏗️ Warehouse Staff — {fd(whTotal,0)} Total Cost</div>
          {WAREHOUSE.map((e,i) => (
            <div key={e.name} style={{
              display:"flex", justifyContent:"space-between", alignItems:"center",
              padding:"14px", marginBottom:i < WAREHOUSE.length-1 ? 10 : 0,
              background:"var(--bg)", border:"1px solid var(--bd)", borderRadius:3,
            }}>
              <div>
                <div style={{ fontFamily:"var(--f2)", fontSize:18, fontWeight:800, color:"#3ddc84" }}>{e.name}</div>
                <div style={{ display:"flex", gap:16, fontSize:11, color:"var(--mu)", marginTop:4 }}>
                  <span>{e.type}</span>
                  {e.hours > 0 && <span>{fn(e.hours,1)} hrs</span>}
                  {e.regHrs > 0 && <span>Reg {fn(e.regHrs,1)}</span>}
                  {e.otHrs > 0 && <span style={{ color:"#f5c542" }}>OT {fn(e.otHrs,1)}</span>}
                  <span>{e.note}</span>
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontFamily:"var(--f2)", fontSize:28, fontWeight:900, color:"#3ddc84" }}>{fd(e.totalCost,0)}</div>
                <div style={{ fontSize:10, color:"var(--mu)" }}>Gross {fd(e.gross,0)} + Tax {fd(e.taxes,0)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── CONTRACTORS VIEW ── */}
      {view === "contractors" && (
        <>
          <div className="ibox" style={{ marginBottom:14 }}>
            <strong style={{ color:"#f5c542" }}>1099 Contractors — paid via Chase/direct deposit.</strong>{" "}
            Commission-eligible: Elizabeth Delgado, Chris Simpson, Mellody Abrego.{" "}
            Car allowances: Jon Marcus $350/mo, Mellody $334.86/mo.{" "}
            Health ins (company paid): Mellody $368.34/wk, Hilda $118.82/wk, Deb $53.79/wk, Chris $53.79/wk.{" "}
            ⚡ = also has W2 history above.
          </div>
          <div className="card">
            <div className="ctit" style={{ color:"#f5c542" }}>Contractors — {fd(conTotal,0)} Total Paid</div>
            <div style={{ overflowX:"auto" }}>
              <table className="tbl" style={{ fontSize:11 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign:"left" }}>Name / DBA</th>
                    <th>Payments</th>
                    <th>Weekly Total</th>
                    <th>Car Allow.</th>
                    <th>Commission</th>
                    <th>Health Ins</th>
                    <th>Total Paid</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {[...CONTRACTORS].sort((a,b) => b.total - a.total).map((c,i) => (
                    <tr key={c.name} style={{ background:i%2===0?"var(--s2)":"transparent", opacity:c.total===0?0.5:1 }}>
                      <td>
                        <span style={{ fontWeight:600 }}>{c.name}</span>
                        {c.dual && <span style={{ color:"#ff8a65", fontSize:9, marginLeft:4 }}>⚡</span>}
                        {c.dba && <div style={{ fontSize:9, color:"var(--mu)" }}>DBA: {c.dba}</div>}
                      </td>
                      <td style={{ color:c.payments > 0 ? "var(--tx)" : "var(--mu)" }}>{c.payments || "—"}</td>
                      <td style={{ color:"#4fc3f7" }}>{c.weeklyTotal > 0 ? fd(c.weeklyTotal,0) : "—"}</td>
                      <td style={{ color:c.carTotal > 0 ? "#b39ddb" : "var(--mu)" }}>{c.carTotal > 0 ? fd(c.carTotal,0) : "—"}</td>
                      <td style={{ color:c.commission > 0 ? "#f5c542" : "var(--mu)" }}>{c.commission > 0 ? fd(c.commission,0) : "—"}</td>
                      <td style={{ color:c.healthInsTotal > 0 ? "#ff8a65" : "var(--mu)" }}>{c.healthInsTotal > 0 ? fd(c.healthInsTotal,0) : "—"}
                        {c.healthIns > 0 && <div style={{ fontSize:9,color:"var(--mu)" }}>${c.healthIns}/wk</div>}
                      </td>
                      <td style={{ color:c.total > 0 ? "var(--or)" : "var(--mu)", fontWeight:700 }}>{c.total > 0 ? fd(c.total,0) : "—"}</td>
                      <td style={{ fontSize:9, color:"var(--mu)", maxWidth:180 }}>{c.note}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>TOTAL — {CONTRACTORS.filter(c=>c.total>0).length} active</td>
                    <td>{CONTRACTORS.reduce((s,c)=>s+c.payments,0)}</td>
                    <td style={{ color:"#4fc3f7" }}>{fd(CONTRACTORS.reduce((s,c)=>s+c.weeklyTotal,0),0)}</td>
                    <td style={{ color:"#b39ddb" }}>{fd(carTotal,0)}</td>
                    <td style={{ color:"#f5c542" }}>{fd(commissionCon,0)}</td>
                    <td style={{ color:"#ff8a65" }}>{fd(healthInsTotal,0)}</td>
                    <td style={{ color:"var(--or)", fontWeight:800 }}>{fd(conTotal,0)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── CASH FLOW DASHBOARD ──────────────────────────────────────
const CASH_SNAPSHOTS = [
  {
    date: "Mar 23, 2026",
    weekLabel: "Week of Mar 23",
    accounts: [
      { name:"Capacity Express 1", last4:"1927", balance:38734.68, group:"Operating" },
      { name:"Show Freight Inc",   last4:"3028", balance:48795.80, group:"Operating" },
      { name:"Show Freight TN",    last4:"0870", balance:27792.12, group:"Operating" },
      { name:"J and A",            last4:"4842", balance:1335.71,  group:"Admin" },
      { name:"PLAT BUS CHECKING",  last4:"7165", balance:1063.88,  group:"Other" },
      { name:"PLAT BUS CHECKING",  last4:"7173", balance:41.63,    group:"Other" },
      { name:"Payroll",            last4:"0703", balance:1004.55,  group:"Payroll" },
      { name:"PLAT BUS CHECKING (CE East)", last4:"6053", balance:4907.63, group:"CE East" },
      { name:"DockIt LLC",         last4:"1508", balance:90.69,    group:"Other" },
      { name:"Nanas Pool Fencing", last4:"5623", balance:5.70,     group:"Other" },
      { name:"American Express Savings", last4:"—", balance:23271.07, group:"Savings" },
    ],
    // This week's payments (Mar 23-29)
    payments: [
      { day:"Sun 22", vendor:"NV Energy",              amount:615.00,   status:"paid",  cat:"Utilities" },
      { day:"Mon 23", vendor:"Ascend TMS",             amount:1085.00,  status:"due",   cat:"Software" },
      { day:"Mon 23", vendor:"Starlink",               amount:290.00,   status:"due",   cat:"Utilities" },
      { day:"Tue 24", vendor:"WEX (EFS)",              amount:15000.00, status:"due",   cat:"Fuel" },
      { day:"Wed 25", vendor:"TEC Equipment",          amount:28000.00, status:"due",   cat:"Truck Lease" },
      { day:"Wed 25", vendor:"Descartes",              amount:570.00,   status:"due",   cat:"Software" },
      { day:"Wed 25", vendor:"Colombia Payroll",       amount:1850.00,  status:"due",   cat:"CE East" },
      { day:"Wed 25", vendor:"DAT Solutions",          amount:2280.00,  status:"due",   cat:"Software" },
      { day:"Wed 25", vendor:"Lendr",                  amount:2658.73,  status:"due",   cat:"Loan" },
      { day:"Fri 27", vendor:"Office Payroll",         amount:30000.00, status:"due",   cat:"Payroll" },
      { day:"Fri 27", vendor:"Driver Payroll",         amount:50000.00, status:"due",   cat:"Payroll" },
      { day:"Fri 27", vendor:"CloneOps",               amount:500.00,   status:"due",   cat:"Software" },
      { day:"Fri 27", vendor:"WEX (fuel)",             amount:4000.00,  status:"due",   cat:"Fuel" },
      { day:"Sat 28", vendor:"NIS General Liability",  amount:427.00,   status:"due",   cat:"Insurance" },
      { day:"Sat 28", vendor:"Carrier Risk Solutions",  amount:1000.00,  status:"due",   cat:"Insurance" },
      { day:"Sat 28", vendor:"Motorola",               amount:2199.50,  status:"due",   cat:"Equipment" },
    ],
  },
];

function CashFlowDashboard() {
  const [liveData, setLiveData] = useState(null);
  const [fetchStatus, setFetchStatus] = useState("idle"); // idle | loading | ok | error

  // Live data: Supabase-backed (queries the budget-calendar w_* tables for
  // this week's recurring + one-time expenses). Replaces the old GitHub
  // raw fetch of current-week.json that fell out of practice.
  useEffect(() => {
    setFetchStatus("loading");
    fetch("/api/cash-flow")
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(data => { setLiveData(data); setFetchStatus("ok"); })
      .catch(() => setFetchStatus("error"));
  }, []);

  // Use live data if available, fallback to hardcoded
  const snapshot = liveData ? {
    date: liveData.week || CASH_SNAPSHOTS[0].date,
    weekLabel: liveData.week || CASH_SNAPSHOTS[0].weekLabel,
    accounts: liveData.accounts || CASH_SNAPSHOTS[0].accounts,
    payments: liveData.payments || CASH_SNAPSHOTS[0].payments,
  } : CASH_SNAPSHOTS[CASH_SNAPSHOTS.length - 1];

  const latest = snapshot;
  const accts = latest.accounts;
  const totalCash = accts.reduce((s,a) => s + a.balance, 0);

  // Group totals
  const groups = {};
  accts.forEach(a => {
    groups[a.group] = (groups[a.group] || 0) + a.balance;
  });
  const operating = groups["Operating"] || 0;
  const ceEast = groups["CE East"] || 0;
  const admin = (groups["Admin"] || 0) + (groups["Payroll"] || 0) + (groups["Other"] || 0);

  // Weekly known obligations (estimates)
  const weeklyPayroll = LABOR / 12; // ~12 weeks in period
  const weeklyFuel = FUEL_TOT / 12;
  const weeklyCarrier = INCOME_2026.carrierPay / 12;
  const weeklyLease = (TRUCK_TOT + TRAILER_TOT) / 12;

  const groupColor = g => g === "Operating" ? "#3ddc84" : g === "CE East" ? "#4fc3f7" : g === "Admin" ? "#f5c542" : g === "Payroll" ? "#ff8a65" : g === "Savings" ? "#b39ddb" : "#5a6370";

  // This week's payments
  const payments = latest.payments || [];
  const totalDue = payments.filter(p => p.status === "due").reduce((s,p) => s + p.amount, 0);
  const totalPaid = payments.filter(p => p.status === "paid").reduce((s,p) => s + p.amount, 0);
  const totalPayments = totalDue + totalPaid;
  const cashAfter = totalCash - totalDue;
  const cashIsRed = cashAfter < 10000;

  // Group payments by day
  const payDays = {};
  payments.forEach(p => {
    if (!payDays[p.day]) payDays[p.day] = [];
    payDays[p.day].push(p);
  });

  const catColor = c => c === "Payroll" ? "#f47820" : c === "Fuel" ? "#f5c542" : c === "Truck Lease" ? "#4fc3f7" :
    c === "Software" ? "#b39ddb" : c === "Insurance" ? "#3ddc84" : c === "Utilities" ? "#26a69a" :
    c === "CE East" ? "#4fc3f7" : c === "Loan" ? "#ff5252" : c === "Equipment" ? "#ff8a65" : "#5a6370";

  return (
    <div>
      <div className="ptitle">Cash Flow</div>
      <div className="psub">
        Weekly bank snapshot · Monday morning balances · {latest.date || latest.weekLabel}
        {fetchStatus === "ok" && <span style={{ color:"#3ddc84",marginLeft:8,fontSize:10 }}>● Live from budget calendar (Supabase)</span>}
        {fetchStatus === "error" && <span style={{ color:"#f5c542",marginLeft:8,fontSize:10 }}>● Using built-in data (Supabase fetch failed)</span>}
        {fetchStatus === "loading" && <span style={{ color:"var(--mu)",marginLeft:8,fontSize:10 }}>● Loading...</span>}
      </div>

      {/* Cash hero */}
      <div style={{
        background:"linear-gradient(135deg,#0f1f12,#0a1508)",
        border:"2px solid #3ddc84", borderRadius:6, padding:"28px 32px",
        marginBottom:14, textAlign:"center", position:"relative", overflow:"hidden",
      }}>
        <div style={{ position:"absolute",inset:0,opacity:.03,
          backgroundImage:"repeating-linear-gradient(0deg,#3ddc84 0px,#3ddc84 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,#3ddc84 0px,#3ddc84 1px,transparent 1px,transparent 40px)" }} />
        <div style={{ fontSize:9,letterSpacing:4,textTransform:"uppercase",color:"#3ddc84",marginBottom:8,position:"relative" }}>Total Available Cash</div>
        <div style={{ fontFamily:"var(--f2)",fontSize:64,fontWeight:900,color:"#3ddc84",lineHeight:1,position:"relative" }}>{fd(totalCash,0)}</div>
        <div style={{ fontSize:12,color:"var(--mu)",marginTop:10,position:"relative" }}>
          {accts.length} accounts · {latest.date || latest.weekLabel} · excludes personal
        </div>
      </div>

      {/* Group breakdown */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:14,marginBottom:14 }}>
        <div className="kpi">
          <div className="klbl">Operating</div>
          <div className="kval" style={{ color:"#3ddc84" }}>{fd(operating,0)}</div>
          <div className="ksub">CE1 + SF + SF TN · {fp(operating/totalCash*100)} of total</div>
        </div>
        <div className="kpi">
          <div className="klbl">CE East</div>
          <div className="kval" style={{ color:"#4fc3f7" }}>{fd(ceEast,0)}</div>
          <div className="ksub">PLAT BUS 6053 · {fp(ceEast/totalCash*100)}</div>
        </div>
        <div className="kpi">
          <div className="klbl">Admin / Payroll / Other</div>
          <div className="kval" style={{ color:"#f5c542" }}>{fd(admin,0)}</div>
          <div className="ksub">J&A + Payroll + misc</div>
        </div>
        <div className="kpi">
          <div className="klbl">Savings (Amex)</div>
          <div className="kval" style={{ color:"#b39ddb" }}>{fd(groups["Savings"]||0,0)}</div>
          <div className="ksub">Reserve · not in daily ops</div>
        </div>
      </div>

      {/* Cash after payments warning */}
      {payments.length > 0 && (
        <div style={{
          background:cashIsRed ? "rgba(255,82,82,.1)" : "rgba(245,197,66,.08)",
          border:`2px solid ${cashIsRed ? "rgba(255,82,82,.5)" : "rgba(245,197,66,.3)"}`,
          borderRadius:6, padding:"20px 24px", marginBottom:14,
        }}>
          <div style={{ display:"grid",gridTemplateColumns:"1fr auto 1fr auto 1fr",gap:16,alignItems:"center" }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:9,color:"#3ddc84",letterSpacing:2,textTransform:"uppercase",marginBottom:4 }}>Cash Available</div>
              <div style={{ fontFamily:"var(--f2)",fontSize:32,fontWeight:900,color:"#3ddc84" }}>{fd(totalCash,0)}</div>
            </div>
            <div style={{ fontFamily:"var(--f2)",fontSize:24,color:"var(--mu)" }}>−</div>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:9,color:"#ff5252",letterSpacing:2,textTransform:"uppercase",marginBottom:4 }}>Due This Week</div>
              <div style={{ fontFamily:"var(--f2)",fontSize:32,fontWeight:900,color:"#ff5252" }}>{fd(totalDue,0)}</div>
            </div>
            <div style={{ fontFamily:"var(--f2)",fontSize:24,color:"var(--mu)" }}>=</div>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:9,color:cashIsRed?"#ff5252":"#f5c542",letterSpacing:2,textTransform:"uppercase",marginBottom:4 }}>
                {cashIsRed ? "⚠️ Remaining After" : "Remaining After"}
              </div>
              <div style={{ fontFamily:"var(--f2)",fontSize:32,fontWeight:900,color:cashIsRed?"#ff5252":"#f5c542" }}>{fd(cashAfter,0)}</div>
            </div>
          </div>
          {cashIsRed && (
            <div style={{ textAlign:"center",marginTop:10,fontSize:12,color:"#ff5252",fontWeight:700 }}>
              ⚠️ Cash will be tight after this week's obligations — ensure funding comes in before Friday payroll
            </div>
          )}
        </div>
      )}

      {/* Day-by-day payment schedule */}
      {payments.length > 0 && (
        <div className="card" style={{ marginBottom:14 }}>
          <div className="ctit">This Week's Payments — {fd(totalPayments,0)} total ({fd(totalPaid,0)} paid · {fd(totalDue,0)} due)</div>
          <div style={{ overflowX:"auto" }}>
            <table className="tbl" style={{ fontSize:11 }}>
              <thead>
                <tr>
                  <th>Day</th>
                  <th style={{ textAlign:"left" }}>Vendor</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p,i) => (
                  <tr key={p.vendor+i} style={{ background:i%2===0?"var(--s2)":"transparent", opacity:p.status==="paid"?0.5:1 }}>
                    <td style={{ fontWeight:600,fontSize:10 }}>{p.day}</td>
                    <td style={{ textAlign:"left",fontWeight:600 }}>{p.vendor}</td>
                    <td><span style={{ fontSize:9,fontWeight:700,color:catColor(p.cat),background:`${catColor(p.cat)}15`,border:`1px solid ${catColor(p.cat)}40`,borderRadius:2,padding:"1px 6px" }}>{p.cat}</span></td>
                    <td style={{ fontFamily:"var(--f2)",fontSize:13,fontWeight:700,color:p.amount >= 10000 ? "#ff5252" : p.amount >= 2000 ? "#f5c542" : "var(--tx)" }}>{fd(p.amount,2)}</td>
                    <td><span style={{ fontSize:9,fontWeight:700,color:p.status==="paid"?"#3ddc84":"#f5c542",background:p.status==="paid"?"rgba(61,220,132,.1)":"rgba(245,197,66,.1)",border:`1px solid ${p.status==="paid"?"rgba(61,220,132,.3)":"rgba(245,197,66,.3)"}`,borderRadius:2,padding:"1px 6px" }}>{p.status==="paid"?"✓ Paid":"Due"}</span></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>TOTAL DUE</td>
                  <td style={{ fontFamily:"var(--f2)",fontSize:16,fontWeight:900,color:"#ff5252" }}>{fd(totalDue,2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Daily totals bar */}
          <div style={{ marginTop:14 }}>
            <div style={{ fontSize:10,color:"var(--mu)",letterSpacing:2,textTransform:"uppercase",marginBottom:8 }}>Daily Outflow</div>
            {Object.entries(payDays).map(([day, items]) => {
              const dayTotal = items.reduce((s,p) => s+p.amount, 0);
              const pct = dayTotal / totalPayments * 100;
              const allPaid = items.every(p => p.status === "paid");
              return (
                <div key={day} style={{ display:"flex",alignItems:"center",gap:10,marginBottom:6 }}>
                  <div style={{ width:60,fontSize:11,fontWeight:600,color:allPaid?"var(--mu)":"var(--tx)" }}>{day}</div>
                  <div style={{ flex:1 }}>
                    <div className="bar" style={{ height:20 }}>
                      <div className="bfil" style={{ width:`${pct}%`,background:allPaid?"var(--mu)":dayTotal>=25000?"#ff5252":dayTotal>=5000?"#f5c542":"#3ddc84",display:"flex",alignItems:"center",paddingLeft:6 }}>
                        {pct > 12 && <span style={{ fontSize:9,color:"#fff",fontWeight:700 }}>{fd(dayTotal,0)}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ width:70,textAlign:"right",fontFamily:"var(--f2)",fontSize:12,fontWeight:700,color:allPaid?"var(--mu)":"var(--tx)" }}>{fd(dayTotal,0)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="g2" style={{ gap:14, marginBottom:14 }}>
        {/* Account detail */}
        <div className="card">
          <div className="ctit">Account Balances — {latest.date || latest.weekLabel}</div>
          <table className="tbl" style={{ fontSize:11 }}>
            <thead>
              <tr><th style={{ textAlign:"left" }}>Account</th><th>Last 4</th><th>Group</th><th>Balance</th></tr>
            </thead>
            <tbody>
              {[...accts].sort((a,b) => b.balance - a.balance).map((a,i) => (
                <tr key={a.last4} style={{ background:i%2===0?"var(--s2)":"transparent" }}>
                  <td style={{ fontWeight:600 }}>{a.name}</td>
                  <td style={{ color:"var(--mu)",fontFamily:"var(--f2)" }}>...{a.last4}</td>
                  <td><span style={{ fontSize:9,fontWeight:700,color:groupColor(a.group),background:`${groupColor(a.group)}15`,border:`1px solid ${groupColor(a.group)}40`,borderRadius:2,padding:"1px 6px" }}>{a.group}</span></td>
                  <td style={{ fontFamily:"var(--f2)",fontSize:14,fontWeight:700,color:groupColor(a.group) }}>{fd(a.balance,2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Total</td>
                <td style={{ fontFamily:"var(--f2)",fontSize:16,fontWeight:900,color:"#3ddc84" }}>{fd(totalCash,2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Weekly burn estimate */}
        <div className="card">
          <div className="ctit">Estimated Weekly Obligations</div>
          <div style={{ fontSize:10,color:"var(--mu)",marginBottom:10 }}>Based on YTD averages over 12 weeks</div>
          {[
            { label:"Driver Payroll", val:weeklyPayroll, color:"#f47820" },
            { label:"Fuel (EFS + Mudflap)", val:weeklyFuel, color:"#f5c542" },
            { label:"Carrier Pay", val:weeklyCarrier, color:"#ff5252" },
            { label:"Truck + Trailer Leases", val:weeklyLease, color:"#4fc3f7" },
          ].map(item => (
            <div key={item.label} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid var(--bd)" }}>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                <div style={{ width:8,height:8,borderRadius:2,background:item.color,flexShrink:0 }} />
                <span style={{ fontSize:12,color:"var(--tx)" }}>{item.label}</span>
              </div>
              <span style={{ fontFamily:"var(--f2)",fontSize:14,fontWeight:700,color:item.color }}>{fd(item.val,0)}/wk</span>
            </div>
          ))}
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:12 }}>
            <span style={{ fontFamily:"var(--f2)",fontSize:12,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"var(--or)" }}>Total Weekly Burn</span>
            <span style={{ fontFamily:"var(--f2)",fontSize:20,fontWeight:900,color:"var(--or)" }}>{fd(weeklyPayroll+weeklyFuel+weeklyCarrier+weeklyLease,0)}/wk</span>
          </div>

          {/* Coverage indicator */}
          <div style={{ marginTop:14,padding:"16px",background:"rgba(61,220,132,.08)",border:"1px solid rgba(61,220,132,.2)",borderRadius:3,textAlign:"center" }}>
            <div style={{ fontSize:9,color:"#3ddc84",letterSpacing:2,textTransform:"uppercase",marginBottom:4 }}>Cash Runway</div>
            <div style={{ fontFamily:"var(--f2)",fontSize:36,fontWeight:900,color:"#3ddc84" }}>
              {(totalCash / (weeklyPayroll + weeklyFuel + weeklyLease)).toFixed(1)} weeks
            </div>
            <div style={{ fontSize:10,color:"var(--mu)",marginTop:4 }}>
              at current burn rate (excl carrier pay which is funded by revenue)
            </div>
          </div>
        </div>
      </div>

      {/* Historical snapshots */}
      {CASH_SNAPSHOTS.length > 1 && (
        <div className="card">
          <div className="ctit">Weekly Cash Trend</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={CASH_SNAPSHOTS.map(s => ({
              week: s.weekLabel,
              total: s.accounts.reduce((sum,a) => sum + a.balance, 0),
            }))} margin={{ top:8,right:10,left:10,bottom:5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" />
              <XAxis dataKey="week" tick={{ fill:"var(--mu)",fontSize:10 }} />
              <YAxis tick={{ fill:"var(--mu)",fontSize:9 }} tickFormatter={v=>"$"+Math.round(v/1000)+"k"} />
              <Tooltip content={<CustomTip />} />
              <Bar dataKey="total" name="Total Cash" fill="#3ddc84" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="ibox" style={{ marginTop:14 }}>
        <strong style={{ color:"#4fc3f7" }}>Live sync enabled:</strong> Scheduled payments pull from the budget-calendar's Supabase tables (<span style={{ color:"#3ddc84" }}>w_custom_recurring + w_one_time_expenses</span>) via <span style={{ color:"#3ddc84" }}>/api/cash-flow</span>.
        Update payments + paid/unpaid status in the budget calendar app — FreightIQ picks it up on next page load. Bank account balances are still hardcoded (no calendar table tracks them); fall back to built-in if Supabase is unreachable.
      </div>
    </div>
  );
}


// ── ATL OPERATIONS ────────────────────────────────────────────
// Atlanta operations launched May 4, 2026. ATL is tracked via the
// per-week ATL_WEEKLY_LOG array — roster + contribution numbers per
// week, since drivers/contractors can be ATL one week and not the next.
// There are no sticky entity:"ATL" tags on PAYROLL/FUEL/CONTRACTORS.
function ArDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [view, setView] = useState("detail"); // detail | customer
  useEffect(() => {
    setLoading(true); setErr(null);
    fetch("/api/alvys-ar").then(r => r.json())
      .then(d => { if (d.error) setErr(d.error); else setData(d); })
      .catch(e => setErr(e.message)).finally(() => setLoading(false));
  }, []);
  const ageColor = d => d == null ? "#4fc3f7" : d <= 7 ? "#3ddc84" : d <= 14 ? "#f5c542" : d <= 30 ? "#ff8a65" : "#ff5252";
  const stColor = s => s === "Invoiced" ? "#f5c542" : s === "Delivered" ? "#3ddc84" : "#4fc3f7";
  const exportXlsx = () => {
    const src = (data && data.allRows) || [];
    const sheet = src.map(r => ({
      "Load #": r.loadNumber, "Order #": r.orderNumber, "PO #": r.po, "Ref #": r.ref,
      "Customer": r.customer, "Status": r.status, "Invoice As": r.invoiceAs,
      "Origin": r.origin, "Destination": r.destination,
      "Picked Up": r.pickedUpAt ? r.pickedUpAt.slice(0,10) : "",
      "Delivered": r.deliveredAt ? r.deliveredAt.slice(0,10) : "",
      "Invoiced": r.invoicedAt ? r.invoicedAt.slice(0,10) : "",
      "Invoice $": r.invoice, "Paid $": r.paid, "Balance $": r.balance,
      "Days Since Delivery": r.daysSinceDelivery, "Days Since Invoice": r.daysSinceInvoice,
    }));
    const ws = XLSX.utils.json_to_sheet(sheet);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "AR Report");
    XLSX.writeFile(wb, `Alvys_AR_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div>
      <div className="ptitle">📋 Accounts Receivable</div>
      <div className="psub">Live from Alvys · open delivered/invoiced/in-transit loads with outstanding balance{data ? ` · as of ${new Date(data.fetchedAt).toLocaleString()}` : ""}</div>

      {loading && <div className="card" style={{ padding:20 }}>Loading A/R from Alvys…</div>}
      {err && <div className="card" style={{ padding:16, color:"#ff5252" }}>⚠ Alvys A/R fetch failed: {err}</div>}

      {data && (<>
        <div className="g4" style={{ marginBottom:14 }}>
          <div className="kpi" style={{ borderTop:"3px solid #f47820" }}>
            <div className="klbl">Total A/R</div>
            <div className="kval" style={{ color:"#f47820" }}>{fd(data.totalAR, 0)}</div>
            <div className="ksub">{data.count} open invoices · avg {data.avgDaysSinceDelivery}d</div>
          </div>
          {["In Transit","Delivered","Invoiced"].map(s => (
            <div key={s} className="kpi" style={{ borderTop:`3px solid ${stColor(s)}` }}>
              <div className="klbl">{s}</div>
              <div className="kval" style={{ color:stColor(s) }}>{fd((data.byStatus[s] && data.byStatus[s].balance) || 0, 0)}</div>
              <div className="ksub">{(data.byStatus[s] && data.byStatus[s].loads) || 0} loads</div>
            </div>
          ))}
        </div>

        <div className="card" style={{ marginBottom:14 }}>
          <div className="ctit">Aging — by days since delivery</div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginTop:8 }}>
            {Object.entries(data.aging).map(([k,v]) => (
              <div key={k} style={{ flex:"1 1 120px", padding:"10px 12px", background:"var(--s2)", borderRadius:4, borderLeft:`3px solid ${k==="undelivered"?"#4fc3f7":k==="31+"?"#ff5252":k==="15-30"?"#ff8a65":k==="8-14"?"#f5c542":"#3ddc84"}` }}>
                <div style={{ fontSize:10, color:"var(--mu)", textTransform:"uppercase" }}>{k==="undelivered"?"In transit":k+" days"}</div>
                <div style={{ fontFamily:"var(--f3,Consolas,monospace)", fontWeight:700, fontSize:15 }}>{fd(v,0)}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize:10, color:"var(--mu)", marginTop:8 }}>{data.note}</div>
        </div>

        <div style={{ display:"flex", gap:8, marginBottom:12, alignItems:"center" }}>
          {[["detail","📄 Detail ("+data.count+")"],["customer","🏢 By Customer ("+data.byCustomer.length+")"]].map(([id,lbl]) => (
            <button key={id} onClick={() => setView(id)} style={{ padding:"7px 16px", borderRadius:3, cursor:"pointer", fontFamily:"var(--f2)", fontSize:12, fontWeight:700, letterSpacing:1, textTransform:"uppercase", background:view===id?"var(--or)":"transparent", color:view===id?"#fff":"var(--mu)", border:`1px solid ${view===id?"var(--or)":"var(--bd)"}` }}>{lbl}</button>
          ))}
          <button onClick={exportXlsx} style={{ marginLeft:"auto", padding:"7px 16px", borderRadius:3, cursor:"pointer", fontFamily:"var(--f2)", fontSize:12, fontWeight:700, letterSpacing:1, textTransform:"uppercase", background:"#3ddc84", color:"#0b0d10", border:"1px solid #3ddc84" }}>⬇ Download Excel</button>
          <span style={{ fontSize:10, color:"var(--mu)" }}>{(data.allRows||[]).length} loads (excl. queued/released/completed)</span>
        </div>

        {view === "customer" && (
          <div className="card" style={{ padding:0, overflowX:"auto" }}>
            <table className="tbl" style={{ fontSize:13, minWidth:560 }}>
              <thead><tr>
                <th style={{ textAlign:"left", fontSize:10 }}>Customer</th>
                <th style={{ fontSize:10 }}>Loads</th><th style={{ fontSize:10 }}>Balance</th><th style={{ fontSize:10 }}>Oldest (days)</th>
              </tr></thead>
              <tbody>
                {data.byCustomer.map((c,i) => (
                  <tr key={c.customer} style={{ background:i%2?"transparent":"var(--s2)" }}>
                    <td style={{ padding:"9px", fontWeight:600 }}>{c.customer}</td>
                    <td style={{ padding:"9px", textAlign:"center", color:"var(--mu)" }}>{c.loads}</td>
                    <td style={{ padding:"9px", textAlign:"right", fontVariantNumeric:"tabular-nums", fontWeight:700, color:"#f47820" }}>{fd(c.balance,0)}</td>
                    <td style={{ padding:"9px", textAlign:"right", fontVariantNumeric:"tabular-nums", color:ageColor(c.oldest) }}>{c.oldest}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === "detail" && (
          <div className="card" style={{ padding:0, overflowX:"auto" }}>
            <table className="tbl" style={{ fontSize:12, minWidth:920 }}>
              <thead><tr>
                {["Load #","Customer","Status","Lane","Delivered","Days","Invoice","Paid","Balance"].map((h,i) => (
                  <th key={h} style={{ fontSize:10, textAlign:i<4?"left":"right", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {data.rows.map((r,i) => (
                  <tr key={r.loadNumber+"-"+i} style={{ background:i%2?"transparent":"var(--s2)" }}>
                    <td style={{ padding:"8px 9px", fontWeight:600, whiteSpace:"nowrap" }}>{r.loadNumber}</td>
                    <td style={{ padding:"8px 9px" }}>{r.customer}</td>
                    <td style={{ padding:"8px 9px", color:stColor(r.status), fontWeight:600, whiteSpace:"nowrap" }}>{r.status}</td>
                    <td style={{ padding:"8px 9px", color:"var(--mu)", fontSize:11, whiteSpace:"nowrap" }}>{r.origin} → {r.destination}</td>
                    <td style={{ padding:"8px 9px", color:"var(--mu)", fontSize:11, whiteSpace:"nowrap" }}>{r.deliveredAt ? r.deliveredAt.slice(0,10) : "—"}</td>
                    <td style={{ padding:"8px 9px", textAlign:"right", fontVariantNumeric:"tabular-nums", color:ageColor(r.daysSinceDelivery), fontWeight:700 }}>{r.daysSinceDelivery==null?"—":r.daysSinceDelivery}</td>
                    <td style={{ padding:"8px 9px", textAlign:"right", fontVariantNumeric:"tabular-nums" }}>{fd(r.invoice,0)}</td>
                    <td style={{ padding:"8px 9px", textAlign:"right", fontVariantNumeric:"tabular-nums", color:r.paid>0?"#3ddc84":"var(--mu)" }}>{r.paid>0?fd(r.paid,0):"—"}</td>
                    <td style={{ padding:"8px 9px", textAlign:"right", fontVariantNumeric:"tabular-nums", fontWeight:700, color:"#f47820" }}>{fd(r.balance,0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr>
                <td colSpan={8} style={{ padding:"10px 9px", fontWeight:700 }}>TOTAL · {data.count} open invoices</td>
                <td style={{ padding:"10px 9px", textAlign:"right", fontWeight:900, color:"#f47820" }}>{fd(data.totalAR,0)}</td>
              </tr></tfoot>
            </table>
          </div>
        )}
      </>)}
    </div>
  );
}

function OtrOperations() {
  const cum = otrSum();
  const milesEst = cum.fuelGallons * 6.5;
  const allIn = cum.driverPay + cum.fuelAmt + cum.contractorPay;
  const drivers = Array.from(new Set(OTR_WEEKLY_LOG.flatMap(w => w.drivers || [])));
  return (
    <div>
      <div className="ptitle">🛣️ OTR Operations</div>
      <div className="psub">
        Over-the-road drivers · separate operation · {OTR_WEEKLY_LOG.length} week{OTR_WEEKLY_LOG.length===1?"":"s"} logged · {drivers.length} drivers · <b style={{color:"var(--or)"}}>excluded from fleet CPM</b> (own calcs TBD)
      </div>

      <div className="g4" style={{ marginBottom:14 }}>
        <div className="kpi" style={{ borderTop:"3px solid #f47820" }}>
          <div className="klbl">OTR Driver Labor</div>
          <div className="kval" style={{ color:"#f47820" }}>{fd(cum.driverPay, 0)}</div>
          <div className="ksub">{fn(cum.driverHours, 0)} hrs · {cum.weeks} week{cum.weeks===1?"":"s"}</div>
        </div>
        <div className="kpi" style={{ borderTop:"3px solid #ff8a65" }}>
          <div className="klbl">OTR Fuel</div>
          <div className="kval" style={{ color:"#ff8a65" }}>{fd(cum.fuelAmt, 0)}</div>
          <div className="ksub">{fn(cum.fuelGallons, 0)} gal · {cum.fuelGallons>0?fd(cum.fuelAmt/cum.fuelGallons,3):"—"}/gal avg</div>
        </div>
        <div className="kpi" style={{ borderTop:"3px solid #3ddc84" }}>
          <div className="klbl">OTR All-In Labor + Fuel</div>
          <div className="kval" style={{ color:"#3ddc84" }}>{fd(allIn, 0)}</div>
          <div className="ksub">{fn(milesEst, 0)} mi est (gal×6.5)</div>
        </div>
        <div className="kpi" style={{ borderTop:"3px solid #4fc3f7" }}>
          <div className="klbl">OTR Drivers</div>
          <div className="kval" style={{ color:"#4fc3f7" }}>{drivers.length}</div>
          <div className="ksub">{drivers.map(n=>n.split(" ")[0]).join(", ") || "—"}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom:14 }}>
        <div className="ctit" style={{ fontSize:13 }}>Per-week OTR roster + cost</div>
        <table className="tbl" style={{ fontSize:13 }}>
          <thead>
            <tr>
              <th style={{ textAlign:"left", fontSize:10 }}>Week</th>
              <th style={{ textAlign:"left", fontSize:10 }}>Drivers</th>
              <th style={{ fontSize:10 }}>Driver Pay</th>
              <th style={{ fontSize:10 }}>Hours</th>
              <th style={{ fontSize:10 }}>Fuel</th>
              <th style={{ fontSize:10 }}>Week Total</th>
            </tr>
          </thead>
          <tbody>
            {[...OTR_WEEKLY_LOG].reverse().map((w, i) => (
              <tr key={w.weekStart} style={{ background:i%2===0?"var(--s2)":"transparent" }}>
                <td style={{ padding:"10px 9px", borderLeft:"4px solid #f47820", fontWeight:600, whiteSpace:"nowrap" }}>{w.weekStart.slice(5)} – {w.weekEnd.slice(5)}</td>
                <td style={{ padding:"10px 9px", color:"#9aa4b3", fontSize:11 }}>{(w.drivers||[]).map(n=>n.split(" ")[0]+" "+(n.split(" ")[1]||"")).join(", ")}</td>
                <td style={{ padding:"10px 9px", fontVariantNumeric:"tabular-nums", color:"#f47820", fontWeight:700 }}>{fd(w.driverPay, 0)}</td>
                <td style={{ padding:"10px 9px", fontVariantNumeric:"tabular-nums", color:"#9aa4b3" }}>{fn(w.driverHours, 0)}</td>
                <td style={{ padding:"10px 9px", fontVariantNumeric:"tabular-nums", color:"#ff8a65" }}>{fd(w.fuelAmt, 0)}</td>
                <td style={{ padding:"10px 9px", fontVariantNumeric:"tabular-nums", fontWeight:700, color:"#3ddc84" }}>{fd((w.driverPay||0)+(w.fuelAmt||0)+(w.contractorPay||0), 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize:11, color:"var(--mu)", marginTop:8 }}>
          Source: <code>OTR_WEEKLY_LOG</code>. OTR drivers are carved out of PAYROLL/FUEL and the fleet CPM (LABOR/FUEL_TOT exclude them). Per-week deltas computed from PAYROLL/FUEL YTD each drop. OTR-specific CPM / revenue calcs TBD.
        </div>
      </div>
    </div>
  );
}

function AtlOperations() {
  const cum = atlSum();
  const atlMilesEst = cum.fuelGallons * 6.5;
  const allInLaborFuel = cum.driverPay + cum.fuelAmt + cum.contractorPay;
  const allInCpm = atlMilesEst > 0 ? allInLaborFuel / atlMilesEst : null;

  // Collect unique driver names across all weeks (for the roster summary).
  // Agents (Kevin) are not part of ATL — they're a separate bucket entirely.
  const allDriverNames = Array.from(new Set(ATL_WEEKLY_LOG.flatMap(w => w.drivers || [])));
  const allContractorNames = Array.from(new Set(ATL_WEEKLY_LOG.flatMap(w => (w.contractors || []).map(c => c.name))));

  // TODO (when QBO class tagging is consistent across all ATL transactions):
  // re-enable the live QB class P&L block. The /api/qbo-pnl?class=ATL endpoint
  // is still wired (uses the correct `class` filter param — see
  // reference_qbo_class_filter memory). The block was removed because the
  // Atlanta Billing XLSX (ATL_BILLING constant) is the current source of
  // truth and the QBO class data was only partial.

  return (
    <div>
      <div className="ptitle">🍑 ATL Operations</div>
      <div className="psub">
        Atlanta operations · launched May 4, 2026 · {ATL_WEEKLY_LOG.length} weeks logged · {allDriverNames.length} unique drivers · {allContractorNames.length} unique contractor{allContractorNames.length===1?"":"s"}
      </div>

      {/* ATL Billing — load-level revenue (source: 2026-Atlanta Billing.xlsx, refreshed weekly) */}
      <div className="g4" style={{ marginBottom:14 }}>
        <div className="kpi" style={{ borderTop:"3px solid #3ddc84" }}>
          <div className="klbl">ATL Revenue</div>
          <div className="kval" style={{ color:"#3ddc84" }}>{fd(ATL_BILLING.revenue, 0)}</div>
          <div className="ksub">{ATL_BILLING.loads} loads · as of {ATL_BILLING.asOf}</div>
        </div>
        <div className="kpi" style={{ borderTop:"3px solid #ff5252" }}>
          <div className="klbl">ATL Carrier Pay (COGS)</div>
          <div className="kval" style={{ color:"#ff5252" }}>{fd(ATL_BILLING.carrierPay, 0)}</div>
          <div className="ksub">{fp(ATL_BILLING.carrierPay / ATL_BILLING.revenue * 100)} of revenue</div>
        </div>
        <div className="kpi" style={{ borderTop:"3px solid #4fc3f7" }}>
          <div className="klbl">ATL Gross Profit</div>
          <div className="kval" style={{ color:"#4fc3f7" }}>{fd(ATL_BILLING.grossProfit, 0)}</div>
          <div className="ksub">{fp(ATL_BILLING.grossMargin)} margin</div>
        </div>
        <div className="kpi" style={{ borderTop:"3px solid #fbbf24" }}>
          <div className="klbl">Avg Revenue / Load</div>
          <div className="kval" style={{ color:"#fbbf24" }}>{fd(ATL_BILLING.revenue / ATL_BILLING.loads, 0)}</div>
          <div className="ksub">avg carrier {fd(ATL_BILLING.carrierPay / ATL_BILLING.loads, 0)} · avg GP {fd(ATL_BILLING.grossProfit / ATL_BILLING.loads, 0)}</div>
        </div>
      </div>

      {/* Operational KPIs (cumulative across all logged ATL weeks) */}
      <div className="g4" style={{ marginBottom:14 }}>
        <div className="kpi" style={{ borderTop:"3px solid #f47820" }}>
          <div className="klbl">ATL Driver Labor</div>
          <div className="kval" style={{ color:"#f47820" }}>{fd(cum.driverPay, 0)}</div>
          <div className="ksub">{fn(cum.driverHours, 0)} hrs · {cum.weeks} weeks</div>
        </div>
        <div className="kpi" style={{ borderTop:"3px solid #f5c542" }}>
          <div className="klbl">ATL Contractors</div>
          <div className="kval" style={{ color:"#fbbf24" }}>{fd(cum.contractorPay, 0)}</div>
          <div className="ksub">{allContractorNames.map(n => n.split(" ")[0]).join(", ") || "—"}</div>
        </div>
        <div className="kpi" style={{ borderTop:"3px solid #ff8a65" }}>
          <div className="klbl">ATL Fuel</div>
          <div className="kval" style={{ color:"#ff8a65" }}>{fd(cum.fuelAmt, 0)}</div>
          <div className="ksub">{fn(cum.fuelGallons, 0)} gal · {cum.fuelGallons>0?fd(cum.fuelAmt/cum.fuelGallons,3):"—"}/gal avg</div>
        </div>
        <div className="kpi" style={{ borderTop:"3px solid #3ddc84" }}>
          <div className="klbl">ATL All-In Labor + Fuel</div>
          <div className="kval" style={{ color:"#3ddc84" }}>{fd(allInLaborFuel, 0)}</div>
          <div className="ksub">{fn(atlMilesEst, 0)} mi est · {allInCpm!=null?fd(allInCpm,3)+"/mi":"—"}</div>
        </div>
      </div>

      {/* ATL Loads & Billing — per-driver breakdown from the XLSX */}
      <div className="card" style={{ marginBottom:14 }}>
        <div className="ctit" style={{ fontSize:13 }}>💰 ATL Loads & Billing · per-driver · as of {ATL_BILLING.asOf}</div>
        <table className="tbl" style={{ fontSize:13 }}>
          <thead>
            <tr>
              <th style={{ textAlign:"left", fontSize:10 }}>Driver</th>
              <th style={{ fontSize:10 }}>Loads</th>
              <th style={{ fontSize:10 }}>Revenue</th>
              <th style={{ fontSize:10 }}>Carrier Pay</th>
              <th style={{ fontSize:10 }}>Gross Profit</th>
              <th style={{ fontSize:10 }}>Margin</th>
              <th style={{ fontSize:10 }}>Avg / Load</th>
            </tr>
          </thead>
          <tbody>
            {[...ATL_BILLING.byDriver].sort((a,b)=>b.revenue-a.revenue).map((r, i) => {
              const margin = r.revenue > 0 ? r.gross / r.revenue * 100 : 0;
              return (
                <tr key={r.name} style={{ background:i%2===0?"var(--s2)":"transparent" }}>
                  <td style={{ padding:"10px 9px", borderLeft:"4px solid #3ddc84", fontWeight:600 }}>{r.name} <span style={{ color:"#9aa4b3", fontSize:10 }}>({r.short})</span></td>
                  <td style={{ padding:"10px 9px", color:"#9aa4b3" }}>{r.loads}</td>
                  <td style={{ padding:"10px 9px", fontVariantNumeric:"tabular-nums", color:"#3ddc84", fontWeight:700 }}>{fd(r.revenue, 0)}</td>
                  <td style={{ padding:"10px 9px", fontVariantNumeric:"tabular-nums", color:"#ff5252" }}>{fd(r.carrier, 0)}</td>
                  <td style={{ padding:"10px 9px", fontVariantNumeric:"tabular-nums", fontWeight:700, color:"#4fc3f7" }}>{fd(r.gross, 0)}</td>
                  <td style={{ padding:"10px 9px", fontVariantNumeric:"tabular-nums", color: margin >= 20 ? "#3ddc84" : margin >= 10 ? "#fbbf24" : "#ff5252", fontWeight:700 }}>{fp(margin)}</td>
                  <td style={{ padding:"10px 9px", fontVariantNumeric:"tabular-nums", color:"#9aa4b3" }}>{fd(r.revenue / r.loads, 0)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ padding:"12px 9px", fontSize:13 }}>TOTAL · {ATL_BILLING.byDriver.length} drivers</td>
              <td style={{ padding:"12px 9px", fontSize:13 }}>{ATL_BILLING.loads}</td>
              <td style={{ padding:"12px 9px", fontSize:14, fontWeight:900, color:"#3ddc84" }}>{fd(ATL_BILLING.revenue, 0)}</td>
              <td style={{ padding:"12px 9px", fontSize:13, color:"#ff5252" }}>{fd(ATL_BILLING.carrierPay, 0)}</td>
              <td style={{ padding:"12px 9px", fontSize:14, fontWeight:900, color:"#4fc3f7" }}>{fd(ATL_BILLING.grossProfit, 0)}</td>
              <td style={{ padding:"12px 9px", fontSize:13, fontWeight:700 }}>{fp(ATL_BILLING.grossMargin)}</td>
              <td style={{ padding:"12px 9px", fontSize:13 }}>{fd(ATL_BILLING.revenue / ATL_BILLING.loads, 0)}</td>
            </tr>
          </tfoot>
        </table>
        <div style={{ fontSize:10, color:"var(--mu)", marginTop:8 }}>
          Source: <span style={{ color:"#4fc3f7" }}>2026-Atlanta Billing.xlsx</span> · all {ATL_BILLING.loads} loads count as ATL revenue (the <code>Assigned</code> column only reflects QBO booking routing — some loads invoiced under SF/Corp or CE East, but the load itself is ATL ops). Refresh weekly via <code>scripts/parse_atl_billing.py</code>.
        </div>
      </div>

      {/* ATL per-week roster + contribution table */}
      <div className="card" style={{ marginBottom:14 }}>
        <div className="ctit" style={{ fontSize:13 }}>📅 ATL per-week log · roster + cost contribution</div>
        <table className="tbl" style={{ fontSize:12 }}>
          <thead>
            <tr>
              <th style={{ textAlign:"left", fontSize:10 }}>Week</th>
              <th style={{ textAlign:"left", fontSize:10 }}>Roster</th>
              <th style={{ fontSize:10 }}>Driver Labor</th>
              <th style={{ fontSize:10 }}>Hours</th>
              <th style={{ fontSize:10 }}>Fuel</th>
              <th style={{ fontSize:10 }}>Contractors</th>
              <th style={{ fontSize:10 }}>Week Total</th>
            </tr>
          </thead>
          <tbody>
            {ATL_WEEKLY_LOG.map((w, i) => {
              const driverShorts = (w.drivers || []).map(d => d.split(" ")[0]).join(", ");
              const contractorShorts = (w.contractors || []).map(c => c.name.split(" ")[0]).join(", ");
              const rosterTxt = [
                `${(w.drivers||[]).length}W2: ${driverShorts || "—"}`,
                contractorShorts ? `${(w.contractors||[]).length}C: ${contractorShorts}` : null,
              ].filter(Boolean).join(" · ");
              const wkTotal = (w.driverPay||0) + (w.fuelAmt||0) + (w.contractorPay||0);
              return (
                <tr key={`${w.weekStart}-${w.weekEnd}`} style={{ background:i%2===0?"var(--s2)":"transparent" }}>
                  <td style={{ padding:"10px 9px", borderLeft:"4px solid #f47820", fontWeight:700, fontFamily:"var(--f2)" }}>
                    {w.weekStart.slice(5)} → {w.weekEnd.slice(5)}
                  </td>
                  <td style={{ padding:"10px 9px", fontSize:10, color:"#9aa4b3" }}>{rosterTxt}</td>
                  <td style={{ padding:"10px 9px", fontVariantNumeric:"tabular-nums" }}>{fd(w.driverPay||0,0)}</td>
                  <td style={{ padding:"10px 9px", fontVariantNumeric:"tabular-nums", color:"#9aa4b3" }}>{fn(w.driverHours||0,0)}</td>
                  <td style={{ padding:"10px 9px", fontVariantNumeric:"tabular-nums", color:"#ff8a65" }}>{fd(w.fuelAmt||0,0)}</td>
                  <td style={{ padding:"10px 9px", fontVariantNumeric:"tabular-nums", color:"#fbbf24" }}>{w.contractorPay>0?fd(w.contractorPay,0):"—"}</td>
                  <td style={{ padding:"10px 9px", fontVariantNumeric:"tabular-nums", fontWeight:800 }}>{fd(wkTotal,0)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ padding:"12px 9px", fontSize:12 }} colSpan={2}>TOTAL · {ATL_WEEKLY_LOG.length} weeks</td>
              <td style={{ padding:"12px 9px", fontSize:13, fontWeight:800 }}>{fd(cum.driverPay,0)}</td>
              <td style={{ padding:"12px 9px", fontSize:12 }}>{fn(cum.driverHours,0)}</td>
              <td style={{ padding:"12px 9px", fontSize:13, color:"#ff8a65", fontWeight:800 }}>{fd(cum.fuelAmt,0)}</td>
              <td style={{ padding:"12px 9px", fontSize:13, color:"#fbbf24", fontWeight:800 }}>{fd(cum.contractorPay,0)}</td>
              <td style={{ padding:"12px 9px", fontSize:14, fontWeight:900 }}>{fd(allInLaborFuel,0)}</td>
            </tr>
          </tfoot>
        </table>
        <div style={{ fontSize:10, color:"var(--mu)", marginTop:8 }}>
          Source: <code>ATL_WEEKLY_LOG</code> — per-week roster + contribution amounts. Agents are tracked separately on the Budgeting tab (not part of ATL or any specific company). Historical weeks (May 4-10, May 11-17) are best-effort allocations; the latest week is exact (PAYROLL/FUEL YTD delta). ATL designation toggles week-to-week — confirm the roster with Ben each drop.
        </div>
      </div>
    </div>
  );
}


// ── BUDGETING ─────────────────────────────────────────────────
// Pulls live QBO P&L (ce_sf_combined, YTD) and rolls expense lines into
// 17 buckets. What-if simulator persists shared scenarios via Supabase
// (freightiq_budget_whatifs table — run the migration SQL once).
function Budgeting() {
  const [pnl, setPnl]               = useState(null);
  const [pnlLoading, setPnlLoading] = useState(false);
  const [pnlError, setPnlError]     = useState(null);
  const [scenarios, setScenarios]   = useState([]);
  const [setupErr, setSetupErr]     = useState(null);
  const [scnLoading, setScnLoading] = useState(false);
  const [formLabel, setFormLabel]   = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formFreq, setFormFreq]     = useState("weekly");
  const [adding, setAdding]         = useState(false);

  // Live QBO P&L on mount
  useEffect(() => {
    setPnlLoading(true); setPnlError(null);
    fetch("/api/qbo-pnl?company=ce_sf_combined&period=ytd")
      .then(r => r.ok ? r.json() : r.json().then(b => Promise.reject(b)))
      .then(d => { if (d.error) throw new Error(d.error); setPnl(d); })
      .catch(e => setPnlError(e.message || String(e)))
      .finally(() => setPnlLoading(false));
  }, []);

  // What-if scenarios from Supabase
  const refreshScenarios = () => {
    setScnLoading(true);
    fetch("/api/budget-whatifs")
      .then(async r => {
        const j = await r.json().catch(() => ({}));
        if (r.status === 503 && j.error === "table-not-found") {
          setSetupErr(j.message || "Supabase table not provisioned");
          setScenarios([]);
          return;
        }
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        setSetupErr(null);
        setScenarios(j.scenarios || []);
      })
      .catch(e => setSetupErr(e.message || String(e)))
      .finally(() => setScnLoading(false));
  };
  useEffect(() => { refreshScenarios(); }, []);

  // Roll expense lines into investor-readable buckets
  const buckets = useMemo(() => {
    // Brighter color variants chosen for legibility against the #0b0d10 / #181c26
    // backgrounds — replaces lavender / indigo / gray washouts.
    const b = [
      { key:"carrier",   label:"Carrier Pay (COGS)",  val:0, color:"#ff6b6b", icon:"📦" },
      { key:"driver",    label:"Driver Labor",         val:0, color:"#f47820", icon:"🚚" },
      { key:"office",    label:"Office Labor",         val:0, color:"#4fc3f7", icon:"🏢" },
      { key:"contract",  label:"Contractor Payroll",   val:0, color:"#fbbf24", icon:"📋" },
      { key:"taxes",     label:"Payroll Taxes & Benefits", val:0, color:"#c4b5fd", icon:"💼" },
      { key:"fuel",      label:"Fuel",                 val:0, color:"#ff8a65", icon:"⛽" },
      { key:"truckRent", label:"Truck Rentals",        val:0, color:"#c084fc", icon:"🚛" },
      { key:"trailRent", label:"Trailer Rentals",      val:0, color:"#5eead4", icon:"🚜" },
      { key:"truckIns",  label:"Truck Insurance",      val:0, color:"#f472b6", icon:"🛡" },
      { key:"otherIns",  label:"Other Insurance",      val:0, color:"#e879f9", icon:"🏥" },
      { key:"maint",     label:"Maint & Storage",      val:0, color:"#fbbf24", icon:"🔧" },
      { key:"owner",     label:"Owner Draws + Purchases", val:0, color:"#3ddc84", icon:"👑" },
      { key:"ceEast",    label:"CE East Operations",   val:0, color:"#a78bfa", icon:"🏦" },
      { key:"badDebt",   label:"Bad Debt",             val:0, color:"#ff5252", icon:"💸" },
      { key:"assetLoan", label:"Asset Loan Payments",  val:0, color:"#93c5fd", icon:"🚙" },
      { key:"legal",     label:"Legal & Professional", val:0, color:"#86efac", icon:"⚖" },
      { key:"facilities", label:"Facilities & Utilities", val:0, color:"#fde68a", icon:"🏠" },
      { key:"techMkt",   label:"Tech & Marketing",     val:0, color:"#7dd3fc", icon:"💻" },
      { key:"agent",     label:"Agent Payments",       val:0, color:"#fb923c", icon:"🤝" },
      { key:"gaOther",   label:"G&A Other",            val:0, color:"#cbd5e1", icon:"📎" },
    ];
    const idx = Object.fromEntries(b.map(x => [x.key, x]));

    // Agent payments tracked separately from CONTRACTORS array (different
    // expense lens — recruiter/finder model). Sum across all AGENTS entries.
    // Note: Agent draws are a SEPARATE draw category in QBO (NOT inside
    // "Total for Owners Draw"), so we don't subtract from the owner bucket.
    const agentTotal = AGENTS.reduce((s, a) => s + (a.total || 0), 0);
    idx.agent.val = agentTotal;

    if (!pnl) {
      // Static fallback from this week's QBO extraction
      idx.carrier.val    = INCOME_2026.carrierPay;
      idx.driver.val     = 552199.46;
      idx.office.val     = 238058.43;
      idx.contract.val   = 239221.69 + 67469.31;  // contractor payroll + cost of labor (owner ops)
      idx.taxes.val      = 277707.13 + 28609.11 + 3888.03;  // payroll tax + 401k + child support
      idx.fuel.val       = 398087.03;
      idx.truckRent.val  = TRUCK_TOT;
      idx.trailRent.val  = TRAILER_TOT;
      idx.truckIns.val   = INS_TOT;
      idx.otherIns.val   = 66786.96;
      idx.maint.val      = TRUCK_MAINT + TRAIL_MAINT + STORAGE + UNIFORMS;
      idx.owner.val      = 247082.12 + 71846.51;  // owner draws + owner purchases (Agent is a SEPARATE draw in QBO, not subtracted)
      idx.ceEast.val     = 122383.21;
      idx.badDebt.val    = 84000.00;
      idx.assetLoan.val  = 41765.53;
      idx.legal.val      = 64696.24;
      idx.facilities.val = 62146.76 + 18587.91 + 5914.34;       // Rent + Utilities + Repair
      idx.techMkt.val    = 68389.76 + 45474.00 + 15683.92;      // Computer & Software + Advertising + Dues
      // Remainder bucket
      const sumSoFar = b.reduce((s, x) => s + x.val, 0);
      const knownTotal = INCOME_2026.cogs + INCOME_2026.totalExp;
      idx.gaOther.val    = Math.max(0, knownTotal - sumSoFar);
      return b;
    }

    // Live QBO mapping — parsed data lives under pnl.parsed
    const parsed = pnl.parsed || pnl;
    // Carrier bucket = all COGS lines (Carrier Pay + Flexent + Triumph fees)
    for (const v of Object.values(parsed.cogs || {})) idx.carrier.val += v;

    // Sections where we use the "Total for X" subtotal — skip any " > "
    // sub-items under these to avoid double-counting. "Travel Expenses - CE
    // East" is a sub-section inside Capacity Express East; the parser loses
    // the CE East prefix when recursing one more level deep, so we have to
    // skip it explicitly (otherwise its $4K flights/hotel/uber would land in
    // gaOther AND already be summed in "Total for Capacity Express East").
    const subSectionsUseSubtotal = new Set([
      "Asset Loan Payments", "Bad Debt Expense", "Capacity Express East",
      "Cost of Labor", "Insurance", "Legal and Professional Fees",
      "Owners Draw", "Payroll Taxes", "Travel Expenses",
      "Travel Expenses - CE East",
    ]);

    for (const [k, v] of Object.entries(parsed.expenses || {})) {
      // Skip "Total for Salaries and Wages" (its components are summed individually below)
      if (k === "Total for Salaries and Wages") continue;
      if (k === "Total for Truck/Trailer") continue;  // handled via parsed.truckTrailer
      // CE East travel subtotal is already inside "Total for Capacity Express East"
      if (k === "Total Travel Expenses - CE East") continue;

      // Strip parent-section prefix where present. For sections we sum via
      // subtotal, skip the sub-items entirely. Otherwise use the suffix as the
      // match key (so "Salaries and Wages > Salaries & Wages - Drivers" maps
      // to driverLabor).
      let key = k;
      if (k.includes(" > ")) {
        const section = k.slice(0, k.indexOf(" > "));
        if (subSectionsUseSubtotal.has(section)) continue;
        key = k.slice(k.indexOf(" > ") + 3);
      }

      if (key === "Salaries & Wages - Drivers")      idx.driver.val   += v;
      else if (key === "Salaries & Wages - Office")  idx.office.val   += v;
      else if (key === "Contractor Payroll")         idx.contract.val += v;
      else if (key === "Total for Cost of Labor") idx.contract.val += v;
      else if (key === "401(k) Expense" || key === "Child Support Payments") idx.taxes.val += v;
      else if (key === "Total for Payroll Taxes" || key === "Total Payroll Taxes") idx.taxes.val += v;
      else if (key === "Total for Asset Loan Payments")            idx.assetLoan.val += v;
      else if (key === "Total for Bad Debt Expense")               idx.badDebt.val   += v;
      else if (key === "Total for Capacity Express East")          idx.ceEast.val    += v;
      else if (key === "Total for Insurance")                      idx.otherIns.val  += v;
      else if (key === "Total for Legal and Professional Fees")    idx.legal.val     += v;
      else if (key === "Total for Owners Draw" || key === "Owner Purchases") idx.owner.val += v;
      // Facilities & Utilities: physical space costs
      else if (key === "Rent/Lease of Building" || key === "Utilities" || key === "Repair & Maintenance") idx.facilities.val += v;
      // Tech & Marketing: software, ads, paid subscriptions
      else if (key === "Computer & Software" || key === "Advertising & Marketing" || key === "Dues & Subscriptions") idx.techMkt.val += v;
      else idx.gaOther.val += v;
    }

    for (const [k, v] of Object.entries(parsed.truckTrailer || {})) {
      if (k.startsWith("_")) continue;
      if (k === "Fuel")                idx.fuel.val      += v;
      else if (k === "SF Truck Insurance") idx.truckIns.val  += v;
      else if (k === "Truck Rentals")  idx.truckRent.val += v;
      else if (k === "Trailer Rentals") idx.trailRent.val += v;
      else                              idx.maint.val     += v;  // truck maint, trailer maint, storage, uniforms
    }

    return b;
  }, [pnl]);

  // Time/aggregate math
  const days = PERIOD_DAYS;
  const weeksElapsed = days / 7;
  const totalWeeklyExp = buckets.reduce((s, b) => s + b.val, 0) / weeksElapsed;
  const totalAnnualExp = buckets.reduce((s, b) => s + b.val, 0) * (365 / days);
  const weeklyRev = INCOME_2026.total / weeksElapsed;
  // Net margin uses actual Net Income (= revenue − COGS − opex + other income),
  // not just revenue − spend, so the Triumph withholding refunds & interest are
  // included. Matches Income tab's headline net margin.
  const netMargin = INCOME_2026.netIncome / INCOME_2026.total * 100;
  const weeklyNetIncome = INCOME_2026.netIncome / weeksElapsed;

  // What-if impact math — each added $/wk reduces weekly net income 1:1
  const activeScn = scenarios.filter(s => s.active);
  const scnWeekly = activeScn.reduce((sum, s) => sum + (s.frequency === "weekly" ? s.amount : s.amount * 12 / 52), 0);
  const adjWeeklyExp = totalWeeklyExp + scnWeekly;
  const adjNetIncome = weeklyNetIncome - scnWeekly;
  const adjNetMargin = adjNetIncome / weeklyRev * 100;
  const adjAnnualExp = totalAnnualExp + scnWeekly * 52;

  async function addScenario(e) {
    e.preventDefault();
    const amt = Number(formAmount);
    if (!formLabel.trim() || !isFinite(amt) || amt <= 0) return;
    setAdding(true);
    try {
      const r = await fetch("/api/budget-whatifs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: formLabel.trim(), amount: amt, frequency: formFreq }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setSetupErr(j.message || j.error || `HTTP ${r.status}`);
        return;
      }
      setFormLabel(""); setFormAmount(""); setFormFreq("weekly");
      refreshScenarios();
    } finally { setAdding(false); }
  }

  async function toggleScenario(id, active) {
    await fetch(`/api/budget-whatifs?id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    refreshScenarios();
  }
  async function deleteScenario(id) {
    await fetch(`/api/budget-whatifs?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    refreshScenarios();
  }

  const sortedBuckets = [...buckets].sort((a, b) => b.val - a.val);

  return (
    <div>
      <div className="ptitle">Budgeting</div>
      <div className="psub">QBO P&L weekly run rate · {PERIOD} ({days} days / {weeksElapsed.toFixed(1)} weeks) · {pnl ? "Live QB" : pnlLoading ? "Loading…" : "Static fallback"}</div>

      {pnlError && (
        <div className="ibox" style={{ borderColor:"rgba(255,82,82,.4)", background:"rgba(255,82,82,.08)" }}>
          <strong style={{ color:"var(--rd)" }}>⚠ QB P&L fetch failed:</strong> {pnlError} · using static fallback from last QB extraction
        </div>
      )}

      {/* Summary KPIs */}
      <div className="g4" style={{ marginBottom:14 }}>
        <div className="kpi" style={{ borderTop:"3px solid #ff5252" }}>
          <div className="klbl">Total Weekly Spend</div>
          <div className="kval" style={{ color:"#ff5252" }}>{fd(totalWeeklyExp, 0)}</div>
          <div className="ksub">{fd(totalAnnualExp, 0)} annualized</div>
        </div>
        <div className="kpi" style={{ borderTop:"3px solid #3ddc84" }}>
          <div className="klbl">Weekly Revenue (avg)</div>
          <div className="kval" style={{ color:"#3ddc84" }}>{fd(weeklyRev, 0)}</div>
          <div className="ksub">{weeksElapsed.toFixed(1)} weeks · {fd(INCOME_2026.total, 0)} YTD</div>
        </div>
        <div className="kpi" style={{ borderTop:`3px solid ${netMargin>=0?"#3ddc84":"#ff5252"}` }}>
          <div className="klbl">Net Income Margin</div>
          <div className="kval" style={{ color: netMargin>=0?"#3ddc84":"#ff5252" }}>{fp(netMargin)}</div>
          <div className="ksub">{fd(weeklyNetIncome, 0)}/wk net income · {fd(INCOME_2026.netIncome, 0)} YTD</div>
        </div>
        <div className="kpi" style={{ borderTop:"3px solid #f47820" }}>
          <div className="klbl">With What-Ifs</div>
          <div className="kval" style={{ color: adjNetMargin>=0?"#3ddc84":"#ff5252" }}>{fp(adjNetMargin)}</div>
          <div className="ksub">{fd(adjNetIncome, 0)}/wk clearing · {activeScn.length} active scenarios</div>
        </div>
      </div>

      {/* Budget table */}
      <div className="card" style={{ marginBottom:14 }}>
        <div className="ctit" style={{ fontSize:13 }}>📋 Weekly Budget by Category · QBO P&L (sorted by size)</div>
        <table className="tbl" style={{ fontSize:13 }}>
          <thead>
            <tr>
              <th style={{ textAlign:"left", fontSize:10 }}>Category</th>
              <th style={{ fontSize:10 }}>YTD ({days}d)</th>
              <th style={{ fontSize:10 }}>Weekly</th>
              <th style={{ fontSize:10 }}>Monthly (~4.33wk)</th>
              <th style={{ fontSize:10 }}>Annualized</th>
              <th style={{ fontSize:10 }}>% of Weekly Rev</th>
            </tr>
          </thead>
          <tbody>
            {sortedBuckets.map((b, i) => {
              const weekly = b.val / weeksElapsed;
              const monthly = weekly * 4.33;
              const annual = b.val * (365 / days);
              const pctOfRev = weeklyRev > 0 ? (weekly / weeklyRev * 100) : 0;
              return (
                <tr key={b.key} style={{ background:i%2===0?"var(--s2)":"transparent" }}>
                  <td style={{ padding:"10px 9px", borderLeft:`4px solid ${b.color}` }}>
                    <span style={{ display:"inline-block", width:26, fontSize:16 }}>{b.icon}</span>
                    <span style={{ color:"var(--tx)", fontWeight:600, fontSize:13 }}>{b.label}</span>
                  </td>
                  <td style={{ color:"var(--tx)", fontVariantNumeric:"tabular-nums", padding:"10px 9px" }}>{fd(b.val, 0)}</td>
                  <td style={{ color:b.color, fontWeight:800, fontSize:14, fontVariantNumeric:"tabular-nums", padding:"10px 9px" }}>{fd(weekly, 0)}</td>
                  <td style={{ color:"#9aa4b3", fontVariantNumeric:"tabular-nums", padding:"10px 9px" }}>{fd(monthly, 0)}</td>
                  <td style={{ color:"#9aa4b3", fontVariantNumeric:"tabular-nums", padding:"10px 9px" }}>{fd(annual, 0)}</td>
                  <td style={{ color: pctOfRev > 30 ? "#ff7777" : pctOfRev > 10 ? "#fcd34d" : "#9aa4b3", fontWeight:700, padding:"10px 9px" }}>{fp(pctOfRev)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ padding:"12px 9px", fontSize:13 }}>TOTAL · {sortedBuckets.length} categories</td>
              <td style={{ fontSize:13, padding:"12px 9px" }}>{fd(sortedBuckets.reduce((s,b)=>s+b.val,0), 0)}</td>
              <td style={{ fontSize:14, fontWeight:900, padding:"12px 9px" }}>{fd(totalWeeklyExp, 0)}</td>
              <td style={{ fontSize:13, padding:"12px 9px" }}>{fd(totalWeeklyExp * 4.33, 0)}</td>
              <td style={{ fontSize:13, padding:"12px 9px" }}>{fd(totalAnnualExp, 0)}</td>
              <td style={{ fontSize:13, padding:"12px 9px" }}>{fp(totalWeeklyExp / weeklyRev * 100)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* What-If Simulator */}
      <div className="card" style={{ marginBottom:14 }}>
        <div className="ctit">🎯 What-If Simulator · Add hypothetical expenses</div>

        {setupErr && (
          <div className="ibox" style={{ borderColor:"rgba(245,197,66,.5)", background:"rgba(245,197,66,.08)", marginBottom:14 }}>
            <strong style={{ color:"var(--ye)" }}>⚙ Setup needed:</strong> {setupErr}
          </div>
        )}

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          {/* Add form */}
          <form onSubmit={addScenario} style={{ background:"var(--s2)", border:"1px solid var(--bd)", borderRadius:4, padding:14 }}>
            <div className="ctit" style={{ fontSize:10, marginBottom:10 }}>Add Scenario</div>
            <div className="fld">
              <label className="lbl">Label</label>
              <input className="inp" type="text" value={formLabel} onChange={e=>setFormLabel(e.target.value)} placeholder="e.g. New dispatcher" disabled={adding} />
            </div>
            <div className="row2">
              <div className="fld">
                <label className="lbl">Amount ($)</label>
                <input className="inp" type="number" min="0" step="0.01" value={formAmount} onChange={e=>setFormAmount(e.target.value)} placeholder="1400" disabled={adding} />
              </div>
              <div className="fld">
                <label className="lbl">Frequency</label>
                <select className="inp" value={formFreq} onChange={e=>setFormFreq(e.target.value)} disabled={adding}>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn" disabled={adding || !formLabel.trim() || !formAmount}>
              {adding ? "Adding…" : "Add Scenario"}
            </button>
          </form>

          {/* Active impact summary */}
          <div style={{ background:"var(--s2)", border:"1px solid var(--bd)", borderRadius:4, padding:14 }}>
            <div className="ctit" style={{ fontSize:10, marginBottom:10 }}>Combined Impact (active only)</div>
            <div className="g2" style={{ gap:10 }}>
              <div className="met">
                <div className="mlbl">Added /wk</div>
                <div className="mval" style={{ color:"#f5c542", fontSize:22 }}>{fd(scnWeekly, 0)}</div>
                <div className="msub">{fd(scnWeekly * 4.33, 0)}/mo · {fd(scnWeekly * 52, 0)}/yr</div>
              </div>
              <div className="met">
                <div className="mlbl">Net Margin Δ</div>
                <div className="mval" style={{ color: (adjNetMargin-netMargin) >= 0 ? "#3ddc84" : "#ff5252", fontSize:22 }}>
                  {adjNetMargin - netMargin >= 0 ? "+" : ""}{(adjNetMargin - netMargin).toFixed(1)} pts
                </div>
                <div className="msub">{fp(netMargin)} → {fp(adjNetMargin)}</div>
              </div>
              <div className="met">
                <div className="mlbl">Weekly Clearing (after)</div>
                <div className="mval" style={{ color: adjNetIncome >= 0 ? "#3ddc84" : "#ff5252", fontSize:22 }}>{fd(adjNetIncome, 0)}</div>
                <div className="msub">before {fd(weeklyNetIncome, 0)} · Δ {scnWeekly >= 0 ? "−" : "+"}{fd(Math.abs(scnWeekly), 0)}</div>
              </div>
              <div className="met">
                <div className="mlbl">Annual Clearing (after)</div>
                <div className="mval" style={{ color: adjNetIncome * 52 >= 0 ? "#3ddc84" : "#ff5252", fontSize:22 }}>{fd(adjNetIncome * 52, 0)}</div>
                <div className="msub">before {fd(weeklyNetIncome * 52, 0)} · Δ {scnWeekly >= 0 ? "−" : "+"}{fd(Math.abs(scnWeekly * 52), 0)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Scenarios list */}
        <div style={{ marginTop:14 }}>
          <div className="ctit" style={{ fontSize:10, marginBottom:10 }}>Saved Scenarios · {scenarios.length} total · {activeScn.length} active</div>
          {scnLoading && <div style={{ color:"var(--mu)", fontSize:11 }}>Loading…</div>}
          {!scnLoading && scenarios.length === 0 && !setupErr && (
            <div style={{ color:"var(--mu)", fontSize:11, padding:10, textAlign:"center" }}>No scenarios yet. Add one above to see its weekly impact.</div>
          )}
          {scenarios.length > 0 && (
            <table className="tbl" style={{ fontSize:13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign:"left", fontSize:10 }}>Label</th>
                  <th style={{ fontSize:10 }}>Amount</th>
                  <th style={{ fontSize:10 }}>Frequency</th>
                  <th style={{ fontSize:10 }}>Weekly Equivalent</th>
                  <th style={{ fontSize:10 }}>Annualized</th>
                  <th style={{ fontSize:10 }}>Active</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((s, i) => {
                  const weekly = s.frequency === "weekly" ? s.amount : s.amount * 12 / 52;
                  return (
                    <tr key={s.id} style={{ background:i%2===0?"var(--s2)":"transparent", opacity:s.active?1:0.5 }}>
                      <td style={{ fontWeight:600, color:"var(--tx)", padding:"10px 9px" }}>{s.label}</td>
                      <td style={{ color:"var(--tx)", fontVariantNumeric:"tabular-nums", padding:"10px 9px" }}>{fd(s.amount, 2)}</td>
                      <td style={{ color:"#9aa4b3", textTransform:"uppercase", fontSize:11, padding:"10px 9px" }}>{s.frequency}</td>
                      <td style={{ color:"#fbbf24", fontWeight:800, fontSize:14, fontVariantNumeric:"tabular-nums", padding:"10px 9px" }}>{fd(weekly, 0)}/wk</td>
                      <td style={{ color:"#9aa4b3", fontVariantNumeric:"tabular-nums", padding:"10px 9px" }}>{fd(weekly * 52, 0)}</td>
                      <td>
                        <button onClick={()=>toggleScenario(s.id, !s.active)} style={{
                          background:"transparent", border:`1px solid ${s.active?"var(--gn)":"var(--mu)"}`,
                          color:s.active?"var(--gn)":"var(--mu)", padding:"3px 10px", borderRadius:3,
                          fontSize:10, fontFamily:"var(--f2)", letterSpacing:1, cursor:"pointer", textTransform:"uppercase",
                        }}>{s.active ? "✓ ON" : "OFF"}</button>
                      </td>
                      <td>
                        <button onClick={()=>{ if (confirm(`Delete "${s.label}"?`)) deleteScenario(s.id); }} style={{
                          background:"transparent", border:"1px solid var(--rd)", color:"var(--rd)",
                          padding:"3px 8px", borderRadius:3, fontSize:11, cursor:"pointer",
                        }}>×</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}


// ── WEEKLY/MONTHLY CHECKLIST ──────────────────────────────────
function Checklist() {
  const getWeekLabel = () => {
    const now = new Date();
    const start = new Date(now); start.setDate(now.getDate() - now.getDay());
    const end = new Date(start); end.setDate(start.getDate() + 6);
    const fmt = d => d.toLocaleDateString("en-US", { month:"short", day:"numeric" });
    return `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}`;
  };
  const getMonthLabel = () => new Date().toLocaleDateString("en-US", { month:"long", year:"numeric" });

  const WEEKLY_ITEMS = [
    { section: "Fleet Overview & CPM", icon: "🏢", color: "#f47820", source: "QuickBooks + EFS", items: [
      { id: "w_qb_labor", label: "Upload QuickBooks payroll report", sub: "Updates LABOR total for CPM" },
      { id: "w_efs_fuel", label: "Upload EFS fuel card export", sub: "Updates FUEL_TOT, driver fuel spend, gallons" },
      { id: "w_mudflap", label: "Upload Mudflap fuel statement", sub: "Combines with EFS for total fuel" },
      { id: "w_qb_pl", label: "Upload QuickBooks P&L (if available)", sub: "Updates insurance, maintenance, storage, uniforms totals" },
    ]},
    { section: "Income", icon: "💵", color: "#3ddc84", source: "Triumph / Flexent", items: [
      { id: "w_income_weekly", label: "Update weekly revenue (CE, SF, DI splits)", sub: "Income tab — weekly trend data" },
      { id: "w_carrier_pay", label: "Verify carrier pay / COGS for the week", sub: "Gross profit calculation" },
    ]},
    { section: "Trucks & Mileage", icon: "📍", color: "#4fc3f7", source: "Samsara", items: [
      { id: "w_samsara", label: "Drop Samsara Vehicle Mileage xlsx into incoming-freightiq/", sub: "Run scripts/parse_samsara_mileage.py to regenerate MILES + TRUCK_MILES" },
      { id: "w_verify_miles", label: "Verify MILES total matches Samsara", sub: "Used in CPM denominator — must be accurate" },
    ]},
    { section: "Driver Detail", icon: "🚛", color: "#f5c542", source: "Payroll + Fuel", items: [
      { id: "w_driver_review", label: "Review top 5 highest-CPM drivers", sub: "Flag any anomalies — new drivers, leave, etc." },
      { id: "w_fuel_outliers", label: "Check fuel outliers (high $/gal, high gallons)", sub: "Fuel Analysis tab — look for waste" },
    ]},
    { section: "CE East", icon: "🏦", color: "#ab47bc", source: "QuickBooks", items: [
      { id: "w_ce_revenue", label: "Update CE East weekly revenue", sub: "From Triumph CE East account" },
      { id: "w_ce_ar", label: "Check A/R balances — funding, released, unreleased", sub: "Balance sheet accuracy" },
    ]},
    { section: "Office Staff", icon: "🏢", color: "#ff8a65", source: "QuickBooks + Chase", items: [
      { id: "w_office_payroll", label: "Verify W2 office payroll ran (SF + J&A)", sub: "QuickBooks — salaried + hourly employees" },
      { id: "w_contractor_payments", label: "Verify contractor payments sent (Chase)", sub: "Jon Marcus, Mellody, Gabriel, Hilda, Maria, Logic, etc." },
      { id: "w_commissions", label: "Calculate & pay commissions (if applicable)", sub: "Elizabeth Delgado, Chris Simpson, Mellody Abrego" },
      { id: "w_health_ins", label: "Verify contractor health insurance payments", sub: "Mellody $368.34, Hilda $118.82, Deb $53.79, Chris $53.79/wk" },
      { id: "w_weekly_grid", label: "Refresh Weekly Checks grid (by-company payroll)", sub: "Drop SF+J&A paycheck history, J&A contractor payments, Chase VendorEmployeePayments → run scripts/build_paycheck_grid.py → build/push. Append Mairena's new payments in the script." },
    ]},
  ];

  const MONTHLY_ITEMS = [
    { section: "Truck Invoices", icon: "🚛", color: "#ff8a65", source: "TCI / Penske / TEC", items: [
      { id: "m_tci_lease", label: "Upload TCI lease invoices", sub: "Monthly fixed + variable mileage charges" },
      { id: "m_tci_service", label: "Upload TCI service invoices (if any)", sub: "Liftgate installs, repairs, etc." },
      { id: "m_tci_rental", label: "Upload TCI rental invoices (box truck, etc.)", sub: "Unit #19129 and any temp rentals" },
      { id: "m_penske", label: "Upload Penske lease/rental invoices", sub: "Units 587120, 587127, subs, fuel" },
      { id: "m_tec_lease", label: "Upload TEC Equipment lease invoice", sub: "Agreement #875 — 12 units, fixed + mileage" },
      { id: "m_tec_rental", label: "Upload TEC rental invoices (if any)", sub: "Daily/weekly/distance rentals" },
      { id: "m_tec_shop", label: "Upload TEC shop invoices (if any)", sub: "DOT inspections, mattress, repairs" },
    ]},
    { section: "Trailer Invoices", icon: "🚜", color: "#26a69a", source: "McKinney / Xtra / Utility", items: [
      { id: "m_mckinney", label: "Upload McKinney Trailers invoice", sub: "28 trailers — rental + mileage + repairs" },
      { id: "m_xtra_rental", label: "Upload Xtra Lease rental invoice", sub: "8 units — Road Van 53'/28' rental" },
      { id: "m_xtra_service", label: "Upload Xtra Lease service invoice (if any)", sub: "Roll door, panel repairs" },
      { id: "m_utility", label: "Upload Mountain West / Utility Trailers invoice", sub: "21 units @ $600/unit flat rate" },
      { id: "m_premier", label: "Upload Premier Trailers invoice (if any)", sub: "Check for new invoices" },
      { id: "m_boxwheel", label: "Upload Boxwheel Trailer Leasing invoice (if any)", sub: "Check for new invoices" },
    ]},
    { section: "Maintenance", icon: "🔧", color: "#ef5350", source: "Various vendors", items: [
      { id: "m_truck_maint", label: "Upload truck maintenance invoices", sub: "Prime Wash, AutoForce, Titan Glass, towing, batteries, etc." },
      { id: "m_trailer_maint", label: "Upload trailer maintenance invoices", sub: "TravelCenters of America, MKD Express, etc." },
    ]},
    { section: "Insurance & Other", icon: "🛡️", color: "#b39ddb", source: "QuickBooks", items: [
      { id: "m_insurance", label: "Verify insurance premium ($6,375/wk) in QuickBooks", sub: "Confirm weeks billed match period" },
      { id: "m_uniforms", label: "Upload Unifirst / Safety Guard invoices", sub: "Monthly uniform service + any shoe purchases" },
      { id: "m_storage", label: "Upload storage/parking invoices", sub: "Storage on Wheels, Total Transportation, Parking Service Center" },
    ]},
    { section: "Office Staff", icon: "🏢", color: "#ff8a65", source: "QuickBooks + Chase", items: [
      { id: "m_office_gusto_sf", label: "Export Show Freight payroll summary from QuickBooks", sub: "Updates W2 office staff data — SF entity" },
      { id: "m_office_gusto_ja", label: "Export J&A Management payroll summary from QuickBooks", sub: "Updates W2 office staff data — J&A entity" },
      { id: "m_office_contractors", label: "Export Chase contractor payment history", sub: "All contractor payments for the month" },
      { id: "m_office_gusto_1099", label: "Export QuickBooks contractor payments (if any)", sub: "Deb Adamson transitioned to QuickBooks contractor" },
      { id: "m_car_payments", label: "Verify car allowance payments", sub: "Jon Marcus $350/mo · Mellody $334.86/mo" },
      { id: "m_contractor_health", label: "Verify monthly health insurance totals", sub: "Mellody, Hilda, Deb, Chris — company-paid" },
      { id: "m_commission_reconcile", label: "Reconcile commission payments vs earned", sub: "Elizabeth, Chris, Mellody — W2 and/or 1099" },
    ]},
    { section: "QuickBooks Reconciliation", icon: "📊", color: "#f47820", source: "QuickBooks", items: [
      { id: "m_qb_reconcile", label: "Reconcile QuickBooks totals vs invoice totals", sub: "Truck/trailer QB totals should match sum of vendor invoices" },
      { id: "m_qb_period", label: "Update PERIOD label if date range changed", sub: "Currently: " + PERIOD },
      { id: "m_qb_push", label: "Push updated App.jsx to GitHub (via Claude)", sub: "Bake in new permanent data → Vercel redeploys" },
    ]},
  ];

  // Load/save state
  const [checks, setChecks] = useState(() => {
    try {
      const stored = localStorage.getItem("freightiq_checklist");
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const [weekLabel] = useState(getWeekLabel);
  const [monthLabel] = useState(getMonthLabel);

  const save = (updated) => {
    setChecks(updated);
    try { localStorage.setItem("freightiq_checklist", JSON.stringify(updated)); } catch {}
  };

  const toggle = (id) => {
    const updated = { ...checks, [id]: !checks[id] };
    save(updated);
  };

  const resetWeekly = () => {
    const updated = { ...checks };
    WEEKLY_ITEMS.forEach(s => s.items.forEach(i => { delete updated[i.id]; }));
    save(updated);
  };

  const resetMonthly = () => {
    const updated = { ...checks };
    MONTHLY_ITEMS.forEach(s => s.items.forEach(i => { delete updated[i.id]; }));
    save(updated);
  };

  const resetAll = () => save({});

  const countChecked = (items) => items.reduce((s, sec) => s + sec.items.filter(i => checks[i.id]).length, 0);
  const countTotal = (items) => items.reduce((s, sec) => s + sec.items.length, 0);
  const pct = (items) => {
    const t = countTotal(items);
    return t > 0 ? Math.round(countChecked(items) / t * 100) : 0;
  };

  const renderSection = (sec) => {
    const done = sec.items.filter(i => checks[i.id]).length;
    const total = sec.items.length;
    const allDone = done === total;
    return (
      <div key={sec.section} className="card" style={{ marginBottom: 10, borderLeft: `3px solid ${allDone ? "#3ddc84" : sec.color}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontFamily: "var(--f2)", fontSize: 14, fontWeight: 800, letterSpacing: 1, color: allDone ? "#3ddc84" : sec.color }}>
              {sec.icon} {sec.section} {allDone && "✓"}
            </div>
            <div style={{ fontSize: 10, color: "var(--mu)" }}>Source: {sec.source}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "var(--f2)", fontSize: 18, fontWeight: 800, color: allDone ? "#3ddc84" : done > 0 ? "#f5c542" : "var(--mu)" }}>
              {done}/{total}
            </div>
          </div>
        </div>
        {sec.items.map(item => (
          <div key={item.id}
            onClick={() => toggle(item.id)}
            style={{
              display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0",
              borderBottom: "1px solid var(--bd)", cursor: "pointer",
              opacity: checks[item.id] ? 0.5 : 1,
              transition: "opacity .15s",
            }}>
            <div style={{
              width: 20, height: 20, borderRadius: 3, flexShrink: 0, marginTop: 1,
              border: `2px solid ${checks[item.id] ? "#3ddc84" : "var(--bd)"}`,
              background: checks[item.id] ? "rgba(61,220,132,.15)" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, color: "#3ddc84",
            }}>
              {checks[item.id] && "✓"}
            </div>
            <div>
              <div style={{
                fontSize: 12, color: checks[item.id] ? "var(--mu)" : "var(--tx)",
                textDecoration: checks[item.id] ? "line-through" : "none",
                fontWeight: 500,
              }}>
                {item.label}
              </div>
              <div style={{ fontSize: 10, color: "var(--mu)", marginTop: 1 }}>{item.sub}</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const wPct = pct(WEEKLY_ITEMS);
  const mPct = pct(MONTHLY_ITEMS);
  const wDone = countChecked(WEEKLY_ITEMS);
  const wTotal = countTotal(WEEKLY_ITEMS);
  const mDone = countChecked(MONTHLY_ITEMS);
  const mTotal = countTotal(MONTHLY_ITEMS);

  return (
    <div>
      <div className="ptitle">Update Checklist</div>
      <div className="psub">Weekly + monthly data update tasks · check off as you go</div>

      {/* Progress hero */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div style={{
          background: wPct === 100 ? "rgba(61,220,132,.08)" : "var(--s1)",
          border: `2px solid ${wPct === 100 ? "#3ddc84" : "var(--or)"}`,
          borderRadius: 6, padding: "22px", textAlign: "center",
        }}>
          <div style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: wPct === 100 ? "#3ddc84" : "var(--or)", marginBottom: 6 }}>
            Weekly — {weekLabel}
          </div>
          <div style={{ fontFamily: "var(--f2)", fontSize: 56, fontWeight: 900, color: wPct === 100 ? "#3ddc84" : wPct > 0 ? "#f5c542" : "var(--mu)" }}>
            {wPct}%
          </div>
          <div style={{ fontSize: 11, color: "var(--mu)", marginTop: 4 }}>{wDone} of {wTotal} tasks complete</div>
          <div className="bar" style={{ marginTop: 10 }}>
            <div className="bfil" style={{ width: `${wPct}%`, background: wPct === 100 ? "#3ddc84" : "var(--or)", transition: "width .3s" }} />
          </div>
        </div>
        <div style={{
          background: mPct === 100 ? "rgba(61,220,132,.08)" : "var(--s1)",
          border: `2px solid ${mPct === 100 ? "#3ddc84" : "#4fc3f7"}`,
          borderRadius: 6, padding: "22px", textAlign: "center",
        }}>
          <div style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: mPct === 100 ? "#3ddc84" : "#4fc3f7", marginBottom: 6 }}>
            Monthly — {monthLabel}
          </div>
          <div style={{ fontFamily: "var(--f2)", fontSize: 56, fontWeight: 900, color: mPct === 100 ? "#3ddc84" : mPct > 0 ? "#f5c542" : "var(--mu)" }}>
            {mPct}%
          </div>
          <div style={{ fontSize: 11, color: "var(--mu)", marginTop: 4 }}>{mDone} of {mTotal} tasks complete</div>
          <div className="bar" style={{ marginTop: 10 }}>
            <div className="bfil" style={{ width: `${mPct}%`, background: mPct === 100 ? "#3ddc84" : "#4fc3f7", transition: "width .3s" }} />
          </div>
        </div>
      </div>

      {/* Reset buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button className="btn btn-o" onClick={resetWeekly} style={{ flex: 1, fontSize: 10, padding: "7px 12px" }}>
          🔄 Start New Week
        </button>
        <button className="btn btn-o" onClick={resetMonthly} style={{ flex: 1, fontSize: 10, padding: "7px 12px" }}>
          🔄 Start New Month
        </button>
        <button className="btn btn-o" onClick={resetAll} style={{ flex: "none", fontSize: 10, padding: "7px 12px", color: "#ff5252", borderColor: "#ff5252" }}>
          Reset All
        </button>
      </div>

      {/* Weekly checklist */}
      <div style={{ fontFamily: "var(--f2)", fontSize: 20, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "var(--or)", marginBottom: 10 }}>
        📋 Weekly Tasks
      </div>
      <div className="ibox" style={{ marginBottom: 14 }}>
        <strong style={{ color: "#4fc3f7" }}>Do these every week.</strong>{" "}
        These uploads feed the Fleet Overview, CPM Calculator, Driver Detail, Fuel Analysis, Income, and CE East tabs.
        QuickBooks and EFS are the primary sources — they control your CPM numbers.
      </div>
      {WEEKLY_ITEMS.map(renderSection)}

      {/* Monthly checklist */}
      <div style={{ fontFamily: "var(--f2)", fontSize: 20, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#4fc3f7", marginTop: 20, marginBottom: 10 }}>
        📋 Monthly Tasks
      </div>
      <div className="ibox" style={{ marginBottom: 14 }}>
        <strong style={{ color: "#f5c542" }}>Do these once a month</strong> (usually first week after month-end).{" "}
        These invoices populate the Trucks and Trailers tabs.
        They do <strong style={{ color: "#ff5252" }}>NOT</strong> affect CPM — that comes from QuickBooks only.
        Duplicate invoices are auto-detected in the Upload tab.
      </div>
      {MONTHLY_ITEMS.map(renderSection)}
    </div>
  );
}

// ── APP SHELL ─────────────────────────────────────────────────
// ── RECOMPUTE DERIVED VALUES ──────────────────────────────────
function recomputeDerived() {
  MILES_EST = GALLONS * 6.5;
  // INS_TOT is set directly from QuickBooks, not calculated
  EQUIP_TOT = TRUCK_TOT + TRAILER_TOT;
  MAINT_TOT = TRUCK_MAINT + TRAIL_MAINT + STORAGE;
  BASIC_COST  = LABOR + FUEL_TOT + TRUCK_TOT + INS_TOT;
  BASIC_CPM_V = BASIC_COST / MILES;
  ALLIN_COST  = LABOR + FUEL_TOT + TRUCK_TOT + INS_TOT + TRAILER_TOT + TRUCK_MAINT + TRAIL_MAINT + STORAGE + UNIFORMS;
  ALLIN_CPM_V = ALLIN_COST / MILES;
  // Rebuild DRIVERS from current PAYROLL + FUEL
  DRIVERS = PAYROLL.map(p => {
    const f = FUEL[p.name] || { fuel: 0, gallons: 0 };
    const mi = f.gallons * 6.5;
    const tot = p.totalCost + f.fuel;
    return { ...p, fuel: f.fuel, gallons: f.gallons, miles: mi, combined: tot,
      cpm: mi > 0 ? tot / mi : null, lCPM: mi > 0 ? p.totalCost / mi : null, fCPM: mi > 0 ? f.fuel / mi : null };
  });
}

// ── Password Gate ─────────────────────────────────────────────
function PasswordGate({ children }) {
  const correctPassword = import.meta.env.VITE_APP_PASSWORD || "ShowFreight2026!";
  const STORAGE_KEY = "sf_auth_v1";
  const VALID_DAYS = 30;
  const [unlocked, setUnlocked] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const { expires } = JSON.parse(raw);
      return expires && Date.now() < expires;
    } catch { return false; }
  });
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const submit = (e) => {
    e.preventDefault();
    if (pw === correctPassword) {
      const expires = Date.now() + VALID_DAYS * 24 * 60 * 60 * 1000;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ expires })); } catch {}
      setUnlocked(true);
      setError(false);
    } else {
      setError(true);
      setPw("");
    }
  };
  if (unlocked) return children;
  return (
    <div style={{ position: "fixed", inset: 0, background: "#0b0d10", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono', monospace", color: "#e8eaf0" }}>
      <form onSubmit={submit} style={{ background: "#12151c", border: "2px solid #f47820", borderRadius: 8, padding: "40px 36px", width: "100%", maxWidth: 400, boxShadow: "0 0 60px rgba(244,120,32,.15)" }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 900, color: "#f47820", letterSpacing: 3, textAlign: "center", marginBottom: 4 }}>⬡ FREIGHTIQ</div>
        <div style={{ fontSize: 11, color: "#5a6370", textAlign: "center", letterSpacing: 2, textTransform: "uppercase", marginBottom: 24 }}>Show Freight Inc · Authorized Access</div>
        <input
          type="password" value={pw} onChange={(e) => { setPw(e.target.value); setError(false); }}
          placeholder="Password" autoFocus
          style={{ width: "100%", padding: "12px 14px", fontSize: 14, background: "#0b0d10", border: `2px solid ${error ? "#ff5252" : "#1f2535"}`, borderRadius: 6, color: "#e8eaf0", fontFamily: "inherit", outline: "none", marginBottom: 12, transition: "border-color .2s" }}
        />
        {error && <div style={{ fontSize: 12, color: "#ff5252", marginBottom: 12, textAlign: "center" }}>Incorrect password</div>}
        <button type="submit" style={{ width: "100%", padding: "12px", background: "linear-gradient(135deg,#f47820,#c45e10)", border: "none", borderRadius: 6, color: "#fff", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>Unlock</button>
        <div style={{ fontSize: 10, color: "#5a6370", textAlign: "center", marginTop: 16 }}>Stays unlocked for {VALID_DAYS} days on this device</div>
      </form>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("overview");
  const [dataVersion, setDataVersion] = useState(0);
  const [equipmentData, setEquipmentData] = useState(null);
  const [equipmentError, setEquipmentError] = useState(null);
  const [warehouseLive, setWarehouseLive] = useState(false);

  // Best-effort one-time cleanup of old Samsara live-mileage caches.
  // The API was retired in June 2026; MILES is now refreshed by manually
  // dropping the Samsara Vehicle Mileage xlsx and running the parser. Clear
  // any stale cached value so returning visitors don't get an old number.
  useEffect(() => {
    try {
      localStorage.removeItem("fiq_fleet_miles_v1");
      localStorage.removeItem("fiq_fleet_miles_v2");
    } catch (e) { /* localStorage unavailable */ }
  }, []);

  useEffect(() => {
    fetch("https://ap-aging-v4.vercel.app/api/equipment")
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        if (!data || !Array.isArray(data.units)) throw new Error("malformed response (no units array)");
        setEquipmentData(data);
        setEquipmentError(null);
      })
      .catch(e => {
        // Visible error so silent CORS / network / shape regressions don't
        // leave Trucks/Trailers tabs sitting empty without explanation.
        const msg = e?.message || String(e);
        console.warn("Equipment fetch failed:", msg);
        setEquipmentError(msg);
      });
  }, []);

  // Hydrate fleet constants from the fdw_ data warehouse (Supabase). This is the
  // migration off hardcoded constants: numbers now come from Postgres, refreshed
  // by ingestion — no code edit needed. Falls back silently to the hardcoded
  // values if the fetch fails, so the dashboard never breaks. Mutates the same
  // module-level lets the Upload tab does, then recomputeDerived()+remount.
  useEffect(() => {
    fetch("/api/fdw-metrics")
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => {
        if (!d || !d.ok || !d.fleet) throw new Error("no fleet data");
        const f = d.fleet;
        const pick = (v, cur) => (typeof v === "number" && !Number.isNaN(v)) ? v : cur;
        LABOR = pick(f.labor, LABOR);           FUEL_TOT = pick(f.fuel_tot, FUEL_TOT);
        GALLONS = pick(f.gallons, GALLONS);     MILES = pick(f.miles, MILES);
        INS_TOT = pick(f.ins_tot, INS_TOT);     TRUCK_TOT = pick(f.truck_tot, TRUCK_TOT);
        TRAILER_TOT = pick(f.trailer_tot, TRAILER_TOT);
        TRUCK_MAINT = pick(f.truck_maint, TRUCK_MAINT);
        TRAIL_MAINT = pick(f.trail_maint, TRAIL_MAINT);
        STORAGE = pick(f.storage, STORAGE);     UNIFORMS = pick(f.uniforms, UNIFORMS);
        TRUCK_COUNT = pick(f.truck_count, TRUCK_COUNT);
        TOTAL_HRS = pick(f.total_hrs, TOTAL_HRS);
        if (Array.isArray(d.payroll) && d.payroll.length) {
          PAYROLL = d.payroll.map(p => p.active === false
            ? { name: p.name, hours: p.hours, totalCost: p.totalCost, active: false }
            : { name: p.name, hours: p.hours, totalCost: p.totalCost });
        }
        if (d.fuel && typeof d.fuel === "object" && Object.keys(d.fuel).length) FUEL = d.fuel;
        // Income tab: hydrate INCOME_2026 from QBO-fed warehouse tables (mutate
        // the const object's props, like the Upload tab does). Only overwrite
        // numeric fields that came back; keep hardcoded values otherwise.
        if (d.income) {
          const inc = d.income;
          for (const k of ["ce","sf","di","ceEast","total","cogs","grossProfit","totalExp","netOpIncome","netIncome","carrierPay","merchantFees","flexentFees"]) {
            if (typeof inc[k] === "number" && !Number.isNaN(inc[k])) INCOME_2026[k] = inc[k];
          }
          if (Array.isArray(inc.weeks) && inc.weeks.length) INCOME_2026.weeks = inc.weeks;
          if (Array.isArray(inc.months) && inc.months.length) INCOME_2026.months = inc.months;
        }
        recomputeDerived();
        setWarehouseLive(true);
        setDataVersion(v => v + 1);
      })
      .catch(e => console.warn("fdw-metrics fetch failed (hardcoded fallback):", e?.message || e));
  }, []);

  const trackedCPM = (LABOR + FUEL_TOT + INS_TOT + EQUIP_TOT + MAINT_TOT + UNIFORMS) / MILES;

  const page = () => {
    if (tab === "overview") return <FleetOverview />;
    if (tab === "basiccpm") return <BasicCPM />;
    if (tab === "perload")  return <PerLoadCPM />;
    if (tab === "driver")   return <DriverDetail />;
    if (tab === "trucks")   return <TrucksMileage />;
    if (tab === "fuel")     return <FuelAnalysis />;
    if (tab === "trucks2")  return <TrucksTab />;
    if (tab === "trailers") return <TrailerFleet />;
    if (tab === "income")   return <IncomeDashboard />;
    if (tab === "revenue")  return <RevenueDashboard />;
    if (tab === "ceeast")   return <CEEast />;
    if (tab === "cashflow") return <CashFlowDashboard />;
    if (tab === "atl")      return <AtlOperations />;
    if (tab === "ar")       return <ArDashboard />;
    if (tab === "otr")      return <OtrOperations />;
    if (tab === "budget")   return <Budgeting />;
    if (tab === "office")   return <OfficeStaff />;
    if (tab === "settings") return <DataSettings />;
    if (tab === "checklist") return <Checklist />;
    return null;
  };

  const ctxValue = { bumpVersion: () => setDataVersion(v => v + 1) };

  return (
    <PasswordGate>
    <DataContext.Provider value={ctxValue}>
    <EquipmentContext.Provider value={equipmentData ? { ...equipmentData, _error: null } : (equipmentError ? { units: [], _error: equipmentError } : null)}>
      <style>{CSS}</style>
      <div className="app" key={dataVersion}>
        <header className="hdr">
          <div className="logo">⬡ Freight<b>IQ</b></div>
          <div className="hsub">Show Freight Inc · {PERIOD}</div>
          <div className="hbdg">
            {warehouseLive && <span className="bdg bdg-o" title="Fleet numbers live from the fdw_ Supabase data warehouse (no hardcoded constants)">⚡ warehouse</span>}
            <span className="bdg bdg-o">Labor {fd(LABOR, 0)}</span>
            <span className="bdg bdg-o">Fuel {fd(FUEL_TOT, 0)}</span>
            <span className="bdg bdg-o">Ins {fd(INS_TOT, 0)}</span>
            <span className="bdg bdg-o">Equip {fd(EQUIP_TOT, 0)}</span>
            <span className="bdg" style={{background:"rgba(61,220,132,.1)",color:"#3ddc84",border:"1px solid rgba(61,220,132,.4)"}}>Basic {fd(BASIC_CPM_V, 3)}</span>
            <span className="bdg bdg-g">All-In {fd(ALLIN_CPM_V, 3)}</span>
          </div>
        </header>

        <nav className="nav">
          {TABS.map(t => (
            <button key={t.id} className={`ntab${tab === t.id ? " on" : ""}`} onClick={() => setTab(t.id)}
              style={t.id === "perload" ? { fontSize:15, letterSpacing:1.5 } : undefined}>
              {t.icon} {t.label}
            </button>
          ))}
        </nav>

        <main className="main">{page()}</main>
      </div>
    </EquipmentContext.Provider>
    </DataContext.Provider>
    </PasswordGate>
  );
}
