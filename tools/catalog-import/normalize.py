"""Merge the four pipe & fitting sheets into one clean catalogue.

Usage: python normalize.py SHEETS_FOLDER

Outputs (in ./out):
  catalog.json   - normalised rows (used by the mock API)
  retired.json   - codes listed at some point (history.json) but not in these sheets (imported switched off)
  issues.json    - rows needing a look
Then run build_xlsx.py for the admin import workbook.

The sheets are treated as the full listing: they replace the previous catalogue.
Images come from images.json (one per size family, editable); an image_url column in a sheet wins.
"""
import json, re, collections, os
from load import sheet, D
import openpyxl

import sys
# Current listing (26 Oct 2026, second set). The first sheet of each file is read.
FILES = [
    ('Uploded_King_CPVC_Fitting.xlsx', None),
    ('Uploded_UPVC_Fitting_All.xlsx', None),
    ('Uploded_PVC_Pipes_All.xlsx', None),     # despite the name: PVC, UPVC and CPVC pipes
    ('Uploded_PVC_Fitting_All_.xlsx', None),
]
HERE = os.path.dirname(os.path.abspath(__file__))
# Every code ever listed, so a code that drops out of the sheets is switched off in every later import file.
HISTORY = os.path.join(HERE, 'history.json')
issues = []          # (code, name, source, problem, what we did)
renames = collections.Counter()

def issue(r, problem, action):
    issues.append({'code': r.get('code'), 'name': r.get('name'), 'source': f"{r['_src'].split(':')[0]} row {r['_row']}", 'problem': problem, 'action': action})

# ---------------------------------------------------------------- vocabulary
FAMILY_FIX = {
    'M.T.A.': 'MTA', 'F.T.A.': 'FTA', 'R BUSH': 'REDUCER BUSH',
    'MUULTIFLOOR TRAP WITH JALI DM': 'MULTIFLOOR TRAP WITH JALI DM',
    'TRANSACTION BUSH': 'TRANSITION BUSH',
    'BRASS MTA (Hexagone)': 'BRASS MTA (HEX)', 'BRASS FTA (Hexagone)': 'BRASS FTA (HEX)',
    'P.T.F.E. SEAL TAP (Teflon)': 'PTFE SEAL TAPE (TEFLON)',
    '3 IN 1 MIXER ADAPTOR 6"': '3-IN-1 MIXER ADAPTOR 6"',
}
UPPER = {'MTA', 'FTA', 'PTFE', 'LW', 'DM', 'CPVC', 'UPVC', 'PVC', 'SDR', 'HEX', 'P', 'Y'}
def title(s):
    out = []
    for w in re.split(r'(\s+|\(|\)|-)', s):
        if not w or w.isspace() or w in '()-': out.append(w); continue
        out.append(w if w.upper() in UPPER else (w[:1].upper() + w[1:].lower()))
    return ''.join(out).replace('3-In-1', '3-in-1').replace('With', 'with').replace('Without', 'without')

ALIASES = {
    'COUPLER': 'socket, coupling', 'ELBOW': 'bend, elbow 90', 'ELBOW 90°': 'bend, elbow', 'ELBOW 45°': 'bend 45',
    'TEE': 'tee, T', 'MTA': 'male threaded adaptor, male adapter', 'FTA': 'female threaded adaptor, female adapter',
    'END CAP': 'cap, dhakkan', 'REDUCER': 'reducing socket', 'REDUCER BUSH': 'bushing, reducing bush',
    'UNION': 'union joint', 'SOLVENT': 'solvent cement, solution, glue', 'BALL VALVE': 'valve, tap',
    'BRASS MTA': 'brass male adaptor', 'BRASS FTA': 'brass female adaptor', 'PIPE': '',
}
TYPE_ALIAS = {'CPVC': 'garam pani pipe, hot water', 'UPVC': 'thanda pani pipe, cold water', 'PVC': 'nali pipe, drainage'}

# Nominal mm → inch maps, used only to flag size labels whose mm and inch parts disagree.
CTS = {15: '½', 20: '¾', 25: '1', 32: '1¼', 40: '1½', 50: '2', 65: '2½', 80: '3', 100: '4', 125: '5', 150: '6', 200: '8', 250: '10', 300: '12'}
OD = {20: '½', 25: '¾', 32: '1', 40: '1¼', 50: '1½', 63: '2', 75: '2½', 90: '3', 110: '4', 125: '4½', 140: '5', 160: '6', 180: '7', 200: '8', 225: '9', 250: '10', 280: '11', 315: '12'}

