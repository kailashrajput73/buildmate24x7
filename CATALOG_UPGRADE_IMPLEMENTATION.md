# BuildMate catalog upgrade — local implementation

## Follow-up: category navigation and recovery (2026-10-30)

- Mobile reloads products and resets pagination/filters when an existing category screen receives a different category ID.
- Mobile now has an All subcategories option that preserves the selected Type while clearing dependent filters.
- Website catalog errors include Retry, retaining the current filters and page.
- Widget regression coverage checks category changes and clearing a subcategory without losing its Type.
- Flutter widget/model suite: 11 passed, including both category navigation regressions.
- Flutter analysis passed with no errors or warnings; 19 informational style/deprecation notices remain.
- Admin and storefront TypeScript checks passed. Backend tests: 95 passed, 13 skipped; database-dependent coverage was not rerun with a configured test database in this follow-up.

## Architecture and compatibility

The existing .NET 8/EF Core/PostgreSQL services, ClosedXML importer, React dashboard, Next storefront and Flutter application were extended. Existing catalog, stock ledger, dispatch, quotation and Cashfree services remain in place.

- `ProductType` belongs to a category. Its allowed subcategories reference the existing subcategory table. Staff with catalog-management permission maintain this list; Excel never creates unknown Types or Sub-Categories.
- `CatalogFamily` has a stable numeric ID and a unique category/brand/key relationship. Explicit legacy `VariantFamily` assignments migrate within their original category and brand. Display names are never parsed to infer family identity. Products without explicit assignments remain individual products.
- Products retain their existing IDs, codes, prices, stock, aliases, translations, visibility flags and specification fields. Optional structured Type, Class, Size, Length, family and package fields are additive.
- Size and Length retain their entered display strings. Recognized linear quantities normalize to millimetres, area quantities to square millimetres, with separate dimensions. Unknown or compound product-specific labels remain displayable. Area quantities cannot be assigned as a recognized length.
- Product image → family image → existing placeholder is applied without copying family images over product-specific images.

## Database migration

Forward script: `api/db/2026-10-30_catalog_packages.sql`.

Guarded physical rollback: `api/db/2026-10-30_catalog_packages_rollback.sql`.

This repository uses `EnsureCreated` for fresh databases and versioned SQL patches for existing databases; the upgrade follows that architecture rather than introducing an incompatible initial EF migration. **Starting the new API does not upgrade an existing database automatically.** Apply the script to the approved target before starting the new API.

The transaction creates three master/link tables, adds optional product fields, adds package snapshots to order/quotation items, and extends cart uniqueness to `(user_id, product_id, purchase_unit)`. Existing cart and order rows default to Piece. Existing financial amounts and stock are not recalculated. An advisory lock serializes family upserts and migration/import work.

Legacy migration strategy:

1. Backfill only explicit legacy family strings, separated by category and brand.
2. Leave missing Type/Class/Size/Length values null. No ambiguous name-based mapping is performed.
3. Create approved Types and category/type/subcategory relationships in the dashboard.
4. Export legacy products, review mappings and reimport with their original Code and Product ID.
5. Products with unassigned optional fields remain browsable under their category.

The migration was applied **only** to `127.0.0.1:55432/buildmate_local`, after a custom-format backup at `.local-run/real-backend/pre-catalog-20261030-214445.dump`. Counts before and after migration were 0 products, 0 orders and 1 user. Subsequent browser tests created three clearly labelled LOCAL QA products and associated masters; these are retained for local review. No production database was accessed or modified.

## Excel contract

`ExcelService.ProductColumns` and `ProductExportColumns()` preserve the previous product columns and extend import/template/export with:

`Type`, `Class`, `product_family`, `Size`, `Length`, `Pack Size`, `MRP Pkg`, `Box Discount Type`, `Box Discount Value`, `Family Image URL`, `Product ID`, `Family ID`.

`Sub-Category` accepts the existing `SubCategory` header through normalized header matching. Existing `Variant Family`, `Variant Label`, `Specs`, image URLs and identifiers remain supported. If both family-name columns disagree, import returns a row error. Exported IDs prevent accidental reassignment of identifiers or family ownership. Existing product codes drive upserts. Repeated imports do not add duplicate products or brand-scoped families.

- Required core columns remain Name, Category, Brand and List Price; existing validation and generated codes remain available.
- Unknown Types and Sub-Categories produce row-level errors, even when “create missing masters” is enabled. That option still applies to category/brand creation.
- Pack Size accepts a positive number or a quantity with the matching base unit, such as `20 pieces` for `pcs`. Piece counts must be whole numbers.
- MRP Pkg defaults to piece MRP × Pack Size when not supplied. A supplied package MRP is an explicit override. Exports contain the effective package MRP, so reimporting it makes that amount explicit.
- Box Discount Type is `None`, `Percentage` or `Fixed`. The value has at most two decimal places. Discounts cannot produce a nonpositive box price.
- Image splitting preserves commas within URLs such as Cloudinary transformation paths.
- Exported Stock/Reserved/Rack information is informational. Product import does not bypass the stock ledger to overwrite inventory.
- Validation and updates run in one transaction; a rejected import commits no rows.

