# Firebase phone login — BuildMate website + Android app

Both the website (buildmate24x7.com) and the Android app sign people in with **Firebase phone authentication**
(real SMS OTP) in the Firebase project **`buildmate24x7`**. Firebase only proves the person owns the number; the
BuildMate API then checks Firebase's ID token and creates the BuildMate session, in the same database for both.

```
Phone / browser ──(1) SMS OTP──▶ Firebase (project buildmate24x7)
       │                               │
       │◀──(2) Firebase ID token───────┘
       │
       └──(3) POST /api/auth/firebase {idToken}──▶ BuildMate API (VPS) ──(4) checks token with Google's public keys
                                                         │
                                                         └── finds / creates the user in Postgres, returns a BuildMate session
```

No Firebase service-account key is needed anywhere: the API verifies tokens with Google's public keys. Nothing in
this guide is a secret except where marked; Firebase web/Android API keys are public identifiers by design (they are
protected by authorized domains, package name + SHA fingerprints, and API-key restrictions).

---

## 1. Firebase Console — project `buildmate24x7` (manual, done once)

### 1.1 Enable phone sign-in
Authentication → **Sign-in method** → **Phone** → Enable → Save.

### 1.2 Billing (needed for real SMS)
Firebase sends real SMS only on the **Blaze (pay-as-you-go)** plan. Upgrade: Project overview → ⚙ → Usage and
billing → Details & settings → Modify plan → Blaze. SMS to India is charged per message by Google (see the Firebase
pricing page). Without billing you get `auth/billing-not-enabled` (web) / `billing-not-enabled` (app) or no SMS.

Until billing is on, you can still test with **test numbers**: Authentication → Settings → **Phone numbers for
testing** → add e.g. `+91 99999 00001` with code `246810`. No SMS is sent for those; they work on web and Android.
Remove them before going live.

### 1.3 SMS region policy
Authentication → Settings → **SMS region policy** → Allow → **India**. (If the policy is set to "allow" with an
empty list, or India is denied, SMS fails with `auth/operation-not-allowed` / region errors.)

### 1.4 Authorized domains (website)
Authentication → Settings → **Authorized domains** → Add domain:
- `buildmate24x7.com`
- `www.buildmate24x7.com` (if the site also opens on www)
- `localhost` is there by default (for local testing).

Without this the website gets `auth/unauthorized-domain` or `auth/captcha-check-failed` when sending the OTP.

### 1.5 Web app (website config)
Project settings → **Your apps** → if there is no Web app, Add app → Web (</>) → name "BuildMate website".
Copy its config — these become the website's `NEXT_PUBLIC_FIREBASE_*` values (section 3):

| Firebase config key | Environment variable |
|---|---|
| `apiKey` | `NEXT_PUBLIC_FIREBASE_API_KEY` |
| `authDomain` | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` (`buildmate24x7.firebaseapp.com`) |
| `projectId` | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` (`buildmate24x7`) |
| `storageBucket` | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` |
| `messagingSenderId` | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` (`384018735885`) |
| `appId` | `NEXT_PUBLIC_FIREBASE_APP_ID` (`1:384018735885:web:52cf804bbb61127d88c644` in the existing web app) |

### 1.6 Android app
Project settings → Your apps → Android app **`com.buildmate.customerapp`** (already registered). If it's missing:
Add app → Android → package name `com.buildmate.customerapp`.

**Add fingerprints** (Your apps → `com.buildmate.customerapp` → Add fingerprint), both **SHA-1 and SHA-256** for
every key that signs the app:

| Key | Where to get the fingerprints |
|---|---|
| Test builds (debug key) | `mobile/firebase-sha.txt` — written by `build-apk.bat` |
| Release key (your upload keystore) | `mobile/firebase-sha.txt` — written by `build-apk.bat` once `android/key.properties` exists |
| Google Play app signing key | Play Console → your app → Setup → **App integrity** → App signing key certificate |

