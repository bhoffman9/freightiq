# Builds OFFICE_PAYCHECKS for Office Staff > Weekly Checks grid and writes it
# straight into src/App.jsx. Run from repo root each weekly drop:
#     python scripts/build_paycheck_grid.py
#
# Drop these into incoming-freightiq/ (filenames auto-detected by pattern):
#   - ShowFreightInc_PaycheckHistory_*.xls      (W-2, SF)
#   - J&A*PaycheckHistory*.xls                  (W-2, J&A)
#   - J&A*ContractorPayments*.xls               (1099 via QB)
#   - VendorEmployeePayments*.csv               (1099 via Chase)
#
# Business rules live in this file and must be maintained as people change:
#   - W2DIV / canon(): per-person company (CE/SF/CE East/J&A) + 50/50 splits
#   - dual people merge W-2 + 1099 into one row (Delgado/Simpson/Debra/Biniyam)
#   - hardcoded (not in any file): Maria Con ($550->$650/wk), Logic ($500/wk),
#     Mairena Tapias (dated list — APPEND her new payments each week)
#   - reimbursements excluded; agent (Nixon Graye) excluded
import xlrd, io, json, re, csv, datetime, glob, sys

ROOT = '.'
INC = 'incoming-freightiq'

def find(pattern):
    hits = sorted(glob.glob(f'{INC}/{pattern}'))
    if not hits:
        sys.exit(f'MISSING: no file matching {pattern} in {INC}/')
    return hits[-1]  # latest

SF_PC = find('ShowFreightInc_PaycheckHistory_*.xls')
JA_PC = find('J&A*PaycheckHistory*.xls')
QB_CON = find('J&A*ContractorPayments*.xls')
CHASE = find('VendorEmployeePayments*.csv')
print('using:', SF_PC.split("/")[-1], '|', JA_PC.split("/")[-1], '|', QB_CON.split("/")[-1], '|', CHASE.split("/")[-1])

app = io.open('src/App.jsx', encoding='utf-8').read()

def key(full):
    full = full.lstrip('*').strip()
    if ',' in full:
        last, first = [x.strip() for x in full.split(',', 1)]
    else:
        p = full.split(); first = p[0] if p else ''; last = p[-1] if p else ''
    return (last.lower(), (first[:1].lower() if first else ''))

FACT = {}
for blk in ['OFFICE_W2', 'WAREHOUSE']:
    b = re.search(r'const ' + blk + r' = \[(.*?)\n\];', app, re.S).group(1)
    for m in re.finditer(r'name:"([^"]+)".*?gross:([\d.]+).*?totalCost:([\d.]+)', b):
        nm, g, t = m.group(1), float(m.group(2)), float(m.group(3))
        FACT[key(nm)] = (t / g if g else 1.0, nm)

W2DIV = {('naruszewicz','b'):{'CE':0.5,'SF':0.5}, ('youngblood','n'):{'CE':1.0}, ('rivera','c'):{'CE':1.0},
         ('galvis','h'):{'CE':0.5,'CE East':0.5}, ('gelaw','k'):{'CE':0.5,'CE East':0.5}}
OFFICE = ['arias','gonzalez','grosser','naruszewicz','rivera','youngblood','mahan','eagleton','figueroa','wilson']

def mon(dt): return dt - datetime.timedelta(days=dt.weekday())
def mdate(s): m,d,y = s.split('/'); return datetime.date(int(y),int(m),int(d))

def parse_pc(path):
    sh = xlrd.open_workbook(path).sheets()[0]; out = []
    for r in range(5, sh.nrows):
        d,n,tp,nt = sh.cell(r,0).value, sh.cell(r,1).value, sh.cell(r,2).value, sh.cell(r,3).value
        if not d or not n: continue
        try: tp = float(tp); nt = float(nt)
        except: continue
        out.append((mdate(str(d).strip()), str(n).strip(), tp, nt))  # date, name, gross, net
    return out

