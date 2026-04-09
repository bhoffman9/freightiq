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