Manual alternative: `keytool -list -v -keystore <keystore> -alias <alias>` (debug: `%USERPROFILE%\.android\debug.keystore`,
alias `androiddebugkey`, password `android`).

Then **download `google-services.json` again** (it changes after adding fingerprints) and put it in
`mobile/android/app/google-services.json`. It is not committed to the repository.

### 1.7 API key restrictions (optional but recommended)
Google Cloud console → APIs & Services → Credentials:
- **Browser key** (website): Application restrictions → Websites → `https://buildmate24x7.com/*`,
  `https://www.buildmate24x7.com/*`, `https://buildmate24x7.firebaseapp.com/*`. API restrictions must include
  **Identity Toolkit API** (and Token Service API).
- **Android key**: Android apps → package `com.buildmate.customerapp` + the SHA-1s above.
A restricted key that is missing one of these gives `auth/api-key-not-valid` / `app-not-authorized`.

### 1.8 Play Integrity / reCAPTCHA
- **Android**: Firebase checks the app with Play Integrity; if that isn't possible (sideloaded APK) it opens a
  reCAPTCHA page in the browser. Both need the SHA fingerprints in 1.6. Enable the **Play Integrity API** for the
  project in Google Cloud console (APIs & Services → Library) — Firebase usually does this automatically.
- **Website**: the site uses Firebase's **invisible reCAPTCHA** (`RecaptchaVerifier` with `size: 'invisible'` on the
  `#firebase-recaptcha` element of the login and OTP pages). Nothing to configure beyond authorized domains. If
  you turn on **reCAPTCHA Enterprise** for phone auth in Firebase (Authentication → Settings → reCAPTCHA), add the
  domains there too.

---

## 2. BuildMate API (VPS backend)

The API trusts Firebase tokens whose audience is in `Firebase:ProjectId`:

| Setting | Value | Where |
|---|---|---|
| `Firebase:ProjectId` | `buildmate24x7` (comma-separated list allowed) | `appsettings.json` already has `buildmate24x7,buildmate-24x7`; docker: env `Firebase__ProjectId` (`FIREBASE_PROJECT_ID` in `.env`) |

How the token is checked (`api/src/BuildMate.Services/Auth/FirebaseAuth.cs`): signature against Google's public keys
(`securetoken@system.gserviceaccount.com`), issuer `https://securetoken.google.com/buildmate24x7`, audience
`buildmate24x7`, expiry, and the `phone_number` claim. The VPS must be able to reach `www.googleapis.com` over HTTPS.

Endpoints:
- `POST /api/auth/firebase` `{ idToken, audience?, name?, email?, partnerType? }` → BuildMate session, or
  `409 signup_required` for a new number (the site/app then asks for name + profession and calls again).
- `GET /api/auth/config` → `{ firebaseProjects, firebaseEnabled, smsOtpSendsSms }` — a quick set-up check, no secrets.

The API's own SMS OTP (`/api/auth/otp/request|verify`) is **not** used by the website or app in production. With
`Sms:Provider = Log` it never sent an SMS (the code only went to the server log); it now answers
`503 otp_sms_not_configured` outside development instead of pretending "OTP sent". The fixed code `123456` exists only
in the local **mock** API (`tools/mock-api`), never in the real API.

---

## 3. Website — production environment and rebuild

`NEXT_PUBLIC_*` values are **inlined into the JavaScript when the site is built** (`next build`). Setting them only
at runtime (systemd/pm2 env, docker `environment:`) has **no effect** — the site must be rebuilt after any change.

Required variables (website):
```
NEXT_PUBLIC_FIREBASE_API_KEY=<web apiKey from 1.5>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=buildmate24x7.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=buildmate24x7
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=buildmate24x7.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=384018735885
NEXT_PUBLIC_FIREBASE_APP_ID=1:384018735885:web:52cf804bbb61127d88c644
```
Must **not** be set in production: `NEXT_PUBLIC_AUTH_MODE` (only `otp` for local demos).

