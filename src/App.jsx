import { useState, useMemo, useEffect, createContext, useContext } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import * as Papa from "papaparse";
import * as XLSX from "xlsx";

// ── Data Context (for Upload tab communication) ──────────────
const DataContext = createContext(null);
function useDataCtx() { return useContext(DataContext); }


// ── PAYROLL DATA ──────────────────────────────────────────────
let PAYROLL = [
  { name: "Alexander Christopher", hours: 234.35, totalCost: 6842.08 },
  { name: "Allwine Brian A",       hours: 181.34, totalCost: 5043.53 },
  { name: "Anderson Justin M",     hours: 79.01,  totalCost: 2285.37 },
  { name: "Brown Jr Marcellus",    hours: 77.08,  totalCost: 2143.78 },
  { name: "Butler Richard",        hours: 178.07, totalCost: 5150.67 },
  { name: "Clark Rettick",         hours: 148.05, totalCost: 4282.35 },
  { name: "Cotton Kejlon",         hours: 320.32, totalCost: 11677.82 },
  { name: "Davis Anthoni D",       hours: 792.03, totalCost: 26487.37 },
  { name: "Denman Samuel E",       hours: 645.08, totalCost: 20476.88 },
  { name: "Gutierrez Danny",       hours: 566.90, totalCost: 17641.25 },
  { name: "Guzman Jose",           hours: 690.60, totalCost: 24784.54 },
  { name: "Howell Lawrence",       hours: 85.33,  totalCost: 2373.24 },
  { name: "Ibarra Jose Pablo",     hours: 694.50, totalCost: 24366.91 },
  { name: "Juarez Angel",          hours: 55.73,  totalCost: 1611.99 },
  { name: "Kelly Kirk D",          hours: 573.04, totalCost: 16237.77 },
  { name: "Matthews Ron A",        hours: 374.18, totalCost: 10529.93 },
  { name: "Mcclam Michael A",      hours: 115.59, totalCost: 3343.44 },
  { name: "McNamara John",         hours: 690.94, totalCost: 22294.86 },
  { name: "Negrete Arturo",        hours: 371.01, totalCost: 11053.06 },
  { name: "Robinson Animashaun",   hours: 54.22,  totalCost: 1568.31 },
  { name: "Ronkov Martin P",       hours: 621.06, totalCost: 17334.95 },
  { name: "Secrest Jermelle",      hours: 65.49,  totalCost: 1894.30 },
  { name: "Striplin Lamareh",      hours: 122.15, totalCost: 3891.20 },
  { name: "Thorne Richard",        hours: 26.75,  totalCost: 773.74 },
  { name: "Wainwright Michael W",  hours: 549.69, totalCost: 16509.20 },
  { name: "Watkins Shawn",         hours: 113.42, totalCost: 3280.67 },
  { name: "Watson Dahnifu S",      hours: 612.91, totalCost: 17119.18 },
  { name: "Whipple Wallace",       hours: 690.81, totalCost: 22053.62 },
  { name: "Williams Tadaryl C",    hours: 605.02, totalCost: 17432.50 },
  { name: "Williams Will",         hours: 109.31, totalCost: 3161.79 },
  { name: "Willis Wali A",         hours: 718.30, totalCost: 23800.86 },
  { name: "Wright Robert",         hours: 260.66, totalCost: 9443.88 },
];

// ── FUEL DATA (EFS + Mudflap) ─────────────────────────────────
let FUEL = {
  "Alexander Christopher": { fuel: 4308.83, gallons: 786.33 },
  "Allwine Brian A":       { fuel: 3046.59, gallons: 382.17 },
  "Anderson Justin M":     { fuel: 600.83,  gallons: 126.00 },
  "Brown Jr Marcellus":    { fuel: 1333.67, gallons: 307.66 },
  "Butler Richard":        { fuel: 0,       gallons: 0 },
  "Clark Rettick":         { fuel: 1680.91, gallons: 400.24 },
  "Cotton Kejlon":         { fuel: 801.50,  gallons: 161.98 },
  "Davis Anthoni D":       { fuel: 18233.54,gallons: 3709.06 },
  "Denman Samuel E":       { fuel: 12402.37,gallons: 2875.66 },
  "Gutierrez Danny":       { fuel: 4127.15, gallons: 977.24 },
  "Guzman Jose":           { fuel: 6311.64, gallons: 1397.59 },
  "Howell Lawrence":       { fuel: 0,       gallons: 0 },
  "Ibarra Jose Pablo":     { fuel: 3446.50, gallons: 796.78 },
  "Juarez Angel":          { fuel: 0,       gallons: 0 },
  "Kelly Kirk D":          { fuel: 11788.16,gallons: 2505.03 },
  "Matthews Ron A":        { fuel: 3046.59, gallons: 382.17 },
  "Mcclam Michael A":      { fuel: 953.89,  gallons: 174.72 },
  "McNamara John":         { fuel: 10082.40,gallons: 2454.33 },
  "Negrete Arturo":        { fuel: 6494.46, gallons: 1511.56 },
  "Robinson Animashaun":   { fuel: 4261.56, gallons: 829.43 },
  "Ronkov Martin P":       { fuel: 2247.65, gallons: 531.90 },
  "Secrest Jermelle":      { fuel: 3208.09, gallons: 553.11 },
  "Striplin Lamareh":      { fuel: 2610.49, gallons: 470.73 },
  "Thorne Richard":        { fuel: 3624.97, gallons: 721.61 },
  "Wainwright Michael W":  { fuel: 0,       gallons: 0 },
  "Watkins Shawn":         { fuel: 3780.63, gallons: 734.57 },
  "Watson Dahnifu S":      { fuel: 6873.60, gallons: 1732.00 },
  "Whipple Wallace":       { fuel: 11190.11,gallons: 2690.06 },
  "Williams Tadaryl C":    { fuel: 7020.64, gallons: 1591.81 },
  "Williams Will":         { fuel: 2917.43, gallons: 538.70 },
  "Willis Wali A":         { fuel: 3879.77, gallons: 887.76 },
  "Wright Robert":         { fuel: 2521.36, gallons: 600.35 },
};

// ── FLEET CONSTANTS ───────────────────────────────────────────
let LABOR     = 356891.04;  // Updated: driver/hourly payroll only (salaried removed)
let FUEL_TOT  = 154660.96;  // EFS $144,424 + Mudflap $10,237
let GALLONS   = 35914.11;
let MILES_EST = GALLONS * 6.5;  // kept for fuel avg price calc
let MILES     = 205054.128;     // Samsara GPS actual, Jan 1 – Mar 15, 2026 (replaces estimated)
let TOTAL_HRS = 11422.94;  // Updated payroll hours
let INS_WEEK  = 6375;
let INS_TOT   = INS_WEEK * (72 / 7); // 72-day period = $65,571
let TRUCK_TOT  = 123494.38;  // Penske $25,113 + TEC/Transco $91,218 + TCI $13,950 - Mercury credit $6,787
let TRAILER_TOT = 51106.04;  // McKinney $29,665 + Xtra Lease $11,602 + Utility $7,560 + Premier $1,402 + Boxwheel $877
let EQUIP_TOT   = TRUCK_TOT + TRAILER_TOT; // $174,600
let TRUCK_MAINT  = 4048.81;   // Prime Wash, AutoForce, Titan Glass, Towing, Batteries, TZ Parts, eBay, SF Heavy Equipment
let TRAIL_MAINT  = 4139.71;   // TravelCenters of America, MKD Express
let STORAGE      = 10413.85;  // Storage on Wheels, Total Transportation, Parking Service Center
let MAINT_TOT    = TRUCK_MAINT + TRAIL_MAINT + STORAGE; // $18,602
let UNIFORMS     = 5264.10;   // Unifirst x3 ($3,909) + Safety Guard Shoe ($1,355)
// Basic CPM = Labor + Fuel + Truck Rentals + Insurance only
let BASIC_COST  = LABOR + FUEL_TOT + TRUCK_TOT + INS_TOT;
let BASIC_CPM_V = BASIC_COST / MILES;
// All-In CPM = everything tracked
let ALLIN_COST  = LABOR + FUEL_TOT + TRUCK_TOT + INS_TOT + TRAILER_TOT + TRUCK_MAINT + TRAIL_MAINT + STORAGE + UNIFORMS;
let ALLIN_CPM_V = ALLIN_COST / MILES;
let PERIOD    = "Jan 1 - Mar 13, 2026";

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

