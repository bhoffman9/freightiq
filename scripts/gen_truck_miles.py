#!/usr/bin/env python3
# Regenerate TRUCK_MILES from the Samsara parser, re-applying active:false to the
# prior inactive trucks UNION the 7 ATL trucks (carved out of fleet CPM).
import re, subprocess, os
ROOT = os.path.join(os.path.dirname(__file__), "..")
APP = os.path.join(ROOT, "src", "App.jsx")
app = open(APP, encoding="utf-8").read()

# prior inactive trucks (departed fleet — recovered from git HEAD, per-line).
inactive = {"114", "149", "351", "462", "463", "476", "488", "503", "539", "589",
            "675", "676", "728", "730", "731", "738", "937", "968", "971"}
ATL = {"685", "674", "669", "686", "673", "675", "488"}
carve = inactive | ATL

out = subprocess.run(["python", os.path.join(os.path.dirname(__file__), "parse_samsara_mileage.py")],
                     capture_output=True, text=True).stdout
block = re.search(r"let TRUCK_MILES = \[(.*?)\n\];", out, re.S).group(1)

lines = []
for ln in block.strip().split("\n"):
    tm = re.search(r'truck:"(\d+)"', ln)
    if tm and tm.group(1) in carve and "active:" not in ln:
        ln = re.sub(r"\},?\s*$", ", active:false },", ln.rstrip())
    lines.append(ln)
newblock = "let TRUCK_MILES = [\n" + "\n".join(lines) + "\n];"

app2 = re.sub(r"let TRUCK_MILES = \[.*?\n\];", lambda m: newblock, app, count=1, flags=re.S)
open(APP, "w", encoding="utf-8").write(app2)
print("prior inactive:", sorted(inactive))
print("flagged active:false (inactive + 7 ATL):", len(carve))
print("ATL trucks flagged:", sorted(ATL & set(re.findall(r'truck:"(\d+)"', block))))
