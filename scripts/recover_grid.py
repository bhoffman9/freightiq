import subprocess, json, sys, collections
def sh(*a): return subprocess.run(a, capture_output=True, text=True, encoding='utf-8', errors='replace').stdout
def extract(src):
    i = src.find('const OFFICE_PAYCHECKS = ')
    if i < 0: return None
    i += len('const OFFICE_PAYCHECKS = '); depth=0; j=i
    while j < len(src):
        if src[j]=='{': depth+=1
        elif src[j]=='}':
            depth-=1
            if depth==0: break
        j+=1
    try: return json.loads(src[i:j+1])
    except: return None

commits = sh('git','log','--reverse','--format=%H','--','src/App.jsx').split()
latest = extract(sh('git','show', f'{commits[-1]}:src/App.jsx'))
CANON = set(latest['weeks'])   # the 29 canonical pay-week labels — no phantom weeks
PERWEEK = ['amts','net','gross','camts','car','health','commission','reimb']

merged = {}   # (section, person) -> perweek dicts (restricted to CANON), latest wins
for h in commits:
    op = extract(sh('git','show', f'{h}:src/App.jsx'))
    if not op: continue
    for sec in op.get('sections', []):
        for row in sec.get('rows', []):
            key = (sec['name'], row['name'])
            m = merged.setdefault(key, {k:{} for k in PERWEEK} | {'former': False})
            m['former'] = row.get('former', m['former'])
            for pk in PERWEEK:
                for w, v in (row.get(pk) or {}).items():
                    if w in CANON: m[pk][w] = v

weeks = latest['weeks']
out_sections = []
filled = 0; before = 0
for sec in latest['sections']:
    rows = []
    for row in sec['rows']:
        m = merged[(sec['name'], row['name'])]
        r = {'name': row['name'], 'former': m['former']}
        for pk in PERWEEK: r[pk] = {w: m[pk][w] for w in weeks if w in m[pk]}
        # count how many amts cells we recovered vs the latest-only version
        before += len(row.get('amts') or {}) + len(row.get('camts') or {})
        filled += len(r['amts']) + len(r['camts'])
        r['total'] = round(sum(r['amts'].values()) + sum(r['camts'].values()), 2)
        rows.append(r)
    out_sections.append({'name': sec['name'], 'rows': rows})

out = {'source': latest.get('source',''), 'weeks': weeks, 'sections': out_sections}
open('scripts/_grid_merged.json','w').write(json.dumps(out))
print(f"recovered cells: {before} -> {filled} (+{filled-before})", file=sys.stderr)
pw = collections.OrderedDict((w,0.0) for w in weeks); npeep = collections.OrderedDict((w,0) for w in weeks)
for sec in out_sections:
    for r in sec['rows']:
        for w,v in {**r['amts'], **r['camts']}.items(): pw[w]+=v; npeep[w]+=1
print("WEEK   TOTAL         #ppl", file=sys.stderr)
for w in weeks: print(f"  {w:6} ${pw[w]:>11,.0f}   {npeep[w]}", file=sys.stderr)
