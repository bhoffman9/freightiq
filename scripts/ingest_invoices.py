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

def money(t, labels):
    for lab in labels:
        m = re.search(lab + r'\s*:?\s*\$?\s*(-?[\d,]+\.\d{2})', t, re.I)
        if m: return float(m.group(1).replace(',', ''))
    return None

def date_near(t, labels):
    for lab in labels:
        m = re.search(lab + r'\s*:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', t, re.I)
        if m:
            mo, d, y = re.split(r'[/-]', m.group(1))
            y = ('20' + y) if len(y) == 2 else y
            return f'{y}-{int(mo):02d}-{int(d):02d}'
    return None

# Unit id = letter-prefixed 4-7 digits (F10777, P5181425, U98136) OR bare 5-7
# digits. Bare 4-digit numbers are EXCLUDED — they're street numbers ("7582 S Las
# Vegas Blvd"), suite/zip fragments, years, etc., not fleet units.
UNIT_TOK = r'(?:[A-Z]{1,2}\d{4,7}|\d{5,7})'
DESC_KW = re.compile(r'\bft\.?\b|\bvan\b|swing|reefer|sleeper|tractor|road ?van|air ?ride|plate|dry ?van', re.I)
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
            # equipment-row context: VIN here or on the next line (McKinney puts VIN
            # under the unit), a 6+ digit serial, or an equipment description.
            if not is_vin(u) and (lv or nxtvin or re.search(r'\d{6,}', rest) or DESC_KW.search(rest)):
                units.add(u)
    for m in re.finditer(r'(?:unit|tractor|truck|vehicle|trailer|equip(?:ment)?)\s*#?\s*(' + UNIT_TOK + r')\b', text, re.I):
        if not is_vin(m.group(1)): units.add(m.group(1).upper())
    return sorted(units)

def parse(path):
    t = ''
    with pdfplumber.open(path) as p:
        for pg in p.pages: t += (pg.extract_text() or '') + '\n'
    vend, cat = vendor_of(t)
    inv = re.search(r'(?:Invoice\s*(?:No\.?|Number|#)|Inv\.?\s*#)\s*:?\s*([A-Z0-9][A-Z0-9-]{3,20})', t, re.I)
    amt = money(t, [r'Total\s*Due', r'Invoice\s*Amount', r'Amount\s*Due', r'Balance\s*Due', r'Total\s*Amount', r'\bTotal\b'])
    idate = date_near(t, [r'Invoice\s*Date', r'Inv\.?\s*Date', r'Date'])
    ddate = date_near(t, [r'Due\s*Date', r'Payment\s*Due', r'Invoice\s*Due\s*Date'])
    units = units_of(t)
    vins = sorted({v.upper() for v in VIN_RE.findall(t) if is_vin(v)})
    return {
        'file': os.path.basename(path), 'vendor': vend, 'category': cat,
        'invoice_number': inv.group(1) if inv else None,
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
