import { api, ApiError } from '@/lib/api';
import type { AuthResult } from '@/lib/types';

const PROOF_KEY = 'bm_phone_proof';

type Proof = { phone: string; code: string };
let memoryProof: Proof | null = null;

const digits10 = (mobile: string) => {
  const digits = mobile.replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
};

function saveProof(proof: Proof | null) {
  memoryProof = proof;
  try {
    if (proof) sessionStorage.setItem(PROOF_KEY, JSON.stringify(proof));
    else sessionStorage.removeItem(PROOF_KEY);
  } catch {
    // The in-memory copy still supports the current page session.
  }
}

function loadProof(): Proof | null {
  try {
    const stored = JSON.parse(sessionStorage.getItem(PROOF_KEY) ?? 'null') as Partial<Proof> | null;
    if (typeof stored?.phone === 'string' && typeof stored.code === 'string') return stored as Proof;
    return memoryProof;
  } catch {
    return memoryProof;
  }
}

export async function sendPhoneOtp(mobileNumber: string): Promise<void> {
  const phone = digits10(mobileNumber);
  if (!/^[6-9]\d{9}$/.test(phone)) {
    throw Object.assign(new Error('Enter a valid 10-digit mobile number.'), { code: 'invalid_phone' });
  }
  saveProof(null);
  await api('/api/auth/otp/request', { method: 'POST', body: { phone } });
}

export async function confirmPhoneOtp(code: string, mobileNumber: string): Promise<void> {
  const phone = digits10(mobileNumber);
  if (!/^[6-9]\d{9}$/.test(phone)) throw new Error('Enter a valid 10-digit mobile number.');
  if (!/^\d{6}$/.test(code.trim())) throw new Error('Enter the 6-digit verification code.');
  saveProof({ phone, code: code.trim() });
}

export type SignupDetails = {
  audience: 'Partner' | 'Customer';
  name?: string;
  email?: string;
  partnerType?: 'Plumber' | 'Electrician' | 'Contractor' | 'Builder' | 'Flooring' | 'Other';
  referralCode?: string;
};

const REF_KEY = 'bm_referral_code';

export function rememberReferral(code: string | null) {
  const normalized = code?.trim().toUpperCase();
  if (!normalized || !/^[A-Z0-9]{4,12}$/.test(normalized)) return;
  try {
    sessionStorage.setItem(REF_KEY, normalized);
  } catch {
    // Referral codes are optional when browser storage is unavailable.
  }
}

export function rememberedReferral(): string {
  try {
    return sessionStorage.getItem(REF_KEY) ?? '';
  } catch {
    return '';
  }
}

export async function signInWithVerifiedPhone(signup?: SignupDetails): Promise<AuthResult> {
  const proof = loadProof();
  if (!proof) throw new ApiError(401, 'Please verify your mobile number again.', 'proof_missing');

  const result = await api<AuthResult>('/api/auth/otp/verify', {
    method: 'POST',
    body: { phone: proof.phone, code: proof.code, ...signup },
  });
  saveProof(null);
  return result;
}

export const hasVerifiedPhone = () => loadProof() !== null;
export const verifiedPhone = () => loadProof()?.phone ?? null;

export function phoneAuthMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  switch (code) {
    case 'invalid_phone':
      return 'Enter a valid mobile number.';
    case 'otp_invalid':
      return 'That verification code is incorrect. Check it and try again.';
    case 'otp_expired':
      return 'That verification code has expired. Request a new code.';
    case 'otp_rate_limited':
    case 'otp_cooldown':
      return 'Too many attempts. Wait a while before trying again.';
    case 'otp_sms_not_configured':
      return 'Phone login is not configured on the server yet. Please contact BuildMate support.';
    default:
      if (error instanceof Error && error.message) return error.message;
      return 'Phone verification failed. Please try again.';
  }
}