sf = parse_pc(SF_PC); ja = parse_pc(JA_PC)
alld = [mon(d) for d,_,_,_ in sf+ja]; w0,w1 = min(alld), max(alld); weeks = []; c = w0
while c <= w1: weeks.append(c); c += datetime.timedelta(days=7)

# Column labels = PAY DAY (actual check date), not the Monday week-start.
# For each Mon-Sun bucket, use the MOST COMMON check date that week as the
# label (the main payroll run); off-cycle checks still sit in that column.
# Buckets are still keyed by Monday internally; PD maps Monday -> payday label.
from collections import Counter
_ckcount = {}
for _d, _n, _tp, _nt in sf + ja:
    _ckcount.setdefault(mon(_d), Counter())[_d] += 1
def _payday(mnd):
    cc = _ckcount.get(mnd)
    if not cc: return f"{mnd.month}/{mnd.day}"        # no checks that week → fall back to Monday
    pd = cc.most_common(1)[0][0]                       # most-frequent check date
    return f"{pd.month}/{pd.day}"
PD = {w: _payday(w) for w in weeks}                    # Monday date -> payday label
PD_BY_MONLABEL = {f"{w.month}/{w.day}": PD[w] for w in weeks}  # "6/29" (Mon) -> payday label
wlabel = [PD[w] for w in weeks]

def wk_of(dt):
    m = mon(dt); m = max(weeks[0], min(weeks[-1], m)); return PD[m]

rows = {}
def getrow(comp, k, name, former):
    r = rows.get((comp, k))
    if not r: r = rows[(comp, k)] = {'name':name,'former':former,'amts':{},'camts':{},'net':{},'gross':{},'car':{},'health':{},'commission':{},'reimb':{}}
    return r

def addw2(checks, office_only, src):
    for d,n,tp,nt in checks:
        k = key(n)
        if office_only and k[0] not in OFFICE: continue
        fac, fn = FACT.get(k, (1.11, None)); disp = fn or n.lstrip('*'); former = n.lstrip().startswith('*'); wl = wk_of(d)
        for comp, wt in (W2DIV.get(k) or {src:1.0}).items():
            nm = disp + (f" ({int(wt*100)}%)" if wt < 1 else "")
            r = getrow(comp, k, nm, former)
            r['amts'][wl]  = round(r['amts'].get(wl,0)  + tp*fac*wt, 2)   # loaded (gross x employer factor)
            r['gross'][wl] = round(r['gross'].get(wl,0) + tp*wt, 2)       # gross pay
            r['net'][wl]   = round(r['net'].get(wl,0)   + nt*wt, 2)       # net (bank direct deposit)

addw2(sf, True, 'SF'); addw2(ja, False, 'J&A')

# --- Driver weekly series (for the owner-facing "This Week — All-In Payroll"
# card + Fund Payroll panel). Drivers are excluded from the grid above, but the
# SF PaycheckHistory contains them. Bucket SF checks by pay week: the carved-out
# ex-OTR drivers (Baker/Dawson/Pacitti — now ATL, still not fleet) vs fleet
# drivers. Convert gross → loaded by a factor calibrated so the YTD sum matches
# LABOR (fleet) + the carve-out total from App.jsx. NOTE: the emitted DRIVER_WEEKLY
# key is still named 'otr' (internal only) — it's the ex-OTR/ATL driver bucket.
OTR_LN = {'baker', 'dawson', 'pacitti', 'griffin', 'johnson', 'logan', 'phillips', 'tucker', 'wainwright'}   # 9 ATL drivers (week of 7/19); kept separate from fleet LABOR
_drv_g, _otr_g = {}, {}
for d, n, tp, nt in sf:
    k = key(n)
    if k[0] in OFFICE: continue                 # office + warehouse
    wl = wk_of(d)
    if k[0] in OTR_LN: _otr_g[wl] = _otr_g.get(wl, 0) + tp
    else:              _drv_g[wl] = _drv_g.get(wl, 0) + tp
