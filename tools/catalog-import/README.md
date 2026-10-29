# Catalogue import: pipes & fittings, electrical

Turns the four brand sheets into one file the admin panel can import
(Admin → Products → Import), and lists rows that need a human look.

```bash
pip install openpyxl
# put the four current sheets in a folder, keeping their file names:
#   Uploded_King_CPVC_Fitting.xlsx, Uploded_UPVC_Fitting_All.xlsx,
#   Uploded_PVC_Pipes_All.xlsx, Uploded_PVC_Fitting_All_.xlsx
# when the image sheets change (brand | product_family | type | class | image_url):
python import_images.py PVC_Fitting_Images_.xlsx PVC_Pipe_All_Images.xlsx King_CPVC_fitting_Images.xlsx UPVC_Fitting_Images.xlsx
python normalize.py path/to/sheets     # builds out/catalog.json, records codes in history.json
python build_xlsx.py                   # writes out/BuildMate_Pipes_Fittings_Import.xlsx
cp out/catalog.json ../mock-api/data/pipes-fittings.json   # optional: refresh the mock API
```

**The sheets are the full listing.** `history.json` remembers every code ever listed; any of those missing from
the current sheets is put in the import switched off (Active = No), so after importing, the website and app show
exactly what's in the sheets — whichever earlier file was imported before. Products are never deleted, because past orders and invoices still refer to them. Removed codes are
listed on the workbook's "Removed" sheet.

**Images** come from the store's image sheets, stored in `image_links.json` by `import_images.py` and matched
to products by brand + item + type + class (class is case-insensitive; a blank class matches items that have
none; item spellings like "M.T.A." are matched to the catalogue names). Order of precedence: an `image_url`
column in a listing sheet → `image_links.json` → `images.json` (older per-family links). Ranges still without
an image, and image rows that matched nothing, are listed on the workbook's "Needs checking" sheet.

The output workbook has up to four sheets. Only the first is imported.

| Sheet | What it is |
|---|---|
| Products | One row per product code, in the admin import format |
| Needs checking | Missing MRP, size labels whose mm and inch don't match, prices going down as size goes up, blank purchase discounts |
| Removed | Codes no longer in the sheets; imported switched off |
| Renamed | Spelling and format changes made to names and sizes |

## Rules applied

- **Which sheet:** the first sheet of each file. A header that appears twice (the King file has two "Status" columns) uses the column that has values.
- **Status:** Active (or blank) is on sale; anything else is imported switched off. Blank statuses are flagged.
- **Category:** everything goes under "Pipes & Fittings", with sub categories CPVC / UPVC / PVC × Pipes / Fittings.
- **Names:** Brand + Material + Item + Class – Size (+ length for pipes), e.g. `King CPVC Coupler SDR 11 – 15 mm (½")`.
- **Size families:** all sizes of the same brand + material + item + class share a *Variant Family*. The website and app show them as one item with a size picker.
- **Prices:** customers pay **MRP** for now (List Price = MRP, no retail or partner discount). The sheet's "discount" column is the purchase discount from the brand. It is stored as the starting cost (MRP × (1 − discount)), never shown to customers.
- **No MRP:** rows without an MRP are imported hidden (Active = No).
- **Images:** see above. Still missing: Astral PVC DM drainage fittings and solvent, Vanstone flanges, and Supreme PVC / UPVC Sch 80 / CPVC SDR 13 pipes.
- **GST and HSN:** GST 0.18 or 18 both become 18%. HSN is kept as written (fittings 39174000, pipes 391723).

To change customer prices later, either edit List Price / Partner Discount % / Retail Discount % in the workbook and re-import (existing codes are updated, not duplicated), or change them product by product in the admin.

## Electrical (cables)

```bash
# folder holding Uploded_Electical_Cable_.xlsx
python normalize_cables.py path/to/sheets   # out/electrical_catalog.json, history_electrical.json
python build_xlsx.py electrical             # out/BuildMate_Electrical_Import.xlsx
cp out/electrical_catalog.json ../mock-api/data/electrical.json   # optional: refresh the mock API
```

Each cable line is one product card with a picker per option; every code is still its own product (own stock,
price, QR). Options that vary inside a line become pickers; options fixed by another (Safetech length follows the
size) are shown as specs.

| Line | Pickers |
|---|---|
| Greencore house wire | Size · Colour · Length |
| NextGen, SafePlus house wire; Safetech; single core flexible; speaker | Size · Colour |
| Multicore flexible industrial | Cores · Size |
| Flat submersible | Size |
| LAN | Category · Colour |
| CCTV | Type · Length |
| Coaxial | Type · Conductor · Length |
| Switchboard telephone | Pairs · Conductor · Length |

The Variant Label holds the options as `Size: 1.5 sq.mm; Colour: Red; Length: 90 m` (one option = a plain label,
as for pipes). Sizes are sorted numerically and colours in wiring order (red, yellow, blue, black, white).
Checks: MRP rising with size, longer coils priced in proportion (180 m ≈ 2 × 90 m), unit mix-ups, near-duplicate
colours. Images: add rows to an image sheet (brand | product_family | type | class | image_url, with type `Cable`
and class = colour, or blank for every colour) and run `import_images.py`.
