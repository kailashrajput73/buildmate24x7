# Global product family grouping (19 Nov 2026)

One product card per family for all brands, in every module, using the same
system Pipes & Fitting already used. Brand is an option on the product page.
No UI, cart, checkout or payment code changed.

## How a family is identified (CatalogService)
Module (category) → product family → brand → variants.

1. Catalogue family row (`catalog_families`): its stable `key` (family name in capitals).
2. Together with category + Type: "PIPE" of UPVC and of CPVC, or "Switches" of the
   Switches and Sockets types, stay different families.
3. Older products without a family row: their Variant Family name, trimmed, in capitals.

The brand is not part of the identity. Products with no family stay one card each:
nothing is grouped by similar names.

## Rule
`ProductType.GroupAcrossBrands` (Dashboard › Catalog Types & families › Product cards):
- Automatic (empty) = one card for all brands. This is now the same for every module;
  before, it applied only to Pipe & Fitting and Electrical › Cable.
- "One card per brand" = per-brand families, exactly as before.

## Schema changes
None. No product rows, ids or families are changed or deleted. Existing
`product_types.group_across_brands` and `catalog_families.key` are used.

## API changes (additive)
- `GET /api/catalog/products?collapse=true`: families of every module collapse
  across brands. All-brand cards also return `brands` (list of brand names).
- `GET /api/catalog/products/{id}`: the product page of any family offers every
  brand. Module / Color / Series / Current rating become option rows only when they
  differ within the family. Each option opens that variant (price, SKU, stock, images).

## Data to check by hand
Families whose name includes the brand ("Anchor Switches" vs "WIT Switches") or
that differ in spelling are different keys. To merge them, give those products the
same family name in the import (`product_family` column) or in the Product Family
field on the product's edit page. Renaming a family under Types & families keeps its
old key, so that alone does not merge it.
Families with no Type group by category + name only; they can't have a shared card
photo, because card photos are set per Type.