/* layout */
.main { flex: 1; padding: 22px; max-width: 1160px; width: 100%; margin: 0 auto; }
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
  { m:"Jan", local:21061.9, regional:62297.2, total:83359.1,
    trucks:{"20":{l:2928.4,r:471.7,t:3400.0},"120":{l:735.8,r:9478.5,t:10214.3},"127":{l:58.2,r:0.0,t:58.2},"149":{l:913.3,r:3773.4,t:4686.7},"476":{l:1413.0,r:2894.3,t:4307.3},"568":{l:2066.3,r:1799.0,t:3865.3},"573":{l:1252.3,r:312.7,t:1565.0},"574":{l:1366.0,r:5571.6,t:6937.6},"577":{l:1329.6,r:1537.7,t:2867.2},"589":{l:985.5,r:0.0,t:985.5},"676":{l:2393.2,r:1566.8,t:3960.0},"728":{l:1150.7,r:6177.9,t:7328.6},"730":{l:832.3,r:2308.5,t:3140.8},"731":{l:1194.8,r:5833.1,t:7027.9},"738":{l:1181.2,r:4762.9,t:5944.1},"937":{l:168.4,r:8775.7,t:8944.0},"951":{l:1092.9,r:7033.4,t:8126.3}} },
  { m:"Feb", local:15497.6, regional:50279.3, total:65776.9,
    trucks:{"20":{l:1307.1,r:0.0,t:1307.1},"120":{l:677.2,r:7520.8,t:8198.0},"127":{l:26.1,r:0.0,t:26.1},"149":{l:442.0,r:1476.7,t:1918.6},"441":{l:214.3,r:545.3,t:759.7},"476":{l:1123.0,r:2824.7,t:3947.7},"539":{l:1022.9,r:7378.4,t:8401.3},"568":{l:1205.8,r:4316.3,t:5522.1},"573":{l:1759.9,r:541.9,t:2301.8},"574":{l:990.1,r:2012.9,t:3003.0},"577":{l:1031.1,r:4856.4,t:5887.6},"676":{l:1716.4,r:0.0,t:1716.4},"728":{l:998.8,r:3636.6,t:4635.4},"730":{l:512.5,r:3673.7,t:4186.2},"731":{l:657.7,r:1432.3,t:2090.0},"738":{l:719.4,r:4825.6,t:5545.0},"951":{l:1093.3,r:5237.7,t:6331.0}} },
  { m:"Mar", local:11579.1, regional:53998.8, total:65577.9,
    trucks:{"20":{l:741.4,r:1222.7,t:1964.0},"120":{l:468.5,r:3217.5,t:3686.0},"127":{l:440.1,r:3419.2,t:3859.3},"149":{l:641.7,r:3462.2,t:4103.9},"189":{l:158.6,r:1154.9,t:1313.6},"353":{l:496.5,r:986.7,t:1483.2},"417":{l:208.8,r:2875.5,t:3084.3},"418":{l:307.6,r:3337.6,t:3645.2},"440":{l:771.8,r:763.7,t:1535.6},"441":{l:572.8,r:2439.3,t:3012.1},"476":{l:295.8,r:1124.0,t:1419.8},"539":{l:8.8,r:187.1,t:196.0},"568":{l:781.3,r:3943.8,t:4725.1},"569":{l:560.7,r:960.1,t:1520.9},"573":{l:1043.6,r:968.4,t:2012.0},"574":{l:551.9,r:2957.8,t:3509.7},"577":{l:483.9,r:3479.2,t:3963.2},"728":{l:687.5,r:4624.2,t:5311.7},"730":{l:384.4,r:2103.7,t:2488.1},"731":{l:678.1,r:3448.9,t:4127.0},"738":{l:400.9,r:4407.4,t:4808.3},"951":{l:727.2,r:1193.1,t:1920.3}} },
];


// ── TRUCK TYPE DATA ───────────────────────────────────────────
const TRUCK_TYPE = {
  "568":"Sleeper","728":"Sleeper","730":"Sleeper","731":"Sleeper",
  "738":"Sleeper","149":"Sleeper","574":"Sleeper","120":"Sleeper",
  "127":"Sleeper","417":"Sleeper","418":"Sleeper",
  "476":"Sleeper","539":"Sleeper","577":"Sleeper","937":"Sleeper",
  "20":"Day Cab","951":"Day Cab","353":"Day Cab","440":"Day Cab",
  "441":"Day Cab","569":"Day Cab","570":"Day Cab","573":"Day Cab",
  "676":"Day Cab","589":"Day Cab",
  "189":"Box Truck",
};

// ── SAMSARA MILEAGE DATA (Jan 1 – Mar 15, 2026) ──────────────
let TRUCK_MILES = [
  { truck:"120",  local:1832.5,  regional:20007.0, miles:21839.5, states:{"CA":8897.7,"AZ":2068.6,"NV":1832.5,"TX":1638.4,"NM":1494.8,"OK":1259.1,"GA":1032.1,"AR":1017.5,"AL":991.4,"MS":663.7,"TN":407.8,"LA":399.3,"SC":136.6} },
  { truck:"728",  local:2751.9,  regional:13978.0, miles:16729.9, states:{"CA":11044.8,"AZ":2933.2,"NV":2751.9} },
  { truck:"951",  local:2707.3,  regional:13464.2, miles:16171.5, states:{"CA":12380.5,"NV":2707.3,"AZ":1083.7} },
  { truck:"738",  local:2222.4,  regional:13491.6, miles:15714.0, states:{"CA":12234.1,"NV":2222.4,"AZ":638.1,"UT":619.4} },
  { truck:"568",  local:3974.3,  regional:9592.5,  miles:13566.8, states:{"CA":8303.2,"NV":3974.3,"AZ":1289.3} },
  { truck:"574",  local:2908.0,  regional:10542.3, miles:13450.3, states:{"CA":10071.6,"NV":2908.0,"AZ":470.7} },
  { truck:"731",  local:2530.5,  regional:10714.3, miles:13244.8, states:{"CA":9099.5,"NV":2530.5,"AZ":1614.8} },
  { truck:"577",  local:2840.3,  regional:9873.2,  miles:12713.5, states:{"CA":8746.5,"NV":2840.3,"AZ":1126.7} },
  { truck:"149",  local:1879.5,  regional:8209.8,  miles:10089.3, states:{"CA":8209.8,"NV":1879.5} },
  { truck:"730",  local:1729.3,  regional:8085.9,  miles:9815.2,  states:{"CA":8085.9,"NV":1729.3} },
  { truck:"476",  local:2831.8,  regional:6843.0,  miles:9674.8,  states:{"CA":6270.1,"NV":2831.8,"AZ":572.9} },
  { truck:"937",  local:168.4,   regional:8775.8,  miles:8944.2,  states:{"TX":1691.9,"CA":1176.2,"AZ":959.1,"AL":649.9,"LA":584.1,"NM":542.5,"MS":472.8,"OK":455.8,"GA":451.8,"MO":297.6,"MD":294.4,"VA":276.9,"OH":227.5,"NV":168.4,"IL":160.9,"IN":159.9,"NC":127.5,"SC":107.9,"WV":83.9,"PA":55.2} },
  { truck:"539",  local:1031.8,  regional:7565.5,  miles:8597.3,  states:{"CA":2853.6,"NV":1031.8,"AZ":934.4,"GA":700.1,"OK":669.3,"NM":635.8,"AR":575.8,"AL":384.9,"TX":355.3,"MS":264.8,"SC":165.3,"TN":26.2} },
  { truck:"20",   local:4888.1,  regional:995.8,   miles:5883.9,  states:{"NV":4888.1,"CA":995.8} },
  { truck:"573",  local:3912.3,  regional:1823.0,  miles:5735.3,  states:{"NV":3912.3,"CA":1823.0} },
  { truck:"676",  local:4109.6,  regional:1566.8,  miles:5676.4,  states:{"NV":4109.6,"CA":1566.8} },
  { truck:"127",  local:435.6,   regional:2874.2,  miles:3309.8,  states:{"CA":2874.2,"NV":435.6} },
  { truck:"441",  local:650.6,   regional:2495.9,  miles:3146.5,  states:{"CA":2495.9,"NV":650.6} },
  { truck:"418",  local:230.1,   regional:2708.9,  miles:2939.0,  states:{"CA":2708.9,"NV":230.1} },
  { truck:"417",  local:160.6,   regional:2184.0,  miles:2344.6,  states:{"CA":2184.0,"NV":160.6} },
  { truck:"569",  local:361.5,   regional:960.1,   miles:1321.6,  states:{"CA":960.1,"NV":361.5} },
  { truck:"353",  local:308.2,   regional:986.7,   miles:1294.9,  states:{"CA":986.7,"NV":308.2} },
  { truck:"189",  local:128.2,   regional:1154.9,  miles:1283.1,  states:{"CA":1154.9,"NV":128.2} },
  { truck:"589",  local:985.5,   regional:0,       miles:985.5,   states:{"NV":985.5} },
  { truck:"440",  local:533.0,   regional:49.3,    miles:582.3,   states:{"NV":533.0,"CA":49.3} },
];
let FLEET_LOCAL    = 46111.3;
let FLEET_REGIONAL = 158942.7;

