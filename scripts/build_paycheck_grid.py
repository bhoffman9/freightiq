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
OFFICE = ['arias','gonzalez','grosser','naruszewicz','rivera','youngblood','mahan','eagleton','figueroa']

def mon(dt): return dt - datetime.timedelta(days=dt.weekday())
def mdate(s): m,d,y = s.split('/'); return datetime.date(int(y),int(m),int(d))

def parse_pc(path):
    sh = xlrd.open_workbook(path).sheets()[0]; out = []
    for r in range(5, sh.nrows):
        d,n,tp = sh.cell(r,0).value, sh.cell(r,1).value, sh.cell(r,2).value
        if not d or not n: continue
        try: tp = float(tp)
        except: continue
        out.append((mdate(str(d).strip()), str(n).strip(), tp))
    return out

sf = parse_pc(SF_PC); ja = parse_pc(JA_PC)
alld = [mon(d) for d,_,_ in sf+ja]; w0,w1 = min(alld), max(alld); weeks = []; c = w0
while c <= w1: weeks.append(c); c += datetime.timedelta(days=7)
wlabel = [f"{w.month}/{w.day}" for w in weeks]

def wk_of(dt):
    m = mon(dt); m = max(weeks[0], min(weeks[-1], m)); return f"{m.month}/{m.day}"

rows = {}
def getrow(comp, k, name, former):
    r = rows.get((comp, k))
    if not r: r = rows[(comp, k)] = {'name':name,'former':former,'amts':{},'camts':{}}
    return r

def addw2(checks, office_only, src):
    for d,n,tp in checks:
        k = key(n)
        if office_only and k[0] not in OFFICE: continue
        fac, fn = FACT.get(k, (1.11, None)); disp = fn or n.lstrip('*'); former = n.lstrip().startswith('*'); wl = wk_of(d)
        for comp, wt in (W2DIV.get(k) or {src:1.0}).items():
            nm = disp + (f" ({int(wt*100)}%)" if wt < 1 else "")
            r = getrow(comp, k, nm, former); r['amts'][wl] = round(r['amts'].get(wl,0) + tp*fac*wt, 2)

addw2(sf, True, 'SF'); addw2(ja, False, 'J&A')

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
    return ('UNMAPPED', raw, {}, False)

def add_contractor(dt, raw, amt):
    c = canon(raw)
    if c is None: return
    if c[0] == 'UNMAPPED': print('  UNMAPPED PAYEE (skipped):', raw); return
    rk, disp, weights, former = c; wl = wk_of(dt)
    for comp, w in weights.items():
        ex = rows.get((comp, rk)); nm = ex['name'] if ex else (disp + (f" ({int(w*100)}%)" if w < 1 else ""))
        r = getrow(comp, rk, nm, former if not ex else ex['former']); r['camts'][wl] = round(r['camts'].get(wl,0) + amt*w, 2)

qb = xlrd.open_workbook(QB_CON).sheets()[0]
for r in range(5, qb.nrows):
    d,n,cat,a = qb.cell(r,0).value, qb.cell(r,1).value, qb.cell(r,5).value, qb.cell(r,6).value
    if not d or not n: continue
    if 'reimbur' in str(cat).lower(): continue   # exclude reimbursements
    try: a = float(a)
    except: continue
    add_contractor(mdate(str(d).strip()), str(n).strip(), a)

for row in list(csv.reader(open(CHASE, encoding='utf-8-sig')))[1:]:
    if len(row) < 6: continue
    payto = re.sub(r'\s*\(\.\.\.\d+\)', '', row[0]).strip()
    try: a = float(row[5])
    except: continue
    ds = row[3]; add_contractor(datetime.date(int(ds[:4]), int(ds[4:6]), int(ds[6:8])), payto, a)

# --- Hardcoded (not in any file) — maintain these as rates/people change ---
# Maria Con: $550/wk through Mar 10, then $650/wk (23 weeks from 1/5)
cutoff = datetime.date(2026,3,9); r = getrow('SF', ('con','MAR'), 'Maria Con · 1099', False); cnt = 0
for w in weeks[1:]:
    if cnt >= 23: break
    r['camts'][f"{w.month}/{w.day}"] = 550.0 if w <= cutoff else 650.0; cnt += 1

# Mairena Tapias (Jon Marcus assistant), 100% CE, paid as expense — APPEND new payments weekly
r = getrow('CE', ('con','MAI'), 'Mairena Tapias · 1099', False)
for ds, amt in [('04/20/2026',193.04),('05/05/2026',900.0),('05/20/2026',882.0),('05/28/2026',695.0),('06/02/2026',140.0),('06/12/2026',950.0),('06/22/2026',475.0)]:
    wl = wk_of(mdate(ds)); r['camts'][wl] = round(r['camts'].get(wl,0) + amt, 2)

# Logic Consultants: $500/wk entire year
rL = getrow('J&A', ('con','LOGIC'), 'Logic Consultants · 1099', False)
for w in weeks[1:]: rL['camts'][f"{w.month}/{w.day}"] = 500.0

SECT = ['CE','SF','CE East','J&A']; out = []
for s in SECT:
    rs = [v for (c,k),v in rows.items() if c == s]
    if not rs: continue
    for r in rs: r['total'] = round(sum(r['amts'].values()) + sum(r['camts'].values()), 2)
    rs = sorted(rs, key=lambda r: (r['former'], '1099' in r['name'], r['name']))
    tot = {}; ct = {}
    for wl in wlabel:
        a = round(sum(r['amts'].get(wl,0) for r in rs), 2); cc = round(sum(r['camts'].get(wl,0) for r in rs), 2)
        if a: tot[wl] = a
        if cc: ct[wl] = cc
    out.append({'name':s, 'rows':rs, 'totals':tot, 'ctotals':ct})

period = f"Jan 2 – {weeks[-1].month}/{weeks[-1].day+6}/{weeks[-1].year}"
data = {'source':f'W-2 paychecks (loaded) + contractor payments QB+Chase (dated, excl reimbursements) · {len(wlabel)} weeks', 'weeks':wlabel, 'sections':out}

# write straight into App.jsx
new = json.dumps(data)
app2, n = re.subn(r'(const OFFICE_PAYCHECKS = )\{.*?\};', lambda m: m.group(1) + new + ';', app, count=1, flags=re.S)
if n != 1: sys.exit('ERROR: could not find/replace OFFICE_PAYCHECKS in App.jsx')
io.open('src/App.jsx', 'w', encoding='utf-8').write(app2)

for s in out: print(' ', s['name'], 'total', round(sum(r['total'] for r in s['rows']), 2))
print('GRAND', round(sum(sum(r['total'] for r in s['rows']) for s in out), 2))
print('OFFICE_PAYCHECKS written to src/App.jsx — now: npm run build && commit/push')