def clean_size(raw, typ, fam, r):
    """Returns (label, mm_list, inch_list)."""
    if raw is None or raw == '':
        return '', [], []
    if isinstance(raw, (int, float)):
        n = int(raw)
        if fam == 'SOLVENT': return f'{n} ml', [], []
        return f'{n} mm', [n], []
    s = str(raw).strip()
    if fam == 'SOLVENT':
        m = re.search(r'\((\d+)\s*ml\s*(\w+)?\)', s, re.I)
        if m: return f"{m.group(1)} ml {(m.group(2) or '').lower()}".strip(), [], []
    if 'TAPE' in fam:
        m = re.search(r'\((\d+)\s*mm\s*-\s*(\d+)\s*mtr\s*\((\w+)\)\)', s, re.I)
        if m: return f'{m.group(1)} mm × {m.group(2)} m, {m.group(3).title()}', [], []
    suffix = ''
    m = re.match(r'^(\d+)\s*mm\s*Offset\s*(.*)$', s, re.I)
    if m: s, suffix = m.group(2), f', {m.group(1)} mm offset'
    m = re.search(r'\)\s*(Long|Short)\s*$', s, re.I)
    if m: suffix = f', {m.group(1).lower()}'; s = s[:m.start() + 1]
    s = s.replace('((', '(').replace('x (', 'x ')
    m = re.match(r'^\s*([\d.]+(?:\s*[xX×]\s*[\d.]+)*)\s*(?:mm|MM)?\s*(?:\((.*)\))?\s*$', s)
    if not m:
        issue(r, f'Size "{raw}" not in a recognised format', 'kept as written')
        return s, [], []
    mm = [int(float(x)) for x in re.split(r'\s*[xX×]\s*', m.group(1))]
    inch = []
    if m.group(2):
        inch = [p.strip().strip('"').strip() for p in re.split(r'\s*[xX×]\s*', m.group(2))]
    label = '×'.join(str(x) for x in mm) + ' mm'
    if inch: label += ' (' + ' × '.join(i + '"' for i in inch) + ')'
    # sanity: mm vs inch
    table = OD if typ == 'PVC' else CTS
    for a, b in zip(mm, inch):
        if a in table and table[a] != b:
            issue(r, f'Size "{raw}": {a} mm is normally {table[a]}" for {typ}, sheet says {b}"', 'kept as written — please confirm')
            break
    if len(inch) and len(mm) != len(inch) and len(mm) <= 2:
        issue(r, f'Size "{raw}": {len(mm)} mm values but {len(inch)} inch values', 'kept as written — please confirm')
    if len(mm) == 2 and mm[0] == mm[1] and fam in ('TRANSITION BUSH', 'REDUCER', 'REDUCER BUSH'):
        issue(r, f'Size "{raw}": both ends are {mm[0]} mm on a reducing fitting', 'kept as written — please confirm')
    return label + suffix, mm, inch

def money(v):
    return round(float(v), 2) if isinstance(v, (int, float)) else None

# ---------------------------------------------------------------- image lookups
def family_images():
    """Fallback: one image per size family carried over from the first set of sheets."""
    p = os.path.join(HERE, 'images.json')
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}


def _cls_key(c):
    return re.sub(r'\s+', '', str(c or '')).upper()


def image_links():
    """The store's image sheets (import_images.py), keyed by brand + item + type + class.
    Item names go through the same renames as the catalogue, so "M.T.A." and "MTA" match."""
    p = os.path.join(HERE, 'image_links.json')
    table, used = {}, {}
    if os.path.exists(p):
        for x in json.load(open(p, encoding='utf-8')):
            fam = FAMILY_FIX.get(x['family'], x['family']).upper()
            k = (x['brand'].strip().lower(), fam, x['type'].strip().upper(), _cls_key(x['class']))
            table[k] = x['url']; used[k] = x
    return table, used

