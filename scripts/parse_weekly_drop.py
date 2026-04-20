"""
Weekly FreightIQ data parser.

Reads every file in incoming-freightiq/ and emits a single structured report
for Claude to translate into App.jsx edits. Handles:

  - SF Payroll .xls         — QuickBooks Show Freight Inc payroll summary by employee
  - J&A Payroll .xls        — QuickBooks J&A Management Group payroll summary by employee
  - CE&SF Transaction .xlsx — QuickBooks category-subtotaled transaction report
  - EFS fuel .pdf           — per-card (per-driver) fuel transaction report

Usage:
  cd c:/Users/hoffm/Desktop/Ben/freightiq
  python scripts/parse_weekly_drop.py

Deps: xlrd openpyxl pdfplumber (all already installed on Ben's box)

Output:
  - _parse_output.txt  — raw dumps of every file
  - _summary.txt       — derived totals (driver labor, fuel by card, P&L categories)

The office-vs-driver split for SF payroll is hardcoded below — keep in sync with
CLAUDE.md "Office vs Driver split" section.
"""
import os, re, sys, collections
import xlrd, openpyxl, pdfplumber

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INCOMING = os.path.join(BASE, "incoming-freightiq")

# Per CLAUDE.md "Office vs Driver split (SF Payroll)" — exclude these from LABOR/TOTAL_HRS
SF_OFFICE = {
    "Arias Adrian", "Eagleton Gentry J", "Figueroa Andres",
    "Fissehaye Biniyam G", "Gonzalez Gabriel", "Grosser Scot E",
    "Rivera Cecilia I", "Youngblood Nathan",
}


def find_file(*patterns):
    for name in os.listdir(INCOMING):
        for p in patterns:
            if re.search(p, name, re.IGNORECASE):
                return os.path.join(INCOMING, name)
    return None


def dump_xls(path, label, out):
    out.write(f"\n===== {label} :: {os.path.basename(path)} =====\n")
    wb = xlrd.open_workbook(path)
    sh = wb.sheets()[0]
    for r in range(sh.nrows):
        row = [sh.cell(r, c).value for c in range(sh.ncols)]
        while row and (row[-1] == '' or row[-1] is None): row.pop()
        if not row: continue
        cells = []
        for v in row:
            if isinstance(v, float) and v == int(v): cells.append(str(int(v)))
            elif isinstance(v, float): cells.append(f"{v:.2f}")
            else: cells.append(str(v).strip())
        out.write(" | ".join(cells) + "\n")
    return wb


def dump_xlsx(path, label, out):
    out.write(f"\n===== {label} :: {os.path.basename(path)} =====\n")
    wb = openpyxl.load_workbook(path, data_only=True)
    for sh_name in wb.sheetnames:
        sh = wb[sh_name]
        for r in sh.iter_rows(values_only=True):
            row = list(r)
            while row and (row[-1] is None or row[-1] == ''): row.pop()
            if not row: continue
            cells = []
            for v in row:
                if v is None: cells.append('')
                elif isinstance(v, float) and v == int(v): cells.append(str(int(v)))
                elif isinstance(v, float): cells.append(f"{v:.2f}")
                else: cells.append(str(v).strip())
            out.write(" | ".join(cells) + "\n")
    return wb


def dump_pdf_text(path, label, out):
    out.write(f"\n===== {label} :: {os.path.basename(path)} =====\n")
    pages = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            txt = page.extract_text() or ''
            out.write(txt + "\n")
            pages.extend(txt.split('\n'))
    return pages


