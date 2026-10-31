# Mobile change request implementation — 30 October 2026

Implemented locally against the supplied **BuildMate Mobile App – Change Request Report.docx**. The report describes an older source archive; its Firebase package suggestion was not substituted for the app's existing registered package. Its console, signing, production import and deployment instructions were not treated as authorization to perform those actions.

## Implemented behavior

1. **Firebase and OTP:** preserved Firebase project `buildmate24x7` and Android application ID `com.buildmate.customerapp`. Firebase initialization failures produce a safe debug diagnostic and a visible login message. Six-digit OTP paste/autofill works. The default API host is now `https://api.buildmate24x7.com`; local development requires an explicit `API_URL` override. Cashfree still takes the environment from the backend payment session.
2. **Referral signup:** optional alphanumeric referral field, maximum 12 characters to match the database, trimmed and uppercased before submission, carried through profession selection. The existing OTP/Firebase login APIs receive it. Invalid codes return a helpful error before the account is saved; the user can go back, clear the optional field and continue. Existing configurable referral reward amounts are preserved.
3. **Delivery location:** guests and signed-in users can choose current location, saved addresses or add an address. Current location requests permission and tracks foreground home-screen movement with a 75 m distance filter; leaving home/backgrounding stops tracking. Reverse geocoding uses the existing backend endpoint. Permission, GPS, timeout and network problems have recovery messages/settings actions. GPS prefills a new address; checkout requires a confirmed complete address and does not silently choose an old default address while GPS is selected. Saved-address selection follows through to checkout. Public store info includes delivery pincodes; both the UI and existing backend checkout enforce delivery availability.
4. **Search:** focused search from home/categories/category, clear/submit controls, debounced results, removable category scope, product/brand/category suggestions and up to eight locally persisted recent searches. Titled product lists now also have a search action. Backend search covers category, subcategory and specs and normalizes digit/unit spacing (`20mm`, `sdr11`). Empty results include the query and retry.
5. **QR:** trims/normalizes codes and accepts product-code URLs (`/product/CODE` or `?code=CODE`), rejects unrelated links, supports gallery scans, torch state, haptic success feedback, camera settings/retry, manual codes and clearer lookup/network errors. Home has a labelled Scan action. Missing or hidden products intentionally share a not-found/unavailable message rather than disclosing hidden catalogue entries.
6. **Pipes/fittings:** rail uses configured subcategories with counts/order; categories expose subcategory shortcuts. Class/SDR/Schedule and numeric size filters have multi-select, Apply and Clear actions and combine with existing brand/sort controls. A single matching variant must satisfy all selected filters. Product pages consume server-provided Brand/Class/Size axes; the full-category download and mobile name-parsing heuristic were removed. Out-of-stock options are disabled. Structured item identity preserves compatible choices across brands/classes; legacy rows without Item Type stay within their explicit family instead of guessing.
7. **Profile:** customers and partners use the existing account KYC/reward/referral endpoints. Profile shows Refer & Earn, copy/WhatsApp sharing, referral count/earnings, reward balance and KYC status. KYC supports optional GSTIN, rejection reasons, replacement uploads and resubmission. Partner business profile remains separate. Account-specific providers refresh when the identity changes.
8. **Home rewards:** accessible beside the profile icon for customers/partners; guests follow the existing login redirect. Verified the home layout at 320 px width.
9. **Categories/images:** active empty categories remain visible, dimmed with Coming soon ribbons; tapping shows a message. Product images use existing category/type artwork as a fallback and Cloudinary list thumbnails; product details use full-resolution URLs.

## Catalogue preparation and image audit

- All **76 distinct image URLs** from the supplied import workbooks returned HTTP 200 with an image content type.
- **161 / 1,545** pipes/fittings rows and **247 / 247** electrical rows have no image URL. The app uses artwork fallbacks; no product photos or barcodes were invented.
- `tools/catalog-import/enrich_item_types.py` generated `.local-run/BuildMate_Pipes_Fittings_With_Item_Types.xlsx`, adding explicit Item Type specifications to **1,545 rows, zero unresolved rows**. It derives those values once from the existing structured family/brand/material/class fields. The original workbook was not changed. Future normalization also writes Item Type.
- **The enriched workbook has not been imported into any database.** Cross-brand options for legacy data require a reviewed catalogue update. Do not import blindly: review identity, pricing, stock and image changes before approval. Runtime fallback remains functional until then.
- Detailed image results: `.local-run/mobile-image-audit.json`. Re-run read-only with `python tools/audit-mobile-images.py`.

