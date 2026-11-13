# Delivery serviceability (PIN codes)

Customers can shop from anywhere in India. **Only the delivery PIN code they select decides whether they can buy.**
GPS position, IP address and the customer's current city are never used to allow or block purchases.

## Rule

A PIN code is serviceable when it is in **Dashboard → Admin → Delivery areas** and switched on (and home delivery is
enabled in Store settings). Nothing else counts. **An empty list means no PIN code is serviceable.**

## Where it is enforced

| Step | Website | Mobile app | API (server) |
|---|---|---|---|
| "Deliver to" PIN code selector | Home bar → pop-up | Home bar → bottom sheet | `GET /api/delivery/check?pincode=` |
| Add to Cart / Buy Now / Get Quote | Disabled for a non-serviceable PIN; asks for a PIN when none chosen | Same | — |
| Saved addresses | Serviceable / Not serviceable badge | Same (checked per address) | `serviceable` on each address |
| Checkout | Home delivery only to a serviceable address | Same, plus a final check before placing the order | Order creation rejects any other address (`409 pincode_unserviceable`), for cart checkout and quotation orders |

Store pickup is unchanged (it has no delivery PIN code).

## Dashboard

*Delivery areas* (permission `settings.manage`): add a PIN code (city, district and state fill in from the India Post
directory when available, or type them), switch it on/off, remove it, search. Changes apply immediately to the
website, app and API — no code change or release needed.

## Storage and upgrade

Delivery areas are kept in the existing store-settings record (`settings` table, key `store`) — **no database schema
change**. A store that already had a "Delivery pincodes" list keeps those PIN codes as active delivery areas the
first time the new API reads its settings.

**Before going live:** add your serviceable Kutch PIN codes in *Delivery areas*. Until at least one is added and
active, nobody can order home delivery.

## Outside service

The API looks up city / district / state at `https://api.postalpincode.in` (free, no key, cached, 5 s timeout).
If it is unreachable the names are simply left blank; serviceability never depends on it.

## Tests

`api/tests/BuildMate.Tests/DeliveryAreaTests.cs` covers the rule (serviceable, not serviceable, invalid, disable /
enable, add / remove, duplicates, home delivery off, upgrade of the old PIN list).