def summarize_sf_payroll(path):
    """Extract per-driver hours + totalCost, excluding office staff."""
    wb = xlrd.open_workbook(path)
    sh = wb.sheets()[0]
    header = [sh.cell(6, c).value for c in range(sh.ncols)]  # row 7 in 1-indexed
    hours_row = [sh.cell(7, c).value for c in range(sh.ncols)]
    cost_row = None
    period = None
    for r in range(sh.nrows):
        a = sh.cell(r, 0).value
        if isinstance(a, str) and a.strip().lower().startswith("total payroll cost"):
            cost_row = [sh.cell(r, c).value for c in range(sh.ncols)]
        if isinstance(a, str) and "from " in a.lower() and "to " in a.lower():
            period = a.strip()
    if cost_row is None:
        return None
    drivers = []
    office = []
    total_hrs_all = hours_row[1] if isinstance(hours_row[1], (int, float)) else 0
    total_cost_all = cost_row[1] if isinstance(cost_row[1], (int, float)) else 0
    for c in range(2, len(header)):
        name = str(header[c]).lstrip('*').strip()
        if not name: continue
        hrs = hours_row[c] if isinstance(hours_row[c], (int, float)) else 0
        cost = cost_row[c] if isinstance(cost_row[c], (int, float)) else 0
        bucket = office if name in SF_OFFICE else drivers
        bucket.append({"name": name, "hours": round(hrs, 2), "totalCost": round(cost, 2)})
    drivers_hours = sum(d["hours"] for d in drivers)
    drivers_cost = sum(d["totalCost"] for d in drivers)
    return {
        "period": period,
        "all_hours": total_hrs_all,
        "all_cost": total_cost_all,
        "drivers": drivers,
        "office": office,
        "driver_total_hours": round(drivers_hours, 2),
        "driver_total_cost": round(drivers_cost, 2),
    }


def summarize_cesf_transactions(path):
    """Pull category subtotals from the QB transaction report."""
    wb = openpyxl.load_workbook(path, data_only=True)
    sh = wb[wb.sheetnames[0]]
    current = None
    totals = {}
    for row in sh.iter_rows(values_only=True):
        cells = [c for c in row if c is not None and c != '']
        if not cells: continue
        a = str(cells[0]).strip()
        # Section header: single cell like "Fuel", "SF Truck Insurance", etc.
        if len(cells) == 1 and not a.startswith("Total "):
            current = a
        # Total for {category}
        if a.startswith("Total for "):
            cat = a.replace("Total for ", "").strip()
            # last numeric in row is the total
            for v in reversed(cells):
                if isinstance(v, (int, float)):
                    totals[cat] = round(v, 2)
                    break
    return totals


def summarize_efs(pages_lines):
    """Authoritative: sum per-card from 'Group:' summary blocks."""
    cards = {}
    # First-seen raw driver name per card from tx rows
    card_driver = {}
    i = 0
    while i < len(pages_lines):
        ln = pages_lines[i]
        m = re.match(r'^Group:\s*\d+\s+(\d{5})\s+Amount', ln)
        if m:
            card = m.group(1)
            amt = 0.0; qty = 0.0
            j = i + 1
            while j < len(pages_lines):
                sub = pages_lines[j]
                if re.match(r'^Group:', sub): break
                if 'Grand Totals' in sub: break
                if re.match(r'^\d{5}\s+\d{4}-\d{2}-\d{2}', sub): break
                item = re.match(r'^\s*(ULSD|BDSL|CDSL|UNPR|UNRG)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)', sub)
                if item:
                    amt += float(item.group(2).replace(',', ''))
                    qty += float(item.group(3).replace(',', ''))
                j += 1
            cards[card] = (cards.get(card, (0, 0))[0] + amt, cards.get(card, (0, 0))[1] + qty)
            i = j
        else:
            i += 1
    # Driver name lookup
    for ln in pages_lines:
        m = re.match(r'^(\d{5})\s+\d{4}-\d{2}-\d{2}\s+\S+\s+(?:\S+\s+)?(.+?)\s+(?:TA |FJ|PILOT|ONE9|PETRO|LOVES|MAVERIK|FLYING|GOLDEN|STOCKMENS|QUIK)', ln)
        if m and m.group(1) not in card_driver:
            card_driver[m.group(1)] = m.group(2).strip()
    return cards, card_driver


