# Module / Color / Series / Current Rating on the shop (19 Nov 2026)

The four product fields added on 17 Nov now show on the website the same way as
Size, Class and Length. Empty, blank or whitespace-only values never show.

## One central list
`ProductAttributes.All` (api/src/BuildMate.Services/Catalog/CatalogStructure.cs)
holds each attribute's label, filter key and display value. It drives:
- specification rows,
- option rows on the product page (FamilyAxes),
- the filter lists (`GET /api/catalog/facets` → `attributes`).

The website builds its filter buttons from the API's list, so it has no
per-attribute code. To add an attribute later: add the column and one line there.

## Product page
- Variants of the family have different values (e.g. two colors): an option row,
  like Size. Each choice opens that variant (price, SKU, stock, images). Out-of-stock
  choices keep the usual "Out of stock" style.
- Only one value in the family: a plain specification row (label: value). It is not
  repeated as a specification when it is already an option row.
- No value: nothing shown.
- Labels: Module, Color, Series, Current Rating. Current Rating is stored as
  volt / watt / amp (17 Nov decision) and shown as Volt / Watt / Amp; no number or unit is added.

## Listing
Cards don't show size/length today, so they don't show these either. The category
page has Module / Color / Series / Current Rating filters. Each appears only when
some product there has a value. They clear together with Size/Class/Length
(when the type, sub-category or brand changes).

## Cart, checkout, orders, invoices, quotations
Unchanged (your choice): size/length aren't shown or saved there today either.

## Import
Unchanged since 17 Nov. Columns `Module`, `Color`, `Series`, `Current Rating` are read
and saved; `module`, `current_rating` headers also match (case, spaces and `_` are
ignored). Files without the columns keep the product's existing values.

## API (additive)
- `GET /api/catalog/facets`: new `attributes: [{ key, name, values: [{ value, count }] }]`.
- `GET /api/catalog/products?module=&color=&series=&currentRating=`: already
  existed (17 Nov). Case-insensitive.
- Product page: the specification label is now "Current Rating" (was "Current rating").
