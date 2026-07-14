// AP Aging — fleet equipment with invoice matching, ported from
// ap-aging/src/app/api/equipment/route.js. Vercel serverless. CORS-enabled
// because FreightIQ's own EquipmentContext (and any other app) consumes it.
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY (shared project).
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder',
);

const VENDOR_ALIASES = {
  'penske truck leasing': 'Penske', 'penske': 'Penske',
  'tec equipment leasing': 'TEC', 'tec equipment': 'TEC',
  'tci dedicated logistics, leasing & rental': 'TCI', 'tci dedicated logistics': 'TCI', 'tci': 'TCI',
  'transportation commodities inc': 'TCI', 'transportation commodities': 'TCI',
  'mckinney trailers': 'McKinney', 'mckinney trailer rentals': 'McKinney',
  'xtra lease': 'XTRA Lease',
  'mountain west utility trailer': 'Mountain West', 'mountain west utility trailer, inc': 'Mountain West', 'utility trailer': 'Mountain West',
  'ten trailer leasing': 'Ten Trailer Leasing', 'ten trailer': 'Ten Trailer Leasing',
  'premier trailer leasing': 'Premier Trailer', 'premier trailer': 'Premier Trailer', 'premier trailers': 'Premier Trailer',
  'ryder truck rentals': 'Ryder',
  'bermuda rent': 'Bermuda Rent',
};
const normalizeVendor = (name) => VENDOR_ALIASES[(name || '').trim().toLowerCase()] || null;

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { data: fleet, error: fleetErr } = await supabase
      .from('equipment').select('*').order('vendor').order('vendor_unit');
    if (fleetErr) return res.status(500).json({ error: fleetErr.message });

    const { data: invoices, error: invErr } = await supabase
      .from('invoices')
      .select('id, vendor_name, invoice_number, invoice_date, due_date, amount, amount_paid, description, status, pdf_path')
      .order('invoice_date', { ascending: false });
    if (invErr) return res.status(500).json({ error: invErr.message });

    // contract number (4 digits) -> vendor_unit
    const contractToUnit = {};
    (fleet || []).forEach((eq) => {
      if (eq.contract) { const m = eq.contract.match(/(\d{4})/); if (m) contractToUnit[m[1]] = eq.vendor_unit; }
    });

    const invoicesByUnit = {};
    const invoicesByVendor = {};
    (invoices || []).forEach((inv) => {
      const desc = inv.description || '';
      const invNum = inv.invoice_number || '';
      const equipVendor = normalizeVendor(inv.vendor_name);

      const unitMatch = desc.match(/unit\s*#?\s*(\d{5,7})/i) || desc.match(/for\s+unit\s+(\d{5,7})/i);
      if (unitMatch) {
        const unitNum = unitMatch[1];
        let fleetMatch = (fleet || []).find((eq) => eq.vendor_unit === unitNum);
        if (!fleetMatch && equipVendor === 'TEC' && unitNum.length >= 5) {
          const last3 = unitNum.slice(-3).replace(/^0+/, '') || '0';
          const last4 = unitNum.slice(-4).replace(/^0+/, '') || '0';
          fleetMatch = (fleet || []).find((eq) => eq.vendor === 'TEC' && (eq.fleet_number === last3 || eq.fleet_number === last4));
          if (fleetMatch) {
            const vu = fleetMatch.vendor_unit;
            if (!invoicesByUnit[vu]) invoicesByUnit[vu] = [];
            invoicesByUnit[vu].push(inv);
          }
        }
        if (fleetMatch && !invoicesByUnit[fleetMatch.vendor_unit]?.includes(inv)) {
          const vu = fleetMatch.vendor_unit;
          if (!invoicesByUnit[vu]) invoicesByUnit[vu] = [];
          invoicesByUnit[vu].push(inv);
        }
      }

      if (equipVendor === 'TCI' && !unitMatch) {
        const contractMatch = invNum.match(/\d{2}[A-Z](\d{4})\d{2,}/);
        if (contractMatch && contractToUnit[contractMatch[1]]) {
          const vu = contractToUnit[contractMatch[1]];
          if (!invoicesByUnit[vu]) invoicesByUnit[vu] = [];
          invoicesByUnit[vu].push(inv);
        }
      }

      if (equipVendor) {
        if (!invoicesByVendor[equipVendor]) invoicesByVendor[equipVendor] = [];
        invoicesByVendor[equipVendor].push(inv);
      }
    });

    const matchedInvoiceIds = new Set();
    Object.values(invoicesByUnit).forEach((arr) => arr.forEach((inv) => matchedInvoiceIds.add(inv.id)));

    const vendorUnmatched = {};
    (invoices || []).forEach((inv) => {
      if (matchedInvoiceIds.has(inv.id)) return;
      const equipVendor = normalizeVendor(inv.vendor_name);
      if (equipVendor) { if (!vendorUnmatched[equipVendor]) vendorUnmatched[equipVendor] = []; vendorUnmatched[equipVendor].push(inv); }
    });

    const invRow = (i) => ({
      id: i.id, invoiceNumber: i.invoice_number, date: i.invoice_date,
      amount: parseFloat(i.amount) || 0, paid: parseFloat(i.amount_paid) || 0,
      description: i.description || '', status: i.status, pdfPath: i.pdf_path || '',
    });

    const units = (fleet || []).map((eq) => {
      const unitInvs = invoicesByUnit[eq.vendor_unit] || [];
      const totalBilled = unitInvs.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
      const totalPaid = unitInvs.reduce((s, i) => s + (parseFloat(i.amount_paid) || 0), 0);
      return {
        id: eq.id, fleetNumber: eq.fleet_number, vendor: eq.vendor, vendorUnit: eq.vendor_unit,
        vin: eq.vin || '—', make: eq.make || '—', model: eq.model || '—', year: eq.year || '—',
        type: eq.type, category: eq.category,
        monthlyCost: parseFloat(eq.monthly_cost) || 0, mileageRate: parseFloat(eq.mileage_rate) || 0,
        contract: eq.contract || '', status: eq.status,
        invoiceCount: unitInvs.length,
        totalBilled: Math.round(totalBilled * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        outstanding: Math.round((totalBilled - totalPaid) * 100) / 100,
        lastInvoiceDate: unitInvs.length > 0 ? unitInvs[0].invoice_date : '',
        invoices: unitInvs.map(invRow),
      };
    });

    const trucks = units.filter((u) => u.category === 'truck');
    const trailers = units.filter((u) => u.category === 'trailer');

    const vendorInvoices = {};
    Object.entries(vendorUnmatched).forEach(([vendor, invs]) => {
      vendorInvoices[vendor] = {
        count: invs.length,
        totalBilled: Math.round(invs.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0) * 100) / 100,
        totalPaid: Math.round(invs.reduce((s, i) => s + (parseFloat(i.amount_paid) || 0), 0) * 100) / 100,
        invoices: invs.map(invRow),
      };
    });

    return res.json({
      units, vendorInvoices,
      summary: {
        totalUnits: units.length, trucks: trucks.length, trailers: trailers.length,
        activeTrucks: trucks.filter((u) => u.status === 'Active').length,
        activeTrailers: trailers.filter((u) => u.status === 'Active').length,
        totalMonthly: units.filter((u) => u.status === 'Active').reduce((s, u) => s + u.monthlyCost, 0),
        totalBilled: units.reduce((s, u) => s + u.totalBilled, 0),
        totalOutstanding: units.reduce((s, u) => s + u.outstanding, 0),
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
