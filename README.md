# BuildMate 24x7

Plumbing, electrical and hardware ordering for Shivani Electrochem Services, built from the SOW with these changes:
a cart with upfront payment plus **quotations** for bulk / site orders, Cashfree as the payment gateway, Firebase
phone login, and a pluggable ERP sync layer.

| Folder | What it is | Stack |
|---|---|---|
| `api/` | Single backend for everything | ASP.NET Core 8, EF Core 8, PostgreSQL (N-tier: Domain → Data → Services → Api) |
| `admin/` | Staff admin panel — catalogue, stock, racks, purchases, orders, counter, partners, content, reports, team | React 18 + TypeScript + Vite + Tailwind |
| `storefront/` | Retail customer website | Next.js 14 (app router) |
| `mobile/` | One app for customers and trade partners (Android/iOS) | Flutter 3.29+, Riverpod, go_router |
| `tools/mock-api/` | Zero-dependency Node mock of the API with seeded demo data | Node 20 |
| `brand/` | Cleaned logo (tagline removed) | |
| `data/` | `BuildMate_Pipes_Fittings_Import.xlsx` — the four pipe & fitting sheets cleaned into one import file | |
| `tools/catalog-import/` | Scripts that rebuild that file when the brand sheets change | Python + openpyxl |

The admin panel drives both apps: products, prices, images, categories, home banners, store settings (delivery fee,
minimum order, hours, support number), partner approval and reward rules all come from the API, so a change in admin
shows up on the website and in the app without a release.

## Look and feel: the client's design kit

All three apps follow the design the client supplied (their React web app and Flutter app): flat white surfaces,
brand blue `#1A56DB`, navy header `#1B2A47`, the catalogue's green "ADD" accent `#5FAF2E`, DM Sans headings and
Inter body text. Their screens were ported onto our API rather than rebuilt from scratch.

| App | Where it lives |
|---|---|
| Website | `storefront/ui/` — their components and styles (styled-components) with `ui/theme/theme.ts` as the single source of tokens. Pages not in the kit (orders, addresses, policies, partner page) use Tailwind mapped to the same tokens in `tailwind.config.ts` / `app/globals.css` |
| Admin | `admin/tailwind.config.js` + `admin/src/index.css` — same tokens; navy top bar, white side menu in the kit's style |
| App | `mobile/lib/core/theme/` — their `AppColors`, `AppTypography`, `AppSpacing`, `AppRadius`, `AppTheme`; login, OTP, profession, home and catalogue screens follow their layouts |

What changed from their code, and why:
- **Payment**: their checkout collected card / UPI details on the page. Payment now opens Cashfree's secure page;
  card and bank details never touch our site or app. Confirmation is shown only after the API verifies the payment.
- **Data**: their screens read mock files or their FastAPI server (`187.127.148.44`). All calls now go to this API;
  no request goes to that server.
- **Profile / KYC**: our KYC is Aadhaar / PAN document upload plus optional GSTIN. Their *Bank details* section was
  left out because the system doesn't store bank accounts (it would need a database change — ask if wanted).
- Fake bits removed: demo address, fixed notification counts, AI assistant button, voice search.

## Quick look without a database (mock API)

```bash
node tools/mock-api/server.mjs                     # http://localhost:5080
cd admin && npm install && npm run dev             # http://localhost:5173  admin@buildmate24x7.in / Admin@12345
cd storefront && npm install && npm run dev        # http://localhost:3000  any phone, OTP 123456
cd mobile && …                                     # see mobile/README.md
```

Payments are simulated in the mock (no Cashfree popup). Excel templates, imports and exports work in the mock too
(`tools/mock-api/xlsx.mjs`, same columns and checks as the real API), but everything resets when the mock restarts.

## Running the real stack

### With Docker

```bash
cp .env.example .env        # fill in passwords, JWT key, Cashfree keys
docker compose up -d --build
```

API on :8080 (Swagger off by default), admin on :8081, storefront on :3000. The admin user is seeded from
`Seed:AdminEmail` / `ADMIN_PASSWORD` on first start.

### Without Docker

```bash
# Postgres 16 running locally with a "buildmate" database/user
cd api
dotnet run --project src/BuildMate.Api           # Development profile → http://localhost:5080, Swagger at /swagger
```

`appsettings.Development.json` has a dev JWT key, admin password `Admin@12345`, demo data on, and OTP test numbers
`9999999999` / `8888888888` (code `123456`). Then run admin and storefront as above (both proxy `/api` to :5080).

### Database migrations

The API creates the schema with `EnsureCreated` until migrations exist. Before the first production deploy:

```bash
dotnet tool install -g dotnet-ef
cd api
dotnet ef migrations add Initial -p src/BuildMate.Data -s src/BuildMate.Api
```

From then on it applies migrations on startup (`Database:AutoMigrate`). Commit the `Migrations/` folder.

