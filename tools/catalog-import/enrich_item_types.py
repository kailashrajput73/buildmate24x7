"""Prepare a NEW local workbook with explicit Item Type specs; never imports or edits the source.

This one-time conversion uses the existing structured family, brand, material and class fields.
The API deliberately does not do this inference when serving product pages.
"""
from pathlib import Path
import re
import zipfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
TAG = '{' + NS['s'] + '}'

def enrich(source, output):
    assert source.resolve() != output.resolve(), 'Source must remain unchanged'
    count, unresolved = 0, []
    with zipfile.ZipFile(source) as archive:
        shared = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            shared = [''.join(n.itertext()) for n in ET.fromstring(archive.read('xl/sharedStrings.xml'))]
        def text(cell):
            v = cell.find('s:v', NS)
            value = v.text if v is not None else cell.findtext('s:is/s:t', '', NS)
            return shared[int(value)] if cell.get('t') == 's' else value or ''
        sheet = ET.fromstring(archive.read('xl/worksheets/sheet1.xml'))
        rows = sheet.findall('.//s:row', NS)
        header = {text(c): re.sub(r'\d', '', c.get('r')) for c in rows[0]}
        for row in rows[1:]:
            cells = {re.sub(r'\d', '', c.get('r')): c for c in row.findall('s:c', NS)}
            def field(name):
                c = cells.get(header.get(name))
                return text(c) if c is not None else ''
            specs = dict(part.strip().split(':', 1) for part in field('Specs').split(';') if ':' in part)
            specs = {k.strip(): v.strip() for k, v in specs.items()}
            if 'Item Type' in specs: continue
            family = field('Variant Family')
            material = specs.get('Material', '')
            brand = field('Brand')
            prefix = f'{brand} {material} '
            if not brand or not material or not family.startswith(prefix):
                unresolved.append(row.get('r')); continue
            item = family[len(prefix):].strip()
            cls = next((specs[k] for k in ('Class', 'SDR', 'Schedule') if specs.get(k)), '')
            if cls and item.endswith(' ' + cls): item = item[:-len(cls)].strip()
            if not item:
                unresolved.append(row.get('r')); continue
            specs['Item Type'] = item
            cell = cells[header['Specs']]
            for child in list(cell): cell.remove(child)
            cell.set('t', 'inlineStr')
            ET.SubElement(ET.SubElement(cell, TAG + 'is'), TAG + 't').text = '; '.join(f'{k}: {v}' for k, v in specs.items())
            count += 1
        with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as result:
            for entry in archive.infolist():
                result.writestr(entry, ET.tostring(sheet, encoding='utf-8', xml_declaration=True) if entry.filename == 'xl/worksheets/sheet1.xml' else archive.read(entry.filename))
    return count, unresolved

if __name__ == '__main__':
    output = ROOT / '.local-run' / 'BuildMate_Pipes_Fittings_With_Item_Types.xlsx'
    count, unresolved = enrich(ROOT / 'data' / 'BuildMate_Pipes_Fittings_Import.xlsx', output)
    print(f'Prepared {count} item types; {len(unresolved)} rows need review. Output: {output}')
    if unresolved: print('Unresolved worksheet rows:', unresolved)