Download from Dashboard → Products → Import/template. Local verification copies are `.local-run/catalog-product-template.xlsx` and `.local-run/catalog-selected-export.xlsx`.

## Dashboard and APIs

Dashboard → Products now includes Type, Sub-Category, Class, Product Family, Size and Length filters alongside existing category/brand/status controls. Export all, export filtered and checkbox-selected export use the same server export endpoint. Category/Type changes reset dependent selections.

Product editing includes structured fields and separate package discounts. “Types & family images” opens `/catalog-structure`, where authorized staff manage Types, allowed Sub-Categories and brand-specific family images using the existing uploader.

New endpoints:

| Endpoint | Purpose |
| --- | --- |
| `GET/POST /api/admin/catalog-structure/types` | List/create Type masters |
| `PUT /api/admin/catalog-structure/types/{id}` | Update Type and allowed Sub-Categories |
| `GET/POST /api/admin/catalog-structure/families` | List/create brand-specific families |
| `PUT /api/admin/catalog-structure/families/{id}` | Update family name/image; ownership stays fixed |
| `GET /api/catalog/types?categoryId=…` | Active predefined Types and allowed subcategory IDs |
| `GET /api/catalog/facets?categoryId=…&typeId=…&subCategoryId=…&brandId=…` | Aggregate filter choices/counts |
| `POST /api/cart/preview` | Stateless, server-priced guest cart; no database writes |

Existing product listing/detail endpoints return an additive `catalog` object. Listing queries accept `typeId`, `class`, `familyId`, `size`, `length`; admin listing/export also accepts comma-separated `ids` (maximum 5,000). Existing consumers can ignore these optional fields.

Family list pages use `collapse=true` and pagination. Facets/family summary counts are aggregated in PostgreSQL rather than sending the whole category to the device. The legacy category-items endpoint remains available for backward compatibility; the new web/mobile category screens no longer call it.

Admin endpoints retain Staff authentication plus CatalogView/CatalogManage permission policies. No Firebase/Cashfree credentials or configuration were changed.

## Website and Flutter

- Active categories, including empty categories, retain the existing Coming Soon behavior.
- Category screens use predefined Type → Sub-Category navigation, additional Brand/Class/Size/Length filters, clear states and paginated family cards.
- Product detail uses backend variant axes, rather than downloading a whole category and guessing cross-brand siblings.
- Eligible products offer individual units or whole boxes. The displayed box price comes from the API.
- Web guest cart pricing is now returned by `/api/cart/preview`; the authenticated cart remains authoritative at checkout.
- Cart identity includes purchase unit, so the same product can have separate Piece and Box lines. Cart reload/merge preserves that choice.
- Orders, quotations and invoices retain/display package metadata. Dashboard order editing sends base quantities while allowing box counts in the editor.

## Pricing, stock and historical orders

`Packaging` is the shared decimal calculation/validation and snapshot helper. A box price is package MRP less its independent percentage or fixed discount; piece discounts remain separate.

Cart quantities represent the selected purchase unit. **OrderItem.Quantity and QuotationItem.Quantity remain base-unit quantities**, preserving the existing grouped inventory reservation, dispatch, cancellation and reward behavior. A box order snapshots purchase unit, original pack size, base unit, package MRP and box selling price. Box line totals are calculated using the package price directly, avoiding rounding errors from multiplying a rounded per-piece rate.

Checkout rechecks current configuration and aggregate stock under product locks, then stores snapshots. Existing pending payment retries retain the original order amount and package snapshot. Dispatch still creates one grouped stock movement per product. Duplicate dispatch is rejected. Later changes to a product's pack size/discount do not rewrite earlier order amounts.

## Verification

Automated coverage is in `CatalogPackageTests.cs`, `CatalogMigrationTests.cs`, the existing backend regression suite, `mobile/test/mobile_changes_test.dart`, and `tools/test-catalog-upgrade.cjs`.

The tests cover template columns; import/export Type/Class; unknown masters; repeat-import idempotence; selected export; same-brand grouping and cross-brand separation; recognized units and area isolation; family image precedence; category/type/subcategory filters; piece/box cart prices; both discount types; aggregate stock validation; historical snapshot pricing; mixed-unit dispatch and invoice quantities; duplicate dispatch; pending payment retries; repeatable migrations and rollback guards. Existing Cashfree/security/dispatch tests remain included.

Real HTTP/browser checks use only local ports 5081, 5173 and 3000. They verify anonymous admin access is rejected, dashboard product save/reload, selected export download, web family filters, app/web response parity, box cart display and reload persistence. Screenshots are in `.local-run/catalog-*.png`.