def main():
    os.makedirs(INCOMING, exist_ok=True)
    files = os.listdir(INCOMING)
    if not files:
        print("incoming-freightiq/ is empty")
        sys.exit(0)

    out_raw = open(os.path.join(INCOMING, "_parse_output.txt"), "w", encoding="utf-8")
    out_sum = open(os.path.join(INCOMING, "_summary.txt"), "w", encoding="utf-8")

    sf_path = find_file(r"ShowFreight.*PayrollSummary.*\.xls$", r"SF.*Payroll.*\.xls")
    ja_path = find_file(r"J.A.*PayrollSummary.*\.xls", r"J.A.*Payroll.*\.xls")
    cesf_path = find_file(r"CE.*SF.*Transaction.*\.xlsx", r"CE.*SF.*Combined.*\.xlsx")
    efs_path = find_file(r"TransactionReport.*\.pdf", r"EFS.*\.pdf")

    if sf_path: dump_xls(sf_path, "SF_PAYROLL", out_raw)
    if ja_path: dump_xls(ja_path, "JA_PAYROLL", out_raw)
    if cesf_path: dump_xlsx(cesf_path, "CESF_TRANS", out_raw)
    efs_pages = dump_pdf_text(efs_path, "EFS_FUEL", out_raw) if efs_path else []

    out_sum.write("=" * 70 + "\nWEEKLY DROP SUMMARY\n" + "=" * 70 + "\n\n")

    if sf_path:
        sfp = summarize_sf_payroll(sf_path)
        out_sum.write(f"[SF PAYROLL] {sfp['period']}\n")
        out_sum.write(f"  Total (all staff):   {sfp['all_hours']:>8.2f} hrs  ${sfp['all_cost']:>12,.2f}\n")
        out_sum.write(f"  Drivers only (CPM):  {sfp['driver_total_hours']:>8.2f} hrs  ${sfp['driver_total_cost']:>12,.2f}\n")
        out_sum.write(f"  Active driver count: {len([d for d in sfp['drivers'] if d['hours'] > 0])}\n")
        out_sum.write(f"  Office excluded:     {len(sfp['office'])} ({', '.join(o['name'] for o in sfp['office'])})\n\n")
        out_sum.write("  Per-driver:\n")
        for d in sfp['drivers']:
            out_sum.write(f"    {d['name']:28s}  {d['hours']:>7.2f}  ${d['totalCost']:>10,.2f}\n")
        out_sum.write("\n")

    if cesf_path:
        cats = summarize_cesf_transactions(cesf_path)
        out_sum.write("[CE&SF TRANSACTIONS — YTD category totals]\n")
        for cat, v in cats.items():
            out_sum.write(f"  {cat:30s}  ${v:>12,.2f}\n")
        out_sum.write("\n")

    if efs_path:
        cards, drivers = summarize_efs(efs_pages)
        total_amt = sum(a for a, _ in cards.values())
        total_qty = sum(q for _, q in cards.values())
        out_sum.write("[EFS — per-card totals, aggregated from Group summary blocks]\n")
        out_sum.write(f"  {'CARD':>6s}  {'DRIVER':30s}  {'AMT':>12s}  {'GAL':>10s}\n")
        for card in sorted(cards, key=lambda c: -cards[c][0]):
            a, q = cards[card]
            out_sum.write(f"  {card:>6s}  {drivers.get(card,'?'):30s}  ${a:>11,.2f}  {q:>10,.2f}\n")
        out_sum.write(f"  {'TOTAL':>6s}  {'':30s}  ${total_amt:>11,.2f}  {total_qty:>10,.2f}\n\n")

    out_raw.close()
    out_sum.close()
    print(f"Wrote {INCOMING}/_parse_output.txt and _summary.txt")


if __name__ == "__main__":
    main()