// ── TRANSACTION DETAIL DATA ──────────────────────────────────
const DETAIL = {
  labor: {
    label: "Labor — Driver Payroll",
    thru: "Mar 13, 2026",
    note: "All-in employer cost: gross wages + SS + Medicare + NV SUI + FUTA + 401K match",
    total: 356891.04,
    cols: ["Driver", "Hours", "Employer Cost"],
    rows: DRIVERS.map(d => [d.name, d.hours.toFixed(2), d.totalCost]),
  },
  fuel: {
    label: "Fuel — EFS + Mudflap",
    thru: "EFS Mar 17 · Mudflap Mar 2 ⚠",
    note: "⚠ Mudflap data ends Mar 2 — approx. 2 weeks missing from that card",
    total: 154660.96,
    cols: ["Card", "Amount", "Gallons", "Avg $/Gal"],
    rows: [
      ["EFS Carrier Card", 144424.37, 33114.92, 4.389],
      ["Mudflap Card",     10236.59,  2799.19,  3.657],
    ],
  },
  insurance: {
    label: "Insurance",
    thru: "Mar 13, 2026",
    note: "Applied at $6,375/week over 72-day period (10.286 weeks)",
    total: 65571.43,
    cols: ["Description", "Rate", "Weeks", "Amount"],
    rows: [
      ["Truck Insurance Premium", "$6,375/wk", "10.286", 65571.43],
    ],
  },
  trucks: {
    label: "Truck Payments",
    thru: "Mar 10, 2026",
    note: "Includes Mercury Insurance property damage credit -$6,787.25",
    total: 123494.38,
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
    ],
  },
  trailers: {
    label: "Trailer Payments",
    thru: "Mar 14, 2026",
    note: "5 vendors: McKinney, Xtra Lease, Utility Trailers, Premier, Boxwheel",
    total: 51106.04,
    cols: ["Date", "Vendor", "Amount"],
    rows: [
      ["Jan 7",  "Utility Trailers",        2520.00],
      ["Jan 13", "Boxwheel Trailer Leasing",  876.73],
      ["Jan 24", "Xtra Lease",              4222.31],
      ["Feb 3",  "McKinney Trailer Rentals",2000.00],
      ["Feb 4",  "McKinney Trailer Rentals",2000.00],
      ["Feb 4",  "Utility Trailers",        2520.00],
      ["Feb 6",  "McKinney Trailer Rentals",2000.00],
      ["Feb 11", "McKinney Trailer Rentals",2000.00],
      ["Feb 12", "McKinney Trailer Rentals",4000.00],
      ["Feb 17", "McKinney Trailer Rentals",5137.31],
      ["Feb 18", "McKinney Trailer Rentals",1638.99],
      ["Feb 18", "Utility Trailers",        2520.00],
      ["Feb 21", "Xtra Lease",              6238.26],
      ["Mar 6",  "McKinney Trailer Rentals",10888.77],
      ["Mar 7",  "Xtra Lease",              1141.55],
      ["Mar 14", "Premier Trailers",        1402.12],
    ],
  },
  truckMaint: {
    label: "Truck Maintenance",
    thru: "Mar 11, 2026",
    note: "Two AutoForce credits netted in (-$140.33, -$503.18)",
    total: 4048.81,
    cols: ["Date", "Vendor", "Amount"],
    rows: [
      ["Jan 21", "Prime Washing",                      387.00],
      ["Feb 2",  "U.S. AutoForce",                     140.33],
      ["Feb 5",  "U.S. AutoForce (credit)",            -140.33],
      ["Feb 10", "Titan Auto Glass",                   398.00],
      ["Feb 11", "City to City Towing",                800.00],
      ["Feb 12", "Canos Batteries",                    201.91],
      ["Feb 18", "Dahnifu Watson",                     917.00],
      ["Feb 18", "U.S. AutoForce",                     503.18],
      ["Feb 20", "U.S. AutoForce (credit)",           -503.18],
      ["Feb 25", "TZ Parts",                           490.90],
      ["Mar 5",  "eBay",                               179.74],
      ["Mar 11", "San Francisco Heavy Equipment Repair",674.26],
    ],
  },
  trailerMaint: {
    label: "Trailer Maintenance",
    thru: "Mar 6, 2026",
    note: "2 vendors this period",
    total: 4139.71,
    cols: ["Date", "Vendor", "Amount"],
    rows: [
      ["Feb 20", "TravelCenters of America", 3734.48],
      ["Mar 6",  "MKD Express LLC",           405.23],
    ],
  },
  uniforms: {
    label: "Worker Uniforms",
    thru: "Mar 5, 2026",
    note: "Unifirst monthly service + Safety Guard Shoe one-time purchase",
    total: 5264.10,
    cols: ["Date", "Vendor", "Amount"],
    rows: [
      ["Jan 1",  "Unifirst Corporation",   1772.85],
      ["Jan 31", "Unifirst Corporation",    774.93],
      ["Feb 28", "Unifirst Corporation",   1361.73],
      ["Mar 5",  "Safety Guard Shoe",      1354.59],
    ],
  },
  storage: {
    label: "Storage / Parking",
    thru: "Mar 16, 2026",
    note: "Total Transportation is recurring $3,100/period",
    total: 10413.85,
    cols: ["Date", "Vendor", "Amount"],
    rows: [
      ["Jan 14", "Storage on Wheels",         270.94],
      ["Jan 16", "Storage on Wheels",          97.54],
      ["Feb 9",  "Total Transportation",      3100.00],
      ["Feb 9",  "Parking Service Center",     105.95],
      ["Feb 16", "Storage on Wheels",          270.94],
      ["Feb 17", "Storage on Wheels",           97.54],
      ["Mar 9",  "Total Transportation",      3100.00],
      ["Mar 16", "Storage on Wheels",          270.94],
    ],
  },
};

// ── TABS ──────────────────────────────────────────────────────
const TABS = [
  { id: "overview", icon: "🏢", label: "Fleet Overview" },
  { id: "basiccpm", icon: "🧮", label: "CPM Calculator" },
  { id: "driver",   icon: "🚛", label: "Driver Detail" },
  { id: "trucks",   icon: "📍", label: "Trucks & Mileage" },
  { id: "fuel",     icon: "🛢", label: "Fuel Analysis" },
  { id: "trucks2",  icon: "🚛", label: "Trucks" },
  { id: "trailers", icon: "🚜", label: "Trailers" },
  { id: "income",  icon: "💵", label: "Income" },
  { id: "ceeast",   icon: "🏦", label: "CE East" },
  { id: "settings", icon: "📂", label: "Upload" },
];


