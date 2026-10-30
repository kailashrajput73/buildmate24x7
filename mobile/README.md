# BuildMate 24x7 — Flutter app

One app for customers and trade partners (plumbers, electricians, contractors, flooring). Phone OTP login through
Firebase; at sign-up people pick a profession — Home Owner becomes a customer, trades become partners (partner
prices and reward points once KYC is approved). Browse by category, search, wishlist, cart → pickup or delivery →
Cashfree payment, **quotations** (ask the store for its best price on the cart, accept and pay), orders and invoices,
reward points, addresses, notifications, QR scan, English/Hindi.

The look follows the design kit the client supplied (`theme/` = their `AppColors`, `AppTypography` (DM Sans + Inter),
`AppSpacing`, `AppRadius`, `AppTheme`; their login / OTP / profession screens, home dashboard and catalogue layout).

> The Flutter SDK can't be downloaded in the environment this was written in, so this code has **not been compiled**.
> Expect a short round of `flutter analyze` fixes on first build; send the errors back if anything is unclear.

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

## Build a test APK (no Firebase yet, against the mock or a test API)

```bash
flutter build apk --release --dart-define=API_URL=http://<pc-ip>:5080 --dart-define=AUTH_MODE=otp
# → build/app/outputs/flutter-apk/app-release.apk  (install on any Android phone; OTP 123456 on the mock)
```

Release builds without `android/key.properties` are signed with the debug key — fine for testing, not for Play.

## Firebase phone login (required)

Full guide for web + app: ../FIREBASE_SETUP.md.

The app's package name is **`com.buildmate.customerapp`** — the Android app the store registered in Firebase project
**`buildmate24x7`** (the same project as the website). Its `google-services.json` is not in this repository.

1. Put that `google-services.json` in `android/app/`. `build-apk.bat` then builds with real SMS login
   (`AUTH_MODE=firebase`); without it, or if the file is for another package, it builds the demo OTP (`123456`).
2. Firebase console → Project settings → Your apps → `com.buildmate.customerapp` → **Add fingerprint**: add the
   **SHA-1 and SHA-256** of every key that signs the app. `build-apk.bat` writes the current key's fingerprints to
   `firebase-sha.txt` (debug key until `android/key.properties` exists). For Play Store installs also add the
   **App signing key** fingerprints from Play Console → Setup → App integrity. Phone auth fails without them
   (`app-not-authorized` / `invalid-app-credential`).
3. Download `google-services.json` again after adding fingerprints and replace the one in `android/app/`.
4. Authentication → Sign-in method → enable **Phone**. Real SMS needs the **Blaze** (billing) plan; for testing add
   numbers under Authentication → Settings → Phone numbers for testing.
5. The API's `Firebase:ProjectId` already includes `buildmate24x7`.

Firebase error codes are shown in the login error message (e.g. `[app-not-authorized]`) to make set-up problems easy
to spot.

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
3. Add this key's SHA-1/SHA-256 to Firebase too, then
   `flutter build appbundle --release --dart-define=API_URL=https://<live-api>` → `build/app/outputs/bundle/release/app-release.aab`.
4. Play Console: new app → upload the .aab to Internal testing → fill the store listing, privacy policy URL, data
   safety form, content rating → test → promote to Production. After Play signing is on, add Play's app-signing
   SHA-1 to Firebase as well, or OTP login fails for store installs.

## Running

```bash
# Android emulator against a local API (or the mock API in tools/mock-api) on port 5080
flutter run --dart-define=API_URL=http://10.0.2.2:5080 --dart-define=AUTH_MODE=otp

# Real device on the same Wi-Fi
flutter run --dart-define=API_URL=http://192.168.1.20:5080

# Release
flutter build appbundle --dart-define=API_URL=https://api.buildmate24x7.in
```

Dev logins: any phone, OTP `123456` with the mock API; `9999999999` / `8888888888` with OTP `123456` on the real
API in Development.

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

## Push notifications (optional)

Uses the same Firebase project as login. To enable:

```bash
dart pub global activate flutterfire_cli
flutterfire configure --project=<firebase-project>
```

then add `firebase_options.dart` usage in `main.dart` (`Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform)`)
and put the service-account JSON path in the API's `Push:Fcm` settings. The app registers its token via
`POST /api/account/devices` after login.

## Structure

```
lib/
  core/       config, theme (design-kit tokens in core/theme/), phone_auth (Firebase / API OTP), formatting, i18n (en/hi), API client with token refresh, Cashfree wrapper
  data/       models + Riverpod providers
  widgets/    shared widgets (images, errors, qty stepper, product tile)
  features/   auth (Firebase phone + sign-up), kyc, home, catalog (+category browse), quotations (+wishlist), scan,
              cart (+checkout), orders, rewards, account
  router.dart go_router: Home · Categories · Wishlist · Quotation · Profile; browsing without login,
              cart/checkout/orders ask to log in; new partners finish registration first
```

## Play Store notes

- The SOW line about reading and storing all phone contacts was left out: Google Play restricts the contacts
  permission to apps whose core function needs it, and it's personal data under the DPDP Act. If referral invites
  are wanted, use the system share sheet with a referral link instead.
- Account deletion is in-app (Account → Delete account), which Play requires.