## Configuration reference (API)

Set via `appsettings.json` or environment variables (`Section__Key`).

| Setting | Notes |
|---|---|
| `ConnectionStrings:Default` | Postgres connection string |
| `Jwt:SigningKey` | ≥ 32 random characters. Required in production |
| `Otp:*` | Length, expiry, attempt and resend limits. `TestNumbers` for store/Play review accounts |
| `Firebase:ProjectId` | Firebase project id(s) whose phone-login tokens are accepted, comma-separated. Set to `buildmate24x7,buildmate-24x7` because the client's web and Android configs point at two different projects — use one if possible |
| `Sms:Provider` | Only for the API's own OTP (fallback when Firebase isn't used): `Log` or `Msg91` (needs a DLT-registered template) |
| `Push:FirebaseCredentialPath` | Service-account JSON for FCM. Empty = push disabled |
| `Storage:Provider` | `Local` (folder `storage/`) or `S3` (`S3Bucket`, `S3Region`, `S3PublicBaseUrl`). KYC documents are always private and served only to staff through the API |
| `Cashfree:*` | `Environment` sandbox/production, `ClientId`, `ClientSecret`, `WebReturnUrl` (storefront `/checkout/return?order={orderId}`), `NotifyUrl` |
| `Erp:*` | `Provider` `None` or `Webhook`, `WebhookUrl`, `WebhookSecret`, retry settings |
| `Cors:Origins` | Storefront and admin origins |

### Cashfree

1. Create sandbox keys in the Cashfree merchant dashboard and set them **on the server as environment variables**
   (`Cashfree__ClientId`, `Cashfree__ClientSecret`, `Cashfree__Environment`, `Cashfree__WebReturnUrl`,
   `Cashfree__NotifyUrl`). Never commit them or paste them in chat; regenerate any key that was shared.
   Switch `Environment` to `production` only after one sandbox payment works end to end.
2. Register the webhook `https://<api-host>/api/payments/cashfree/webhook` (payment success/failed/user-dropped and refund events).
3. Order status is only ever set from Cashfree's API or a signature-verified webhook — never from the browser or app.
4. Refunds for counter edits and cancellations are started from the admin order screen.

### ERP

No ERP is chosen yet. Every business event (product changes, purchases, paid orders, dispatches, stock
adjustments, refunds) is written to an outbox table in the same transaction and delivered in the background:

- `Erp:Provider = None` — events are kept and visible under Admin → Integrations.
- `Erp:Provider = Webhook` — each event is POSTed as JSON to `Erp:WebhookUrl` with an `X-BuildMate-Signature`
  HMAC-SHA256 header, retried with backoff, and can be replayed from the admin.

Once the ERP is picked (Tally, Busy, Marg, Zoho, SAP B1…), add an `IErpConnector` implementation in
`api/src/BuildMate.Services/Erp/` — nothing else changes.

## Loading the catalogue (pipes & fittings, electrical cables)

Electrical: import `data/BuildMate_Electrical_Import.xlsx` the same way — 247 Ultravolt cables in 12 product
lines. Cable lines have a picker per option (Size · Colour · Length…) rather than one size row; switches, MCBs,
lighting and fans are still demo items until their sheets arrive.

### Pipes & fittings

On the real API: Admin → Products → **Import** → choose `data/BuildMate_Pipes_Fittings_Import.xlsx`, tick
"Create missing categories, sub categories and brands", upload. 1,508 products in 171 size families are created under
the brands' own codes (C1115CKG, U4015AS…). Re-importing later updates them in place.

The mock API already contains this catalogue (`tools/mock-api/data/pipes-fittings.json`), with invented stock levels.

- **Sizes:** products sharing a *Variant Family* show as one card ("9 sizes, from ₹7.42") with a size picker on
  the product page — website, app and admin.
- **Prices:** customers currently pay MRP. Set real retail / partner prices by editing the import file or per product.
- **Needs checking:** the second sheet of the import file lists ~100 rows for the store to confirm (missing MRP,
  mm/inch mismatches, reversed prices, ranges with no purchase discount).

## How ordering works

1. Customer or partner adds items to the cart, or taps **Buy now** on a product (adds it and goes straight to checkout) (partners see partner prices; retail sees retail prices; ROL/stock checked).
2. Checkout → home delivery or store pickup → Cashfree payment. Submitting the same cart again within 15 minutes
   (double tap, refresh, app + web) reuses the pending order instead of creating a second one. On confirmed payment stock is reserved and the order
   reaches the admin Orders board.
3. Store packs it. At the counter staff can edit the order before handover (add/remove items, special discount);
   any extra is collected at the counter, any excess is flagged for refund.
4. Dispatch deducts stock, generates the GST tax invoice and credits partner reward points.

### Quotations (bulk and site orders)

