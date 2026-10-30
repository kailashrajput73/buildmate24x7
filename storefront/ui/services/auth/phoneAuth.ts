import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  type ConfirmationResult,
} from 'firebase/auth';
import { api, ApiError } from '@/lib/api';
import type { AuthResult } from '@/lib/types';
import { authMode, firebaseAuth, firebaseProjectId, isFirebaseConfigured } from '../../firebase';

/**
 * Phone sign-in for the website. Firebase sends and checks the OTP; the BuildMate API then turns the verified number
 * into a BuildMate session (POST /api/auth/firebase). Without Firebase (local demo) the API's own OTP is used.
 *
 * Proof of the verified number is kept for the rest of the sign-up steps (details → location → profession), because
 * the account is only created at the end, when we know whether it's a partner or a customer.
 */
const RECAPTCHA_CONTAINER_ID = 'firebase-recaptcha';
const PROOF_KEY = 'bm_phone_proof';

let confirmationResult: ConfirmationResult | null = null;
let recaptchaVerifier: RecaptchaVerifier | null = null;

type Proof = { kind: 'firebase'; phone: string } | { kind: 'otp'; phone: string; code: string };

const digits10 = (mobile: string) => {
  const d = mobile.replace(/\D/g, '');
  return d.length === 12 && d.startsWith('91') ? d.slice(2) : d;
};

function clearRecaptcha() {
  recaptchaVerifier?.clear();
  recaptchaVerifier = null;
}

function saveProof(p: Proof | null) {
  try {
    if (p) sessionStorage.setItem(PROOF_KEY, JSON.stringify(p));
    else sessionStorage.removeItem(PROOF_KEY);
  } catch { /* in-memory only */ }
}
function loadProof(): Proof | null {
  try { return JSON.parse(sessionStorage.getItem(PROOF_KEY) ?? 'null'); } catch { return null; }
}

const SETUP_MISSING = 'Phone login is not set up on this website yet (Firebase settings missing). Please contact BuildMate support.';

export async function sendPhoneOtp(mobileNumber: string): Promise<void> {
  const phone = digits10(mobileNumber);
  if (!/^[6-9]\d{9}$/.test(phone)) throw Object.assign(new Error('Enter a valid 10-digit mobile number.'), { code: 'auth/invalid-phone-number' });
  if (authMode === 'missing') {
    console.error('[BuildMate auth] NEXT_PUBLIC_FIREBASE_* were not set when this site was built. See FIREBASE_SETUP.md.');
    throw new Error(SETUP_MISSING);
  }
  if (!isFirebaseConfigured) {
    await api('/api/auth/otp/request', { method: 'POST', body: { phone } });
    return;
  }
  clearRecaptcha();
  if (!document.getElementById(RECAPTCHA_CONTAINER_ID)) {
    throw new Error('Phone verification could not start. Reload the page and try again.');
  }
  const auth = firebaseAuth();
  recaptchaVerifier = new RecaptchaVerifier(auth, RECAPTCHA_CONTAINER_ID, { size: 'invisible' });
  try {
    confirmationResult = await signInWithPhoneNumber(auth, `+91${phone}`, recaptchaVerifier);
  } catch (e) {
    // Logged with the Firebase code so set-up problems (domain, billing, API key) are visible in the browser console.
    console.error('[BuildMate auth] signInWithPhoneNumber failed', { project: firebaseProjectId, host: location.host, code: (e as { code?: string })?.code, error: e });
    throw e;
  } finally {
    clearRecaptcha();
  }
}

/** Checks the code. Firebase verifies it immediately; the API fallback verifies it when we sign in. */
export async function confirmPhoneOtp(code: string, mobileNumber: string): Promise<void> {
  const phone = digits10(mobileNumber);
  if (!isFirebaseConfigured) {
    saveProof({ kind: 'otp', phone, code });
    return;
  }
  if (authMode === 'missing') throw new Error(SETUP_MISSING);
  if (!confirmationResult) throw new Error('Request a verification code before entering an OTP.');
  try {
    await confirmationResult.confirm(code.trim());
  } catch (e) {
    console.error('[BuildMate auth] OTP confirm failed', { code: (e as { code?: string })?.code, error: e });
    throw e;
  }
  confirmationResult = null;
  saveProof({ kind: 'firebase', phone });
}

