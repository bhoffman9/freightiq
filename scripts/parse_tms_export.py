# Parse the TMS load export (Downloads/export (1).csv) into weekly + monthly
# SF-fleet revenue/load history for the FreightIQ Revenue tab. Excludes
# Cancelled loads + legacy $0 rows. Emits a JS TMS_HISTORY block.
import csv, collections, datetime, os, sys

SRC = sys.argv[1] if len(sys.argv) > 1 else r"C:/Users/hoffm/Downloads/export (1).csv"
rows = list(csv.DictReader(open(SRC, encoding="utf-8-sig")))

def pd(s):
    try: return datetime.datetime.strptime(s, "%m-%d-%Y").date()
    except: return None
def rev(r):
    try: return float(r["Customer Revenue"] or 0)
    except: return 0
def office(r):
    o = (r["Office"] or "").strip()
    if o == "Atlanta": return "atl"
    if "East" in o: return "cee"
    if "Capacity" in o or "CE" in o: return "ce"
    return "other"

wk = collections.defaultdict(lambda: {"loads":0,"rev":0.0,"miles":0.0,"ce":0.0,"atl":0.0,"cee":0.0,"other":0.0})
mo = collections.defaultdict(lambda: {"loads":0,"rev":0.0,"miles":0.0,"ce":0.0,"atl":0.0,"cee":0.0,"other":0.0})
for r in rows:
    if (r["Load Status"] or "").strip() == "Cancelled": continue
    d = pd(r["Scheduled Delivery"])
    if not d or d.year < 2026: continue
    rv = rev(r)
    try: mi = float(r["Loaded Miles"] or 0)
    except: mi = 0
    o = office(r)
    ws = d - datetime.timedelta(days=(d.weekday()+1) % 7)  # Sunday
    for bucket, key in ((wk, ws.isoformat()), (mo, f"{d.year}-{d.month:02d}")):
        b = bucket[key]; b["loads"] += 1; b["rev"] += rv; b["miles"] += mi; b[o] += rv

def emit(bucket, kind):
    out = []
    for k in sorted(bucket):
        b = bucket[k]
        if b["rev"] == 0 and b["loads"] < 3: continue  # skip legacy noise
        if kind == "week":
            ws = datetime.date.fromisoformat(k); lbl = f"{ws.month}/{ws.day}"
        else:
            y, m = k.split("-"); lbl = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][int(m)-1] + " " + y
        out.append("{key:%r,label:%r,loads:%d,rev:%d,miles:%d,ce:%d,atl:%d,cee:%d}" % (
            k, lbl, b["loads"], round(b["rev"]), round(b["miles"]), round(b["ce"]), round(b["atl"]), round(b["cee"])))
    return out

weeks = emit(wk, "week"); months = emit(mo, "month")
print("// TMS load history from export (1).csv — SF fleet, excl. cancelled, 2026+")
print("const TMS_HISTORY = {")
print("  weeks: [\n    " + ",\n    ".join(weeks) + "\n  ],")
print("  months: [\n    " + ",\n    ".join(months) + "\n  ],")
print("};")
print(f"// {len(weeks)} weeks, {len(months)} months", file=sys.stderr)
