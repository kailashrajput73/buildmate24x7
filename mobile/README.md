# BuildMate 24x7 — Flutter app

One app for customers and trade partners (plumbers, electricians, contractors, flooring). Phone OTP login through
the BuildMate API with MSG91 delivery; at sign-up people pick a profession — Home Owner becomes a customer, trades become partners (partner
prices and reward points once KYC is approved). Browse by category, search, wishlist, cart → pickup or delivery →
Cashfree payment, **quotations** (ask the store for its best price on the cart, accept and pay), orders and invoices,
reward points, addresses, notifications, QR scan, English/Hindi.

The look follows the design kit the client supplied (`theme/` = their `AppColors`, `AppTypography` (DM Sans + Inter),
`AppSpacing`, `AppRadius`, `AppTheme`; their login / OTP / profession screens, home dashboard and catalogue layout).

> Flutter analysis and widget/model tests have been run locally. See
> [the mobile implementation report](../MOBILE_CHANGE_REQUEST_IMPLEMENTATION.md) and
> [the catalog upgrade report](../CATALOG_UPGRADE_IMPLEMENTATION.md) for validation details.
> APK and physical-device verification remain pending.

## First-time setup

Requires Flutter 3.29+ (Dart 3.7+), Android Studio (for the Android SDK) and JDK 17. The `android/` project is
included (package `com.buildmate.customerapp`, minSdk 23, Kotlin DSL Gradle, launcher icons from the logo), so no
`flutter create` is needed.

```bash
cd mobile
flutter doctor            # fix anything red (Android SDK, licences: flutter doctor --android-licenses)
flutter pub get
flutter analyze           # should be clean; send me any errors
```

## Which server the app talks to (API_URL)

`API_URL` is baked into the APK at build time. A real phone can't use `http://10.0.2.2:5080` (that is the emulator's
alias for the PC) or `localhost` — an APK built with those shows "This app was built for the emulator…" / "Can't reach
the BuildMate server". Error screens and Profile show the address the app is using.

- Phone on the same Wi-Fi as the PC running the API/mock: `http://<PC's IPv4 from ipconfig>:5080`, and allow port
  5080 through Windows Firewall. Doesn't work on mobile data.
- Phone on mobile data, testing: give the PC's port a public HTTPS address with a tunnel, e.g.
  `cloudflared tunnel --url http://localhost:5080` (prints `https://….trycloudflare.com`) and build with that.
- Live: the deployed API's HTTPS address, e.g. `https://api.buildmate24x7.in`.

## Build a test APK

```bash
flutter build apk --release --dart-define=API_URL=http://<pc-ip>:5080
# → build/app/outputs/flutter-apk/app-release.apk
```

Release builds without `android/key.properties` are signed with the debug key — fine for testing, not for Play.

## MSG91 phone login

Phone verification is sent and checked by the BuildMate API; the MSG91 key and OTP template ID are server-side only.
For Docker deployments, set `SMS_PROVIDER=Msg91`, `MSG91_AUTH_KEY`, and `MSG91_OTP_TEMPLATE_ID` in the root `.env`.
The MSG91 template must be approved and DLT-registered. See [MSG91_SETUP.md](../MSG91_SETUP.md).

## Play Store release

1. Create an upload key once:
   `keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload`
2. Create `android/key.properties` (never commit it):
   ```
   storePassword=…
   keyPassword=…
   keyAlias=upload
   storeFile=C:/path/to/upload-keystore.jks
   ```
3. Build the app bundle with `flutter build appbundle --release --dart-define=API_URL=https://<live-api>` →
   `build/app/outputs/bundle/release/app-release.aab`.
4. Play Console: new app → upload the .aab to Internal testing → fill the store listing, privacy policy URL, data
   safety form, content rating → test → promote to Production.

## Running

```bash
# Android emulator against a local API (or the mock API in tools/mock-api) on port 5080
flutter run --dart-define=API_URL=http://10.0.2.2:5080

# Real device on the same Wi-Fi
flutter run --dart-define=API_URL=http://192.168.1.20:5080

# Release
flutter build appbundle --dart-define=API_URL=https://api.buildmate24x7.in
```

The API's Development profile accepts `123456` for configured test phone numbers. Real-device login requires the
API to be reachable and configured with the MSG91 provider and approved template.

## Platform configuration (Android part is already done in `android/`; iOS still needed)

### Android — `android/app/src/main/AndroidManifest.xml`

```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.CAMERA"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>

<!-- inside <manifest>, for url_launcher (call / WhatsApp the store) -->
<queries>
  <intent><action android:name="android.intent.action.DIAL"/><data android:scheme="tel"/></intent>
  <intent><action android:name="android.intent.action.VIEW"/><data android:scheme="https"/></intent>
</queries>
```

For local HTTP testing add `android:usesCleartextTraffic="true"` to `<application>` (debug only).
Set `minSdkVersion 23` in `android/app/build.gradle` (Cashfree and mobile_scanner need it).

### iOS — `ios/Runner/Info.plist`

```xml
<key>NSCameraUsageDescription</key><string>Scan product QR codes and photograph KYC documents.</string>
<key>NSPhotoLibraryUsageDescription</key><string>Choose KYC document photos.</string>
<key>NSLocationWhenInUseUsageDescription</key><string>Tag your shop location during registration.</string>
<key>LSApplicationQueriesSchemes</key><array><string>tel</string><string>https</string><string>upi</string><string>phonepe</string><string>gpay</string><string>paytmmp</string></array>
```

Set the iOS deployment target to 13.0 in `ios/Podfile`.

## Cashfree

Payment sessions are created by the API (`POST /api/orders/checkout` / `/{id}/pay`); the app only opens Cashfree's
web checkout with the returned `paymentSessionId` and then asks the API to verify (`confirm-payment`). The app never
decides that a payment succeeded. `environment` comes from the API (`SANDBOX` / `PRODUCTION`); `mock` skips the SDK
for local testing.

## Notifications

The app shows in-app notifications from the API. Mobile push notifications are not configured.

## Structure

```
lib/
  core/       config, theme (design-kit tokens in core/theme/), phone_auth (API OTP), formatting, i18n (en/hi), API client with token refresh, Cashfree wrapper
  data/       models + Riverpod providers
  widgets/    shared widgets (images, errors, qty stepper, product tile)
  features/   auth (MSG91-backed API OTP + sign-up), kyc, home, catalog (+category browse), quotations (+wishlist), scan,
              cart (+checkout), orders, rewards, account
  router.dart go_router: Home · Categories · Wishlist · Quotation · Profile; browsing without login,
              cart/checkout/orders ask to log in; new partners finish registration first
```

## Play Store notes

- The SOW line about reading and storing all phone contacts was left out: Google Play restricts the contacts
  permission to apps whose core function needs it, and it's personal data under the DPDP Act. If referral invites
  are wanted, use the system share sheet with a referral link instead.
- Account deletion is in-app (Account → Delete account), which Play requires.
