#!/usr/bin/env python3
"""MANDATORY WEEKLY GUARD — ATL_WEEKLY_LOG integrity.

Runs the same class of check as check_contractors.py, for the other place where
data went silently missing for a month.

Three real failures this catches, all of which shipped undetected in 2026:

  1. A MISSING WEEK. The week of Jul 6-12 was absent from the log entirely —
     13 entries covering 14 elapsed weeks. Nothing flagged it, and every
     cumulative ATL figure reported to Ben understated by that week until
     2026-08-10.

  2. A PLACEHOLDER ZERO. The 7/13 entry carried fuelAmt: 0 because the roster
     expanded 7->9 mid-stream and the number was "to be filled in later." It
     never was. A zero looks like data.

  3. A DRIFTED AMOUNT. The 5/4 - 6/21 entries were best-effort allocations
     written before the transaction-date method existed. Recomputing them from
     each week's OWN roster moved individual weeks by up to $5,556 in BOTH
     directions (net only -$1,819.59 — which is exactly why a net check would
     have missed it; this compares PER WEEK).

Exit code is non-zero on any finding. Do NOT commit a weekly with this failing.
Never widen TOL to make it pass — if a week legitimately differs, say why in
the commit message.

Usage:  python scripts/check_atl_log.py
"""
import os, re, sys, glob, datetime, collections

ROOT = os.path.join(os.path.dirname(__file__), "..")
APP = os.path.join(ROOT, "src", "App.jsx")
LAUNCH = datetime.date(2026, 5, 4)          # ATL operations launched
TOL = 1.00                                   # dollars, per week

# ATL driver -> EFS card(s). The nine current ATL cards are carved out of fleet
# FUEL{}; the three early-ATL drivers went BACK to the fleet and still carry
# fleet cards, so their cards are deliberately NOT in the 9-card carve set.
# ADD NEW ATL DRIVERS HERE or the guard cannot see their fuel.
CARD = {
    "Baker Anthony": ["27450"], "Dawson Brian": ["17451"],
    "Pacitti Michael R": ["87455"], "Johnson Christopher M": ["37459"],
    "Johnson Christopher": ["37459"], "Logan LaDyle": ["57457"],
    "Tucker Robert": ["47458"], "Wainwright Michael W": ["67463"],
    "Griffin Corey": ["07454"], "Phillips Anthony P": ["87457"],
    "Davis Anthoni D": ["27406"], "Denman Samuel E": ["47405", "37403"],
    "Alshamaa Manar": ["87454"],
}

ROW = re.compile(r"^(\d{5})\s+(\d{4}-\d{2}-\d{2})\s+(.*)$")
# NOTE: the per-card "Group:" summary block also emits a ULSD line with three
# numbers. Requiring the <card> <date> transaction prefix above is what keeps it
# out — without that, gallons DOUBLE and dollars inflate by each card's avg PPU.
ITEM = re.compile(r"\b(ULSD|DEFD|DEF|BDSL|CDSL|UNPR|UNRG)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)\b")
num = lambda x: float(x.replace(",", ""))


def find_efs():
    """Newest EFS report: this week's drop first, then the drop archive."""
    cands = glob.glob(os.path.join(ROOT, "incoming-freightiq", "TransactionReport*.pdf"))
    cands += glob.glob(os.path.join(ROOT, "..", "_freightiq-drop-archive", "*", "TransactionReport*.pdf"))
    return max(cands, key=os.path.getmtime) if cands else None


def load_tx(path):
    try:
        import pdfplumber
    except ImportError:
        return None
    tx = collections.defaultdict(float)
    with pdfplumber.open(path) as pdf:
        for pg in pdf.pages:
            for ln in (pg.extract_text() or "").split("\n"):
                m = ROW.match(ln.strip())
                if not m:
                    continue
                for it, _p, _q, amt in ITEM.findall(m.group(3)):
                    if it in ("DEFD", "DEF"):      # Total Fuel is ULSD only
                        continue
                    tx[(m.group(1), m.group(2))] += num(amt)
    return tx


