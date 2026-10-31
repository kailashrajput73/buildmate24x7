"""Read-only image audit of the supplied import workbooks. Never updates the catalogue."""
import concurrent.futures
import csv
import json
from pathlib import Path
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def rows(path):
    with zipfile.ZipFile(path) as archive:
        shared = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            shared = [''.join(n.itertext()) for n in ET.fromstring(archive.read('xl/sharedStrings.xml'))]
        sheet = ET.fromstring(archive.read('xl/worksheets/sheet1.xml'))
        for row in sheet.findall('.//s:row', NS):
            cells = {}
            for cell in row.findall('s:c', NS):
                column = ''.join(c for c in cell.attrib['r'] if c.isalpha())
                val = cell.find('s:v', NS)
                text = val.text if val is not None else ''.join(cell.findtext('s:is/s:t', '', NS))
                if cell.attrib.get('t') == 's': text = shared[int(text)]
                cells[column] = text or ''
            yield cells

def check(url):
    try:
        request = urllib.request.Request(url, headers={'User-Agent': 'BuildMate-local-image-audit/1.0'})
        with urllib.request.urlopen(request, timeout=20) as response:
            kind = response.headers.get('Content-Type', '')
            response.read(32)
            return {'url': url, 'status': response.status, 'contentType': kind, 'ok': response.status == 200 and kind.startswith('image/')}
    except Exception as error:
        return {'url': url, 'status': getattr(error, 'code', 0), 'contentType': '', 'ok': False, 'error': type(error).__name__}

def main():
    urls, counts = set(), {}
    for path in (ROOT / 'data').glob('*Import.xlsx'):
        data = iter(rows(path)); header = next(data)
        image_col = next((k for k, v in header.items() if v.strip().lower() == 'image url'), None)
        total = missing = 0
        for row in data:
            if not any(row.values()): continue
            total += 1
            image = row.get(image_col, '').strip()
            if image.startswith(('https://', 'http://')): urls.add(image)
            else: missing += 1
        counts[path.name] = {'products': total, 'missingImage': missing}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(check, sorted(urls)))
    output = ROOT / '.local-run' / 'mobile-image-audit.json'
    output.write_text(json.dumps({'workbooks': counts, 'results': results}, indent=2), encoding='utf-8')
    print(json.dumps({'workbooks': counts, 'uniqueUrls': len(results), 'healthy': sum(r['ok'] for r in results), 'failed': sum(not r['ok'] for r in results), 'report': str(output)}))

if __name__ == '__main__': main()
