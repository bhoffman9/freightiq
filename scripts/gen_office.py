#!/usr/bin/env python3
# Refresh OFFICE_W2[] + WAREHOUSE[] gross/taxes/contrib/totalCost from the SF + J&A
# PayrollSummary XLS (by ROW LABEL, not index — rows shift). Keeps each person's
# bonus/reimb/commission/note; recomputes salary = gross - bonus - reimb - commission.
import xlrd, re, os, glob
ROOT = os.path.join(os.path.dirname(__file__), "..")
APP = os.path.join(ROOT, "src", "App.jsx")
INC = os.path.join(ROOT, "incoming-freightiq")

def latest(pat):
    fs = glob.glob(os.path.join(INC, pat))
    return max(fs, key=os.path.getmtime) if fs else None

LABELS = {"gross pay - total": "gross", "employer taxes - total": "taxes",
          "company contributions - total": "contrib", "total payroll cost": "totalCost"}

def parse(path):
    ws = xlrd.open_workbook(path).sheet_by_index(0)
    # header row = the row where col 1 == 'Total'
    hr = next(r for r in range(min(8, ws.nrows)) if str(ws.cell_value(r, 1)).strip().lower() == "total")
    names = {c: str(ws.cell_value(hr, c)).strip() for c in range(2, ws.ncols) if str(ws.cell_value(hr, c)).strip()}
    rows = {}
    for r in range(ws.nrows):
        lbl = str(ws.cell_value(r, 0)).strip().lower()
        if lbl in LABELS:
            rows[LABELS[lbl]] = r
    out = {}
    for c, nm in names.items():
        clean = nm.lstrip("*").strip()
        vals = {}
        for f, r in rows.items():
            try: vals[f] = round(float(ws.cell_value(r, c) or 0), 2)
            except: vals[f] = 0.0
        out[tuple(sorted(clean.lower().replace(",", "").split()[:2]))] = vals
    return out

data = {}
for pat in ["ShowFreightInc_PayrollSummary*.xls", "J&A*PayrollSummary*.xls"]:
    p = latest(pat)
    if p: data.update(parse(p))

app = open(APP, encoding="utf-8").read()

def upd(block_name):
    global app
    m = re.search(r"const %s = \[(.*?)\n\];" % block_name, app, re.S)
    body = m.group(1)
    def repl(line):
        nm = re.search(r'name:"([^"]+)"', line)
        if not nm: return line
        key = tuple(sorted(nm.group(1).lower().replace(",", "").split()[:2]))
        if key not in data: return line
        v = data[key]
        def setf(l, field, val):
            return re.sub(r"(%s:)\s*[-\d.]+" % field, lambda mm: "%s %s" % (mm.group(1), val), l, count=1)
        for f in ("gross", "taxes", "contrib", "totalCost"):
            if f in v: line = setf(line, f, v[f])
        # recompute salary = gross - bonus - reimb - commission
        def g(field):
            mm = re.search(r"%s:\s*([-\d.]+)" % field, line); return float(mm.group(1)) if mm else 0.0
        sal = round(g("gross") - g("bonus") - g("reimb") - g("commission"), 2)
        line = setf(line, "salary", sal)
        return line
    newbody = "\n".join(repl(l) for l in body.split("\n"))
    app = app[:m.start(1)] + newbody + app[m.end(1):]

upd("OFFICE_W2")
upd("WAREHOUSE")
open(APP, "w", encoding="utf-8").write(app)
matched = sum(1 for k in data)
print("parsed %d payroll people; OFFICE_W2 + WAREHOUSE gross/taxes/contrib/totalCost refreshed." % matched)