_LABOR = float(re.search(r'let LABOR\s*=\s*([\d.]+)', app).group(1))
_m = re.search(r'ATL drivers \([^)]*\) \$([\d,]+\.?\d*)', app)
_OTR_TOT = float(_m.group(1).replace(',', '')) if _m else 0.0
_Fd = _LABOR / sum(_drv_g.values()) if _drv_g else 1.0
_Fo = _OTR_TOT / sum(_otr_g.values()) if _otr_g else 1.0
DRIVER_WEEKLY = {
    'weeks': wlabel,
    'fleet': {wl: round(v * _Fd, 2) for wl, v in _drv_g.items()},
    'otr':   {wl: round(v * _Fo, 2) for wl, v in _otr_g.items()},
}

def canon(raw):
    s = raw.lower().strip()
    if 'nixon graye' in s: return None
    if s.startswith('logic'): return None   # overridden: $500/wk all year
    if 'jon marcus' in s: return (('con','JON'), 'Jon Marcus · 1099', {'CE':1.0}, False)
    if 'gabriel colon' in s: return (('con','GAB'), 'Gabriel Colon · 1099', {'CE':0.5,'SF':0.5}, False)
    if 'neon vibes' in s: return (('con','MEL'), 'Mellody Abrego · 1099', {'J&A':1.0}, False)
    if 'salman' in s or s == 'hilda': return (('con','HIL'), 'Hilda Salman · 1099', {'J&A':1.0}, False)
    if 'enm' in s: return (('fissehaye','b'), 'Biniyam Fissehaye', {'J&A':1.0}, True)
    if 'delgado' in s: return (('delgado','e'), None, {'J&A':1.0}, True)
    if s == 'christopher' or 'chris simpson' in s: return (('simpson','c'), None, {'J&A':1.0}, True)
    if 'bill a' in s or 'deb adamson' in s: return (('adamson','d'), None, {'J&A':1.0}, True)
    if 'erika' in s and 'valenc' in s: return (('con','ERI'), 'Erika Valencio · 1099', {'J&A':1.0}, False)
    if 'kacy' in s or ('richardson' in s and 'kac' in s): return (('con','KAC'), 'Kacy Richardson · 1099', {'J&A':1.0}, False)
    return ('UNMAPPED', raw, {}, False)

def add_contractor(dt, raw, amt, key='camts'):
    c = canon(raw)
    if c is None: return
    if c[0] == 'UNMAPPED': print('  UNMAPPED PAYEE (skipped):', raw); return
    rk, disp, weights, former = c; wl = wk_of(dt)
    for comp, w in weights.items():
        ex = rows.get((comp, rk)); nm = ex['name'] if ex else (disp + (f" ({int(w*100)}%)" if w < 1 else ""))
        r = getrow(comp, rk, nm, former if not ex else ex['former']); r[key][wl] = round(r[key].get(wl,0) + amt*w, 2)

qb = xlrd.open_workbook(QB_CON).sheets()[0]
for r in range(5, qb.nrows):
    d,n,cat,a = qb.cell(r,0).value, qb.cell(r,1).value, qb.cell(r,5).value, qb.cell(r,6).value
    if not d or not n: continue
    try: a = float(a)
    except: continue
    if 'reimbur' in str(cat).lower():        # reimbursements -> separate bucket (toggle in UI)
        add_contractor(mdate(str(d).strip()), str(n).strip(), a, 'reimb'); continue
    add_contractor(mdate(str(d).strip()), str(n).strip(), a)

for row in list(csv.reader(open(CHASE, encoding='utf-8-sig')))[1:]:
    if len(row) < 6: continue
    payto = re.sub(r'\s*\(\.\.\.\d+\)', '', row[0]).strip()
    try: a = float(row[5])
    except: continue
    ds = row[3]; add_contractor(datetime.date(int(ds[:4]), int(ds[4:6]), int(ds[6:8])), payto, a)

