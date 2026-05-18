"""
Parse the Atlanta Billing XLSX dropped into incoming-freightiq/ and produce
the ATL_BILLING constant block to paste into src/App.jsx.

Usage:
  python scripts/parse_atl_billing.py

Counts ONLY loads where the "Assigned" column = "ATL". Loads tagged
"ASSIGNED TO CORP" (ATL drivers running SF freight) and "ASSIGNED TO CEE"
(CE East) are excluded — they are NOT ATL revenue.

First-name → PAYROLL name mapping (extend if new ATL drivers appear):
  Anthoni → Davis Anthoni D
  Sam     → Denman Samuel E
  Michael → Wainwright Michael W
  CJ      → Johnson Christopher
  Manar   → Alshamaa Manar
  Robert  → Tucker Robert
"""
import os, sys, glob, re
import openpyxl
from collections import defaultdict

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INCOMING = os.path.join(BASE, "incoming-freightiq")

NAME_MAP = {
    "Anthoni": "Davis Anthoni D",
    "Sam":     "Denman Samuel E",
    "Michael": "Wainwright Michael W",
    "CJ":      "Johnson Christopher",
    "Manar":   "Alshamaa Manar",
    "Robert":  "Tucker Robert",
}


def find_billing_file():
    pat = os.path.join(INCOMING, "*Atlanta Billing*.xlsx")
    matches = glob.glob(pat)
    if not matches:
        print(f"No 'Atlanta Billing' XLSX in {INCOMING}/")
        sys.exit(1)
    return max(matches, key=os.path.getmtime)


def parse(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    sh = wb[wb.sheetnames[0]]
    # Extract "as of <date>" from sheet name like "as of 5-17-26"
    as_of_match = re.search(r"as of (\d+)-(\d+)-(\d+)", sh.title)
    if as_of_match:
        m, d, y = as_of_match.groups()
        months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        as_of = f"{months[int(m)]} {int(d)}, 20{y}"
    else:
        as_of = "(unknown)"

    rows = list(sh.iter_rows(values_only=True))
    # Header row is row 0
    # Columns: Driver | Load $ | REF # | PO # | Customer | Invoice Amount | Carrier | Carrier Amount | Assigned | Notes

    atl_rows = []
    assigned_counts = defaultdict(int)
    for r in rows[1:]:
        if not r or not r[0]: continue
        assigned = (str(r[8]).strip().upper() if r[8] else "")
        assigned_counts[assigned] += 1
        if assigned == "ATL":
            atl_rows.append(r)

    by_driver = defaultdict(lambda: {"count": 0, "revenue": 0.0, "carrier": 0.0})
    total_rev = 0.0
    total_car = 0.0
    for r in atl_rows:
        driver_short = (str(r[0]).strip() if r[0] else "")
        full_name = NAME_MAP.get(driver_short, f"<UNMAPPED: {driver_short}>")
        invoice = float(r[5]) if isinstance(r[5], (int, float)) else 0
        carrier = float(r[7]) if isinstance(r[7], (int, float)) else 0
        by_driver[driver_short]["count"] += 1
        by_driver[driver_short]["revenue"] += invoice
        by_driver[driver_short]["carrier"] += carrier
        total_rev += invoice
        total_car += carrier

    return {
        "as_of": as_of,
        "loads": len(atl_rows),
        "revenue": round(total_rev, 2),
        "carrier_pay": round(total_car, 2),
        "gross_profit": round(total_rev - total_car, 2),
        "gross_margin": round((total_rev - total_car) / total_rev * 100, 1) if total_rev else 0,
        "by_driver": by_driver,
        "assigned_counts": dict(assigned_counts),
    }


def emit(data):
    print("-" * 60)
    print(f"  ATL BILLING — as of {data['as_of']}")
    print("-" * 60)
    print(f"  ATL loads:    {data['loads']}")
    print(f"  Revenue:      ${data['revenue']:>12,.2f}")
    print(f"  Carrier pay:  ${data['carrier_pay']:>12,.2f}")
    print(f"  Gross profit: ${data['gross_profit']:>12,.2f}")
    print(f"  Gross margin: {data['gross_margin']}%")
    print()
    print("  Assigned breakdown (all loads in sheet):")
    for k, n in sorted(data["assigned_counts"].items(), key=lambda x: -x[1]):
        flag = "  <- ATL revenue" if k == "ATL" else ""
        print(f"    {k or '(blank)':35s}  {n}{flag}")
    print()
    print("  Per-driver ATL:")
    for d, t in sorted(data["by_driver"].items(), key=lambda x: -x[1]["revenue"]):
        full = NAME_MAP.get(d, f"<UNMAPPED:{d}>")
        gross = t["revenue"] - t["carrier"]
        print(f"    {full:25s} ({d:8s})  loads={t['count']}  rev=${t['revenue']:>10,.2f}  car=${t['carrier']:>10,.2f}  gp=${gross:>9,.2f}")

    print()
    print("-" * 60)
    print("  Paste this into src/App.jsx (replace existing ATL_BILLING):")
    print("-" * 60)
    print(f"const ATL_BILLING = {{")
    print(f'  asOf: "{data["as_of"]}",')
    print(f'  loads: {data["loads"]},')
    print(f'  revenue: {data["revenue"]:.2f},      // sum of Invoice Amount')
    print(f'  carrierPay: {data["carrier_pay"]:.2f},   // sum of Carrier Amount (COGS)')
    print(f'  grossProfit: {data["gross_profit"]:.2f},')
    print(f'  grossMargin: {data["gross_margin"]},      // %')
    print(f'  byDriver: [')
    for d, t in sorted(data["by_driver"].items(), key=lambda x: -x[1]["revenue"]):
        full = NAME_MAP.get(d, f"<UNMAPPED:{d}>")
        gross = t["revenue"] - t["carrier"]
        print(f'    {{ name: "{full}",{" "*(28-len(full))}short: "{d}",{" "*(10-len(d))}loads: {t["count"]}, revenue: {t["revenue"]:.2f}, carrier: {t["carrier"]:.2f}, gross: {gross:.2f} }},')
    print(f"  ],")
    print(f"}};")


if __name__ == "__main__":
    f = find_billing_file()
    print(f"Parsing: {os.path.basename(f)}")
    data = parse(f)
    emit(data)
