"""Electrical: turn the cable sheet into the admin import format.

Usage: python normalize_cables.py SHEETS_FOLDER        (folder holding Uploded_Electical_Cable_.xlsx)
Then:  python build_xlsx.py electrical                 -> out/BuildMate_Electrical_Import.xlsx

Outputs (in ./out): electrical_catalog.json, electrical_issues.json, electrical_retired.json,
electrical_images_report.json, electrical_renamed.json.

How cables are grouped
----------------------
Each cable line is ONE product card with a picker per option, e.g. Greencore house wire = Size x Colour x Length.
Every code keeps its own row (stock, price and code stay per coil); rows of a line share a Variant Family, and
their Variant Label lists the options, e.g. "Size: 1.5 sq.mm; Colour: Red; Length: 90 m". An option that never
varies inside a line (e.g. Safetech length, which follows the size) is shown as a spec instead of a picker.
"""
import collections, json, os, re, sys

from load import sheet, D

HERE = os.path.dirname(os.path.abspath(__file__))
FILE = 'Uploded_Electical_Cable_.xlsx'
HISTORY = os.path.join(HERE, 'history_electrical.json')
CATEGORY = 'Electrical'
issues = []


def issue(r, problem, action):
    issues.append({'code': r.get('code'), 'name': r.get('name'), 'source': f"{FILE} row {r.get('_row', '?')}", 'problem': problem, 'action': action})


# Sub-category in the sheet -> sub category in the store, in display order.
SUBCATS = [
    ('House Wire', 'House Wires'),
    ('Multiple Application', 'Multiple Application Cables'),
    ('Multicore Flexible Industrial Wires', 'Multicore Flexible Industrial Cables'),
    ('Submersible Cable', 'Submersible Cables'),
    ('Computer', 'LAN & Computer Cables'),
    ('CCTV', 'CCTV Cables'),
    ('Television and Satellite', 'TV & Satellite Cables'),
    ('Speaker', 'Speaker Cables'),
    ('Telephone Cables', 'Telephone Cables'),
]
SUB_ORDER = {store: i for i, (_, store) in enumerate(SUBCATS)}
COLOUR_ORDER = ['Red', 'Yellow', 'Blue', 'Black', 'White', 'Green', 'Grey', 'Natural Blue']
ALIASES = {
    'House Wires': 'taar, bijli ka taar, house wire, wire',
    'Multiple Application Cables': 'flexible wire, flexible cable, taar',
    'Multicore Flexible Industrial Cables': 'multicore, industrial cable, 3 core, 4 core',
    'Submersible Cables': 'submersible, motor cable, borewell cable',
    'LAN & Computer Cables': 'ethernet, network cable, cat6, lan',
    'CCTV Cables': 'camera cable, cctv wire',
    'TV & Satellite Cables': 'tv cable, dish cable, coaxial, rg6',
    'Speaker Cables': 'speaker wire, audio cable',
    'Telephone Cables': 'phone wire, telephone wire, switchboard cable',
}


def store_subcat(raw):
    raw = (raw or '').strip()
    for sheet_name, store in SUBCATS:
        if raw.lower().startswith(sheet_name.lower()):
            return store
    return raw.title()


def num(s):
    m = re.search(r'\d+(\.\d+)?', str(s))
    return float(m.group()) if m else 0.0


def length_label(raw):
    m = re.match(r'(?i)^\s*(\d+)\s*m', str(raw or ''))
    return f'{int(m.group(1))} m' if m else str(raw or '').strip()


def sq_mm(raw, r):
    s = str(raw).strip()
    if re.match(r'^\d+(\.\d+)?$', s):
        return s
    m = re.match(r'(?i)^(\d+(?:\.\d+)?)\s*(sq\.?\s*mm|mm)$', s)
    if not m:
        issue(r, f'Size "{raw}" not recognised', 'kept as written')
        return s
    if m.group(2).lower() == 'mm':
        issue(r, f'Size "{raw}" says mm; the rest of the line says sq.mm', 'shown as sq.mm — please confirm')
    return f'{m.group(1)} sq.mm'