What the site does with them (`storefront/ui/firebase.ts`):
- all present → Firebase phone login (real SMS);
- missing in a production build → login shows "Phone login is not set up on this website yet" and the browser console
  logs `[BuildMate auth] NEXT_PUBLIC_FIREBASE_* were not set when this site was built` (before this fix it silently
  switched to the API's OTP, which sends no SMS);
- `NEXT_PUBLIC_AUTH_MODE=otp` → API OTP (local demo with the mock API only).

### 3.1 Rebuild and deploy on the VPS
**Take a backup and get approval first. These steps rebuild only the website; the database is not touched.**

Docker Compose (this repository's `docker-compose.yml`):
1. On the VPS, in the folder with `docker-compose.yml`, add the six `NEXT_PUBLIC_FIREBASE_*` lines and
   `FIREBASE_PROJECT_ID=buildmate24x7` to `.env` (see `.env.example`).
2. `docker compose build storefront` — the build now **fails on purpose** if the Firebase values are missing.
3. `docker compose up -d storefront` (and `docker compose up -d api` if you deployed the API changes).
4. `docker compose logs -f storefront api` — check for errors.

Without Docker (Node + pm2/systemd):
1. `cd storefront` and put the six variables in `.env.production.local` (or export them in the shell).
2. `npm ci && npm run build` (this is where they are inlined).
3. Restart the process: `pm2 restart <storefront-name>` or `systemctl restart <service>`.

Check after deploying: open https://buildmate24x7.com, DevTools → Network, reload, search the JS for
`buildmate24x7.firebaseapp.com` — it must be present.

### 3.2 HTTPS and the API address
- The site must be served over **HTTPS** (Firebase phone auth and reCAPTCHA require a secure origin; `localhost` is the
  only exception).
- The website calls the API through its own `/api/*` route, proxied to `API_URL` (set at build time; the compose file
  uses `http://api:8080`). So `idToken` goes browser → `https://buildmate24x7.com/api/auth/firebase` → API.
- The API's `Cors:Origins` must contain `https://buildmate24x7.com` (`SITE_URL` in `.env`) for any direct calls.

---

## 4. Android app — production build

1. `mobile/android/app/google-services.json` from 1.6 (package `com.buildmate.customerapp`, downloaded **after**
   adding fingerprints).
2. `mobile/production-api-url.txt` containing the live API address, e.g. `https://api.buildmate24x7.com`
   (whatever URL serves `/api/...` on the VPS; must be HTTPS).
3. For Play Store: `mobile/android/key.properties` + upload keystore (see `mobile/README.md` → Play Store release).
4. Double-click `mobile/build-apk.bat`.
   - With `production-api-url.txt` it builds **Firebase login only** and stops if `google-services.json` is missing —
     it never falls back to the demo OTP.
   - It writes the signing key's SHA-1/SHA-256 to `mobile/firebase-sha.txt` — add any new ones in Firebase (1.6),
     re-download `google-services.json`, and build again.
   - Output: `mobile/build/app/outputs/flutter-apk/app-release.apk`.

Manual command (equivalent):
```
flutter build apk --release --dart-define=API_URL=https://<live-api> --dart-define=AUTH_MODE=firebase
```

Code: `mobile/lib/core/phone_auth.dart` (Firebase `verifyPhoneNumber` → `signInWithCredential` → ID token),
`mobile/lib/data/providers.dart` (`POST /api/auth/firebase`). Firebase is initialised from `google-services.json` in
`mobile/lib/main.dart`; there is no API key in the Dart code.

---

## 5. Troubleshooting

Errors now show the Firebase code in brackets (app) or in the browser console as `[BuildMate auth] …` (website).

### Website
| Symptom / code | Cause | Fix |
|---|---|---|
| "Phone login is not set up on this website yet" | `NEXT_PUBLIC_FIREBASE_*` missing at build time | Section 3 — set them and **rebuild** |
| `auth/unauthorized-domain` | domain not in Authorized domains | 1.4 |
| `auth/captcha-check-failed`, `auth/invalid-app-credential` | reCAPTCHA failed — domain not authorized, ad blocker, or key restricted | 1.4, 1.7; try a private window without extensions |
| `auth/invalid-api-key`, `auth/api-key-not-valid…` | wrong key, or key restricted without this domain / Identity Toolkit API | 1.5, 1.7, rebuild |
| `auth/operation-not-allowed` | Phone provider off, or India blocked by SMS region policy | 1.1, 1.3 |
| `auth/billing-not-enabled` | Spark plan | 1.2 (or use test numbers) |
| `auth/too-many-requests`, `auth/quota-exceeded` | rate limits / daily SMS quota | wait; raise quota in billing |
| `auth/invalid-verification-code` | wrong code | — |
| `firebase_token_invalid` / `firebase_not_configured` from the API | API doesn't trust project `buildmate24x7`, server clock wrong, or VPS can't reach googleapis.com | Section 2; `GET /api/auth/config`; check VPS time (`timedatectl`) |
| OTP request goes to `/api/auth/otp/request` in production | old build without Firebase values | rebuild per section 3 |

### Android
| Symptom / code | Cause | Fix |
|---|---|---|
| "Phone login is not set up in this build" | APK built without `google-services.json` | 1.6, section 4 |
| `[app-not-authorized]`, `[invalid-app-credential]`, `[missing-client-identifier]` | SHA-1/SHA-256 of the signing key not in Firebase, or package mismatch | 1.6 — add fingerprints from `firebase-sha.txt`, re-download json, rebuild |
| Works from your PC build but not from Play Store | Play app-signing key fingerprints missing | 1.6 (Play Console → App integrity) |
| `[operation-not-allowed]` | Phone provider off / region policy | 1.1, 1.3 |
| `[billing-not-enabled]`, no SMS | Spark plan | 1.2 |
| `[quota-exceeded]`, `[too-many-requests]` | limits | wait / billing |
| Browser opens for a reCAPTCHA | normal for sideloaded APKs | — |
| Build fails "No matching client found for package name" | json is for another package | download the json of `com.buildmate.customerapp` (`build-apk.bat` renames a wrong one to `google-services.json.wrong-package`) |
| "server is taking too long" | API address wrong/unreachable | `production-api-url.txt` must be the live HTTPS API |

---

## 6. Production test checklist

Firebase Console
- [ ] Phone provider enabled (1.1)
- [ ] Blaze plan on, or test numbers added for now (1.2)
- [ ] SMS region policy allows India (1.3)
- [ ] `buildmate24x7.com` (+ `www.`) in Authorized domains (1.4)
- [ ] Web app exists; its config copied into the website env (1.5)
- [ ] Android app `com.buildmate.customerapp` has SHA-1 + SHA-256 for debug, release and Play signing keys (1.6)
- [ ] `google-services.json` re-downloaded after adding fingerprints (1.6)

VPS
- [ ] Backup taken; deployment approved
- [ ] Website rebuilt with the six `NEXT_PUBLIC_FIREBASE_*` values; no `NEXT_PUBLIC_AUTH_MODE` (3.1)
- [ ] `https://buildmate24x7.com` loads over HTTPS with a valid certificate (3.2)
- [ ] `GET https://<api>/api/auth/config` shows `"firebaseProjects":["buildmate24x7", …]` (2)
- [ ] API can reach `https://www.googleapis.com`; server time correct

Website
- [ ] Login → enter a real number → SMS arrives → enter code → signed in
- [ ] New number → sign-up steps → account created → appears in admin Customers/Partners
- [ ] Wrong code shows "That verification code is incorrect"
- [ ] Browser console has no `[BuildMate auth]` errors

Android (release APK, installed fresh)
- [ ] Built with `production-api-url.txt` + `google-services.json` (window shows "Login mode: firebase")
- [ ] SMS arrives (or auto-verifies) → signed in → home loads products from the live API
- [ ] Same number signs in on the website as the same account (same database)
- [ ] Logout / login again works

Clean-up before launch
- [ ] Test phone numbers removed in Firebase (1.2)
- [ ] `Otp:TestNumbers` empty in the API config