# ---------------------------------------------------------------- main
def run():
    fam_img = family_images()
    links, link_rows = image_links()
    hit = set()
    rows, seen = [], {}
    for f, s in FILES:
        for r in sheet(f, s):
            code = str(r['code']).strip().upper() if r.get('code') not in (None, '') else None
            if not code:
                issue(r, 'No product code', 'skipped'); continue
            r['code'] = code
            if code in seen:
                issue(r, f'Code also used in {seen[code]}', 'skipped the second one'); continue
            seen[code] = r['_src']

            typ = str(r.get('type') or '').strip().upper()
            sub = 'Pipes' if str(r.get('subcat') or '').strip().upper().startswith('PIPE') else 'Fittings'
            brand = str(r.get('brand') or '').strip().title()
            fam_raw = str(r.get('family') or ('PIPE' if sub == 'Pipes' else '')).strip()
            fam = FAMILY_FIX.get(fam_raw, fam_raw).upper()
            if fam_raw.upper() != fam and FAMILY_FIX.get(fam_raw): renames[(fam_raw, title(fam))] += 1
            cls = str(r.get('cls') or '').strip()
            cls_label = re.sub(r'(?i)^(\d+)\s*kg$', r'\1 kg/cm²', cls).replace('SDR11', 'SDR 11')
            size, mm, inch = clean_size(r.get('size'), typ, fam, r)
            length = str(r.get('length') or '').strip()
            length = re.sub(r'(?i)^(\d+)\s*mtr$', r'\1 m', length)

            gst = r.get('gst')
            gst = round(gst * 100) if isinstance(gst, (int, float)) and gst < 1 else (round(gst) if isinstance(gst, (int, float)) else 18)
            hsn = r.get('hsn')
            hsn = str(int(hsn)) if isinstance(hsn, (int, float)) else (str(hsn).strip() if hsn else None)
            mrp = money(r.get('mrp'))
            disc = r.get('disc')
            disc = float(disc) if isinstance(disc, (int, float)) else None
            if disc is not None and disc > 1: disc = disc / 100
            pack = int(r['pack']) if isinstance(r.get('pack'), (int, float)) and r['pack'] > 0 else None
            rol = float(r['rol']) if isinstance(r.get('rol'), (int, float)) else 0

            if mrp is None or mrp <= 0:
                issue(r, f'MRP missing ({r.get("mrp")!r})', 'imported as hidden — add MRP and switch Active on');
            if disc is None:
                issue(r, 'Purchase discount blank', 'cost left empty')
            if brand == 'King' and fam == 'COUPLER' and size.startswith('15 mm') and typ == 'CPVC' and r.get('sell'):
                issue(r, f'Only row with a selling price ({r.get("sell")}) and discount {r.get("disc")}; MRP − 0.05 rather than −5%', 'ignored selling price, used MRP')

            image = (r.get('image') or '').strip() or None

            status = str(r.get('status') or '').strip().lower()
            listed = status in ('', 'active')
            if not status:
                issue(r, 'Status blank (every other row says Active)', 'kept on sale — please confirm')
            elif not listed:
                issue(r, f'Status "{r.get("status")}"', 'imported switched off')

            fam_title = title(fam)
            family_name = f'{brand} {typ} {fam_title}' + (f' {cls_label}' if cls_label else '')
            if sub == 'Pipes': family_name = f'{brand} {typ} Pipe {cls_label}'.strip()
            name = f'{family_name} – {size}' + (f', {length}' if length else '')
            desc_bits = [f'{brand} {typ} {fam_title.lower() if sub == "Fittings" else "pipe"}']
            if cls_label: desc_bits.append(f'class {cls_label}')
            if size: desc_bits.append(f'size {size}')
            if length: desc_bits.append(f'{length} length')
            desc = ', '.join(desc_bits) + '.'
            if pack: desc += f' Standard box: {pack} pcs.'

            aliases = [a.strip() for a in (ALIASES.get(fam, '') + ', ' + TYPE_ALIAS.get(typ, '')).split(',') if a.strip()]
            specs = {'Material': typ}
            if cls_label: specs['Class' if typ == 'PVC' else ('SDR' if 'SDR' in cls_label else 'Schedule')] = cls_label
            if size: specs['Size'] = size
            if length: specs['Length'] = length
            if pack: specs['Box quantity'] = str(pack)

            if not image:
                k = (brand.lower(), fam, typ, _cls_key(cls))
                if k in links:
                    image = links[k]; hit.add(k)
                else:
                    # Some image rows leave class blank (items that have no class); accept that as "any class".
                    k2 = (brand.lower(), fam, typ, '')
                    if k2 in links:
                        image = links[k2]; hit.add(k2)
            image = image or fam_img.get(family_name)
            rows.append({
                'code': code, 'name': name, 'description': desc,
                'category': 'Pipes & Fittings', 'subCategory': f'{typ} {sub}', 'brand': brand,
                'unit': 'pcs', 'hsn': hsn, 'gst': gst, 'mrp': mrp or 0,
                'listPrice': mrp or 0, 'partnerDiscount': 0, 'retailDiscount': 0,
                'purchaseDiscount': round(disc * 100, 2) if disc is not None else None,
                'cost': round(mrp * (1 - disc), 2) if (mrp and disc is not None) else None,
                'reorderLevel': rol, 'image': image, 'active': bool(mrp) and listed,
                'variantFamily': family_name, 'variantLabel': size + (f', {length}' if length and sub == 'Fittings' else ''),
                'specs': specs, 'aliases': aliases, 'packSize': pack, 'mrpPkg': money(r.get('mrppkg')),
                '_src': r['_src'], '_row': r['_row'], '_mm': mm,
            })

    # sequence within family = sheet order; flag MRP going down as size goes up (single-size families only)
    fams = collections.defaultdict(list)
    for r in rows: fams[r['variantFamily']].append(r)
    seq = 0
    for fam, items in fams.items():
        for i, r in enumerate(items):
            seq += 1; r['sequence'] = seq
        single = [r for r in items if len(r['_mm']) == 1 and r['mrp']]
        for a, b in zip(single, single[1:]):
            if b['_mm'][0] > a['_mm'][0] and b['mrp'] < a['mrp']:
                issue({'code': b['code'], 'name': b['name'], '_src': b['_src'], '_row': b['_row']},
                      f'MRP ₹{b["mrp"]:g} is lower than the smaller size {a["variantLabel"]} (₹{a["mrp"]:g})', 'kept — please confirm')
    names = collections.Counter(r['name'] for r in rows)
    for r in rows:
        if names[r['name']] > 1:
            issue({'code': r['code'], 'name': r['name'], '_src': r['_src'], '_row': r['_row']}, 'Same name as another code', 'kept both — please confirm they differ')
    # class mismatch heads-up: union listed as Sch 80 for some brands, Sch 40 for others
    by = collections.defaultdict(set)
    for r in rows:
        if r['subCategory'] == 'UPVC Fittings': by[r['variantFamily'].split(' ', 2)[2].rsplit(' Sch', 1)[0]].add((r['brand'], r['specs'].get('Schedule')))
    global unused_links
    unused_links = [link_rows[k] for k in link_rows if k not in hit]
    return rows

