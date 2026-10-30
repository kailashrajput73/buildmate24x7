import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

/** Firebase web config (public values, not secrets) — set NEXT_PUBLIC_FIREBASE_* in .env.local. */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ?? '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() ?? '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ?? '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() ?? '',
};

const hasFirebaseConfig = [firebaseConfig.apiKey, firebaseConfig.authDomain, firebaseConfig.projectId, firebaseConfig.appId].every(Boolean);

/**
 * Which phone login the site uses.
 * - "firebase": Firebase phone auth (real SMS) — the only mode for production.
 * - "otp": the API's own OTP. Only when NEXT_PUBLIC_AUTH_MODE=otp is set explicitly (local demo with the mock API),
 *   or in `next dev` without Firebase settings. A production build never falls back to it silently.
 * - "missing": production build without the NEXT_PUBLIC_FIREBASE_* values — login shows a clear set-up error.
 *   NEXT_PUBLIC_* values are inlined by `next build`, so they must be present when the site is BUILT.
 */
export const authMode: 'firebase' | 'otp' | 'missing' =
  process.env.NEXT_PUBLIC_AUTH_MODE === 'otp'
    ? 'otp'
    : hasFirebaseConfig
      ? 'firebase'
      : process.env.NODE_ENV === 'production'
        ? 'missing'
        : 'otp';

export const isFirebaseConfigured = authMode === 'firebase';

/** Public project id the site was built with (for diagnostics; not a secret). */
export const firebaseProjectId = firebaseConfig.projectId;

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;

/** Browser-only; never called during server rendering. */
export function firebaseAuth(): Auth {
  if (!isFirebaseConfigured) throw new Error('Phone login is not set up on this website yet (Firebase settings missing). Please contact BuildMate support.');
  if (!authInstance) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    authInstance = getAuth(app);
  }
  return authInstance;
}
