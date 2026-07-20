import { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

/* ══════════════════════════════════════════════════════════
   PER LOAD CPM CSS (from standalone app)
   ══════════════════════════════════════════════════════════ */
const PL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');
:root {
  --bg: #0b0d10; --s1: #12151c; --s2: #181c26; --bd: #1f2535;
  --or: #2dd4bf; --or2: #14b8a6; --orl: rgba(45,212,191,.12);
  --ye: #fbbf24; --gn: #4ade80; --rd: #fb7185; --bl: #38bdf8; --pu: #a78bfa;
  --tx: #e8eaf0; --mu: #5a6370;
  --f1: 'IBM Plex Mono', monospace; --f2: 'Plus Jakarta Sans', sans-serif;
}
.ptitle { font-family: var(--f2); font-size: 32px; font-weight: 900; letter-spacing: 2px;
  text-transform: uppercase; margin-bottom: 3px; }
.psub { font-size: 11px; color: var(--mu); letter-spacing: 2px; text-transform: uppercase; margin-bottom: 20px; }
.card { background: var(--s1); border: 1px solid var(--bd); border-radius: 4px; padding: 18px; }
.pl-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 10px;
  border-radius: 5px; background: var(--bd); outline: none; cursor: pointer; }
.pl-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none;
  width: 24px; height: 24px; border-radius: 50%; background: var(--or);
  border: 3px solid var(--tx); cursor: pointer; box-shadow: 0 0 8px rgba(0,0,0,.5); }
.pl-slider::-moz-range-thumb { width: 24px; height: 24px; border-radius: 50%;
  background: var(--or); border: 3px solid var(--tx); cursor: pointer; }
@keyframes pl-pulse { 0%{box-shadow:0 0 0 0 var(--pulse-col)} 70%{box-shadow:0 0 0 12px transparent} 100%{box-shadow:0 0 0 0 transparent} }
.pl-verdict-pulse { animation: pl-pulse .6s ease-out; }
`;

/* ── helpers ── */
const fd = (n, d = 2) => {
  if (n == null || isNaN(n) || !isFinite(n)) return "\u2014";
  return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
};
const fn = (n, d = 0) => {
  if (n == null || isNaN(n)) return "\u2014";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
};
const fp = n => (n == null || isNaN(n)) ? "\u2014" : Number(n).toFixed(1) + "%";
const cpmColor = (cpm) => cpm <= 0 ? '#5a6370' : cpm <= 2.50 ? '#4ade80' : cpm <= 3.20 ? '#fbbf24' : '#fb7185';

/* ── colors ── */
const C = {
  bg: '#0b0d10', surface: '#12151c', border: '#1e2330',
  primary: '#2dd4bf', yellow: '#fbbf24', green: '#4ade80', red: '#fb7185',
  blue: '#38bdf8', purple: '#a78bfa', text: '#e8eaf0', muted: '#5a6370',
  teal: '#80cbc4', pink: '#ce93d8',
};

const catMeta = {
  labor:       { label: 'Labor',        color: C.blue,    icon: '\u{1F477}' },
  fuel:        { label: 'Fuel',         color: C.primary, icon: '\u{26FD}' },
  truckLeases: { label: 'Truck Leases', color: C.purple,  icon: '\u{1F69A}' },
  insurance:   { label: 'Insurance',    color: C.yellow,  icon: '\u{1F6E1}\u{FE0F}' },
  trailers:    { label: 'Trailers',     color: C.green,   icon: '\u{1F3D7}\u{FE0F}' },
  maintenance: { label: 'Maintenance',  color: C.red,     icon: '\u{1F527}' },
  storage:     { label: 'Storage',      color: C.teal,    icon: '\u{1F4E6}' },
  uniforms:    { label: 'Uniforms',     color: C.pink,    icon: '\u{1F455}' },
};

const basicKeys = ['labor', 'fuel', 'truckLeases', 'trailers', 'insurance'];

/* ── shared inline styles ── */
const cardStyle = {
  background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`,
  padding: '20px 24px', marginBottom: 16,
};
const inputStyle = {
  background: '#0e1117', border: `1px solid ${C.border}`, borderRadius: 6,
  color: C.text, padding: '8px 12px', fontSize: 14, fontFamily: "'IBM Plex Mono', monospace",
  width: '100%', outline: 'none',
};
const btnPrimary = {
  background: C.primary, color: '#fff', border: 'none', borderRadius: 8,
  padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: 0.5,
};
const btnOutline = {
  ...btnPrimary, background: 'transparent', border: `1px solid ${C.primary}`, color: C.primary,
};
const labelStyle = { fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 };
const bigNum = { fontSize: 36, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif" };
const sectionTitle = { fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 16, fontFamily: "'Plus Jakarta Sans', sans-serif", textTransform: 'uppercase', letterSpacing: 1 };
const rowFlex = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 };
const calcVal = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 16 };


/* ══════════════════════════════════════════════════════════
   BASIC CPM TAB — Atlanta-specific inputs
   ══════════════════════════════════════════════════════════ */