export type SignupDetails = {
  audience: 'Partner' | 'Customer';
  name?: string;
  email?: string;
  partnerType?: 'Plumber' | 'Electrician' | 'Contractor' | 'Builder' | 'Flooring' | 'Other';
  /** Refer & Earn code; used by the API only when the account is created. */
  referralCode?: string;
};

const REF_KEY = 'bm_referral_code';
/** Keeps a code from an invite link (/login?ref=CODE) until sign-up. */
export function rememberReferral(code: string | null) {
  const c = code?.trim().toUpperCase();
  if (!c || !/^[A-Z0-9]{4,12}$/.test(c)) return;
  try { sessionStorage.setItem(REF_KEY, c); } catch { /* ignore */ }
}
export function rememberedReferral(): string {
  try { return sessionStorage.getItem(REF_KEY) ?? ''; } catch { return ''; }
}

/**
 * Signs in to BuildMate with the verified number. Without signup details an existing account is used; a new number
 * throws ApiError with code "signup_required" so the sign-up steps can run.
 */
export async function signInWithVerifiedPhone(signup?: SignupDetails): Promise<AuthResult> {
  const proof = loadProof();
  if (!proof) throw new ApiError(401, 'Please verify your mobile number again.', 'proof_missing');
  let result: AuthResult;
  if (proof.kind === 'firebase') {
    const user = firebaseAuth().currentUser;
    if (!user) throw new ApiError(401, 'Your verification expired. Please verify your number again.', 'proof_missing');
    const idToken = await user.getIdToken();
    result = await api<AuthResult>('/api/auth/firebase', { method: 'POST', body: { idToken, ...signup } });
  } else {
    result = await api<AuthResult>('/api/auth/otp/verify', { method: 'POST', body: { phone: proof.phone, code: proof.code, ...signup } });
  }
  saveProof(null);
  // The BuildMate session is all the site needs from here on.
  if (proof.kind === 'firebase') await signOut(firebaseAuth()).catch(() => undefined);
  return result;
}

export const hasVerifiedPhone = () => loadProof() !== null;
export const verifiedPhone = () => loadProof()?.phone ?? null;

export function firebaseAuthMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  switch (code) {
    case 'auth/invalid-phone-number':
      return 'Enter a valid mobile number.';
    case 'auth/invalid-verification-code':
    case 'otp_invalid':
      return 'That verification code is incorrect. Check it and try again.';
    case 'auth/code-expired':
    case 'auth/session-expired':
    case 'auth/invalid-verification-id':
    case 'otp_expired':
      return 'That verification code has expired. Request a new code.';
    case 'auth/too-many-requests':
    case 'auth/quota-exceeded':
    case 'otp_rate_limited':
      return 'Too many attempts. Wait a while before trying again.';
    case 'auth/operation-not-allowed':
      return 'Phone sign-in is not enabled for this Firebase project.';
    case 'auth/invalid-app-credential':
    case 'auth/captcha-check-failed':
      return 'App verification failed. Check the Firebase authorized domains and try again.';
    case 'auth/billing-not-enabled':
      return 'Firebase phone authentication requires billing to be enabled for this project.';
    case 'auth/unauthorized-domain':
      return `This website address (${typeof location !== 'undefined' ? location.hostname : 'domain'}) is not allowed in Firebase yet. Add it under Authentication → Settings → Authorized domains.`;
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
      return 'The website\'s Firebase API key is wrong. Check NEXT_PUBLIC_FIREBASE_API_KEY and rebuild the site.';
    case 'auth/network-request-failed':
      return 'No internet connection. Check your network and try again.';
    case 'auth/missing-phone-number':
      return 'Enter your mobile number.';
    case 'firebase_token_invalid':
    case 'firebase_token_expired':
      return 'We could not confirm your sign-in with the server. Please verify your number again.';
    case 'firebase_not_configured':
      return 'Phone login is not set up on the server yet. Please contact BuildMate support.';
    default:
      if (error instanceof Error && error.message) return code ? `${error.message}` : error.message;
      return code ? `Phone verification failed (${code}). Please try again.` : 'Phone verification failed. Please try again.';
  }
}