1. At checkout the customer or partner chooses pickup / delivery and taps **Ask for a quote instead** (website and
   app). The cart becomes a quotation (`Qyymmnnnnn`) and is emptied. Stock and minimum order aren't required to ask.
2. Admin → **Quotations** lists requests waiting for a price first. Staff give an extra discount per item (or one %
   for all), see the margin against average cost and the stock on hand, set the delivery charge and how long the
   price holds (1–30 days), add a message, and **Send price**. The customer gets a notification. Sending needs the
   *special discount* permission.
3. The customer opens the quotation and taps **Accept & pay**: the API creates a normal order at the quoted prices
   (same totals, rounding and GST as checkout), and Cashfree opens. From there it is an ordinary order. Partners
   need approved KYC to accept; stock is checked at acceptance.
4. They can **Decline**; staff can **Close** one with a reason the customer sees. A quoted price past its validity
   shows as *Expired* and can be re-priced.

Schema: two new tables and a sequence — `api/db/2026-10-29_quotations.sql` for existing databases (run by hand,
after a backup). Existing tables are not altered.

## Product QR codes and scanning

Each product's QR code holds its code (C1115CKG, BM000123…). Admin → Products → a product → **Print label**
prints a 50 × 38 mm sticker (QR, code, name, MRP); **Download QR** saves the PNG.

- **Counter billing, purchases, stock, order edits:** a USB/Bluetooth scanner works in the search box (it types
  the code and presses Enter). The camera button scans QR codes in any browser — Chrome on Android uses its
  built-in reader, other browsers (Chrome/Edge on Windows, Firefox, Safari) use the bundled jsQR decoder.
  Browsers only allow the camera on **https://** or **localhost**, so a tablet opening the admin over
  `http://192.168…` gets no camera — use https in production.
- **Partner app:** the Scan tab reads QR codes and box barcodes and offers to add the item to the cart.

## Product movement (Fast / Slow / Non-moving)

Admin → Stock shows Fast moving (dispatched in the last 30 days), Slow moving (31–120 days) and Non-moving (121+)
cards, with the class, last dispatch date and days since movement on every row, filters, search, Excel export and a
per-product movement history. Products never dispatched are aged from their first stock receipt and tagged
"Never dispatched". Rules, API, the database script and deployment steps: `docs/PRODUCT_MOVEMENT.md`.

## Tax invoice

Printed in Shivani Electrochem Services' own layout (taken from their invoice SES/25-26/068): letterhead with
logo, CASH/DEBIT MEMO · TAX INVOICE · copy label, state code / GSTIN / PAN / RCM line, buyer block with state
code, invoice no / date / order no / date & place of supply, items (HSN/SAC, qty, unit, rate, GST %, taxable),
Central + State tax (or Integrated tax), round off, GST summary by rate, total tax, total amount, amount in words,
bank details, numbered terms, "For, SHIVANI ELECTROCHEM SERVICES" / Authorised Signatory.

- **Seller details** (address, Gujarat, GSTIN 24AUWPC0904B1Z5, PAN, Axis Bank details, logo, terms) are the
  defaults in Admin → Settings and can be edited there.
- **CGST + SGST vs IGST:** store pickup is always intra-state; delivery to another state is IGST.
- **Numbering:** `SESW/26-27/001` (confirmed by the store: a separate SESW series for online and app sales, so it never clashes with their own SES bills), restarting each April. Admin → Settings → *Next invoice number* moves the
  counter, e.g. to continue after bills made in the store's existing software.
- **Round off:** the bill is rounded to the rupee at checkout, so the amount charged online equals the invoice total.
- **Delivery charge** is a line on the invoice at 18% GST with SAC 996511 (confirmed by the store).
- One component draws it everywhere: `admin/src/components/InvoiceSheet.tsx` (copied to `storefront/components/`).

## Things to decide or finish before launch

- **Flutter app not yet compiled** — the SDK couldn't be downloaded where this was written. Follow `mobile/README.md`
  (Firebase setup, SHA fingerprints, package name) and expect a round of analyzer fixes.
- **One Firebase project** — the website `.env` uses `buildmate24x7`, the Android `google-services.json` uses
  `buildmate-24x7` (package `com.example.customerapp`). Pick one; register the real Android package there.
- **Database scripts to run by hand** (after a backup, on staging first): `api/db/2026-10-28_product_movement.sql`,
  `api/db/2026-10-29_quotations.sql`.
- **API compiled against stubs only** (NuGet was blocked); run `dotnet build` once with real packages.
- **Policies pages** (`storefront/app/policies`) contain draft text — have them reviewed; Cashfree and the app stores require them.
- **Contacts harvesting** from the SOW was not built (Play policy / DPDP Act). Suggest a referral share link instead.
- A few demo images in the mock are placeholder illustrations — upload real product photos from Admin → Products.