## Verification

- Flutter 3.47.8 / Dart 3.13.7: dependency resolution succeeded after updating `intl` for the installed Flutter SDK; lockfile generated.
- `flutter analyze --no-pub --no-fatal-infos`: passed with zero errors/warnings; informational style/deprecation notices remain.
- Flutter unit/widget suite: **7 passed, 0 failed**. Coverage: QR parsing, subcategory grouping, class normalization, size sorting, search persistence, empty categories, 320 px home layout, full-code OTP paste/autofill and delivery coverage.
- .NET suite: **89 passed, 0 failed, 0 skipped**, including real PostgreSQL catalogue queries and customer/partner KYC/rewards/referrals. Tests created and removed their own disposable local databases. Existing compiler warnings in `AppDbContext.cs` and `MyQuotationsController.Request` remain.
- Restarted the isolated local API at `http://127.0.0.1:5081` against its existing local PostgreSQL cluster on port 55432. Health/store/categories return 200; store response contains `deliveryPincodes`. Anonymous KYC/rewards/referral requests return 401.
- `adb devices` found **no connected Android device/emulator**. Real SMS delivery, Firebase console/provider/billing/signing configuration, GPS movement/permission flows, camera/gallery behavior and real Cashfree checkout are **not device-verified**. No APK was built.

## Changed source files

Mobile:

- `mobile/lib/main.dart`
- `mobile/lib/core/config.dart`
- `mobile/lib/core/scan_code.dart` (new)
- `mobile/lib/data/models.dart`
- `mobile/lib/data/providers.dart`
- `mobile/lib/data/delivery_location.dart` (new)
- `mobile/lib/data/search_history.dart` (new)
- `mobile/lib/features/auth/login_screen.dart`
- `mobile/lib/widgets/auth/auth_otp_fields.dart`
- `mobile/lib/features/account/account_screens.dart`
- `mobile/lib/features/kyc/kyc_screens.dart`
- `mobile/lib/features/home/home_screen.dart`
- `mobile/lib/features/home/delivery_location_bar.dart` (new)
- `mobile/lib/features/cart/checkout_screen.dart`
- `mobile/lib/features/catalog/catalog_screens.dart`
- `mobile/lib/features/catalog/category_browse.dart`
- `mobile/lib/features/scan/scan_screen.dart`
- `mobile/lib/widgets/common.dart`
- `mobile/test/mobile_changes_test.dart` (new)
- `mobile/pubspec.yaml`, `mobile/pubspec.lock` (new), `mobile/analysis_options.yaml` (Flutter added generated/platform directory exclusions)
- `mobile/.gitignore` (new; excludes generated build/cache/signing files)

Backend and tools:

- `api/src/BuildMate.Services/Catalog/CatalogService.cs`
- `api/src/BuildMate.Services/Catalog/PipeOptions.cs` (new)
- `api/src/BuildMate.Services/Content/ContentService.cs`
- `api/src/BuildMate.Services/Partners/MemberService.cs`
- `api/tests/BuildMate.Tests/MobileCatalogTests.cs` (new)
- `tools/catalog-import/normalize.py`
- `tools/catalog-import/enrich_item_types.py` (new)
- `tools/audit-mobile-images.py` (new)
- This report.

Existing payment configuration, orders, payment records, credentials, signing keys and Firebase registration were not changed. No new database migration is required for these changes. No VPS deployment, GitHub push, production data change or production payment-mode change was performed.

## Local review and eventual release

Use the updated real local backend for reviewing the new contract. For an Android emulator, explicitly use `--dart-define=API_URL=http://10.0.2.2:5081`; a physical device requires a reachable approved local development address/tunnel. Do not send test signup/payment mutations to the production default host. Local OTP mode is an explicit development-only choice; Firebase remains the production default. Current local Cashfree settings remain Sandbox, without merchant credentials; enter Sandbox keys through the dashboard when ready.

Before an approved production release, review/deploy the matching backend changes, review/import the enriched catalogue if cross-brand selection is wanted, verify Firebase signing/provider settings and perform physical-device acceptance tests. Building/distributing an APK remains a separate step. Roll back the mobile/backend source changes together if needed; preserve the existing database and encrypted payment keyring. Keep the original catalogue workbook and export current catalogue data before any later approved import.
