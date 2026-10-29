"""Read the store's product-image sheets into image_links.json.

Usage: python import_images.py PVC_Fitting_Images_.xlsx PVC_Pipe_All_Images.xlsx King_CPVC_fitting_Images.xlsx UPVC_Fitting_Images.xlsx

Each sheet has the columns brand | product_family | type | class | image_url (first sheet is read).
Rows are matched to products by brand + item + type + class when the catalogue is built (normalize.py).
Running this again replaces the links for every brand/item/type/class it contains and keeps the rest.
"""
import json, os, sys
import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'image_links.json')


def key_cells(h):
    return str(h or '').replace('﻿', '').strip().lower().replace(' ', '_')


def read(path):
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    hdr = [key_cells(h) for h in rows[0]]
    need = ['brand', 'product_family', 'type', 'class', 'image_url']
    missing = [n for n in need if n not in hdr]
    if missing:
        sys.exit(f'{os.path.basename(path)}: missing column(s) {", ".join(missing)}')
    idx = {n: hdr.index(n) for n in need}
    out, skipped = [], 0
    for r in rows[1:]:
        get = lambda n: (str(r[idx[n]]).strip() if idx[n] < len(r) and r[idx[n]] not in (None, '') else '')
        url = get('image_url')
        if not get('brand') or not get('product_family'):
            continue
        if not url.startswith(('http://', 'https://')):
            skipped += 1
            continue
        out.append({'brand': get('brand'), 'family': get('product_family'), 'type': get('type'), 'class': get('class'),
                    'url': url, 'sheet': os.path.basename(path)})
    return out, skipped


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    existing = json.load(open(OUT, encoding='utf-8')) if os.path.exists(OUT) else []
    ident = lambda x: (x['brand'].lower(), x['family'].upper(), x['type'].upper(), x['class'].replace(' ', '').upper())
    merged = {ident(x): x for x in existing}
    for p in sys.argv[1:]:
        rows, skipped = read(p)
        for x in rows:
            merged[ident(x)] = x
        print(f'{os.path.basename(p)}: {len(rows)} links' + (f', {skipped} rows without a link skipped' if skipped else ''))
    data = sorted(merged.values(), key=lambda x: (x['type'], x['brand'].lower(), x['family'], x['class']))
    json.dump(data, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'image_links.json: {len(data)} links')