def classify(r):
    """Returns (subcategory, family, options [(name, value)], extra specs, sheath/core notes)."""
    sub = store_subcat(r['subcat'])
    parts = [p.strip() for p in str(r['name']).split(',') if p.strip()]
    brand = parts[0] if parts else r['brand']
    insulation = parts[1] if len(parts) > 2 else ''
    colour = (r.get('cls') or (parts[-1] if parts else '')).strip()
    line = ', '.join(parts[2:-1]) if len(parts) > 3 else (parts[2] if len(parts) > 2 else '')
    size_raw = r.get('size')
    length = length_label(r.get('length'))
    code = r['code']
    specs = {}
    if insulation:
        specs['Insulation'] = insulation

    if sub == 'House Wires':
        fam = f'{brand} {line.title() if line.isupper() else line} House Wire'
        opts = [('Size', sq_mm(size_raw, r)), ('Colour', colour), ('Length', length)]
        specs['Core'] = 'Single core'
    elif sub == 'Multiple Application Cables':
        if 'single core' in line.lower():
            fam = f'{brand} Single Core Flexible Cable'
            specs['Core'] = 'Single core'
        else:
            fam = f'{brand} {line} Cable'
        opts = [('Size', sq_mm(size_raw, r)), ('Colour', colour), ('Length', length)]
    elif sub == 'Multicore Flexible Industrial Cables':
        cores = re.search(r'(\d+)\s*Core', line, re.I)
        sheath = re.search(r'(\w+)\s+Sheath', line, re.I)
        fam = f'{brand} Multicore Flexible Industrial Cable' + (f' ({sheath.group(1).title()} Sheath)' if sheath else '')
        opts = [('Cores', f'{cores.group(1)} core' if cores else '?'), ('Size', sq_mm(size_raw, r)), ('Length', length)]
        if sheath: specs['Sheath'] = sheath.group(1).title()
    elif sub == 'Submersible Cables':
        cores = re.search(r'FS(\d)C', code)
        fam = f'{brand} Flat Submersible Cable' + (f' {cores.group(1)} Core' if cores else '')
        opts = [('Size', sq_mm(size_raw, r)), ('Length', length)]
        if cores: specs['Cores'] = f'{cores.group(1)} core'
        specs['Colour'] = colour
    elif sub == 'LAN & Computer Cables':
        cat = 'CAT ' + (str(size_raw).replace('.0', '') if size_raw is not None else '?')
        fam = f'{brand} LAN Cable'
        opts = [('Category', cat.upper().replace('CAT ', 'CAT ')), ('Colour', colour), ('Length', length)]
    elif sub == 'CCTV Cables':
        kind = re.sub(r'(?i)^cctv\s*', '', str(size_raw or line))
        fam = f'{brand} CCTV Cable'
        opts = [('Type', kind), ('Colour', colour), ('Length', length)]
    elif sub == 'TV & Satellite Cables':
        m = re.match(r'(?i)^(RG\s?\d+)\s*(CCS|CU)$', str(size_raw or '').strip())
        rg = m.group(1).upper().replace(' ', '') if m else str(size_raw)
        cond = {'CCS': 'Copper-clad steel', 'CU': 'Copper'}.get(m.group(2).upper(), m.group(2)) if m else ''
        fam = f'{brand} Coaxial Cable'
        opts = [('Type', rg), ('Conductor', cond), ('Colour', colour), ('Length', length)]
        if 'COXIAL' in str(r['name']).upper():
            pass  # spelling fixed via the store name; listed on the Renamed sheet
    elif sub == 'Speaker Cables':
        cores = re.search(r'SK(\d)C', code)
        fam = f'{brand} Speaker Cable'
        opts = [('Size', sq_mm(size_raw, r)), ('Colour', colour), ('Length', length)]
        if cores: specs['Cores'] = f'{cores.group(1)} core'
    elif sub == 'Telephone Cables':
        pairs = re.search(r'(\d+)\s*Pair', line, re.I)
        dia = re.search(r'(\d+(?:\.\d+)?)\s*mm', str(r['subcat']))
        if 'sq' in str(size_raw).lower():
            issue(r, f'Size "{size_raw}" — telephone conductors are sized by diameter (the sub-category says {dia.group(1) if dia else "?"} mm ATC)', 'shown as mm diameter — please confirm')
        fam = f'{brand} Switchboard Telephone Cable'
        opts = [('Pairs', f'{pairs.group(1)} pair' if pairs else '?'), ('Conductor', f'{dia.group(1)} mm' if dia else str(size_raw)), ('Colour', colour), ('Length', length)]
        specs['Armour'] = 'Unarmoured'
    else:
        fam = f'{brand} {line}'.strip()
        opts = [('Size', str(size_raw)), ('Colour', colour), ('Length', length)]
    return sub, fam, opts, specs


