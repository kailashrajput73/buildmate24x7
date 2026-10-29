/**
 * Mirrors Flutter `features/profile/domain/models/profile_models.dart`.
 *
 * Approved KYC sections (PAN / GST / Bank) are locked; any edit sends a
 * section back to `pending` for backend review.
 */

export type VerificationStatus = 'approved' | 'pending';

export const isLocked = (status: VerificationStatus) => status === 'approved';

export interface ProfileDocument {
  fileName: string;
  /** ISO date (yyyy-mm-dd). */
  uploadedOn: string;
  /** Object URL for a file picked this session (web only), for preview. */
  previewUrl?: string;
}

export interface PersonalInfo {
  fullName: string;
  /** Login identity — never editable from the profile page. */
  mobileNumber: string;
  email: string;
  address: string;
}

export interface PanDetails {
  panNumber: string;
  nameOnDocument: string;
  document: ProfileDocument;
  status: VerificationStatus;
}

export interface GstDetails {
  gstNumber: string;
  nameOnDocument: string;
  document: ProfileDocument;
  status: VerificationStatus;
}

export interface BankDetails {
  /** Stored masked (e.g. XXXXXXXX1234). */
  accountNumber: string;
  ifscCode: string;
  nameOnAccount: string;
  document: ProfileDocument;
  status: VerificationStatus;
}

export interface ProfileDetails {
  personal: PersonalInfo;
  pan: PanDetails;
  gst: GstDetails;
  bank: BankDetails;
}

export type KycSectionKey = 'pan' | 'gst' | 'bank';

export const hasPendingApproval = (d: ProfileDetails) =>
  [d.pan.status, d.gst.status, d.bank.status].includes('pending');

/** Flutter `maskAccountNumber` — `XXXXXXXX` + last 4 digits. */
export function maskAccountNumber(raw: string): string {
  const digits = raw.replace(/\s/g, '');
  if (digits.length <= 4) return digits;
  return `${'X'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}