# --- Hardcoded (not in any file) — maintain these as rates/people change ---
# Maria Con: $550/wk through Mar 10, then $650/wk — every week 1/5 -> latest
cutoff = datetime.date(2026,3,9); r = getrow('SF', ('con','MAR'), 'Maria Con · 1099', False)
for w in weeks[1:]:
    r['camts'][PD[w]] = 550.0 if w <= cutoff else 650.0

# Mairena Tapias (Jon Marcus assistant), 100% CE, paid as expense — APPEND new payments weekly
r = getrow('CE', ('con','MAI'), 'Mairena Tapias · 1099', False)
for ds, amt in [('04/20/2026',193.04),('05/05/2026',900.0),('05/20/2026',882.0),('05/28/2026',695.0),('06/02/2026',140.0),('06/12/2026',950.0),('06/18/2026',475.0),('06/22/2026',475.0),('06/30/2026',475.0)]:
    wl = wk_of(mdate(ds)); r['camts'][wl] = round(r['camts'].get(wl,0) + amt, 2)

# Logic Consultants: $500/wk entire year
rL = getrow('J&A', ('con','LOGIC'), 'Logic Consultants · 1099', False)
for w in weeks[1:]: rL['camts'][PD[w]] = 500.0

# MANUAL contractor amounts by week (Ben gives these in chat each week, since
# the QB ContractorPayments/Chase exports lag the W-2 paycheck history).
# The dated QB+Chase files above are the FROZEN HISTORICAL base (~through 6/15);
# from 6/22 forward, contractors are hand-placed here. EACH WEEK: add a new
# week key with that week's amounts (Gabriel Colon split 50/50 CE/SF).
# Maria ($650/wk), Logic ($500/wk), Mairena, Jon Marcus car handled by rules above.
MANUAL_CONTRACTORS = {
    '6/22': [
        ('CE',  ('con','JON'),      2800.0,  'Jon Marcus · 1099'),
        ('CE',  ('con','GAB'),      1145.32, 'Gabriel Colon · 1099 (50%)'),
        ('SF',  ('con','GAB'),      1145.32, 'Gabriel Colon · 1099 (50%)'),
        ('J&A', ('con','MEL'),      2250.0,  'Mellody Abrego · 1099'),   # 2250 + 300 commission
        ('J&A', ('con','HIL'),      1730.0,  'Hilda Salman · 1099'),
        ('J&A', ('fissehaye','b'),  1850.0,  'Biniyam Fissehaye'),        # ENM
        ('J&A', ('delgado','e'),    900.0,   'Elizabeth Delgado'),
        ('J&A', ('simpson','c'),    834.97,  'Christopher Simpson'),
        ('J&A', ('adamson','d'),    1750.0,  'Debra Adamson'),
    ],
    '6/29': [  # pay week of the Jul 2 payroll (W-2 checks dated Jun 30 + Jul 2)
        ('CE',  ('con','JON'),      2800.0,  'Jon Marcus · 1099'),
        ('CE',  ('con','GAB'),      1000.0,  'Gabriel Colon · 1099 (50%)'),  # $2,000 split 50/50
        ('SF',  ('con','GAB'),      1000.0,  'Gabriel Colon · 1099 (50%)'),
        ('J&A', ('con','MEL'),      2250.0,  'Mellody Abrego · 1099'),   # 2250 + 300 commission
        ('J&A', ('con','HIL'),      1730.0,  'Hilda Salman · 1099'),
        ('J&A', ('fissehaye','b'),  1850.0,  'Biniyam Fissehaye'),        # ENM
        ('J&A', ('delgado','e'),    900.0,   'Elizabeth Delgado'),
        ('J&A', ('simpson','c'),    834.97,  'Christopher Simpson'),
        ('J&A', ('adamson','d'),    1750.0,  'Debra Adamson'),
    ],
    '7/6': [  # pay week ending Jul 12 (W-2 checks dated Jul 10)
        ('CE',  ('con','JON'),      2800.0,  'Jon Marcus - 1099'),
        ('CE',  ('con','GAB'),      1174.15, 'Gabriel Colon - 1099 (50%)'),  # $2,348.29 split 50/50
        ('SF',  ('con','GAB'),      1174.14, 'Gabriel Colon - 1099 (50%)'),
        ('J&A', ('con','MEL'),      2250.0,  'Mellody Abrego - 1099'),   # 2250 base (no commission stated for this wk)
        ('J&A', ('con','HIL'),      1730.0,  'Hilda Salman - 1099'),
        ('J&A', ('fissehaye','b'),  1850.0,  'Biniyam Fissehaye'),        # ENM
        ('J&A', ('delgado','e'),    900.0,   'Elizabeth Delgado'),
        ('J&A', ('simpson','c'),    834.97,  'Christopher Simpson'),
        ('J&A', ('adamson','d'),    1750.0,  'Debra Adamson'),
        ('J&A', ('con','ERI'),      1730.0,  'Erika Valencio - 1099'),   # NEW J&A contractor
    ],
}
# MANUAL_CONTRACTORS is hand-keyed by Monday week ("6/22", "6/29"); map each
# to its payday label so contractor payments land in the same column as that
# week's W-2 checks.
for wl, items in MANUAL_CONTRACTORS.items():
    wl_pd = PD_BY_MONLABEL.get(wl, wl)
    for comp, rk, amt, disp in items:
        ex = rows.get((comp, rk)); nm = ex['name'] if ex else disp
        rr = getrow(comp, rk, nm, ex['former'] if ex else False)
        rr['camts'][wl_pd] = round(rr['camts'].get(wl_pd, 0) + amt, 2)