def main():
    app = open(APP, encoding="utf-8").read()
    log = app[app.index("ATL_WEEKLY_LOG"):app.index("function atlSum()")]
    weeks = re.findall(
        r'weekStart:\s*"([\d-]+)".*?weekEnd:\s*"([\d-]+)".*?drivers:\s*\[(.*?)\](.*?)(?=weekStart:|\Z)',
        log, re.S)
    findings = []

    if not weeks:
        print("ATL_WEEKLY_LOG: no entries parsed — check the array shape.")
        return 1

    parsed = []
    for ws, we, arr, body in weeks:
        g = lambda k: (lambda m: float(m.group(1)) if m else 0.0)(re.search(rf"\b{k}:\s*([\d.]+)", body))
        parsed.append(dict(ws=datetime.date.fromisoformat(ws), we=datetime.date.fromisoformat(we),
                           names=re.findall(r'"([^"]+)"', arr),
                           pay=g("driverPay"), fuel=g("fuelAmt"), contr=g("contractorPay")))

    # ---- 1. gapless + well-formed weeks -------------------------------------
    have = {w["ws"] for w in parsed}
    latest = max(have)
    d = LAUNCH
    while d <= latest:
        if d not in have:
            findings.append(("MISSING", f"week of {d} is absent from the log"))
        d += datetime.timedelta(days=7)
    for w in parsed:
        if w["ws"].weekday() != 0:
            findings.append(("SHAPE", f"{w['ws']} is not a Monday"))
        if (w["we"] - w["ws"]).days != 6:
            findings.append(("SHAPE", f"{w['ws']}..{w['we']} is not a 7-day week"))

    # ---- 2. placeholder zeros ----------------------------------------------
    for w in parsed:
        if w["names"] and w["pay"] == 0:
            findings.append(("ZERO", f"{w['ws']}: driverPay is 0 with {len(w['names'])} drivers on the roster"))
        if w["names"] and w["fuel"] == 0:
            findings.append(("ZERO", f"{w['ws']}: fuelAmt is 0 with {len(w['names'])} drivers on the roster"))

    # ---- 3. unmapped drivers -----------------------------------------------
    for w in parsed:
        for nm in w["names"]:
            if nm not in CARD:
                findings.append(("UNMAPPED", f"{w['ws']}: '{nm}' has no EFS card in CARD{{}} — fuel cannot be verified"))

    # ---- 4. fuel ties to the EFS transactions ------------------------------
    efs = find_efs()
    if not efs:
        findings.append(("NOEFS", "no EFS TransactionReport found in incoming-freightiq/ or the drop archive — fuel NOT verified"))
    else:
        tx = load_tx(efs)
        if tx is None:
            findings.append(("NOEFS", "pdfplumber not installed — fuel NOT verified"))
        else:
            print(f"  EFS source: {os.path.basename(efs)}")
            print(f"\n  {'week':<24}{'logged':>12}{'EFS':>12}{'diff':>11}")
            for w in parsed:
                cards = {c for nm in w["names"] for c in CARD.get(nm, [])}
                exp = round(sum(a for (c, ds), a in tx.items()
                                if c in cards and w["ws"] <= datetime.date.fromisoformat(ds) <= w["we"]), 2)
                diff = round(w["fuel"] - exp, 2)
                flag = " <<<" if abs(diff) > TOL else ""
                print(f"  {str(w['ws']):<24}{w['fuel']:>12,.2f}{exp:>12,.2f}{diff:>+11,.2f}{flag}")
                if abs(diff) > TOL:
                    findings.append(("FUEL", f"{w['ws']}: logged {w['fuel']:,.2f} vs EFS transactions {exp:,.2f} ({diff:+,.2f})"))

    # ---- report -------------------------------------------------------------
    tot = sum(w["pay"] + w["fuel"] + w["contr"] for w in parsed)
    print(f"\n  {len(parsed)} weeks logged, {LAUNCH} .. {latest}")
    print(f"  cumulative ATL charges: {tot:,.2f}")

    if not findings:
        print("\nOK — log is gapless, no placeholder zeros, every week ties to the EFS report.")
        return 0
    print(f"\n{len(findings)} finding(s):")
    for kind, msg in findings:
        print(f"  {kind:<9}{msg}")
    print("\nFix the log (or explain the variance explicitly in the commit message).")
    print("Do NOT widen TOL to silence this.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