if __name__ == '__main__':
    os.makedirs('out', exist_ok=True)
    rows = run()
    unions = sorted({(r['brand'], r['specs'].get('Schedule')) for r in rows if r['variantFamily'].endswith(('Union Sch 40', 'Union Sch 80')) and r['subCategory'] == 'UPVC Fittings'})
    json.dump([{k: v for k, v in r.items() if not k.startswith('_')} for r in rows], open('out/catalog.json', 'w'), ensure_ascii=False, indent=1)
    # Codes that were listed before but aren't in these sheets: imported switched off so the store matches the sheets
    # (products are never deleted — past orders and invoices still point at them).
    history = {p['code']: p for p in json.load(open(HISTORY, encoding='utf-8'))} if os.path.exists(HISTORY) else {}
    now = {r['code'] for r in rows}
    retired = [dict(p, active=False) for c, p in history.items() if c not in now]
    json.dump(retired, open('out/retired.json', 'w'), ensure_ascii=False, indent=1)
    for r in rows:
        history[r['code']] = {k: v for k, v in r.items() if not k.startswith('_')}
    json.dump(sorted(history.values(), key=lambda p: p['code']), open(HISTORY, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('retired (no longer in the sheets)', len(retired), collections.Counter(p['variantFamily'] for p in retired).most_common())
    print('products', len(rows), 'active', sum(r['active'] for r in rows), 'families', len({r['variantFamily'] for r in rows}),
          'with image', sum(1 for r in rows if r['image']))
    print(collections.Counter(r['subCategory'] for r in rows))
    print(collections.Counter(r['brand'] for r in rows))
    print('issues', len(issues), collections.Counter(i['problem'].split(':')[0].split('(')[0].strip()[:40] for i in issues).most_common())
    print('renames', dict(renames)); print('UPVC union classes', unions)
    json.dump(issues, open('out/issues.json', 'w'), ensure_ascii=False, indent=1)
    no_img = sorted({r['variantFamily'] for r in rows if not r['image']})
    json.dump({'familiesWithoutImage': no_img, 'unusedImageLinks': unused_links}, open('out/images_report.json', 'w'), ensure_ascii=False, indent=1)
    print('families without an image', len(no_img), '| image links that matched no product', len(unused_links))
    for r in rows[:3] + rows[300:302] + rows[700:702] + rows[1200:1202]: print(r['name'], '|', r['variantLabel'], '|', r['image'] is not None)
