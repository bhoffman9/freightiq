# Deterministic invoice reader for the "Ben downloads, Claude ingests" workflow.
# Reads equipment-invoice PDFs, extracts vendor/invoice#/dates/amount/units/VINs,
# and prints structured JSON for review. No AI. Insert happens in a separate step
# after Ben eyeballs the parse. Usage: python scripts/ingest_invoices.py <dir-or-file...>
import pdfplumber, re, sys, glob, os, json

VENDORS = [
    ('McKinney', r'mckinney', 'trailer'),
    ('XTRA', r'xtra', 'trailer'),
    ('Premier', r'premier', 'trailer'),
    ('Utility', r'utility trailer|mountain west', 'trailer'),
    ('Ten Trailers', r'ten trailer|star leasing|transportation equipment network', 'trailer'),
    ('TEC', r'\btec\b|tec equipment', 'truck'),
    ('Penske', r'penske', 'truck'),
    ('Ryder', r'ryder', 'truck'),
    ('Idealease', r'idealease', 'truck'),
    ('TCI', r'transportation commodities|\btci\b', 'truck'),
]
VIN_RE = re.compile(r'\b([A-HJ-NPR-Z0-9]{17})\b')
def is_vin(t): return bool(re.match(r'^[A-HJ-NPR-Z0-9]{17}$', t)) and re.search(r'[A-Z]', t) and re.search(r'\d', t)

def vendor_of(t):
    low = t.lower()
    for name, pat, cat in VENDORS:
        if re.search(pat, low): return name, cat
    return None, None

MONTHS = {m: i + 1 for i, m in enumerate(['january','february','march','april','may','june','july','august','september','october','november','december'])}
def money(t, labels):
    for lab in labels:
        # label ... $ amount  (allow words/dates between label and the $, e.g. Penske "Total due by 7/25/2026 $ 4,835.92")
        m = re.search(lab + r'[^\n$]{0,30}?\$\s*(-?[\d,]+\.\d{2})', t, re.I) or re.search(lab + r'\s*:?\s*(-?[\d,]+\.\d{2})', t, re.I)
        if m: return float(m.group(1).replace(',', ''))
    return None

def date_near(t, labels):
    for lab in labels:
        seg = re.search(lab + r'\s*:?\s*([^\n]{0,24})', t, re.I)
        hay = seg.group(1) if seg else ''
        m = re.search(r'(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})', hay)
        if m:
            mo, d, y = m.groups(); y = ('20' + y) if len(y) == 2 else y
            return f'{int(y):04d}-{int(mo):02d}-{int(d):02d}'
        mn = re.search(r'([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})', hay)  # "July 15, 2026"
        if mn and mn.group(1).lower() in MONTHS:
            return f'{int(mn.group(3)):04d}-{MONTHS[mn.group(1).lower()]:02d}-{int(mn.group(2)):02d}'
    return None

# Unit id = letter-prefixed 4-7 digits (F10777, P5181425, U98136) OR bare 5-7
# digits. Bare 4-digit numbers are EXCLUDED — they're street numbers ("7582 S Las
# Vegas Blvd"), suite/zip fragments, years, etc., not fleet units.
UNIT_TOK = r'(?:[A-Z]{1,2}\d{4,7}|\d{5,7})'
# Equipment-row keywords: trailer/tractor descriptions AND unit-type words that
# sit next to a unit id (Penske lease detail: "481292 Power ... / TADC TRACTOR SLEEPER").
DESC_KW = re.compile(r'\bft\.?\b|\bvan\b|swing|reefer|sleeper|tractor|road ?van|air ?ride|plate|dry ?van|\bpower\b|\bpowr\b|tandem|day ?cab|straight|flatbed|\bbox\b|cargo', re.I)
def units_of(text):
    units = set()
    lines = text.split('\n')
    for i, line in enumerate(lines):
        lv = [v.upper() for v in VIN_RE.findall(line) if is_vin(v)]
        nxt = lines[i + 1] if i + 1 < len(lines) else ''
        nxtvin = any(is_vin(v) for v in VIN_RE.findall(nxt))
        lead = re.match(r'\s*(' + UNIT_TOK + r')\b', line)
        if lead:
            u = lead.group(1).upper()
            rest = line[lead.end():]
            # equipment-row context: VIN here or on the next line (McKinney), a 6+ digit
            # serial, or an equipment/unit-type description on THIS or the NEXT line
            # (Penske "481292 Power" + next-line "TRACTOR SLEEPER").
            if not is_vin(u) and (lv or nxtvin or re.search(r'\d{6,}', rest) or DESC_KW.search(rest) or DESC_KW.search(nxt)):
                units.add(u)
    for m in re.finditer(r'(?:unit|tractor|truck|vehicle|trailer|equip(?:ment)?)\s*#?\s*:?\s*(' + UNIT_TOK + r')\b', text, re.I):
        if not is_vin(m.group(1)): units.add(m.group(1).upper())
    return sorted(units)

def parse(path):
    t = ''
    with pdfplumber.open(path) as p:
        for pg in p.pages: t += (pg.extract_text() or '') + '\n'
    vend, cat = vendor_of(t)
    inv = re.search(r'(?:Invoice\s*(?:No\.?|Number|#)|Inv\.?\s*#)\s*:?\s*([A-Z0-9][A-Z0-9-]{3,20})', t, re.I) \
        or re.search(r'\bInvoice\b\s*:?\s*([A-Z0-9-]{5,20})', t)  # Penske "Invoice 0033599019"
    inv_no = inv.group(1) if inv else re.sub(r'\.[Pp][Dd][Ff]$', '', os.path.basename(path))  # fallback: filename
    amt = money(t, [r'Total\s*Due', r'Invoice\s*Amount', r'Amount\s*Due', r'Balance\s*Due', r'Total\s*due\s*by', r'Total\s*Amount', r'\bTotal\b'])
    idate = date_near(t, [r'Invoice\s*Date', r'Inv\.?\s*Date', r'Date'])
    ddate = date_near(t, [r'Due\s*Date', r'Total\s*due\s*by', r'Payment\s*Due', r'Invoice\s*Due\s*Date'])
    units = units_of(t)
    vins = sorted({v.upper() for v in VIN_RE.findall(t) if is_vin(v)})
    return {
        'file': os.path.basename(path), 'vendor': vend, 'category': cat,
        'invoice_number': inv_no,
        'invoice_date': idate, 'due_date': ddate, 'amount': amt,
        'units': units, 'unit_count': len(units), 'vins': vins, 'chars': len(t),
    }

def main():
    args = sys.argv[1:] or ['incoming-freightiq']
    files = []
    for a in args:
        files += glob.glob(os.path.join(a, '*.pdf')) if os.path.isdir(a) else [a]
    out = [parse(f) for f in files]
    print(json.dumps(out, indent=1))

if __name__ == '__main__':
    main()
