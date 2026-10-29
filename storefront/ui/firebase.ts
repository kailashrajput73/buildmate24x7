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

/**
 * Firebase phone OTP is used when configured. Without it (local demo with the mock API) the site falls back to the
 * API's own OTP (code 123456 on the mock). NEXT_PUBLIC_AUTH_MODE=otp forces the fallback.
 */
export const isFirebaseConfigured =
  process.env.NEXT_PUBLIC_AUTH_MODE !== 'otp' &&
  [firebaseConfig.apiKey, firebaseConfig.authDomain, firebaseConfig.projectId, firebaseConfig.appId].every(Boolean);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;

/** Browser-only; never called during server rendering. */
export function firebaseAuth(): Auth {
  if (!isFirebaseConfigured) throw new Error('Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* in .env.local.');
  if (!authInstance) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    authInstance = getAuth(app);
  }
  return authInstance;
}
