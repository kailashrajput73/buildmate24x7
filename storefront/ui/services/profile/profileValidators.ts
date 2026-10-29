/** Mirrors Flutter `ProfileValidators` (profile_models.dart). */

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GST = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT = /^[0-9]{9,18}$/;
const AADHAAR = /^[2-9][0-9]{11}$/;

export type Validator = (value: string) => string | null;

export const required =
  (label: string): Validator =>
  (v) =>
    v.trim() === '' ? `${label} is required` : null;

const withPattern =
  (label: string, pattern: RegExp, message: string, upper = false): Validator =>
  (v) =>
    required(label)(v) ??
    (pattern.test(upper ? v.trim().toUpperCase() : v.trim()) ? null : message);

export const profileValidators = {
  fullName: required('Full name'),
  email: withPattern('Email address', EMAIL, 'Enter a valid email address'),
  address: required('Address'),
  pan: withPattern('PAN number', PAN, 'Enter a valid PAN (e.g. ABCDE1234F)', true),
  gst: withPattern('GST number', GST, 'Enter a valid 15-character GSTIN', true),
  ifsc: withPattern('IFSC code', IFSC, 'Enter a valid IFSC (e.g. HDFC0001234)', true),
  accountNumber: withPattern('Account number', ACCOUNT, 'Enter 9–18 digits'),
  name: required('Name'),
  aadhaar: withPattern('Aadhaar number', AADHAAR, 'Enter the 12-digit Aadhaar number'),
  /** Email is optional on BuildMate accounts. */
  optionalEmail: (v: string) => (v.trim() === '' || EMAIL.test(v.trim()) ? null : 'Enter a valid email address'),
  /** GSTIN is optional — many trade partners are not GST registered. */
  optionalGst: (v: string) => (v.trim() === '' || GST.test(v.trim().toUpperCase()) ? null : 'Enter a valid 15-character GSTIN'),
} satisfies Record<string, Validator>;

export type ProfileValidatorKey = keyof typeof profileValidators;
