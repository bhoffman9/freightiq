#!/usr/bin/env python3
"""Weekly guard against silent contractor-data loss.

Two failures this catches, both of which went unnoticed for months:

  1. WENT SILENT — a payee who was being paid drops to zero and stays there.
     Debra Adamson, Elizabeth Delgado and Christopher Simpson came off W-2 in
     Feb/Mar 2026 and their Apr/May 1099 payments were never recorded. Nothing
     flagged it; the CONTRACTORS[] total just quietly ran 16% under QBO.

  2. MONTH DRIFT — grid 1099 cash vs the QBO "Contractor Payroll" P&L line,
     per month. A whole-year total hides which month broke; per-month points
     straight at it.

Run it every weekly drop, after build_paycheck_grid.py:

    python scripts/check_contractors.py

Exits 1 if anything trips, so it can gate a build. Pass --warn to report
without failing.
"""
import os, re, sys, csv, json, glob, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INCOMING = os.path.join(ROOT, "incoming-freightiq")
ARCHIVE = os.path.join(os.path.dirname(ROOT), "_freightiq-drop-archive")
MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

DRIFT_PCT = 2.0      # per-month tolerance vs QBO before it's a finding
SILENT_WEEKS = 3     # consecutive zero weeks after being paid = went silent


def _num(s):
    t = str(s).replace("$", "").replace(",", "").strip()
    if not t:
        return 0.0
    try:
        return -float(t.strip("()")) if t.startswith("(") else float(t)
    except ValueError:
        return 0.0


def find_pnl():
    """Monthly CE&SF P&L — current drop first, else newest archived copy."""
    pats = ["*PL_MONTHLY*.csv", "*Profit and Loss*.csv", "*Profit and Loss*.xlsx"]
    hits = []
    for d in (INCOMING, ARCHIVE):
        for pat in pats:
            hits += glob.glob(os.path.join(d, pat))
            hits += glob.glob(os.path.join(d, "*", pat))
    hits = [h for h in hits if h.lower().endswith(".csv")]
    return max(hits, key=os.path.getmtime) if hits else None


def qbo_by_month(path):
    rows = list(csv.reader(open(path, newline="", encoding="utf-8-sig")))
    hdr = next((r for r in rows if r and r[0] == "" and any("2026" in c for c in r)), None)
    if not hdr:
        return {}
    out = {}
    for r in rows:
        if r and r[0].strip() == "Contractor Payroll":
            for i, h in enumerate(hdr):
                h = h.strip()
                if h and h != "Total" and i < len(r):
                    out[h.split()[0]] = _num(r[i])
    return out


def grid():
    app = open(os.path.join(ROOT, "src", "App.jsx"), encoding="utf-8").read()
    m = re.search(r"const OFFICE_PAYCHECKS = (\{.*?\});\n", app, re.S)
    return json.loads(m.group(1)) if m else None


def main():
    warn_only = "--warn" in sys.argv
    g = grid()
    if not g:
        print("SKIP: OFFICE_PAYCHECKS not found in src/App.jsx")
        return 0

    findings = []

    # ---- 1) payees that went silent -------------------------------------
    weeks = g["weeks"]
    for s in g["sections"]:
        for r in s["rows"]:
            c = r.get("camts") or {}
            if not any(c.values()):
                continue
            paid = [i for i, w in enumerate(weeks) if c.get(w, 0)]
            last = paid[-1]
            trailing = len(weeks) - 1 - last
            # a gap INSIDE the paid range is worse than simply having stopped
            inner = 0
            run = 0
            for i in range(paid[0], last + 1):
                run = 0 if c.get(weeks[i], 0) else run + 1
                inner = max(inner, run)
            if inner >= SILENT_WEEKS:
                findings.append(
                    "GAP    %-30s %d consecutive zero weeks INSIDE its paid range "
                    "(%s..%s) — payments likely never recorded"
                    % (r["name"][:30], inner, weeks[paid[0]], weeks[last]))
            elif trailing >= SILENT_WEEKS:
                findings.append(
                    "SILENT %-30s no payment since %s (%d weeks) — confirm they "
                    "actually stopped" % (r["name"][:30], weeks[last], trailing))

    # ---- 2) monthly drift vs QBO ----------------------------------------
    pnl = find_pnl()
    if not pnl:
        findings.append("NO P&L  monthly CE&SF P&L csv not found — drift check skipped")
    else:
        qbo = qbo_by_month(pnl)
        gm = collections.defaultdict(float)
        for w in weeks:
            mn = MONTHS[int(w.split("/")[0])]
            for s in g["sections"]:
                for r in s["rows"]:
                    gm[mn] += (r.get("camts") or {}).get(w, 0)
        print("  %-6s %13s %13s %12s %8s" % ("month", "QBO", "grid", "gap", "pct"))
        for mn in MONTHS[1:]:
            if mn not in qbo:
                continue
            q, gv = qbo[mn], gm.get(mn, 0.0)
            gap = q - gv
            pct = (gap / q * 100) if q else 0.0
            flag = " <<<" if q and abs(pct) > DRIFT_PCT else ""
            print("  %-6s %13s %13s %12s %7.1f%%%s"
                  % (mn, format(q, ",.2f"), format(gv, ",.2f"), format(gap, ",.2f"), pct, flag))
            if q and abs(pct) > DRIFT_PCT:
                findings.append("DRIFT  %-6s grid is %s (%.1f%%) off QBO Contractor Payroll"
                                % (mn, format(gap, ",.2f"), pct))

    print()
    if not findings:
        print("OK — no silent payees, no month off QBO by more than %.1f%%" % DRIFT_PCT)
        return 0
    print("%d finding(s):" % len(findings))
    for f in findings:
        print("  " + f)
    print()
    print("Fix by adding the missing weeks to MANUAL_CONTRACTORS in "
          "scripts/build_paycheck_grid.py, then re-run it.")
    return 0 if warn_only else 1


if __name__ == "__main__":
    sys.exit(main())