function BasicCPMTab({ fleet, setFleet, truckCount, laborCfg, setLaborCfg, truckCfg, setTruckCfg,
  manualCosts, setManualCosts, miles, setMiles, period, setPeriod,
  computed, fleetMetrics, basicCPM, allInCPM, basicTotal, allInTotal, totalMiles }) {

  const updateFleet = (key, val) => setFleet(prev => ({ ...prev, [key]: val }));
  const updateLabor = (key, val) => setLaborCfg(prev => ({ ...prev, [key]: val }));
  const updateIdealease = (key, val) => setTruckCfg(prev => ({ ...prev, idealease: { ...prev.idealease, [key]: val } }));

  const setTotalMiles = (v) => {
    const t = Number(v) || 0;
    setMiles({ total: v, perTruck: truckCount > 0 ? String(Math.round(t / truckCount)) : '' });
  };
  const setPerTruck = (v) => {
    const p = Number(v) || 0;
    setMiles({ perTruck: v, total: String(p * truckCount) });
  };

  const perTruckMiles = truckCount > 0 && totalMiles > 0 ? totalMiles / truckCount : 0;

  /* 5 basic cost components for the results panel */
  const basicCats = [
    { key: 'labor', label: 'LABOR', val: computed.labor, color: C.blue, desc: `${laborCfg.drivers} drivers · all-in employer cost` },
    { key: 'fuel', label: 'FUEL', val: computed.fuel, color: C.primary, desc: 'Fleet avg rate' },
    { key: 'truckLeases', label: 'TRUCK RENTALS', val: computed.truckLeases, color: C.purple, desc: `${truckCfg.idealease.count} Idealease` },
    { key: 'trailers', label: 'TRAILER RENTALS', val: computed.trailers, color: C.green, desc: `${fleet.trailers} trailers · ${fd(fleet.trailerMonthly)}/mo each` },
    { key: 'insurance', label: 'INSURANCE', val: computed.insurance, color: C.yellow, desc: `${truckCount} trucks · ${fd(fleetMetrics.insPerTruckWeekly)}/truck/wk` },
  ];

  return (
    <div>

      {/* ── TOP: INPUTS (horizontal) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
        {/* Labor */}
        <div style={{ ...cardStyle, marginBottom: 0 }}>
          <div style={sectionTitle}>{catMeta.labor.icon} Labor</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <div style={labelStyle}>Drivers</div>
              <input type="number" value={laborCfg.drivers} onChange={e => updateLabor('drivers', Number(e.target.value) || 0)} style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>All-In $/hr</div>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 13 }}>$</span>
                <input type="number" step="0.01" value={laborCfg.loadedRate} onChange={e => updateLabor('loadedRate', Number(e.target.value) || 0)} style={{ ...inputStyle, paddingLeft: 24 }} />
              </div>
            </div>
          </div>
          <div>
            <div style={labelStyle}>Hours / Week</div>
            <input type="number" value={laborCfg.hoursPerWeek} onChange={e => updateLabor('hoursPerWeek', Number(e.target.value) || 0)} style={inputStyle} />
          </div>
          <div style={{ background: '#0e1117', borderRadius: 6, padding: '8px 12px', marginTop: 10 }}>
            <div style={{ ...rowFlex, marginBottom: 0 }}>
              <span style={{ fontSize: 11, color: C.muted }}>{period === 'weekly' ? 'Weekly' : 'Monthly'}</span>
              <span style={{ ...calcVal, color: C.text }}>{fd(computed.labor)}</span>
            </div>
          </div>
          <div style={{ fontSize: 9, color: C.muted, marginTop: 6 }}>~$28.50 base + GA taxes · No 401k/health · ATL native rate</div>
        </div>

        {/* Trucks */}
        <div style={{ ...cardStyle, marginBottom: 0 }}>
          <div style={sectionTitle}>{catMeta.truckLeases.icon} Trucks</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.purple, marginBottom: 4 }}>Idealease</div>
          <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr', gap: 6, marginBottom: 8 }}>
            <div>
              <div style={{ ...labelStyle, fontSize: 9 }}>#</div>
              <input type="number" value={truckCfg.idealease.count} onChange={e => updateIdealease('count', Number(e.target.value) || 0)} style={{ ...inputStyle, padding: '8px 6px', textAlign: 'center' }} />
            </div>
            <div>
              <div style={{ ...labelStyle, fontSize: 9 }}>$/Mo</div>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 12 }}>$</span>
                <input type="number" value={truckCfg.idealease.monthly} onChange={e => updateIdealease('monthly', Number(e.target.value) || 0)} style={{ ...inputStyle, paddingLeft: 22 }} />
              </div>
            </div>
            <div>
              <div style={{ ...labelStyle, fontSize: 9 }}>$/Mi</div>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 12 }}>$</span>
                <input type="number" step="0.01" value={truckCfg.idealease.perMile} onChange={e => updateIdealease('perMile', Number(e.target.value) || 0)} style={{ ...inputStyle, paddingLeft: 22 }} />
              </div>
            </div>
          </div>
          <div style={{ background: '#0e1117', borderRadius: 6, padding: '8px 12px', marginTop: 10 }}>
            <div style={{ ...rowFlex, marginBottom: 0 }}>
              <span style={{ fontSize: 11, color: C.muted }}>{truckCount} trucks</span>
              <span style={{ ...calcVal, color: C.text }}>{fd(computed.truckLeases)}</span>
            </div>
          </div>
        </div>

        {/* Trailers + Mileage */}
        <div style={{ ...cardStyle, marginBottom: 0 }}>
          <div style={sectionTitle}>Trailers & Mileage</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <div style={labelStyle}>Trailers</div>
              <input type="number" value={fleet.trailers} onChange={e => updateFleet('trailers', Number(e.target.value) || 0)} style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>$/Trailer/Mo</div>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 13 }}>$</span>
                <input type="number" value={fleet.trailerMonthly} onChange={e => updateFleet('trailerMonthly', Number(e.target.value) || 0)} style={{ ...inputStyle, paddingLeft: 24 }} />
              </div>
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 4 }}>
            <div style={labelStyle}>Total Fleet Miles ({period})</div>
            <input type="number" placeholder="0" value={miles.total} onChange={e => setTotalMiles(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginTop: 8 }}>
            <div style={labelStyle}>or Avg Mi/Truck</div>
            <input type="number" placeholder="0" value={miles.perTruck} onChange={e => setPerTruck(e.target.value)} style={inputStyle} />
          </div>
          {truckCount > 0 && perTruckMiles > 0 && (
            <div style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>
              {fn(Math.round(perTruckMiles))}/truck × {truckCount} = {fn(totalMiles)} mi
            </div>
          )}
        </div>

        {/* Period + Fleet-pulled rates */}
        <div style={{ ...cardStyle, marginBottom: 0 }}>
          <div style={sectionTitle}>Period & Fleet Rates</div>
          <div style={labelStyle}>Period</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {['weekly', 'monthly'].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                style={{
                  ...btnOutline, flex: 1, padding: '6px 0', fontSize: 12,
                  ...(period === p ? { background: C.primary, color: '#fff', borderColor: C.primary } : {}),
                }}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ background: '#0e1117', borderRadius: 6, padding: '10px 12px' }}>
            {fleetMetrics.loaded ? (
              <>
                <div style={{ ...rowFlex, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: C.muted }}>Fuel CPM</span>
                  <span style={{ ...calcVal, fontSize: 14, color: C.primary }}>${fleetMetrics.fuelCPM.toFixed(3)}/mi</span>
                </div>
                <div style={{ ...rowFlex, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: C.muted }}>Insurance</span>
                  <span style={{ ...calcVal, fontSize: 14, color: C.yellow }}>{fd(fleetMetrics.insPerTruckWeekly)}/truck/wk</span>
                </div>
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 6, marginTop: 4 }}>
                  <div style={{ ...rowFlex, marginBottom: 2 }}>
                    <span style={{ fontSize: 11, color: C.muted }}>Fuel total</span>
                    <span style={{ ...calcVal, fontSize: 13, color: C.text }}>{fd(computed.fuel)}</span>
                  </div>
                  <div style={{ ...rowFlex, marginBottom: 0 }}>
                    <span style={{ fontSize: 11, color: C.muted }}>Ins total</span>
                    <span style={{ ...calcVal, fontSize: 13, color: C.text }}>{fd(computed.insurance)}</span>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 11, color: C.muted, textAlign: 'center', padding: 8 }}>Loading fleet rates...</div>
            )}
          </div>
          <div style={{ fontSize: 9, color: C.muted, marginTop: 6 }}>Auto-pulled from fleet metrics</div>
        </div>
      </div>

      {/* ── BELOW: CPM CALCULATOR RESULTS ── */}
      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 32, fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 3, color: C.text }}>
        CPM Calculator
      </div>
      <div style={{ fontSize: 11, color: C.muted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 20 }}>
        BASIC (5 COST CATEGORIES) · {truckCount} TRUCKS · {fn(totalMiles)} {period.toUpperCase()} MILES
      </div>

      {/* BASIC CPM HERO */}
      <div style={{
        border: `2px solid ${cpmColor(basicCPM)}`, borderRadius: 8, padding: '28px 24px',
        textAlign: 'center', marginBottom: 24,
        background: 'linear-gradient(135deg, #0f1118 0%, #12151c 100%)',
        boxShadow: totalMiles > 0 ? `0 0 40px ${cpmColor(basicCPM)}15` : 'none',
      }}>
        <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>Basic CPM</div>
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 72, fontWeight: 900, lineHeight: 1, color: cpmColor(basicCPM), marginBottom: 12 }}>
          {totalMiles > 0 ? '$' + basicCPM.toFixed(3) : '\u2014'}
        </div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>Labor · Fuel · Truck Rentals · Trailer Rentals · Insurance</div>
        <div style={{ fontSize: 13, color: C.muted }}>{fd(basicTotal)} · {fn(totalMiles)} mi</div>
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: C.text, marginTop: 8 }}>5 Categories</div>
      </div>

      {/* BASIC CPM — 4 COMPONENTS */}
      {totalMiles > 0 && basicTotal > 0 && (
        <>
          <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase', color: C.text, marginBottom: 14 }}>
            Basic CPM — 5 Components
          </div>

          {/* Stacked percentage bar */}
          <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', height: 28, marginBottom: 20 }}>
            {basicCats.map(c => {
              const pct = basicTotal > 0 ? (c.val / basicTotal) * 100 : 0;
              if (pct <= 0) return null;
              return (
                <div key={c.key} style={{
                  width: pct + '%', background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: c.color === C.yellow ? '#000' : '#fff',
                  fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: 1, whiteSpace: 'nowrap', overflow: 'hidden',
                }}>
                  {pct >= 8 ? `${c.label.split(' ')[0]} ${pct.toFixed(1)}%` : ''}
                </div>
              );
            })}
          </div>

          {/* 4 Cost cards */}
          {basicCats.map(c => {
            const cpm = totalMiles > 0 ? c.val / totalMiles : 0;
            const pct = basicTotal > 0 ? (c.val / basicTotal) * 100 : 0;
            return (
              <div key={c.key} style={{
                background: C.surface, border: `1px solid ${C.border}`, borderLeft: `4px solid ${c.color}`,
                borderRadius: 4, padding: '18px 20px', marginBottom: 10,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: C.muted, marginBottom: 4 }}>{c.label}</div>
                  <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 28, fontWeight: 900, color: c.color, lineHeight: 1, marginBottom: 4 }}>
                    {fd(c.val)}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted }}>{c.desc}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 28, fontWeight: 900, color: c.color, lineHeight: 1, marginBottom: 4 }}>
                    ${cpm.toFixed(3)}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted }}>per mile · {pct.toFixed(1)}%</div>
                </div>
              </div>
            );
          })}

          {/* BASIC TOTAL */}
          <div style={{
            background: C.surface, border: `2px solid ${C.primary}`, borderRadius: 4,
            padding: '18px 20px', marginTop: 6,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 18, fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase', color: C.primary }}>
              Basic Total
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 32, fontWeight: 900, color: cpmColor(basicCPM), lineHeight: 1 }}>
                ${basicCPM.toFixed(3)}
              </div>
              <div style={{ fontSize: 13, color: C.muted }}>{fd(basicTotal)}</div>
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {totalMiles === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: 60, color: C.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>{'\u{1F69A}'}</div>
          <div style={{ fontSize: 16, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Enter mileage to see CPM analysis</div>
          <div style={{ fontSize: 12, marginTop: 8 }}>Costs auto-calculate from the inputs above</div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   PER LOAD CPM TAB — exact port from standalone perload-cpm
   ══════════════════════════════════════════════════════════ */
function PerLoadCPM({ d }) {
  const { LABOR, FUEL_TOT, MILES, INS_TOT, TRUCK_TOT, TRAILER_TOT, BASIC_COST, BASIC_CPM_V, ALLIN_COST, ALLIN_CPM_V, PERIOD } = d;
  const HOURLY_RATE = d.HOURLY_RATE || 28.86;

  const costCategories = [
    { key:"labor",    label:"Labor",           val:LABOR,        color:"#2dd4bf" },
    { key:"fuel",     label:"Fuel",            val:FUEL_TOT,     color:"#fbbf24" },
    { key:"trucks",   label:"Truck Rentals",   val:TRUCK_TOT,    color:"#38bdf8" },
    { key:"trailers", label:"Trailer Rentals", val:TRAILER_TOT,  color:"#4ade80" },
    { key:"ins",      label:"Insurance",       val:INS_TOT,      color:"#a78bfa" },
  ];

  const [grossRev, setGrossRev] = useState(1846);
  const [miles, setMiles] = useState(386);
  const [roundtrip, setRoundtrip] = useState(false);
  const [trucks, setTrucks] = useState(1);
  const [laborHours, setLaborHours] = useState(10);
  const [margin, setMargin] = useState(25);

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

  const [selectedCosts, setSelectedCosts] = useState(() => {
    const init = {};
    costCategories.forEach(c => { init[c.key] = true; });
    return init;
  });
  const toggleCost = key => setSelectedCosts(prev => ({ ...prev, [key]: !prev[key] }));
  const presetAll = () => { const s = {}; costCategories.forEach(c => { s[c.key] = true; }); setSelectedCosts(s); };
  const presetNone = () => { const s = {}; costCategories.forEach(c => { s[c.key] = false; }); setSelectedCosts(s); };

  const perTruckMiles = roundtrip ? miles * 2 : miles;
  const effectiveMiles = perTruckMiles * trucks;
  const totalRev = grossRev * trucks;
  const rpm = perTruckMiles > 0 ? grossRev / perTruckMiles : 0;
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

  const mCol = margin >= 25 ? "#4ade80" : margin >= 15 ? "#fbbf24" : "#fb7185";

  const verdictCol = netProfit > 0 && netMarginCalc >= 15 ? "#4ade80" : netProfit > 0 ? "#fbbf24" : "#fb7185";
  const verdictLabel = netProfit > 0 && netMarginCalc >= 15 ? "Good Load" : netProfit > 0 ? "Acceptable" : "Loses Money";
  const profitPerMile = effectiveMiles > 0 ? netProfit / effectiveMiles : 0;
  const hitsTarget = netMarginCalc >= margin;
  const revBorderCol = hitsTarget ? "#4ade80" : totalRev > fleetCost ? "#fbbf24" : "#fb7185";

  const verdictRef = useRef(null);
  const prevVerdict = useRef(verdictLabel);
  useEffect(() => {
    if (prevVerdict.current !== verdictLabel && verdictRef.current) {
      verdictRef.current.classList.remove("pl-verdict-pulse");
      void verdictRef.current.offsetWidth;
      verdictRef.current.style.setProperty("--pulse-col", verdictCol + "60");
      verdictRef.current.classList.add("pl-verdict-pulse");
    }
    prevVerdict.current = verdictLabel;
  }, [verdictLabel, verdictCol]);

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
          textAlign:"center", outline:"none", width:"100%", transition:"border-color .15s",
        }} />
      {presets && (
        <div style={{ display:"flex", gap:4, marginTop:8, flexWrap:"wrap" }}>
          {presets.map(v => (
            <button key={v} onClick={() => onChange(v)} style={{
              padding:"4px 10px", borderRadius:3, cursor:"pointer", fontSize:12, fontWeight:700,
              fontFamily:"var(--f2)",
              background: value === v ? color : "transparent",
              color: value === v ? (color==="#fbbf24"?"#000":"#fff") : "var(--mu)",
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

      {MILES === 0 && (
        <div style={{ padding:"12px 18px", marginBottom:14, borderRadius:6, background:"rgba(245,197,66,.08)", border:"1px solid #fbbf2440", fontSize:13, color:"#fbbf24" }}>
          Enter costs and mileage on the Basic CPM tab first — those values feed into this calculator.
        </div>
      )}

      <div style={{
        padding:"20px 24px", borderRadius:8, marginBottom:14,
        background:"linear-gradient(135deg,#0f1118 0%,#12151c 100%)",
        border:`2px solid ${verdictCol}`,
        boxShadow:`0 0 40px ${verdictCol}20`,
        transition:"border-color .3s, box-shadow .3s",
      }}>

        {/* PROFIT HERO */}
        <div style={{ textAlign:"center", marginBottom:18 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:12 }}>
            <div style={{ fontFamily:"var(--f2)", fontSize:72, fontWeight:900, lineHeight:1, color:verdictCol, textShadow:`0 0 40px ${verdictCol}40` }}>
              {netProfit >= 0 ? "+" : ""}{fd(netProfit,0)}
            </div>
            <div style={{ textAlign:"left" }}>
              <div ref={verdictRef} style={{
                fontSize:14, fontWeight:800, letterSpacing:2, textTransform:"uppercase",
                color:verdictCol, padding:"5px 14px", borderRadius:3,
                background:`${verdictCol}18`, border:`1px solid ${verdictCol}40`, marginBottom:6,
              }}>{verdictLabel}</div>
              <div style={{ fontSize:14, color:"var(--mu)" }}>{fp(netMarginCalc)} margin · {activeCats.length} cost{activeCats.length!==1?"s":""} · {fd(selectedCPM,3)}/mi</div>
            </div>
          </div>
        </div>

        {/* LANE — origin & destination */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr auto", gap:10, marginBottom:14, alignItems:"end" }}>
          <div>
            <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:"#4ade80", marginBottom:6, fontWeight:700 }}>Origin</div>
            <input type="text" value={origin} onChange={e => setOrigin(e.target.value)} placeholder="City, State or address"
              onKeyDown={e => e.key === "Enter" && calcRoute()}
              style={{ background:"var(--bg)", border:"1px solid var(--bd)", borderRadius:6, padding:"12px 14px",
                color:"var(--tx)", fontFamily:"var(--f1)", fontSize:14, outline:"none", width:"100%",
                transition:"border-color .15s" }} />
          </div>
          <div style={{ fontFamily:"var(--f2)", fontSize:24, fontWeight:900, color:"var(--mu)", paddingBottom:8 }}>{"\u2192"}</div>
          <div>
            <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:"#fb7185", marginBottom:6, fontWeight:700 }}>Destination</div>
            <input type="text" value={dest} onChange={e => setDest(e.target.value)} placeholder="City, State or address"
              onKeyDown={e => e.key === "Enter" && calcRoute()}
              style={{ background:"var(--bg)", border:"1px solid var(--bd)", borderRadius:6, padding:"12px 14px",
                color:"var(--tx)", fontFamily:"var(--f1)", fontSize:14, outline:"none", width:"100%",
                transition:"border-color .15s" }} />
          </div>
          <button onClick={calcRoute} style={{
            padding:"12px 24px", borderRadius:6, cursor:"pointer", border:"none",
            fontFamily:"var(--f2)", fontSize:14, fontWeight:800, letterSpacing:1, textTransform:"uppercase",
            background: routeStatus === "loading" ? "var(--bd)" : "var(--or)",
            color:"#fff", transition:"all .15s",
          }}>{routeStatus === "loading" ? "..." : "Calc Miles"}</button>
        </div>
        {routeInfo && routeStatus === "done" && (
          <div style={{ display:"flex", gap:16, alignItems:"center", marginBottom:14, padding:"10px 16px",
            background:"rgba(61,220,132,.06)", border:"1px solid #4ade8030", borderRadius:4 }}>
            <span style={{ fontSize:13, color:"var(--mu)" }}>{routeInfo.origin.split(",").slice(0,2).join(",")}</span>
            <span style={{ fontFamily:"var(--f2)", fontSize:14, fontWeight:800, color:"var(--or)" }}>{"\u2192"}</span>
            <span style={{ fontSize:13, color:"var(--mu)" }}>{routeInfo.dest.split(",").slice(0,2).join(",")}</span>
            <span style={{ fontFamily:"var(--f2)", fontSize:18, fontWeight:900, color:"#38bdf8" }}>{fn(routeInfo.miles,0)} mi</span>
            <span style={{ fontSize:13, color:"var(--mu)" }}>{routeInfo.hours} hrs driving</span>
          </div>
        )}
        {routeInfo && routeStatus === "error" && (
          <div style={{ marginBottom:14, padding:"10px 16px", background:"rgba(255,82,82,.06)", border:"1px solid #fb718530", borderRadius:4, fontSize:13, color:"#fb7185" }}>
            {routeInfo.error}
          </div>
        )}

        {/* INPUTS */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 2fr", gap:12, marginBottom:16 }}>
          <div style={{ position:"relative" }}>
            <span style={{ position:"absolute", left:14, top:8, fontSize:12, letterSpacing:2, textTransform:"uppercase", color:revBorderCol, fontWeight:700, pointerEvents:"none", zIndex:1 }}>Gross Revenue</span>
            <span style={{ position:"absolute", left:14, top:32, fontFamily:"var(--f2)", fontSize:20, fontWeight:700, color:"var(--mu)", pointerEvents:"none", zIndex:1 }}>$</span>
            <input type="number" value={grossRev} onChange={e => setGrossRev(Number(e.target.value) || 0)}
              style={{ background:"var(--bg)", border:`2px solid ${revBorderCol}`, borderRadius:6, padding:"32px 14px 12px 32px",
                color:"var(--tx)", fontFamily:"var(--f2)", fontSize:28, fontWeight:700, textAlign:"center", outline:"none", width:"100%", transition:"border-color .3s" }} />
            <div style={{ display:"flex", gap:4, marginTop:8, flexWrap:"wrap" }}>
              {[1000,1500,2000,2500,3500,5000].map(v => (
                <button key={v} onClick={() => setGrossRev(v)} style={{
                  padding:"4px 10px", borderRadius:3, cursor:"pointer", fontSize:12, fontWeight:700, fontFamily:"var(--f2)",
                  background: grossRev===v ? revBorderCol : "transparent", color: grossRev===v ? "#fff" : "var(--mu)",
                  border:`1px solid ${grossRev===v ? revBorderCol : "var(--bd)"}`,
                }}>{fd(v,0)}</button>
              ))}
            </div>
          </div>
          <div>
            {inputBox("Mileage (one-way)", miles, setMiles, "#38bdf8", null, [150,250,386,500,750,1000], v => `${fn(v,0)} mi`)}
            <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:8, flexWrap:"wrap" }}>
              <button onClick={() => setRoundtrip(!roundtrip)} style={{
                padding:"5px 14px", borderRadius:20, cursor:"pointer",
                fontFamily:"var(--f2)", fontSize:12, fontWeight:700, letterSpacing:1,
                background: roundtrip ? "#38bdf8" : "transparent",
                color: roundtrip ? "#000" : "var(--mu)",
                border:`1px solid ${roundtrip ? "#38bdf8" : "var(--bd)"}`,
                transition:"all .15s",
              }}>{roundtrip ? "\u2194 Roundtrip" : "\u2192 One-way"}</button>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                <span style={{ fontSize:12, color:"var(--mu)" }}>Trucks:</span>
                <select value={trucks} onChange={e => setTrucks(Number(e.target.value))} style={{
                  background:"var(--bg)", border:"1px solid var(--bd)", borderRadius:4,
                  padding:"4px 8px", color:"var(--tx)", fontFamily:"var(--f2)", fontSize:14, fontWeight:700,
                  cursor:"pointer", outline:"none",
                }}>
                  {Array.from({length:5},(_,i)=>i+1).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              {(roundtrip || trucks > 1) && (
                <span style={{ fontFamily:"var(--f2)", fontSize:14, fontWeight:700, color:"#38bdf8" }}>
                  {fn(effectiveMiles,0)} mi total{trucks > 1 ? ` \u00b7 ${trucks} trucks \u00b7 ${fd(totalRev,0)} total rev` : ""}
                </span>
              )}
            </div>
          </div>

          <div>
            <div style={{ textAlign:"center", marginBottom:8 }}>
              <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:"var(--mu)", marginBottom:2 }}>Actual Margin</div>
              <div style={{ fontFamily:"var(--f2)", fontSize:52, fontWeight:900, lineHeight:1, color:verdictCol }}>{fp(netMarginCalc)}</div>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4 }}>
              <span style={{ fontSize:12, letterSpacing:2, textTransform:"uppercase", color:mCol, fontWeight:700 }}>Target Margin</span>
              <span style={{ fontFamily:"var(--f2)", fontSize:28, fontWeight:900, color:mCol, lineHeight:1 }}>{margin}%</span>
            </div>
            <input type="range" className="pl-slider" min={0} max={50} step={1} value={margin} onChange={e => setMargin(Number(e.target.value))} style={{ accentColor:mCol }} />
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
              {[0,10,15,20,25,30,40,50].map(t => (
                <button key={t} onClick={() => setMargin(t)} style={{
                  padding:"3px 8px", borderRadius:3, cursor:"pointer", fontSize:12, fontWeight:700,
                  fontFamily:"var(--f2)", border:"none",
                  background: margin===t ? mCol : "transparent", color: margin===t ? "#000" : "var(--mu)",
                }}>{t}%</button>
              ))}
            </div>
            {(() => {
              const minRev = margin < 100 ? fleetCost / (1 - margin / 100) : 0;
              const minRPM = perTruckMiles > 0 ? (minRev / trucks) / perTruckMiles : 0;
              const gap = totalRev - minRev;
              return (
                <div style={{ marginTop:10, padding:"10px 14px", borderRadius:4,
                  background: hitsTarget ? "rgba(61,220,132,.08)" : "rgba(255,82,82,.08)",
                  border:`1px solid ${hitsTarget ? "#4ade8040" : "#fb718540"}` }}>
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
                    <span style={{ fontFamily:"var(--f2)", fontSize:15, fontWeight:800, color:hitsTarget?"#4ade80":"#fb7185" }}>{hitsTarget ? "+" : ""}{fd(gap,0)}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* FLEET COSTS */}
        <div style={{ marginBottom:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:12 }}>
            <div>
              <span style={{ fontFamily:"var(--f2)", fontSize:15, fontWeight:800, letterSpacing:3, textTransform:"uppercase", color:"var(--tx)" }}>Fleet Costs</span>
              <span style={{ fontSize:13, color:"var(--mu)", marginLeft:12 }}>{activeCats.length} of 5 active</span>
            </div>
            <div style={{ display:"flex", alignItems:"baseline", gap:16 }}>
              <span style={{ fontFamily:"var(--f2)", fontSize:22, fontWeight:900, color:"#fb7185" }}>{fd(selectedCPM,3)}<span style={{ fontSize:13, fontWeight:700, color:"var(--mu)" }}>/mi</span></span>
              <div style={{ display:"flex", gap:6 }}>
                {[["All", presetAll],["None", presetNone]].map(([lbl, action]) => (
                  <button key={lbl} onClick={action} style={{
                    padding:"5px 14px", borderRadius:20, cursor:"pointer", fontFamily:"var(--f2)", fontSize:11, fontWeight:700,
                    letterSpacing:1, textTransform:"uppercase", background:"transparent", color:"var(--mu)", border:"1px solid var(--bd)", transition:"all .15s",
                  }}>{lbl}</button>
                ))}
              </div>
            </div>
          </div>
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
                  opacity: on ? 1 : 0.35, transition:"all .2s", textAlign:"center",
                }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                    <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color: on ? c.color : "var(--mu)", fontWeight:700 }}>{c.label}</div>
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
                      <div style={{ fontFamily:"var(--f2)", fontSize:28, fontWeight:900, color: on ? c.color : "var(--mu)", lineHeight:1, marginBottom:4 }}>{fd(HOURLY_RATE,2)}</div>
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
                      <div style={{ fontFamily:"var(--f2)", fontSize:28, fontWeight:900, color: on ? c.color : "var(--mu)", lineHeight:1, marginBottom:4 }}>{fd(cpm,3)}</div>
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

        {/* KPI BAR */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"rgba(0,0,0,.3)", borderRadius:4, padding:"12px 20px", marginBottom:16 }}>
          {[
            { label:"RPM", val:`$${rpm.toFixed(2)}`, color:"var(--or)" },
            { label:"Fleet CPM", val:`$${selectedCPM.toFixed(3)}`, color:"#fb7185" },
            { label:"Profit/Mi", val:`$${profitPerMile.toFixed(2)}`, color:profitPerMile>=0?verdictCol:"#fb7185" },
            { label:`Fleet Cost (${activeCats.length})`, val:fd(fleetCost,0), color:"#fb7185" },
            { label:"Net Profit", val:(netProfit>=0?"+":"")+fd(netProfit,0), color:verdictCol },
            { label:"Net Margin", val:fp(netMarginCalc), color:verdictCol },
          ].map((k,i) => (
            <div key={k.label} style={{ display:"flex", alignItems:"center", gap:8, ...(i > 0 ? { borderLeft:"1px solid var(--bd)", paddingLeft:14 } : {}) }}>
              <span style={{ fontSize:12, letterSpacing:1, textTransform:"uppercase", color:"var(--mu)" }}>{k.label}</span>
              <span style={{ fontFamily:"var(--f2)", fontSize:20, fontWeight:800, color:k.color }}>{k.val}</span>
            </div>
          ))}
        </div>

        {/* COST SUMMARY */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr auto 1fr", gap:0, alignItems:"center", background:"rgba(0,0,0,.2)", borderRadius:6, padding:"20px 24px" }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:12, letterSpacing:2, textTransform:"uppercase", color:"var(--mu)", marginBottom:6 }}>Revenue{trucks>1?` (${trucks} trucks)`:""}</div>
            <div style={{ fontFamily:"var(--f2)", fontSize:42, fontWeight:900, color:"#4ade80", lineHeight:1 }}>{fd(totalRev,0)}</div>
          </div>
          <div style={{ fontFamily:"var(--f2)", fontSize:36, fontWeight:900, color:"var(--mu)", padding:"0 16px" }}>{"\u2212"}</div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:12, letterSpacing:2, textTransform:"uppercase", color:"var(--mu)", marginBottom:6 }}>Fleet Cost</div>
            <div style={{ fontFamily:"var(--f2)", fontSize:42, fontWeight:900, color:"#fb7185", lineHeight:1 }}>{fd(fleetCost,0)}</div>
          </div>
          <div style={{ fontFamily:"var(--f2)", fontSize:36, fontWeight:900, color:"var(--mu)", padding:"0 16px" }}>=</div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:12, letterSpacing:2, textTransform:"uppercase", color:"var(--mu)", marginBottom:6 }}>Net Profit</div>
            <div style={{ fontFamily:"var(--f2)", fontSize:42, fontWeight:900, color:verdictCol, lineHeight:1 }}>{netProfit >= 0 ? "+" : ""}{fd(netProfit,0)}</div>
          </div>
        </div>

        {/* MILEAGE COMPARE */}
        <div style={{ background:"rgba(0,0,0,.2)", borderRadius:6, padding:"14px 18px", marginTop:16 }}>
          <div style={{ fontSize:13, letterSpacing:2, textTransform:"uppercase", color:"var(--mu)", marginBottom:10 }}>What if mileage changes? · {fd(totalRev,0)} revenue{trucks>1?` \u00b7 ${trucks} trucks`:""}</div>
          <div style={{ display:"flex", gap:8 }}>
            {compareMiles.map(m => {
              const em = (roundtrip ? m * 2 : m) * trucks;
              const tRev = grossRev * trucks;
              const cost = em * selectedCPM;
              const prof = tRev - cost;
              const mrg = tRev > 0 ? (prof / tRev) * 100 : 0;
              const col = prof > 0 && mrg >= 15 ? "#4ade80" : prof > 0 ? "#fbbf24" : "#fb7185";
              const isActive = m === miles;
              return (
                <div key={m} onClick={() => setMiles(m)} style={{
                  flex:1, textAlign:"center", padding:"10px 6px", borderRadius:4, cursor:"pointer",
                  background: isActive ? `${col}15` : "var(--bg)",
                  border: isActive ? `2px solid ${col}` : "1px solid var(--bd)", transition:"all .15s",
                }}>
                  <div style={{ fontFamily:"var(--f2)", fontSize:16, fontWeight:800, color:"#38bdf8" }}>{fn(m,0)} mi{roundtrip ? " RT" : ""}</div>
                  <div style={{ fontFamily:"var(--f2)", fontSize:13, fontWeight:700, color:"var(--mu)", marginTop:2 }}>${(tRev/em).toFixed(2)}/mi</div>
                  <div style={{ fontFamily:"var(--f2)", fontSize:18, fontWeight:900, color:col, marginTop:4 }}>{prof >= 0 ? "+" : ""}{fd(prof,0)}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:col }}>{fp(mrg)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT — Atlanta CPM (FreightIQ tab). `ytd` = live ATL YTD
   actuals passed from App.jsx (labor/fuel/miles/trucks/revenue).
   ══════════════════════════════════════════════════════════ */
export default function AtlantaCpm({ ytd }) {
  const [activeTab, setActiveTab] = useState('basic');

  /* Fetch fleet-wide fuel CPM + per-truck insurance from FreightIQ metrics.json */
  const [fleetMetrics, setFleetMetrics] = useState({ insPerTruckWeekly: 0, fuelCPM: 0, loaded: false });
  useEffect(() => {
    fetch("/metrics.json")
      .then(r => r.json())
      .then(d => {
        // Insurance: fixed per-truck cost (ins_tot is for the period, divide by trucks and normalize to weekly)
        const periodDays = d.period_days || 102; // fallback to current period length
        const truckCount = d.truck_count || 35;  // fallback to current fleet size
        const insWeeklyTotal = d.ins_tot / (periodDays / 7);
        const insPerTruckWeekly = insWeeklyTotal / truckCount;
        setFleetMetrics({
          insPerTruckWeekly,
          fuelCPM: d.miles > 0 ? d.fuel_tot / d.miles : 0,
          loaded: true,
        });
      })
      .catch(e => console.warn("Failed to fetch fleet metrics:", e));
  }, []);

  /* Shared state — defaults reflect actual ATL operations as of May 17, 2026.
     ATL launched May 4, 2026; first 2 weeks of operating data feed these
     baselines (see project_atlanta_payroll memory + FreightIQ ATL Ops tab). */
  const [fleet, setFleet] = useState({ trailers: 10, trailerMonthly: 348 });
  const [period, setPeriod] = useState('monthly');
  const [miles, setMiles] = useState({ total: '30000', perTruck: '6000' });
  // Actual May 4-17: 2,142 gallons × 6.5 mpg ≈ 13,925 mi over 14 days
  // → ~30,180 monthly run-rate. Plan target hits actual within 0.6%.

  /* Atlanta labor config — loadedRate is full burden (gross + GA employer taxes, no 401k/health).
     $30.59/hr is the ATL native loaded rate (Manar + Tucker, both new hires May 11).
     Davis/Denman/Wainwright transferred from SF carry SF rates ($32-35/hr loaded) but
     baseline planning uses the native rate. Actual fleet hours: 205/wk avg, 41/driver. */
  const [laborCfg, setLaborCfg] = useState({
    drivers: 5, loadedRate: 30.59, hoursPerWeek: 41,
  });

  /* Atlanta truck config — 5 trucks active matching driver count */
  const [truckCfg, setTruckCfg] = useState({
    idealease: { count: 5, monthly: 3500, perMile: 0.08 },
  });

  /* Manual additional costs */
  const [manualCosts, setManualCosts] = useState({
    trailers: '', maintenance: '', storage: '', uniforms: '',
  });

  /* Derived values */
  const truckCount = truckCfg.idealease.count;
  const totalMiles = Number(miles.total) || 0;
  const weeksPerPeriod = period === 'weekly' ? 1 : 4.33;

  // Labor: drivers × loaded rate × hours/wk × weeks
  const laborTotal = laborCfg.drivers * laborCfg.loadedRate * laborCfg.hoursPerWeek * weeksPerPeriod;

  // Trucks: Idealease fixed + per-mile
  const truckTotal = (truckCfg.idealease.count * truckCfg.idealease.monthly * (period === 'weekly' ? 1/4.33 : 1))
    + (truckCfg.idealease.perMile * totalMiles);

  // Fuel from fleet CPM, Insurance per-truck (fixed cost, not mileage-driven)
  const fuelTotal = fleetMetrics.loaded ? fleetMetrics.fuelCPM * totalMiles : 0;
  const insTotal = fleetMetrics.loaded ? fleetMetrics.insPerTruckWeekly * truckCount * weeksPerPeriod : 0;

  // Trailers: per-trailer monthly rate × trailer count
  const trailersVal = fleet.trailers * fleet.trailerMonthly * (period === 'weekly' ? 1/4.33 : 1);

  // Manual costs
  const maintVal = Number(manualCosts.maintenance) || 0;
  const storageVal = Number(manualCosts.storage) || 0;
  const uniformsVal = Number(manualCosts.uniforms) || 0;

  // Computed cost object (used by both tabs)
  const computed = {
    labor: laborTotal,
    fuel: fuelTotal,
    truckLeases: truckTotal,
    insurance: insTotal,
    trailers: trailersVal,
    maintenance: maintVal,
    storage: storageVal,
    uniforms: uniformsVal,
  };

  const basicTotal = basicKeys.reduce((s, k) => s + (computed[k] || 0), 0);
  const allInTotal = basicTotal; // no separate all-in for Atlanta
  const basicCPM = totalMiles > 0 ? basicTotal / totalMiles : 0;
  const allInCPM = totalMiles > 0 ? allInTotal / totalMiles : 0;

  /* Fleet data object for Per Load CPM */
  const fleetData = {
    LABOR: laborTotal,
    FUEL_TOT: fuelTotal,
    MILES: totalMiles,
    INS_TOT: insTotal,
    TRUCK_TOT: truckTotal,
    TRAILER_TOT: trailersVal,
    BASIC_COST: basicTotal,
    BASIC_CPM_V: basicCPM,
    ALLIN_COST: allInTotal,
    ALLIN_CPM_V: allInCPM,
    HOURLY_RATE: laborCfg.loadedRate,
    PERIOD: `Atlanta · ${truckCount} trucks · ${period}`,
  };

  const tabs = [
    { id: 'basic', label: 'Basic CPM' },
    { id: 'perload', label: 'Per Load CPM' },
  ];

  return (
    <div style={{ color: C.text }}>
      <div className="ptitle">🍑 ATL CPM</div>
      <div className="psub">Atlanta expansion · fleet-config planner + per-load margin · CPM = driver wages only</div>

      {/* Live YTD actuals (from FreightIQ ATL constants) */}
      {ytd && (() => {
        const laborFuel = (ytd.labor || 0) + (ytd.fuel || 0);
        const ytdCpm = ytd.miles > 0 ? laborFuel / ytd.miles : 0;
        const cells = [
          { l: 'ATL Miles YTD', v: fn(ytd.miles), s: `${ytd.trucks || 0} trucks`, c: C.text },
          { l: 'ATL Labor', v: fd(ytd.labor, 0), s: ytd.hrs ? `${fn(ytd.hrs)} hrs` : 'driver wages', c: C.blue },
          { l: 'ATL Fuel', v: fd(ytd.fuel, 0), s: ytd.gallons ? `${fn(ytd.gallons)} gal` : '', c: C.primary },
          { l: 'Actual CPM', v: fd(ytdCpm, 3), s: 'labor + fuel ÷ miles', c: C.green },
          { l: 'ATL Revenue', v: ytd.revenue ? fd(ytd.revenue, 0) : '—', s: ytd.revenue && laborFuel ? `${fp((1 - laborFuel / ytd.revenue) * 100)} labor+fuel margin` : 'booked in CE/SF', c: C.yellow },
        ];
        return (
          <div style={{ ...cardStyle, marginBottom: 16, borderColor: 'rgba(74,222,128,0.35)', background: 'linear-gradient(135deg,#0e1a12 0%,#12151c 100%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: C.green }}>🍑 Actual ATL Performance · YTD</div>
              <div style={{ fontSize: 10, color: C.muted }}>live · carved out of fleet CPM · planning defaults below</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
              {cells.map((x, i) => (
                <div key={i}>
                  <div style={{ ...labelStyle, fontSize: 9 }}>{x.l}</div>
                  <div style={{ ...calcVal, fontFamily: "'IBM Plex Mono', monospace", color: x.c }}>{x.v}</div>
                  <div style={{ fontSize: 9, color: C.muted }}>{x.s}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 9, color: C.muted, marginTop: 10 }}>CPM uses driver wages only (no office labor). Revenue booked within CE/SF.</div>
          </div>
        );
      })()}

      {/* sub-tab switcher */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {tabs.map(t => {
          const active = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{ background: active ? C.primary : 'transparent', color: active ? '#07100e' : C.muted,
                border: `1px solid ${active ? C.primary : C.border}`, borderRadius: 8, padding: '8px 22px',
                fontSize: 14, fontWeight: 800, cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase' }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div>
        {activeTab === 'basic' ? (
          <BasicCPMTab
            fleet={fleet} setFleet={setFleet} truckCount={truckCount}
            laborCfg={laborCfg} setLaborCfg={setLaborCfg}
            truckCfg={truckCfg} setTruckCfg={setTruckCfg}
            manualCosts={manualCosts} setManualCosts={setManualCosts}
            miles={miles} setMiles={setMiles} period={period} setPeriod={setPeriod}
            computed={computed} fleetMetrics={fleetMetrics}
            basicCPM={basicCPM} allInCPM={allInCPM} basicTotal={basicTotal} allInTotal={allInTotal} totalMiles={totalMiles}
          />
        ) : (
          <PerLoadCPM d={fleetData} />
        )}
      </div>
    </div>
  );
}