def sort_key(name, value):
    if name == 'Colour':
        return (COLOUR_ORDER.index(value) if value in COLOUR_ORDER else 99, value)
    return (num(value), value)


def run():
    rows_in = sheet(FILE)
    out, seen = [], set()
    for r in rows_in:
        code = str(r.get('code') or '').strip().upper()
        if not code:
            issue(r, 'No product code', 'skipped'); continue
        if code in seen:
            issue(r, 'Code appears twice', 'skipped the second one'); continue
        seen.add(code); r['code'] = code
        brand = str(r.get('brand') or '').strip().title()
        r['brand'] = brand
        sub, fam, opts, specs = classify(r)
        mrp = round(float(r['mrp']), 2) if isinstance(r.get('mrp'), (int, float)) else None
        gst = r.get('gst'); gst = round(gst * 100) if isinstance(gst, (int, float)) and gst < 1 else (round(gst) if isinstance(gst, (int, float)) else 18)
        hsn = r.get('hsn'); hsn = str(int(hsn)) if isinstance(hsn, (int, float)) else (str(hsn).strip() if hsn else None)
        disc = r.get('disc'); disc = float(disc) if isinstance(disc, (int, float)) else None
        pack = int(r['pack']) if isinstance(r.get('pack'), (int, float)) and r['pack'] > 0 else None
        status = str(r.get('status') or '').strip().lower()
        listed = status in ('', 'active')
        if status and not listed:
            issue(r, f'Status "{r.get("status")}"', 'imported switched off')
        if not mrp:
            issue(r, 'MRP missing', 'imported hidden — add MRP and switch Active on')
        if pack: specs['Coils per carton'] = str(pack)
        out.append({'_r': r, 'code': code, 'brand': brand, 'subCategory': sub, 'variantFamily': fam, 'opts': opts, 'specs': specs,
                    'mrp': mrp or 0, 'gst': gst, 'hsn': hsn, 'disc': disc, 'listed': listed and bool(mrp),
                    'rawFamily': str(r.get('family') or '').strip(), 'cls': str(r.get('cls') or '').strip()})

    # Per family: which options actually vary (those become pickers), stable order, names, labels
    fams = collections.OrderedDict()
    for x in sorted(out, key=lambda x: SUB_ORDER.get(x['subCategory'], 99)):
        fams.setdefault(x['variantFamily'], []).append(x)
    rows, seq = [], 0
    for fam, items in fams.items():
        names = [n for n, _ in items[0]['opts']]
        varying = [n for n in names if len({dict(i['opts'])[n] for i in items}) > 1]
        # Length is a picker only where the same size/colour comes in more than one length (e.g. Greencore 90 m / 180 m)
        if 'Length' in varying:
            others = [n for n in varying if n != 'Length']
            combos = collections.Counter(tuple(dict(i['opts'])[n] for n in others) for i in items)
            if all(c == 1 for c in combos.values()):
                varying.remove('Length')
        items.sort(key=lambda i: tuple(sort_key(n, dict(i['opts'])[n]) for n in names))
        labels = collections.Counter()
        for i in items:
            seq += 1
            o = dict(i['opts'])
            shown = [o[n] for n in names if o[n]]
            name = f"{fam} – {', '.join(shown)}"
            if len(varying) >= 2:
                label = '; '.join(f'{n}: {o[n]}' for n in varying)
            elif len(varying) == 1:
                label = o[varying[0]]
            else:
                label = ', '.join(shown)
            labels[label] += 1
            specs = dict(i['specs'])
            for n in names:
                if o[n] and n not in specs: specs[n] = o[n]
            r = i['_r']
            desc = f"{fam}, {', '.join(shown)}."
            if 'Coils per carton' in specs: desc += f" {specs['Coils per carton']} coils per carton."
            rows.append({
                'code': i['code'], 'name': name, 'description': desc, 'category': CATEGORY, 'subCategory': i['subCategory'], 'brand': i['brand'],
                'unit': 'coil', 'hsn': i['hsn'], 'gst': i['gst'], 'mrp': i['mrp'], 'listPrice': i['mrp'], 'partnerDiscount': 0, 'retailDiscount': 0,
                'purchaseDiscount': round(i['disc'] * 100, 2) if i['disc'] is not None else None,
                'cost': round(i['mrp'] * (1 - i['disc']), 2) if (i['mrp'] and i['disc'] is not None) else None,
                'reorderLevel': float(r['rol']) if isinstance(r.get('rol'), (int, float)) else 0, 'image': None, 'active': i['listed'],
                'variantFamily': fam, 'variantLabel': label, 'specs': specs,
                'aliases': [a.strip() for a in ALIASES.get(i['subCategory'], '').split(',') if a.strip()],
                'packSize': None, 'mrpPkg': None, 'sequence': 5000 + seq,
                '_row': r['_row'], '_rawFamily': i['rawFamily'], '_cls': i['cls'], '_opts': i['opts'], '_varying': varying,
            })
        for label, n in labels.items():
            if n > 1:
                issue({'code': '—', 'name': f'{fam} – {label}', '_row': '—'}, f'{n} codes have identical options', 'kept all — please confirm they differ')

    # Near-duplicate colour names inside one line become two separate chips
    for fam in {x['variantFamily'] for x in rows}:
        cols = sorted({dict(x['_opts']).get('Colour') for x in rows if x['variantFamily'] == fam} - {None})
        for a in cols:
            for b in cols:
                if a != b and b.lower().endswith(' ' + a.lower()):
                    issue({'code': '—', 'name': fam, '_row': '—'}, f'Colours "{a}" and "{b}" in one line — same colour?', 'shown as two colour choices — please confirm')

    # Price sanity: within a line, same colour + length, MRP should rise with size; 180 m ≈ 2 × 90 m
    by = collections.defaultdict(list)
    for x in rows:
        o = dict(x['_opts']); by[(x['variantFamily'], o.get('Colour'), o.get('Length'), o.get('Cores'), o.get('Type'))].append(x)
    for k, items in by.items():
        sized = sorted([i for i in items if 'Size' in dict(i['_opts'])], key=lambda i: num(dict(i['_opts'])['Size']))
        for a, b in zip(sized, sized[1:]):
            if b['mrp'] and a['mrp'] and b['mrp'] < a['mrp']:
                issue({'code': b['code'], 'name': b['name'], '_row': b['_row']}, f"MRP ₹{b['mrp']:g} is lower than the smaller size {dict(a['_opts'])['Size']} (₹{a['mrp']:g})", 'kept — please confirm')
    pairs = collections.defaultdict(dict)
    for x in rows:
        o = dict(x['_opts'])
        if 'Length' in o: pairs[(x['variantFamily'], o.get('Size'), o.get('Colour'), o.get('Type'), o.get('Conductor'), o.get('Category'))][num(o['Length'])] = x
    for k, by_len in pairs.items():
        lens = sorted(by_len)
        for a, b in zip(lens, lens[1:]):
            ra, rb = by_len[a], by_len[b]
            expect = ra['mrp'] * b / a
            if ra['mrp'] and rb['mrp'] and abs(rb['mrp'] - expect) / expect > 0.08:
                issue({'code': rb['code'], 'name': rb['name'], '_row': rb['_row']},
                      f"{int(b)} m costs ₹{rb['mrp']:g}; {int(a)} m is ₹{ra['mrp']:g}, so about ₹{expect:,.0f} expected", 'kept — please confirm')
    return rows