Payment integration tests use a **test-only gateway double** and the existing Cashfree tests. No real merchant payment was created: merchant sandbox credentials have not been entered, and production credentials are unavailable. No physical Android device/emulator was connected; Flutter analyzer/widget/model tests are the available mobile verification. No APK was rebuilt.

Production master lists and ambiguous legacy mappings still require the client's review. No production-data rehearsal has been claimed.

## Deployment and rollback — instructions only

1. Review the changes and obtain deployment/migration approval. Back up the approved database and verify restoration in an isolated environment. Preserve the existing Firebase/Cashfree configuration and encryption keys.
2. Rehearse the forward migration on a restored copy with representative legacy products, pending payments and orders. Compare row counts, stock balances and historical totals.
3. Schedule a brief catalog/checkout maintenance window. Apply the SQL transaction with `psql -v ON_ERROR_STOP=1 -f api/db/2026-10-30_catalog_packages.sql` using an approved connection, then deploy compatible API/dashboard/storefront versions. Build and distribute the compatible mobile app separately after approval.
4. Populate/review Type masters and legacy mappings before bulk import. Test one family from two brands, a piece purchase, a box purchase, dispatch, invoice and cancellation. Confirm production API origins and payment environment without changing credentials.
5. Keep backups and earlier application artifacts. If the new feature has not stored any structured/package data, the guarded rollback script can remove the unused additions. It deliberately refuses when data exists.
6. **Once box orders exist, do not restore old checkout/order-writing binaries that do not understand package snapshots.** Keep the additive schema and data, place affected writes in maintenance mode, and deploy a compatible fix. A reviewed restore requires reconciliation of all orders/payments since backup; never discard subsequent business data as an automatic rollback.

Local verification commands:

```text
.local-tools/dotnet/dotnet.exe test api/tests/BuildMate.Tests/BuildMate.Tests.csproj
npm --prefix admin run build
cd storefront && npm run build
cd mobile && flutter analyze --no-fatal-infos && flutter test
node tools/test-catalog-upgrade.cjs
```

Backend integration tests require `BUILDMATE_TEST_DB` pointing only at a local/test PostgreSQL server with permission to create disposable databases. Browser tests require `LOCAL_ADMIN_EMAIL` / `LOCAL_ADMIN_PASSWORD` and the three local applications. For an isolated storefront build, set `NEXT_BUILD_DIR=.next-catalog-build`; default production output remains `.next`.

## Changed source files

- Domain/Data: `Catalog.cs`, `CatalogStructure.cs`, `Orders.cs`, `AppDbContext.cs`, `EntityConfigurations.cs`, `CatalogStructureConfigurations.cs`; two catalog SQL scripts.
- Services: `CatalogDtos.cs`, `CatalogAdminService.cs`, `CatalogService.cs`, new `CatalogStructure.cs`, `CatalogMeasure.cs`, `FamilyAxes.cs`, `Packaging.cs`; `ExcelService.cs`, `Pricing.cs`, `CartService.cs`, `OrderDtos.cs`, `CheckoutService.cs`, `QuotationService.cs`, `OrderService.cs`, `OrderAdminService.cs`.
- API: `CatalogAdminControllers.cs`, new `CatalogStructureController.cs`, new `CatalogFacetsController.cs`, `ShopperControllers.cs`.
- Dashboard: `App.tsx`, `lib/types.ts`, `lib/masters.ts`, `pages/Products.tsx`, `pages/ProductEdit.tsx`, `pages/OrderDetail.tsx`, new `pages/CatalogStructure.tsx`, new `components/CatalogFields.tsx`.
- Storefront: `lib/types.ts`, `lib/shop.tsx`, `app/products/page.tsx`, `app/account/orders/[id]/page.tsx`, `ui/pages/catalog/CategoryBrowse/CategoryBrowse.tsx`, `ui/pages/catalog/ProductView/ProductView.tsx`, `ui/session/CartContext.tsx`, `ui/services/catalog/buildmateCatalog.ts`, `ui/pages/checkout/OrderConfirmation/OrderConfirmation.tsx`, `next.config.mjs`; Next also adds the isolated build's generated-types path to `tsconfig.json`.
- Flutter: `data/models.dart`, `data/providers.dart`, `features/catalog/category_browse.dart`, `features/catalog/catalog_screens.dart`, `features/cart/cart_screen.dart`, `features/orders/order_screens.dart`, `widgets/common.dart`, `test/mobile_changes_test.dart`.
- Verification: `api/tests/BuildMate.Tests/CatalogPackageTests.cs`, `CatalogMigrationTests.cs`, updated brand-boundary expectation in `MobileCatalogTests.cs`, `tools/test-catalog-upgrade.cjs`.

No Git push, VPS deployment, production migration, database reset, production credential change or APK build was performed.
