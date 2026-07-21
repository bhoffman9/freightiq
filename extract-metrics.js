// Extracts key metrics from App.jsx and writes public/metrics.json
// Runs automatically during `npm run build`

import { readFileSync, writeFileSync } from 'fs';

const src = readFileSync('src/App.jsx', 'utf8');

function grab(pattern) {
  const m = src.match(pattern);
  return m ? m[1] : null;
}

function num(pattern) {
  const v = grab(pattern);
  return v ? parseFloat(v.replace(/,/g, '')) : 0;
}

// Fleet constants
const metrics = {
  period: grab(/let PERIOD\s*=\s*"([^"]+)"/) || '',
  drivers: num(/(\d+)\s*drivers/i) || num(/let DRIVERS\s*=\s*(\d+)/),
  miles: num(/let MILES\s*=\s*([\d.]+)/),
  labor: num(/let LABOR\s*=\s*([\d.]+)/),
  fuel_tot: num(/let FUEL_TOT\s*=\s*([\d.]+)/),
  ins_tot: num(/let INS_TOT\s*=\s*([\d.]+)/),
  truck_tot: num(/let TRUCK_TOT\s*=\s*([\d.]+)/),
  trailer_tot: num(/let TRAILER_TOT\s*=\s*([\d.]+)/),
  truck_maint: num(/let TRUCK_MAINT\s*=\s*([\d.]+)/),
  trail_maint: num(/let TRAIL_MAINT\s*=\s*([\d.]+)/),
  storage: num(/let STORAGE\s*=\s*([\d.]+)/),
  uniforms: num(/let UNIFORMS\s*=\s*([\d.]+)/),
};

// Income data
const incomeMatch = src.match(/const INCOME_2026\s*=\s*\{([\s\S]*?)\};/);
if (incomeMatch) {
  const block = incomeMatch[1];
  const numFrom = (pat) => {
    const m = block.match(pat);
    return m ? parseFloat(m[1].replace(/,/g, '')) : 0;
  };
  metrics.total_revenue = numFrom(/total:\s*([\d.]+)/);
  metrics.carrier_pay = numFrom(/carrierPay:\s*([\d.]+)/);
  metrics.gross_profit = numFrom(/grossProfit:\s*([\d.]+)/);
  metrics.net_income = numFrom(/netIncome:\s*([\d.]+)/);
  metrics.revenue_ce = numFrom(/ce:\s*([\d.]+)/);
  metrics.revenue_sf = numFrom(/sf:\s*([\d.]+)/);
  metrics.revenue_di = numFrom(/di:\s*([\d.]+)/);
  metrics.net_op_income = numFrom(/netOpIncome:\s*([-\d.]+)/);
}