def main():
    os.makedirs('out', exist_ok=True)
    rows = run()

    # Images: image_links.json (import_images.py) by brand + item + type + colour; any-colour row as fallback
    links = {}
    p = os.path.join(HERE, 'image_links.json')
    if os.path.exists(p):
        for x in json.load(open(p, encoding='utf-8')):
            links[(x['brand'].strip().lower(), x['family'].strip().upper(), x['type'].strip().upper(), re.sub(r'\s+', '', x['class']).upper())] = x['url']
    hit = set()
    for r in rows:
        for k in [(r['brand'].lower(), r['_rawFamily'].upper(), 'CABLE', re.sub(r'\s+', '', r['_cls']).upper()),
                  (r['brand'].lower(), r['_rawFamily'].upper(), 'CABLE', '')]:
            if k in links:
                r['image'] = links[k]; hit.add(k); break

    # Status: a blank Status column across the whole sheet is one note, not 247
    if all(not str(x.get('status') or '').strip() for x in sheet(FILE)):
        issues.insert(0, {'code': '—', 'name': 'All rows', 'source': FILE, 'problem': 'Status column is blank for every row', 'action': 'all treated as on sale'})
    if all(r['purchaseDiscount'] is None for r in rows):
        issues.insert(0, {'code': '—', 'name': 'All rows', 'source': FILE, 'problem': 'No purchase discount in the sheet (all rows)', 'action': 'cost left empty — fill in when known'})

    history = {p['code']: p for p in json.load(open(HISTORY, encoding='utf-8'))} if os.path.exists(HISTORY) else {}
    now = {r['code'] for r in rows}
    retired = [dict(p, active=False) for c, p in history.items() if c not in now]
    clean = [{k: v for k, v in r.items() if not k.startswith('_')} for r in rows]
    for r in clean: history[r['code']] = r
    json.dump(sorted(history.values(), key=lambda p: p['code']), open(HISTORY, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    json.dump(clean, open('out/electrical_catalog.json', 'w'), ensure_ascii=False, indent=1)
    json.dump(issues, open('out/electrical_issues.json', 'w'), ensure_ascii=False, indent=1)
    json.dump(retired, open('out/electrical_retired.json', 'w'), ensure_ascii=False, indent=1)
    no_img = sorted({r['variantFamily'] for r in rows if not r['image']})
    json.dump({'familiesWithoutImage': no_img, 'unusedImageLinks': []}, open('out/electrical_images_report.json', 'w'), ensure_ascii=False, indent=1)
    json.dump([
        ['Sub-Category "House Wire", "Speaker", "CCTV", "Computer"…', 'House Wires, Speaker Cables, CCTV Cables, LAN & Computer Cables…', 'Plural, clear names in the menu'],
        ['"Telephone Cables - Unarmoured 0.4 mm ATC" and "… 0.5 mm ATC"', 'One sub category: Telephone Cables (0.4 / 0.5 mm becomes a Conductor option)', 'One menu entry instead of two'],
        ['"Multiple Application"', 'Multiple Application Cables', 'Clearer menu name'],
        ['COXIAL CABLE', 'Coaxial Cable', 'Typo'],
        ['RG6CCS / RG6CU', 'Type RG6 + Conductor Copper-clad steel / Copper', 'Readable options'],
        ['Product names "Ultravolt,HR FR LF,Greencore,Black"', 'Ultravolt Greencore House Wire – 1.5 sq.mm, Black, 90 m', 'Readable names; insulation shown as a spec'],
        ['One row per colour / size / length', 'One product card per cable line with Size, Colour, Length pickers', 'Customers pick options instead of scrolling 50 rows'],
        ['UoM "Nos"', 'Sold per coil', 'Clearer for buyers'],
    ], open('out/electrical_renamed.json', 'w'), ensure_ascii=False, indent=1)

    fams = collections.OrderedDict()
    for r in rows: fams.setdefault(r['variantFamily'], []).append(r)
    print('products', len(rows), 'families', len(fams), 'retired', len(retired), 'issues', len(issues))
    for f, items in fams.items():
        print(f'  {f:62} {len(items):3}  pickers: {" × ".join(items[0]["_varying"]) or "—"}   e.g. {items[0]["variantLabel"]}')


if __name__ == '__main__':
    main()