// ── DETAIL MODAL ──────────────────────────────────────────────
function DetailModal({ id, onClose }) {
  if (!id) return null;
  const d = DETAIL[id];
  if (!d) return null;

  const isMoney = v => typeof v === "number" && (Math.abs(v) > 1 || v === 0);
  const isDriver = id === "labor";

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
              through {d.thru}
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
                {d.cols.map(c => <th key={c} style={{ position: "sticky", top: 0, background: "var(--s2)", textAlign: c === d.cols[0] || c === "Driver" || c === "Vendor" || c === "Description" || c === "Card" ? "left" : "right" }}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {d.rows.map((row, i) => (
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
                {d.cols.map((c, j) => (
                  <td key={c} style={{ textAlign: j === 0 ? "left" : "right" }}>
                    {j === 0 ? "TOTAL" : j === d.cols.length - 1 ? fd(d.total, 0) : ""}
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

  const sorted = useMemo(() => {
    const arr = [...TRUCK_MILES];
    if (sortKey === "miles")    return arr.sort((a,b) => b.miles    - a.miles);
    if (sortKey === "local")    return arr.sort((a,b) => b.local    - a.local);
    if (sortKey === "regional") return arr.sort((a,b) => b.regional - a.regional);
    if (sortKey === "truck")    return arr.sort((a,b) => Number(a.truck) - Number(b.truck));
    if (sortKey === "localPct") return arr.sort((a,b) => (b.local/b.miles) - (a.local/a.miles));
    return arr;
  }, [sortKey]);

  const STATE_COLORS = {
    CA:"#f47820",NV:"#4fc3f7",AZ:"#3ddc84",TX:"#f5c542",OR:"#b39ddb",
    UT:"#a78bfa",NM:"#ff8a65",GA:"#26a69a",AR:"#ef5350",OK:"#ab47bc",
    AL:"#66bb6a",TN:"#29b6f6",MS:"#ff7043",LA:"#8d6e63",SC:"#ec407a",
    WV:"#78909c",VA:"#5c6bc0",MD:"#26c6da",OH:"#d4e157",NC:"#ffa726",
    IN:"#42a5f5",PA:"#7e57c2",IL:"#26a69a",MO:"#ff7043",
  };
  const getColor = (st, i) => STATE_COLORS[st] || `hsl(${(i*47)%360},60%,55%)`;

  const localPct    = FLEET_LOCAL    / MILES * 100;
  const regionalPct = FLEET_REGIONAL / MILES * 100;

  return (
    <div>
      <div className="ptitle">Trucks + Mileage</div>
      <div className="psub">Samsara GPS · Jan 1 – Mar 15, 2026 · 25 trucks · NV = Local · All other states = Regional</div>

      {/* Fleet summary KPIs */}
      <div className="g4" style={{ marginBottom:14 }}>
        <div className="kpi">
          <div className="klbl">Total Fleet Miles</div>
          <div className="kval" style={{ color:"#4fc3f7" }}>{fn(MILES,0)}</div>
          <div className="ksub">Samsara GPS · 25 trucks</div>
        </div>
        <div className="kpi">
          <div className="klbl">Local Miles (NV)</div>
          <div className="kval" style={{ color:"#3ddc84" }}>{fn(FLEET_LOCAL,0)}</div>
          <div className="ksub">{fp(localPct)} of fleet</div>
        </div>
        <div className="kpi">
          <div className="klbl">Regional Miles</div>
          <div className="kval" style={{ color:"#f47820" }}>{fn(FLEET_REGIONAL,0)}</div>
          <div className="ksub">{fp(regionalPct)} of fleet</div>
        </div>
        <div className="kpi">
          <div className="klbl">Avg Miles / Truck</div>
          <div className="kval" style={{ color:"#f5c542" }}>{fn(MILES/25,0)}</div>
          <div className="ksub">{fn(FLEET_LOCAL/25,0)} local · {fn(FLEET_REGIONAL/25,0)} regional</div>
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
          <span><span style={{ color:"#3ddc84" }}>■</span> Local (NV): {fn(FLEET_LOCAL,0)} mi</span>
          <span><span style={{ color:"#f47820" }}>■</span> Regional (all other states): {fn(FLEET_REGIONAL,0)} mi</span>
          <span style={{ color:"var(--mu)" }}>Total: {fn(MILES,0)} mi</span>
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
            { label:"Labor",         val:LABOR,    cpm:lCPM, color:"#f47820", sub:"32 drivers · all-in employer cost" },
            { label:"Fuel",          val:FUEL_TOT, cpm:fCPM, color:"#f5c542", sub:"EFS + Mudflap · "+fn(GALLONS,0)+" gal" },
            { label:"Truck Rentals", val:TRUCK_TOT,cpm:tCPM, color:"#4fc3f7", sub:"Penske + TEC/Transco + TCI" },
            { label:"Insurance",     val:INS_TOT,  cpm:iCPM, color:"#b39ddb", sub:"$6,375/wk · 72-day period" },
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
      <div className="psub">Show Freight Inc · {PERIOD} · 32 Drivers</div>

      <div className="sbox">
        <strong style={{ color: "#4fc3f7" }}>Data sources loaded:</strong>
        {" "}Payroll $356,891 <span style={{color:"var(--mu)"}}>(thru Mar 13)</span> ·
        {" "}Fuel EFS $144,424 <span style={{color:"var(--mu)"}}>(thru Mar 17)</span> ·
        {" "}Fuel Mudflap $10,237 <span style={{color:"#f5c542"}}>(thru Mar 2 ⚠)</span> ·
        {" "}Insurance $65,571 <span style={{color:"var(--mu)"}}>(thru Mar 13)</span> ·
        {" "}Trucks $123,494 <span style={{color:"var(--mu)"}}>(thru Mar 10)</span> ·
        {" "}Trailers $51,106 <span style={{color:"var(--mu)"}}>(thru Mar 14)</span> ·
        {" "}Truck Maint $4,049 <span style={{color:"var(--mu)"}}>(thru Mar 11)</span> ·
        {" "}Trailer Maint $4,140 <span style={{color:"var(--mu)"}}>(thru Mar 6)</span> ·
        {" "}Storage $10,414 <span style={{color:"var(--mu)"}}>(thru Mar 16)</span> ·
        {" "}Uniforms $5,264 <span style={{color:"var(--mu)"}}>(thru Mar 5)</span>
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
            {fn(MILES, 0)} mi · Jan 1 – Mar 15, 2026
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
          <div className="kpi"><div className="klbl">Truck CPM</div><div className="kval" style={{ fontSize: 18, color: "#4fc3f7" }}>{fd(TRUCK_TOT/MILES_EST, 3)}</div></div>
          <div className="kpi"><div className="klbl">Trailer CPM</div><div className="kval" style={{ fontSize: 18, color: "#3ddc84" }}>{fd(TRAILER_TOT/MILES_EST, 3)}</div></div>
          <div className="kpi"><div className="klbl">Maint+Stor CPM</div><div className="kval" style={{ fontSize: 18, color: "#d97706" }}>{fd(MAINT_TOT/MILES_EST, 3)}</div></div>
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
          <div className="kval" style={{ color: "#f47820" }}>$144,424</div>
          <div className="ksub">33,115 gal · $4.389/gal avg</div>
        </div>
        <div className="kpi">
          <div className="klbl">Mudflap Spend</div>
          <div className="kval" style={{ color: "#f5c542" }}>$10,237</div>
          <div className="ksub">2,799 gal · $931 savings</div>
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
  // 4x lease contract invoices
  lease: [
    { invoice:"31L1710001", date:"Feb 19, 2026", unit:"26440", vin:"3AKJHLDV7TSWN4160", contract:1710, period:"Feb 10–28, 2026",
      fixed:1684.00, license:1906.97, fhut:229.17, misc:2136.14, total:3820.14 },
    { invoice:"31L1711001", date:"Feb 19, 2026", unit:"26441", vin:"3AKJHLDV9TSWN4161", contract:1711, period:"Feb 11–28, 2026",
      fixed:1572.00, license:1651.14, fhut:229.17, misc:1880.31, total:3452.31 },
    { invoice:"31L1712001", date:"Feb 19, 2026", unit:"26569", vin:"3AKJHLDV1TSWN4283", contract:1712, period:"Feb 10–28, 2026",
      fixed:1684.00, license:1311.74, fhut:229.17, misc:1540.91, total:3224.91 },
    { invoice:"31L1713001", date:"Feb 19, 2026", unit:"26570", vin:"3AKJHLDV3TSWN4284", contract:1713, period:"Feb 10–28, 2026",
      fixed:1684.00, license:1311.74, fhut:229.17, misc:1540.91, total:3224.91 },
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
  const [view, setView] = useState("penske"); // penske | lease | rentals | shop

  const lu   = TEC_EQUIPMENT.lease.units;
  const totalMiles = lu.reduce((s,u)=>s+u.miles,0);
  const totalFixed = lu.reduce((s,u)=>s+u.fixed,0);
  const totalMiChg = lu.reduce((s,u)=>s+u.miCharge,0);
  const rentalTotal= TEC_EQUIPMENT.rentals.reduce((s,r)=>s+r.total,0);
  const shopTotal  = TEC_EQUIPMENT.shop.reduce((s,r)=>s+r.total,0);
  const penskeTotal = PENSKE.invoices.reduce((s,i)=>s+i.total,0);
  const tciTotal    = TCI_LEASING.service.reduce((s,i)=>s+i.total,0) + TCI_LEASING.lease.reduce((s,i)=>s+i.total,0);
  const grandTotal  = TEC_EQUIPMENT.lease.total + rentalTotal + shopTotal + penskeTotal + tciTotal;

  return (
    <div>
      <div className="ptitle">Trucks</div>
      <div className="psub">TEC Equipment · Penske · TCI Leasing · Feb–Mar 2026 · Lease · Rental · Service</div>

      {/* Grand summary KPIs */}
      <div className="g4" style={{ marginBottom:14 }}>
        <div className="kpi">
          <div className="klbl">Total Truck Spend</div>
          <div className="kval" style={{ color:"#f47820" }}>{fd(grandTotal,0)}</div>
          <div className="ksub">TEC {fd(TEC_EQUIPMENT.lease.total+rentalTotal+shopTotal,0)} · Penske {fd(penskeTotal,0)} · TCI {fd(tciTotal,0)}</div>
        </div>
        <div className="kpi">
          <div className="klbl">Leased Units</div>
          <div className="kval" style={{ color:"#3ddc84" }}>{lu.length}</div>
          <div className="ksub">Agreement #875 · Mar 2026</div>
        </div>
        <div className="kpi">
          <div className="klbl">Total Miles (Lease)</div>
          <div className="kval" style={{ color:"#4fc3f7" }}>{fn(totalMiles,0)}</div>
          <div className="ksub">@ avg ${(totalMiChg/totalMiles).toFixed(4)}/mi charge</div>
        </div>
        <div className="kpi">
          <div className="klbl">Avg Cost / Leased Unit</div>
          <div className="kval" style={{ color:"#f5c542" }}>{fd(TEC_EQUIPMENT.lease.total/lu.length,0)}</div>
          <div className="ksub">fixed {fd(totalFixed/lu.length,0)} + variable</div>
        </div>
      </div>

      {/* View toggle */}
      <div style={{ display:"flex",gap:8,marginBottom:14,flexWrap:"wrap" }}>
        {[
          ["tci",    `🔧 TCI (8 inv)`],
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

      {/* ── TCI VIEW ── */}
      {view === "tci" && (
        <>
          {/* Summary KPIs */}
          <div className="g4" style={{ marginBottom:14 }}>
            <div className="kpi">
              <div className="klbl">Total TCI Spend</div>
              <div className="kval" style={{ color:"#f47820" }}>{fd(TCI_LEASING.service.reduce((s,i)=>s+i.total,0)+TCI_LEASING.lease.reduce((s,i)=>s+i.total,0),0)}</div>
              <div className="ksub">Service {fd(TCI_LEASING.service.reduce((s,i)=>s+i.total,0),0)} · Lease {fd(TCI_LEASING.lease.reduce((s,i)=>s+i.total,0),0)}</div>
            </div>
            <div className="kpi">
              <div className="klbl">Units</div>
              <div className="kval" style={{ color:"#3ddc84" }}>4</div>
              <div className="ksub">2026 Freightliner CA126DC — all new TCI</div>
            </div>
            <div className="kpi">
              <div className="klbl">License Fees</div>
              <div className="kval" style={{ color:"#f5c542" }}>{fd(TCI_LEASING.lease.reduce((s,i)=>s+i.license,0),0)}</div>
              <div className="ksub">2026–2027 annual registration</div>
            </div>
            <div className="kpi">
              <div className="klbl">FHUT Fees</div>
              <div className="kval" style={{ color:"#4fc3f7" }}>{fd(TCI_LEASING.lease.reduce((s,i)=>s+i.fhut,0),0)}</div>
              <div className="ksub">Prorated Feb–Jul 2026 · 4 units</div>
            </div>
          </div>

          {/* Lease contracts */}
          <div className="card" style={{ marginBottom:14 }}>
            <div className="ctit">TCI Lease Contracts — 4 New Freightliner CA126DC (2026)</div>
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
                    <td colSpan={5}>TOTAL — 4 units</td>
                    <td style={{ color:"#4fc3f7" }}>{fd(TCI_LEASING.lease.reduce((s,i)=>s+i.fixed,0),0)}</td>
                    <td style={{ color:"#f5c542" }}>{fd(TCI_LEASING.lease.reduce((s,i)=>s+i.license,0),0)}</td>
                    <td style={{ color:"#b39ddb" }}>{fd(TCI_LEASING.lease.reduce((s,i)=>s+i.fhut,0),0)}</td>
                    <td style={{ color:"#f47820",fontWeight:800 }}>{fd(TCI_LEASING.lease.reduce((s,i)=>s+i.total,0),2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
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
  const [view, setView]       = useState("fleet"); // fleet | repairs
  const [vendor, setVendor]   = useState("all"); // all | mckinney | xtra | mtnwest

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
      <div className="psub">McKinney · XTRA Lease · Mountain West · Feb–Mar 2026 · 58 units across 3 vendors</div>

      {/* View toggle */}
      <div style={{ display:"flex",gap:8,marginBottom:14 }}>
        {[["fleet","🚜 Fleet & Rentals"],["repairs","🔧 Repairs & Maintenance"]].map(([id,lbl]) => (
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
  period: "Jan 1 – Mar 18, 2026",
  ce:  2471963.81, sf: 798791.81, di: 36658.75,
  total: 3307414.37,
  cogs: 1735680.36, grossProfit: 1571734.01,
  totalExp: 1590848.74, netOpIncome: -19114.73,
  netIncome: 44702.93,
  carrierPay: 1680600.76, merchantFees: 55079.60,
  // Combined weekly + per-company breakdown (CE, SF, DI from P&L columns)
  weeks: [
    { label:"Jan 1-4",   rev:86886.02,  gp:52052.64,  ce:71474.65,  sf:14362.37,  di:1049.00,  ref25:158397 },
    { label:"Jan 5-11",  rev:167335.63, gp:76449.43,  ce:103721.70, sf:63463.93,  di:150.00,   ref25:158397 },
    { label:"Jan 12-18", rev:239072.36, gp:96713.35,  ce:164803.92, sf:68403.04,  di:5865.40,  ref25:158397 },
    { label:"Jan 19-25", rev:249993.50, gp:109470.39, ce:157601.79, sf:89058.86,  di:3332.85,  ref25:158397 },
    { label:"Jan 26-F1", rev:249874.28, gp:146247.69, ce:165858.08, sf:79466.20,  di:4550.00,  ref25:158397 },
    { label:"Feb 2-8",   rev:441729.58, gp:156641.30, ce:355998.69, sf:85296.04,  di:434.85,   ref25:247136 },
    { label:"Feb 9-15",  rev:526250.37, gp:235956.79, ce:403325.58, sf:121889.79, di:1035.00,  ref25:247136 },
    { label:"Feb 16-22", rev:259947.62, gp:121921.58, ce:200471.24, sf:58840.48,  di:635.90,   ref25:247136 },
    { label:"Feb 23-M1", rev:379906.17, gp:168598.15, ce:304358.58, sf:71016.84,  di:4530.75,  ref25:247136 },
    { label:"Mar 2-8",   rev:369704.58, gp:165061.53, ce:286145.38, sf:68554.20,  di:15005.00, ref25:292349 },
    { label:"Mar 9-15",  rev:201670.91, gp:107577.81, ce:123160.85, sf:78440.06,  di:70.00,    ref25:292349 },
    { label:"Mar 16-18", rev:135043.35, gp:135043.35, ce:135043.35, sf:0,         di:0,         ref25:292349 },
  ],
  months: [
    { m: "Jan", rev: 993161.79,  gp: 480933.50  },
    { m: "Feb", rev: 1607833.74, gp: 683037.82  },
    { m: "Mar", rev: 706418.84,  gp: 407762.69  },
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
function IncomeDashboard() {
  const [view, setView]           = useState("overview"); // overview | trend | yoy
  const [trendMode, setTrendMode] = useState("combined"); // combined | byco | monthly

  const gpMargin26 = INCOME_2026.grossProfit / INCOME_2026.total * 100;
  const gpMargin25 = INCOME_2025.grossProfit / INCOME_2025.total * 100;
  const yoyRevChg  = (INCOME_2026.total / INCOME_2025.q1Rev - 1) * 100;
  const yoyGPChg   = (INCOME_2026.grossProfit / INCOME_2025.q1GP - 1) * 100;

  // Custom tooltip for recharts
  const CustomTip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: "var(--s2)", border: "1px solid var(--bd)", borderRadius: 3, padding: "10px 14px", fontSize: 11 }}>
        <div style={{ color: "var(--or)", fontFamily: "var(--f2)", fontWeight: 700, marginBottom: 6 }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color, marginBottom: 2 }}>
            {p.name}: {fd(p.value, 0)}
          </div>
        ))}
      </div>
    );
  };

  // Month comparison data
  const monthCompare = [
    { m: "Jan", v26: INCOME_2026.months[0].rev, v25: INCOME_2025.months[0].rev },
    { m: "Feb", v26: INCOME_2026.months[1].rev, v25: INCOME_2025.months[1].rev },
    { m: "Mar", v26: INCOME_2026.months[2].rev, v25: INCOME_2025.months[2].rev },
  ];

  return (
    <div>
      <div className="ptitle">Income</div>
      <div className="psub">CE + SF + DI Combined · Jan 1 – Mar 18, 2026 vs Full Year 2025</div>

      {/* Sub-nav */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {[["overview","📊","Overview"],["trend","📈","Weekly Trend"],["yoy","🔄","YoY Comparison"]].map(([id,ico,lbl]) => (
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
                <div style={{ fontSize:11,color:"var(--mu)",marginTop:3,position:"relative" }}>({fd(co.val/77*365,0)} proj. full year)</div>
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

          {/* Top 3 cost categories as % of revenue */}
          <div className="card" style={{ marginBottom:14 }}>
            <div className="ctit">Top Cost Categories — % of Revenue</div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14 }}>
              {[
                { label:"Carrier Pay",    val:INCOME_2026.carrierPay,    color:"#ff5252", note:"Largest single cost" },
                { label:"Total Expenses", val:INCOME_2026.totalExp,      color:"#ff8a65", note:"All operating expenses" },
                { label:"Merchant Fees",  val:INCOME_2026.merchantFees,  color:"#ffa726", note:"Triumph processing fees" },
              ].map(item => {
                const pct = item.val / INCOME_2026.total * 100;
                return (
                  <div key={item.label} style={{ textAlign:"center",padding:"8px 0" }}>
                    <div style={{ fontSize:9,color:"var(--mu)",letterSpacing:2,textTransform:"uppercase",marginBottom:6 }}>{item.label}</div>
                    <div style={{ fontFamily:"var(--f2)",fontSize:36,fontWeight:900,color:item.color }}>{fp(pct)}</div>
                    <div style={{ fontFamily:"var(--f2)",fontSize:14,color:"var(--mu)",marginTop:4 }}>{fd(item.val,0)}</div>
                    <div style={{ fontSize:10,color:"var(--mu)",marginTop:2 }}>{item.note}</div>
                    <div className="bar" style={{ marginTop:8 }}>
                      <div className="bfil" style={{ width:`${Math.min(100,pct)}%`,background:item.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Revenue split bars — 2026 vs 2025 */}
          <div className="card" style={{ marginBottom:14 }}>
            <div className="ctit">Revenue Split — 2026 YTD vs 2025 Full Year</div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:20 }}>
              {[
                { label:"2026 YTD", total:INCOME_2026.total, ce:INCOME_2026.ce, sf:INCOME_2026.sf, di:INCOME_2026.di },
                { label:"2025 Full Year", total:INCOME_2025.total, ce:INCOME_2025.ce, sf:INCOME_2025.sf, di:INCOME_2025.di },
              ].map(yr => (
                <div key={yr.label}>
                  <div style={{ fontSize:10,color:"var(--mu)",letterSpacing:2,textTransform:"uppercase",marginBottom:10 }}>{yr.label}</div>
                  {[
                    { key:"ce",label:"CE",color:"#f47820",val:yr.ce },
                    { key:"sf",label:"SF",color:"#4fc3f7",val:yr.sf },
                    { key:"di",label:"DI",color:"#b39ddb",val:yr.di },
                  ].map(co => (
                    <div key={co.key} style={{ marginBottom:10 }}>
                      <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4 }}>
                        <span style={{ color:"var(--tx)",fontWeight:600 }}>{co.label}</span>
                        <span style={{ color:co.color }}>{fd(co.val,0)} · {fp(co.val/yr.total*100)}</span>
                      </div>
                      <div className="bar" style={{ height:10 }}>
                        <div className="bfil" style={{ width:`${co.val/yr.total*100}%`,background:co.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* P&L Summary table */}
          <div className="card">
            <div className="ctit">P&L Summary</div>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ textAlign:"left" }}>Line Item</th>
                  <th>2026 YTD (Mar 18)</th>
                  <th>2025 Q1 est.</th>
                  <th>2025 Full Year</th>
                  <th>YoY vs Q1</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label:"Total Revenue",   v26:INCOME_2026.total,       q1:INCOME_2025.q1Rev,  fy:INCOME_2025.total,      hi:true },
                  { label:"COGS",            v26:-INCOME_2026.cogs,       q1:null,               fy:-INCOME_2025.cogs,      neg:true },
                  { label:"Gross Profit",    v26:INCOME_2026.grossProfit, q1:INCOME_2025.q1GP,   fy:INCOME_2025.grossProfit,hi:true },
                  { label:"GP Margin",       v26:gpMargin26,              q1:INCOME_2025.q1GP/INCOME_2025.q1Rev*100, fy:gpMargin25, pct:true },
                  { label:"Net Income",      v26:INCOME_2026.netIncome,   q1:INCOME_2025.q1NI,   fy:INCOME_2025.netIncome,  color:true,hi:true },
                ].map((r,i) => {
                  const chg = r.q1 != null ? (r.pct ? r.v26 - r.q1 : (r.v26/r.q1-1)*100) : null;
                  return (
                    <tr key={r.label} style={{ background:i%2===0?"var(--s2)":"transparent" }}>
                      <td style={{ fontWeight:r.hi?700:400 }}>{r.label}</td>
                      <td style={{ color:r.pct?undefined:r.color?(r.v26>=0?"var(--gn)":"var(--rd)"):r.neg?"var(--rd)":"var(--ye)", fontWeight:r.hi?700:400 }}>
                        {r.pct ? fp(r.v26) : fd(r.v26,0)}
                      </td>
                      <td style={{ color:"var(--mu)" }}>{r.q1!=null?(r.pct?fp(r.q1):fd(r.q1,0)):"—"}</td>
                      <td style={{ color:"var(--mu)" }}>{r.pct?fp(r.fy):fd(r.fy,0)}</td>
                      <td style={{ color:chg==null?"var(--mu)":chg>=0?"var(--gn)":"var(--rd)",fontWeight:700 }}>
                        {chg==null?"—":r.pct?`${chg>=0?"+":""}${chg.toFixed(1)} pts`:`${chg>=0?"+":""}${chg.toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}


      {/* ── WEEKLY TREND ── */}
      {view === "trend" && (
        <>
          <div className="g3" style={{ marginBottom:14 }}>
            <div className="kpi">
              <div className="klbl">Best Week (Total)</div>
              <div className="kval" style={{ color:"var(--gn)",fontSize:20 }}>Feb 9-15</div>
              <div className="ksub">{fd(526250.37,0)} revenue</div>
            </div>
            <div className="kpi">
              <div className="klbl">Avg Weekly Revenue</div>
              <div className="kval" style={{ color:"var(--ye)",fontSize:20 }}>{fd(INCOME_2026.total/12,0)}</div>
              <div className="ksub">over 12 periods</div>
            </div>
            <div className="kpi">
              <div className="klbl">CE Total YTD</div>
              <div className="kval" style={{ color:"var(--or)",fontSize:20 }}>{fd(INCOME_2026.ce,0)}</div>
              <div className="ksub">largest entity</div>
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
              <div className="ctit">Weekly Revenue 2026 vs 2025 Weekly Avg</div>
              <div style={{ fontSize:10,color:"var(--mu)",marginBottom:8 }}>
                2025 line = monthly average distributed evenly across weeks (Jan $158K · Feb $247K · Mar $292K avg/wk)
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={INCOME_2026.weeks} margin={{ top:8,right:10,left:10,bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bd)" />
                  <XAxis dataKey="label" tick={{ fill:"var(--mu)",fontSize:9 }} />
                  <YAxis tick={{ fill:"var(--mu)",fontSize:9 }} tickFormatter={v=>"$"+Math.round(v/1000)+"k"} />
                  <Tooltip content={<CustomTip />} />
                  <Bar dataKey="rev" name="2026 Revenue" fill="#3ddc84" radius={[2,2,0,0]} />
                  <Bar dataKey="gp"  name="2026 Gross Profit" fill="#f47820" radius={[2,2,0,0]} />
                  <Line dataKey="ref25" name="2025 Wkly Avg" stroke="#f5c542" strokeWidth={2.5}
                    dot={{ r:4, fill:"#f5c542", strokeWidth:0 }}
                    type="monotone" />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display:"flex",gap:20,fontSize:10,color:"var(--mu)",marginTop:8 }}>
                <span><span style={{ color:"#3ddc84" }}>■</span> 2026 Revenue</span>
                <span><span style={{ color:"#f47820" }}>■</span> 2026 Gross Profit</span>
                <span><span style={{ color:"#f5c542" }}>—</span> 2025 Weekly Avg</span>
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
              <div className="klbl">2026 YTD Revenue</div>
              <div className="kval" style={{ color:"var(--gn)" }}>{fd(INCOME_2026.total,0)}</div>
              <div className="ksub">Jan 1 – Mar 18</div>
            </div>
            <div className="kpi">
              <div className="klbl">2025 Q1 Revenue</div>
              <div className="kval" style={{ color:"var(--mu)" }}>{fd(INCOME_2025.q1Rev,0)}</div>
              <div className="ksub">Jan 1 – Mar 16 (est.)</div>
            </div>
            <div className="kpi">
              <div className="klbl">YoY Revenue Change</div>
              <div className="kval" style={{ color:"var(--gn)" }}>+{yoyRevChg.toFixed(1)}%</div>
              <div className="ksub">+{fd(INCOME_2026.total-INCOME_2025.q1Rev,0)}</div>
            </div>
            <div className="kpi">
              <div className="klbl">2025 Full Year</div>
              <div className="kval" style={{ color:"var(--ye)" }}>{fd(INCOME_2025.total,0)}</div>
              <div className="ksub">GP {fp(gpMargin25)}</div>
            </div>
          </div>

          {/* Month by month side by side */}
          <div className="card" style={{ marginBottom:14 }}>
            <div className="ctit">Monthly Revenue — 2026 vs 2025 (Q1 Comparison)</div>
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
            <div className="ctit">Net Income — 2026 YTD vs 2025</div>
            <div className="g3" style={{ gap:10 }}>
              <div className="kpi">
                <div className="klbl">2026 YTD Net Income</div>
                <div className="kval" style={{ color:"var(--gn)" }}>{fd(INCOME_2026.netIncome,0)}</div>
                <div className="ksub">Positive — ahead of 2025</div>
              </div>
              <div className="kpi">
                <div className="klbl">2025 Q1 Net Income</div>
                <div className="kval" style={{ color:"var(--rd)" }}>{fd(INCOME_2025.q1NI,0)}</div>
                <div className="ksub">Jan–Mar 2025 was a loss</div>
              </div>
              <div className="kpi">
                <div className="klbl">2025 Full Year Net</div>
                <div className="kval" style={{ color:"var(--rd)" }}>{fd(INCOME_2025.netIncome,0)}</div>
                <div className="ksub">Full year 2025 was a loss</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


// ── CE EAST ───────────────────────────────────────────────────
const CE_EAST = {
  // Balance Sheet — as of Mar 18, 2026
  bs: {
    cash: 837.00,
    arFunding: 56660.37, arReleased: 17261.25, arUnreleased: 12117.87,
    arTotal: 86039.49, dueFromAnthony: 22000.00,
    totalAssets: 108876.49,
    dueToAnthony: 13620.24, dueToChris: 129642.77,
    totalLiab: 143263.01,
    retainedEarnings: -51572.93, netIncome2026: 28237.14,
    totalEquity: -23335.79,
  },
  // P&L — All Dates (lifetime)
  pl: {
    revenue: 987897.77, cogs: 857072.90,
    grossProfit: 130824.87, expenses: 143176.26,
    netIncome: -12351.39,
    salaries: 85975.90, freightIns: 13059.51, computers: 17299.00,
    travel: 11621.19, utilities: 2796.32, officeSup: 4884.83,
    rent: 4390.00, meals: 598.11, commissions: 1733.25,
    carrierPay: 840955.00, merchantFees: 16117.90,
  },
  // CE East monthly 2026
  months2026: [
    { m:"Jan 26", rev:258555.00, gp:33360.69 },
    { m:"Feb 26", rev:156830.01, gp:30796.68 },
    { m:"Mar 26", rev:90761.75,  gp:23294.89 },
  ],
  ytdDays: 77,  // Jan 1 – Mar 18, 2026
};

function CEEast() {
  const [distPct, setDistPct] = useState(50);

  const bs = CE_EAST.bs;
  const pl = CE_EAST.pl;

  // ── Shareholder obligations ──
  const dueToChr  = bs.dueToChris;
  const dueToAnt  = bs.dueToAnthony;
  const totalDue  = dueToChr + dueToAnt;
  const dueFromAnt = bs.dueFromAnthony;

  // ── Progress ── pl.grossProfit is all-time (includes 2026) from the P&L file
  const gpAllTime = pl.grossProfit; // $130,824.87
  const gap       = totalDue - gpAllTime;
  const pctDone   = gpAllTime / totalDue * 100;

  // ── 2026 GP pace — from actual monthly data ──
  const monthlyGP  = CE_EAST.months2026.reduce((s,r)=>s+r.gp,0) / CE_EAST.months2026.length; // avg of Jan/Feb/Mar
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
  const monthlyDist = monthlyGP * (distPct / 100);
  const annualDist  = monthlyDist * 12;

  // ── Month projection bars ──
  const months = [];
  let cumGP = gpAllTime;
  let m = new Date(2026, 2, 1);
  for (let i = 0; i < 5; i++) {
    if (i > 0) cumGP += monthlyGP;
    months.push({
      label: m.toLocaleDateString("en-US", { month:"short", year:"2-digit" }),
      pct: Math.min(100, cumGP / totalDue * 100),
      done: cumGP >= totalDue,
      first: cumGP >= totalDue && (months.length === 0 || months[months.length-1]?.pct < 100),
    });
    m.setMonth(m.getMonth() + 1);
  }

  // ── 2026 monthly revenue (from MONTHLY_REVENUE) ──
  const rev2026 = MONTHLY_REVENUE.filter(r => r.m.includes("26"));
  const rev2025Total = INCOME_2025.total;
  const rev2025GP    = INCOME_2025.grossProfit;

  return (
    <div>
      <div className="ptitle">CE East — Owner Payback</div>
      <div className="psub">Distributions begin when cumulative gross profit exceeds shareholder loans</div>


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
            {CE_EAST.months2026.map(row => (
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
                {fd(CE_EAST.months2026.reduce((s,r)=>s+r.gp,0),0)} GP
              </div>
              <div style={{ fontSize:10,color:"var(--mu)" }}>
                {fd(CE_EAST.months2026.reduce((s,r)=>s+r.rev,0),0)} revenue
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress hero */}
      <div style={{
        background:"linear-gradient(135deg,#0f1f12,#0a1508)",
        border:"2px solid #3ddc84", borderRadius:6, padding:"28px 32px",
        marginBottom:14, boxShadow:"0 0 60px rgba(61,220,132,.12)",
        position:"relative", overflow:"hidden",
      }}>
        <div style={{ position:"absolute",inset:0,opacity:.03,
          backgroundImage:"repeating-linear-gradient(0deg,#3ddc84 0px,#3ddc84 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,#3ddc84 0px,#3ddc84 1px,transparent 1px,transparent 40px)" }} />
        <div style={{ display:"grid",gridTemplateColumns:"1fr auto 1fr auto 1fr",gap:16,alignItems:"center",position:"relative" }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:9,color:"var(--mu)",letterSpacing:2,textTransform:"uppercase",marginBottom:4 }}>GP Earned — All Time</div>
            <div style={{ fontFamily:"var(--f2)",fontSize:42,fontWeight:900,color:"#3ddc84" }}>{fd(gpAllTime,0)}</div>
          </div>
          <div style={{ fontFamily:"var(--f2)",fontSize:28,color:"var(--mu)" }}>vs</div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:9,color:"var(--mu)",letterSpacing:2,textTransform:"uppercase",marginBottom:4 }}>Shareholder Contributions</div>
            <div style={{ fontFamily:"var(--f2)",fontSize:42,fontWeight:900,color:"#ff5252" }}>{fd(totalDue,0)}</div>
          </div>
          <div style={{ fontFamily:"var(--f2)",fontSize:28,color:"var(--mu)" }}>=</div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:9,color:"var(--ye)",letterSpacing:2,textTransform:"uppercase",marginBottom:4 }}>Gap Remaining</div>
            <div style={{ fontFamily:"var(--f2)",fontSize:42,fontWeight:900,color:"var(--ye)" }}>{fd(gap,0)}</div>
            <div style={{ marginTop:8,fontFamily:"var(--f2)",fontSize:14,fontWeight:700,color:"#3ddc84" }}>
              🎯 Distributions start ~{distStr}
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ marginTop:20,position:"relative" }}>
          <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--mu)",marginBottom:6 }}>
            <span>$0</span>
            <span style={{ color:"#3ddc84",fontWeight:700,fontSize:13 }}>{fp(pctDone)} complete · {fd(gap,0)} to go</span>
            <span style={{ color:"#ff5252" }}>{fd(totalDue,0)}</span>
          </div>
          <div style={{ height:34,background:"rgba(0,0,0,.4)",borderRadius:4,overflow:"hidden",border:"1px solid var(--bd)" }}>
            <div style={{ width:`${pctDone}%`,height:"100%",background:"linear-gradient(90deg,#1a7a47,#3ddc84)",
              display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:12 }}>
              <span style={{ fontFamily:"var(--f2)",fontSize:13,fontWeight:900,color:"#fff" }}>{fd(gpAllTime,0)}</span>
            </div>
          </div>
          {/* Month bars */}
          <div style={{ display:"flex",gap:6,alignItems:"flex-end",marginTop:14,height:52 }}>
            {months.map((m,i) => (
              <div key={i} style={{ flex:1,textAlign:"center" }}>
                <div style={{ height:40,display:"flex",alignItems:"flex-end" }}>
                  <div style={{ width:"100%",borderRadius:"3px 3px 0 0",height:`${m.pct}%`,minHeight:4,
                    background:m.done?"linear-gradient(180deg,#f5c542,#f47820)":"linear-gradient(180deg,#3ddc84,#1a7a47)",
                    position:"relative" }}>
                    {m.first && <div style={{ position:"absolute",top:-18,left:"50%",transform:"translateX(-50%)",fontSize:13 }}>🎉</div>}
                  </div>
                </div>
                <div style={{ fontSize:9,color:m.done?"var(--ye)":"var(--mu)",fontWeight:m.done?700:400,marginTop:4 }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="g2" style={{ marginBottom:14 }}>
        {/* Left: Distribution estimator */}
        <div>
          <div className="card" style={{ marginBottom:14 }}>
            <div className="ctit">Distribution Estimator</div>

            {/* Slider */}
            <div style={{ marginBottom:16 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
                <label className="lbl" style={{ margin:0 }}>% of Monthly GP to Distribute</label>
                <div style={{ fontFamily:"var(--f2)",fontSize:22,fontWeight:900,color:"#3ddc84" }}>{distPct}%</div>
              </div>
              <input type="range" min={10} max={100} step={5} value={distPct}
                onChange={e => setDistPct(+e.target.value)}
                style={{ width:"100%",accentColor:"#3ddc84" }} />
              <div style={{ display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--mu)",marginTop:4 }}>
                <span>10%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
              </div>
            </div>

            {/* Total distribution result */}
            <div style={{ background:"rgba(61,220,132,.08)",border:"1px solid rgba(61,220,132,.2)",
              borderRadius:3,padding:"14px",marginBottom:14,textAlign:"center" }}>
              <div style={{ fontSize:9,color:"#3ddc84",letterSpacing:3,textTransform:"uppercase",marginBottom:4 }}>Total Monthly Distribution</div>
              <div style={{ fontFamily:"var(--f2)",fontSize:44,fontWeight:900,color:"#3ddc84",lineHeight:1 }}>
                {fd(monthlyDist,0)}<span style={{ fontSize:16,color:"var(--mu)" }}>/mo</span>
              </div>
              <div style={{ fontSize:11,color:"var(--mu)",marginTop:4 }}>{fd(annualDist,0)}/yr · {fp(distPct)} of ${fd(monthlyGP,0)}/mo GP</div>
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
              const mo = monthlyGP * pct/100;
              const sel = pct === distPct;
              return (
                <div key={pct} onClick={() => setDistPct(pct)} style={{
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
            <div className="ctit">Shareholder Breakdown — Threshold</div>
            {[
              { label:"Chris Contribution",   val:dueToChr, color:"#ff5252", pct:dueToChr/totalDue*100 },
              { label:"Anthony Contribution", val:dueToAnt, color:"#ff8a65", pct:dueToAnt/totalDue*100 },
            ].map(item => (
              <div key={item.label} style={{ display:"flex",justifyContent:"space-between",
                alignItems:"center",padding:"10px 0",borderBottom:"1px solid var(--bd)" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11,color:"var(--tx)",fontWeight:600,marginBottom:4 }}>{item.label}</div>
                  <div className="bar"><div className="bfil" style={{ width:`${item.pct}%`,background:item.color }} /></div>
                  <div style={{ fontSize:10,color:"var(--mu)",marginTop:3 }}>{fp(item.pct)} of total</div>
                </div>
                <div style={{ fontFamily:"var(--f2)",fontSize:24,fontWeight:900,color:item.color,marginLeft:16 }}>{fd(item.val,0)}</div>
              </div>
            ))}
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:12 }}>
              <div style={{ fontFamily:"var(--f2)",fontSize:12,fontWeight:800,letterSpacing:2,textTransform:"uppercase",color:"#ff5252" }}>Total Threshold</div>
              <div style={{ fontFamily:"var(--f2)",fontSize:26,fontWeight:900,color:"#ff5252" }}>{fd(totalDue,0)}</div>
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
            <div style={{ fontSize:9,color:"var(--mu)",marginBottom:14 }}>All dates · as of Mar 20, 2026</div>

            {/* Two hero numbers */}
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16 }}>
              <div style={{ background:"rgba(245,197,66,.08)",border:"1px solid rgba(245,197,66,.25)",borderRadius:4,padding:"16px",textAlign:"center" }}>
                <div style={{ fontSize:9,color:"#f5c542",letterSpacing:3,textTransform:"uppercase",marginBottom:6 }}>Gross Profit</div>
                <div style={{ fontFamily:"var(--f2)",fontSize:36,fontWeight:900,color:"#f5c542",lineHeight:1 }}>{fd(pl.grossProfit,0)}</div>
                <div style={{ fontSize:10,color:"var(--mu)",marginTop:4 }}>{fp(pl.grossProfit/pl.revenue*100)} margin</div>
              </div>
              <div style={{ background:"rgba(255,82,82,.08)",border:"1px solid rgba(255,82,82,.25)",borderRadius:4,padding:"16px",textAlign:"center" }}>
                <div style={{ fontSize:9,color:"#ff5252",letterSpacing:3,textTransform:"uppercase",marginBottom:6 }}>Net Income</div>
                <div style={{ fontFamily:"var(--f2)",fontSize:36,fontWeight:900,color:"#ff5252",lineHeight:1 }}>{fd(pl.netIncome,0)}</div>
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
              { label:"Net Income",             val:pl.netIncome,     color:"#ff5252", bold:true },
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
        </div>
      </div>

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

async function classifyAndMap(headers, sampleRows, fileName) {
  const sample = sampleRows.slice(0, 8).map(r =>
    headers.map(h => r[h] ?? "").join(" | ")
  ).join("\n");

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
If the report contains summary/total values (like total labor cost, total fuel, total miles) rather than per-row data, put those in "constants" as key-value pairs using the constant names: LABOR, FUEL_TOT, GALLONS, MILES, INS_WEEK, TRUCK_TOT, TRAILER_TOT, TRUCK_MAINT, TRAIL_MAINT, STORAGE, UNIFORMS, TOTAL_HRS, FLEET_LOCAL, FLEET_REGIONAL, PERIOD.
If no per-row mapping is possible (e.g. a summary report), set mapping to {} and put everything in constants.`;

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
  // Apply any constants first
  if (constants && Object.keys(constants).length > 0) {
    const c = constants;
    if (c.LABOR) LABOR = Number(c.LABOR);
    if (c.FUEL_TOT) FUEL_TOT = Number(c.FUEL_TOT);
    if (c.GALLONS) GALLONS = Number(c.GALLONS);
    if (c.MILES) MILES = Number(c.MILES);
    if (c.INS_WEEK) INS_WEEK = Number(c.INS_WEEK);
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

function DataSettings() {
  const ctx = useDataCtx();
  const [uploads, setUploads] = useState([]);  // { id, fileName, status, type, mapping, rows, headers, preview, notes, confidence, constants }
  const [dragging, setDragging] = useState(false);
  const [history, setHistory] = useState([]);

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
      const { headers, rows, allSheets, sheetNames } = await parseFile(file);
      entry.headers = headers;
      entry.rows = rows;
      entry.status = "classifying";
      entry.preview = rows.slice(0, 5);
      setUploads(prev => prev.map(u => u.id === id ? { ...entry } : u));

      const result = await classifyAndMap(headers, rows, file.name);
      entry.type = result.type || "unknown";
      entry.mapping = result.mapping || {};
      entry.notes = result.notes || "";
      entry.confidence = result.confidence || "low";
      entry.constants = result.constants || {};
      entry.status = "ready";
      entry.allSheets = allSheets;
      entry.sheetNames = sheetNames;
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

  const applyUpload = (upload) => {
    applyMappedData(upload.type, upload.mapping, upload.rows, upload.constants);
    recomputeDerived();
    if (ctx?.bumpVersion) ctx.bumpVersion();

    const h = [{ fileName: upload.fileName, type: upload.type, rows: upload.rows.length, date: new Date().toISOString(), notes: upload.notes }, ...history];
    setHistory(h);
    saveHistory(h);

    setUploads(prev => prev.map(u => u.id === upload.id ? { ...u, status: "applied" } : u));
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
        insurance invoices, Penske/TEC/TCI lease statements, trailer invoices, or any CSV/XLSX with relevant data.
        The AI reads your column headers and figures out the rest.
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => { const inp = document.createElement("input"); inp.type = "file"; inp.multiple = true; inp.accept = ".csv,.tsv,.xlsx,.xls,.xlsm"; inp.onchange = e => handleFiles(e.target.files); inp.click(); }}
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
          CSV · XLSX · XLS · TSV — any column structure, any vendor format
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

            {/* Action buttons */}
            {u.status === "ready" && (
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" onClick={() => applyUpload(u)} style={{ flex: 1 }}>
                  ✓ Apply {rt.label} Data ({u.rows.length} rows)
                </button>
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
                ✓ Data applied to dashboard — {rt.label} updated with {u.rows.length} rows
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
        <div className="g4" style={{ gap: 8 }}>
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
        </div>
      </div>
    </div>
  );
}


// ── APP SHELL ─────────────────────────────────────────────────
// ── RECOMPUTE DERIVED VALUES ──────────────────────────────────
function recomputeDerived() {
  MILES_EST = GALLONS * 6.5;
  INS_TOT   = INS_WEEK * (72 / 7);
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

export default function App() {
  const [tab, setTab] = useState("overview");
  const [dataVersion, setDataVersion] = useState(0);

  const trackedCPM = (LABOR + FUEL_TOT + INS_TOT + EQUIP_TOT + MAINT_TOT + UNIFORMS) / MILES;

  const page = () => {
    if (tab === "overview") return <FleetOverview />;
    if (tab === "basiccpm") return <BasicCPM />;
    if (tab === "driver")   return <DriverDetail />;
    if (tab === "trucks")   return <TrucksMileage />;
    if (tab === "fuel")     return <FuelAnalysis />;
    if (tab === "trucks2")  return <TrucksTab />;
    if (tab === "trailers") return <TrailerFleet />;
    if (tab === "income")   return <IncomeDashboard />;
    if (tab === "ceeast")   return <CEEast />;
    if (tab === "settings") return <DataSettings />;
    return null;
  };

  const ctxValue = { bumpVersion: () => setDataVersion(v => v + 1) };

  return (
    <DataContext.Provider value={ctxValue}>
      <style>{CSS}</style>
      <div className="app" key={dataVersion}>
        <header className="hdr">
          <div className="logo">⬡ Freight<b>IQ</b></div>
          <div className="hsub">Show Freight Inc · Q1 2026</div>
          <div className="hbdg">
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
            <button key={t.id} className={`ntab${tab === t.id ? " on" : ""}`} onClick={() => setTab(t.id)}>
              {t.icon} {t.label}
            </button>
          ))}
        </nav>

        <main className="main">{page()}</main>
      </div>
    </DataContext.Provider>
  );
}