// Driver count from PAYROLL array
const payrollMatch = src.match(/const PAYROLL\s*=\s*\[([\s\S]*?)\];/);
if (payrollMatch && !metrics.drivers) {
  const names = payrollMatch[1].match(/name:\s*"/g);
  if (names) metrics.drivers = names.length;
}

// Days in period
const periodStr = metrics.period;
const dateMatch = periodStr.match(/(\w+ \d+).*?(\w+ \d+),\s*(\d{4})/);
if (dateMatch) {
  const start = new Date(`${dateMatch[1]}, ${dateMatch[3]}`);
  const end = new Date(`${dateMatch[2]}, ${dateMatch[3]}`);
  metrics.days_in_period = Math.round((end - start) / 86400000) + 1;
}

// ── Fleet utilization weekly series (mirror of App.jsx Fleet Utilization card) ──
// Parses TMS_HISTORY.weeks (SF-carrier weekly loads/rev/miles) + DRIVER_WEEKLY
// (per-pay-week driver loaded cost), matches each Sun–Sat revenue week to that
// week's payroll by pay date, and emits a per-week series + 12-wk summary so the
// numbers are logged point-in-time (fdw_utilization_weekly) and never lost.
try {
  const tmsBlock = src.match(/const TMS_HISTORY\s*=\s*\{[\s\S]*?weeks:\s*\[([\s\S]*?)\n\s*\],/);
  const dwMatch = src.match(/const DRIVER_WEEKLY\s*=\s*(\{[\s\S]*?\});/);
  const truckCount = num(/let TRUCK_COUNT\s*=\s*(\d+)/) || 0;
  const driverCount = metrics.drivers || 0;
  if (tmsBlock && dwMatch) {
    const wk = [...tmsBlock[1].matchAll(/\{key:'(\d{4}-\d\d-\d\d)',label:'([^']+)',loads:(\d+),rev:(\d+),miles:(\d+)/g)]
      .map(m => ({ key: m[1], label: m[2], loads: +m[3], rev: +m[4], miles: +m[5] }));
    const dw = JSON.parse(dwMatch[1]);
    const pdDates = (dw.weeks || []).map(l => { const [mo, d] = l.split('/').map(Number); return { label: l, t: Date.UTC(2026, mo - 1, d) }; });
    const payrollFor = (key) => { const [Y, M, D] = key.split('-').map(Number); const s = Date.UTC(Y, M - 1, D), e = s + 6 * 864e5; const h = pdDates.find(p => p.t >= s && p.t <= e); return h ? (dw.fleet?.[h.label] || 0) + (dw.otr?.[h.label] || 0) : null; };
    const series = wk.filter(w => w.loads >= 40).map(w => {
      const pay = payrollFor(w.key);
      return { week: w.key, label: w.label, loads: w.loads, rev: w.rev, miles: w.miles,
        driver_payroll: pay != null ? Math.round(pay) : null,
        rev_per_truck: truckCount ? Math.round(w.rev / truckCount) : null,
        mi_per_truck: truckCount ? Math.round(w.miles / truckCount) : null,
        loads_per_truck: truckCount ? +(w.loads / truckCount).toFixed(2) : null,
        rev_per_pay: pay ? +(w.rev / pay).toFixed(3) : null, trucks: truckCount, drivers: driverCount };
    });
    metrics.utilization_weekly = series;
    const recent = series.slice(-12), sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
    const payWk = recent.filter(x => x.driver_payroll);
    metrics.utilization = {
      weeks: recent.length, trucks: truckCount, drivers: driverCount,
      avg_rev: recent.length ? Math.round(sum(recent, x => x.rev) / recent.length) : 0,
      avg_loads: recent.length ? Math.round(sum(recent, x => x.loads) / recent.length) : 0,
      avg_miles: recent.length ? Math.round(sum(recent, x => x.miles) / recent.length) : 0,
      rev_per_truck: recent.length && truckCount ? Math.round(sum(recent, x => x.rev) / recent.length / truckCount) : 0,
      mi_per_truck: recent.length && truckCount ? Math.round(sum(recent, x => x.miles) / recent.length / truckCount) : 0,
      loads_per_truck: recent.length && truckCount ? +((sum(recent, x => x.loads) / recent.length) / truckCount).toFixed(2) : 0,
      rev_per_pay: sum(payWk, x => x.driver_payroll) > 0 ? +(sum(payWk, x => x.rev) / sum(payWk, x => x.driver_payroll)).toFixed(3) : null,
      driver_payroll_wk: payWk.length ? Math.round(sum(payWk, x => x.driver_payroll) / payWk.length) : 0,
    };
    metrics.driver_payroll_latest = payWk.length ? payWk[payWk.length - 1].driver_payroll : null;
  }
} catch (e) { console.warn('utilization extract skipped:', e.message); }

metrics.extracted_at = new Date().toISOString();

writeFileSync('public/metrics.json', JSON.stringify(metrics, null, 2));
console.log('Extracted metrics.json:', JSON.stringify(metrics, null, 2));

// ── Extract payroll summary for CFO Dashboard ──
const payroll = { drivers: [], office: [], warehouse: [], contractors: [], period: metrics.period };

// Driver payroll
const driverBlock = src.match(/let PAYROLL\s*=\s*\[([\s\S]*?)\];/);
if (driverBlock) {
  const rows = [...driverBlock[1].matchAll(/\{\s*name:\s*"([^"]+)",\s*hours:\s*([\d.]+),\s*totalCost:\s*([\d.]+)\s*\}/g)];
  payroll.drivers = rows.map(m => ({ name: m[1], hours: parseFloat(m[2]), totalCost: parseFloat(m[3]) }));
}

// Office W2
const officeBlock = src.match(/const OFFICE_W2\s*=\s*\[([\s\S]*?)\];/);
if (officeBlock) {
  const rows = [...officeBlock[1].matchAll(/name:"([^"]+)"[\s\S]*?entity:"([^"]+)"[\s\S]*?totalCost:\s*([\d.]+)/g)];
  payroll.office = rows.map(m => ({ name: m[1], entity: m[2], totalCost: parseFloat(m[3]) }));
}

// Warehouse
const whBlock = src.match(/const WAREHOUSE\s*=\s*\[([\s\S]*?)\];/);
if (whBlock) {
  const rows = [...whBlock[1].matchAll(/name:"([^"]+)"[\s\S]*?totalCost:\s*([\d.]+)/g)];
  payroll.warehouse = rows.map(m => ({ name: m[1], totalCost: parseFloat(m[2]) }));
}

// Contractors
const conBlock = src.match(/const CONTRACTORS\s*=\s*\[([\s\S]*?)\];/);
if (conBlock) {
  const rows = [...conBlock[1].matchAll(/name:"([^"]+)"[\s\S]*?total:\s*([\d.]+)/g)];
  payroll.contractors = rows.map(m => ({ name: m[1], total: parseFloat(m[2]) }));
}

payroll.totals = {
  driverLabor: payroll.drivers.reduce((s, d) => s + d.totalCost, 0),
  driverCount: payroll.drivers.length,
  officeTotal: payroll.office.reduce((s, o) => s + o.totalCost, 0),
  warehouseTotal: payroll.warehouse.reduce((s, w) => s + w.totalCost, 0),
  contractorTotal: payroll.contractors.reduce((s, c) => s + c.total, 0),
};
payroll.totals.grandTotal = payroll.totals.driverLabor + payroll.totals.officeTotal + payroll.totals.warehouseTotal + payroll.totals.contractorTotal;

writeFileSync('public/payroll-summary.json', JSON.stringify(payroll, null, 2));
console.log('Extracted payroll-summary.json:', JSON.stringify(payroll.totals, null, 2));
