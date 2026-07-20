#!/usr/bin/env python3
# Regenerates PAYROLL[] + FUEL{} for src/App.jsx from this week's SF payroll XLS
# + EFS report, reusing parse_weekly_drop's parsers. Preserves the delicate
# per-driver card mapping + frozen/active split-card logic from the CURRENT
# App.jsx (frozen drivers keep their portion; the active owner of a shared card
# absorbs the remainder). Excludes office + the 9 ATL drivers. Reconciles the
# FUEL{} sum against FUEL_TOT so a mis-map is caught, not shipped.
import re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
import importlib.util
spec = importlib.util.spec_from_file_location("pwd", os.path.join(os.path.dirname(__file__), "parse_weekly_drop.py"))
pwd = importlib.util.module_from_spec(spec)
# prevent main() auto-run
_orig = pwd.__dict__.get("__name__")
spec.loader.exec_module(pwd)

ROOT = os.path.join(os.path.dirname(__file__), "..")
APP = os.path.join(ROOT, "src", "App.jsx")
app = open(APP, encoding="utf-8").read()

# 9 ATL drivers (carved out of fleet) — last-name match
ATL_LN = {"baker", "dawson", "pacitti", "griffin", "johnson", "logan", "phillips", "tucker", "wainwright"}
def is_atl(name):
    return name.split()[0].lower() in ATL_LN

# ---- 1) SF payroll → fleet drivers (parser already excludes office + SF_ATL) ----
sf_path = pwd.find_file(r"ShowFreightInc_PayrollSummary.*\.xls")
sfp = pwd.summarize_sf_payroll(sf_path)
drivers = sfp["drivers"]  # [{name, hours, totalCost}], fleet only

# ---- 2) EFS → per-card {card:(amt,gal)} ----
efs_path = pwd.find_file(r"TransactionReport.*\.pdf", r"EFS.*\.pdf")
lines = []
import pdfplumber
with pdfplumber.open(efs_path) as pdf:
    for pg in pdf.pages:
        lines.extend((pg.extract_text() or "").split("\n"))
cards, _ = pwd.summarize_efs(lines)   # {card:(amt,gal)}

# ---- 3) parse current FUEL{} → driver -> {cards:[...], fuel, gallons, frozen} ----
fuel_block = re.search(r"let FUEL = \{(.*?)\n\};", app, re.S).group(1)
cur = {}
for m in re.finditer(r'"([^"]+)":\s*\{ fuel:\s*([\d.]+),\s*gallons:\s*([\d.]+) \},?\s*(//.*)?', fuel_block):
    name, fuel, gal, comment = m.group(1), float(m.group(2)), float(m.group(3)), (m.group(4) or "")
    cnums = re.findall(r"card[s]?\s+((?:\d{5}(?:\s*\+\s*)?)+)", comment)
    clist = re.findall(r"\d{5}", " ".join(cnums)) if cnums else re.findall(r"\bcard[s]?\s+(\d{5})", comment)
    if not clist:
        clist = re.findall(r"\b(\d{5})\b", comment)  # fallback: any 5-digit in comment
    frozen = "frozen" in comment.lower() or "*inactive" in comment.lower()
    cur[name] = dict(cards=clist, fuel=fuel, gallons=gal, frozen=frozen, comment=comment.strip())

# ---- 4) recompute per-driver fuel ----
# card -> list of (driver, frozen)
card_owners = {}
for name, d in cur.items():
    for c in d["cards"]:
        card_owners.setdefault(c, []).append((name, d["frozen"]))

new_fuel = {}
for name, d in cur.items():
    if is_atl(name):
        continue  # ATL carved out of FUEL{}
    if d["frozen"]:
        new_fuel[name] = (d["fuel"], d["gallons"])  # frozen: unchanged
        continue
    amt = gal = 0.0
    for c in d["cards"]:
        if c not in cards:
            continue
        camt, cgal = cards[c]
        owners = card_owners.get(c, [])
        frozen_here = [o for o in owners if o[1] and o[0] != name]
        # active owner absorbs card total minus frozen co-owners' fixed portions
        for fo, _ in frozen_here:
            # subtract that frozen driver's fixed portion on THIS card. A frozen
            # driver's whole fuel sits on their primary (first-listed) card, so
            # subtract it there (not on their other/ATL cards).
            if cur[fo]["cards"] and cur[fo]["cards"][0] == c:
                camt -= cur[fo]["fuel"]; cgal -= cur[fo]["gallons"]
        amt += camt; gal += cgal
    new_fuel[name] = (round(max(amt, 0), 2), round(max(gal, 0), 2))

# ---- 5) emit PAYROLL[] (preserve active flags from current) ----
cur_active = {}
for m in re.finditer(r'\{ name:\s*"([^"]+)",[^}]*?(active:\s*false)?[^}]*\}', app):
    pass
active_false = set(re.findall(r'\{ name:\s*"([^"]+)"[^}]*active:\s*false', app))

pay_lines = []
for d in sorted(drivers, key=lambda x: x["name"]):
    af = ", active: false" if d["name"] in active_false else ""
    pay_lines.append(f'  {{ name: "{d["name"]}", hours: {d["hours"]:.2f}, totalCost: {d["totalCost"]:.2f}{af} }},')
PAYROLL = "let PAYROLL = [\n" + "\n".join(pay_lines) + "\n];"

fuel_lines = []
for name in sorted(new_fuel):
    f, g = new_fuel[name]
    com = cur[name]["comment"]
    fuel_lines.append(f'  "{name}": {{ fuel: {f}, gallons: {g} }},  {com}')
# keep the header comment lines of FUEL block
hdr = "\n".join(l for l in fuel_block.split("\n")[:6] if l.strip().startswith("//"))
FUEL = "let FUEL = {\n" + hdr + "\n" + "\n".join(fuel_lines) + "\n};"

# reconcile
fuel_sum = sum(v[0] for v in new_fuel.values())
FUEL_TOT = float(re.search(r"let FUEL_TOT\s*=\s*([\d.]+)", app).group(1))
print(f"PAYROLL drivers: {len(drivers)}  (LABOR {sfp['driver_total_cost']:,.2f})")
print(f"FUEL{{}} sum: {fuel_sum:,.2f}  vs FUEL_TOT {FUEL_TOT:,.2f}  diff {fuel_sum-FUEL_TOT:,.2f}")
print(f"(diff = unmapped warehouse/office cards kept in FUEL_TOT but not FUEL{{}})")

open(os.path.join(ROOT, "incoming-freightiq", "_gen_payroll.txt"), "w", encoding="utf-8").write(PAYROLL)
open(os.path.join(ROOT, "incoming-freightiq", "_gen_fuel.txt"), "w", encoding="utf-8").write(FUEL)
print("wrote _gen_payroll.txt + _gen_fuel.txt")
