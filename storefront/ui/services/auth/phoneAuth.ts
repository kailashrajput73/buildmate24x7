import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  type ConfirmationResult,
} from 'firebase/auth';
import { api, ApiError } from '@/lib/api';
import type { AuthResult } from '@/lib/types';
import { firebaseAuth, isFirebaseConfigured } from '../../firebase';

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

export async function sendPhoneOtp(mobileNumber: string): Promise<void> {
  const phone = digits10(mobileNumber);
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
  if (!confirmationResult) throw new Error('Request a verification code before entering an OTP.');
  await confirmationResult.confirm(code);
  confirmationResult = null;
  saveProof({ kind: 'firebase', phone });
}

export type SignupDetails = {
  audience: 'Partner' | 'Customer';
  name?: string;
  email?: string;
  partnerType?: 'Plumber' | 'Electrician' | 'Contractor' | 'Builder' | 'Flooring' | 'Other';
};

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
    default:
      if (error instanceof Error && error.message) return error.message;
      return 'Phone verification failed. Please try again.';
  }
}