# --- ALL-IN: fold contractor CAR allowances + company-paid HEALTH insurance
# into the grid so every column is fully loaded (per Ben — "all in for all
# places"). Reconciles to the Cost Breakdown footnotes: car $4,794.02 YTD,
# health $15,463.24 YTD. (Reimbursements stay excluded.)
def _addc(comp, rk, wl, amt, key='camts'):
    ex = rows.get((comp, rk)); nm = ex['name'] if ex else str(rk)
    rr = getrow(comp, rk, nm, ex['former'] if ex else False)
    rr[key][wl] = round(rr[key].get(wl, 0) + amt, 2)

# Health insurance — weekly, company-paid. 26 wks each (weeks[1:]) → matches
# each contractor's healthInsTotal in CONTRACTORS[].
for comp, rk, rate in [('J&A',('con','MEL'),368.34), ('J&A',('con','HIL'),118.82),
                       ('J&A',('simpson','c'),53.79), ('J&A',('adamson','d'),53.79)]:
    for w in weeks[1:]:
        _addc(comp, rk, PD[w], rate, 'health')

# Car allowances — monthly. Spec is (month int → first pay-week of that month)
# OR an explicit payday label for cars we know the exact pay week of (recent).
def _carlbl(spec):
    if isinstance(spec, str): return spec
    for w in weeks:
        if w.month == spec: return PD[w]
    return PD[weeks[-1]]
CAR = [
    ('CE',  ('con','JON'), [(1,350.0),(2,350.0),(3,350.0),(4,350.0),(5,350.0),('7/2',350.0)]),          # Jan-May monthly + June paid this wk (7/2) = $2,100
    ('J&A', ('con','MEL'), [(1,334.86),(2,334.86),(3,334.86),(4,334.86),(5,334.86),(6,684.86),('7/2',334.86)]),  # +June bump + July paid 7/2 = $2,694.02
]
for comp, rk, plan in CAR:
    for spec, amt in plan:
        _addc(comp, rk, _carlbl(spec), amt, 'car')

# Commission — spread each contractor's YTD commission (totals from CONTRACTORS[]
# in App.jsx) across the weeks they actually had cash, so it's a dropdown line for
# EVERY earner (Mellody, Delgado, Simpson), not just a hardcoded few. Reconciles
# to CONTRACTORS[].commission exactly. Runs after camts are fully populated.
COMMISSION_TOTAL = [
    ('J&A', ('con','MEL'),     5133.21),   # Mellody
    ('J&A', ('delgado','e'),   3597.62),   # Elizabeth Delgado
    ('J&A', ('simpson','c'),   2551.20),   # Christopher Simpson
]
for _comp, _rk, _tot in COMMISSION_TOTAL:
    _r = rows.get((_comp, _rk))
    if not _r:
        continue
    _act = [w for w in wlabel if _r['camts'].get(w)] or list(wlabel)
    _per = round(_tot / len(_act), 2)
    for w in _act:
        _r['commission'][w] = _per
    _d = round(_tot - _per * len(_act), 2)   # push rounding remainder into the last week
    if _d:
        _r['commission'][_act[-1]] = round(_r['commission'][_act[-1]] + _d, 2)

SECT = ['CE','SF','CE East','J&A']; out = []
for s in SECT:
    rs = [v for (c,k),v in rows.items() if c == s]
    if not rs: continue
    for r in rs: r['total'] = round(sum(r['amts'].values()) + sum(r['camts'].values()) + sum(r['car'].values()) + sum(r['health'].values()) + sum(r['commission'].values()), 2)
    rs = sorted(rs, key=lambda r: (r['former'], '1099' in r['name'], r['name']))
    tot = {}; ct = {}; lt = {}; rt = {}
    for wl in wlabel:
        a = round(sum(r['amts'].get(wl,0) for r in rs), 2); cc = round(sum(r['camts'].get(wl,0) for r in rs), 2)
        ll = round(sum(r['camts'].get(wl,0)+r['car'].get(wl,0)+r['health'].get(wl,0)+r['commission'].get(wl,0) for r in rs), 2)
        rr = round(sum(r['reimb'].get(wl,0) for r in rs), 2)
        if a: tot[wl] = a
        if cc: ct[wl] = cc
        if ll: lt[wl] = ll
        if rr: rt[wl] = rr
    out.append({'name':s, 'rows':rs, 'totals':tot, 'ctotals':ct, 'ltotals':lt, 'rtotals':rt})

period = f"Jan 2 – {weeks[-1].month}/{weeks[-1].day+6}/{weeks[-1].year}"
data = {'source':f'W-2 paychecks (loaded) + contractors NET cash (car/health/commission broken out in dropdown) · {len(wlabel)} weeks · columns = pay day', 'weeks':wlabel, 'sections':out}

# write straight into App.jsx
new = json.dumps(data)
app2, n = re.subn(r'(const OFFICE_PAYCHECKS = )\{.*?\};', lambda m: m.group(1) + new + ';', app, count=1, flags=re.S)
if n != 1: sys.exit('ERROR: could not find/replace OFFICE_PAYCHECKS in App.jsx')

# DRIVER_WEEKLY — replace if present, else insert right before OFFICE_PAYCHECKS
dw = 'const DRIVER_WEEKLY = ' + json.dumps(DRIVER_WEEKLY) + ';'
app2, dn = re.subn(r'const DRIVER_WEEKLY = \{.*?\};', dw, app2, count=1, flags=re.S)
if dn == 0:
    app2 = app2.replace('const OFFICE_PAYCHECKS = ', dw + '\n\nconst OFFICE_PAYCHECKS = ', 1)
io.open('src/App.jsx', 'w', encoding='utf-8').write(app2)

for s in out: print(' ', s['name'], 'total', round(sum(r['total'] for r in s['rows']), 2))
print('GRAND', round(sum(sum(r['total'] for r in s['rows']) for s in out), 2))
print('OFFICE_PAYCHECKS written to src/App.jsx — now: npm run build && commit/push')
