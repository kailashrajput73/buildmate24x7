import { api, apiUpload } from '@/lib/api';
import type { AuthUser, Address } from '@/lib/types';
import type { ProfileDocument, VerificationStatus } from './profileModels';

type KycDocType = 'Aadhaar' | 'Pan' | 'Gst' | 'ShopPhoto' | 'Selfie' | 'Other';

interface KycDocument { id: number; documentType: KycDocType; documentNumberMasked?: string | null; fileKey: string; uploadedAt: string }

/** GET /api/partner/profile (PartnerDetailDto, the fields the profile page uses). */
export interface PartnerDetail {
  userId: number; name: string; phone?: string | null; email?: string | null;
  partnerType: string; businessName?: string | null; addressLine?: string | null; area?: string | null; city?: string | null;
  state?: string | null; pincode?: string | null; latitude?: number | null; longitude?: number | null; gstin?: string | null;
  kycStatus: 'NotSubmitted' | 'Pending' | 'Approved' | 'Rejected'; kycRemarks?: string | null; rewardBalance: number;
  documents: KycDocument[];
}

export interface KycSection {
  number: string;
  document?: ProfileDocument;
  /** Undefined until something is submitted; approved once the partner's KYC is approved. */
  status?: VerificationStatus;
}

export interface BuildMateProfile {
  isPartner: boolean;
  personal: { fullName: string; mobileNumber: string; email: string; businessName: string; address: string };
  aadhaar: KycSection;
  pan: KycSection;
  gst: KycSection;
  kycStatus?: PartnerDetail['kycStatus'];
  kycRemarks?: string | null;
  rewardBalance: number;
  partner?: PartnerDetail;
}

const docOf = (d?: KycDocument): ProfileDocument | undefined =>
  d ? { fileName: `${d.documentType === 'Pan' ? 'PAN' : d.documentType === 'Gst' ? 'GST certificate' : d.documentType} document`, uploadedOn: d.uploadedAt.slice(0, 10) } : undefined;

const latest = (p: PartnerDetail, type: KycDocType) =>
  [...(p.documents ?? [])].filter((d) => d.documentType === type).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))[0];

const statusOf = (p: PartnerDetail, present: boolean): VerificationStatus | undefined =>
  !present ? undefined : p.kycStatus === 'Approved' ? 'approved' : 'pending';

const joinAddress = (...parts: (string | null | undefined)[]) => parts.filter((x) => x && x.trim()).join(', ');

export async function loadProfile(account: AuthUser): Promise<BuildMateProfile> {
  const phone = account.phone ? `+91 ${account.phone}` : '';
  if (account.userType !== 'Partner') {
    const addresses = await api<Address[]>('/api/account/addresses').catch(() => [] as Address[]);
    const a = addresses.find((x) => x.isDefault) ?? addresses[0];
    return {
      isPartner: false,
      personal: {
        fullName: account.name ?? '', mobileNumber: phone, email: account.email ?? '', businessName: '',
        address: a ? joinAddress(a.line1, a.line2, a.landmark, a.city, a.pincode) : '',
      },
      aadhaar: { number: '' }, pan: { number: '' }, gst: { number: '' }, rewardBalance: 0,
    };
  }
  const p = await api<PartnerDetail>('/api/partner/profile');
  const aadhaar = latest(p, 'Aadhaar');
  const pan = latest(p, 'Pan');
  const gst = latest(p, 'Gst');
  return {
    isPartner: true,
    personal: {
      fullName: p.name ?? '', mobileNumber: phone, email: p.email ?? '', businessName: p.businessName ?? '',
      address: joinAddress(p.addressLine, p.area, p.city, p.pincode),
    },
    aadhaar: { number: aadhaar?.documentNumberMasked ?? '', document: docOf(aadhaar), status: statusOf(p, !!aadhaar) },
    pan: { number: pan?.documentNumberMasked ?? '', document: docOf(pan), status: statusOf(p, !!pan) },
    gst: { number: p.gstin ?? gst?.documentNumberMasked ?? '', document: docOf(gst), status: statusOf(p, !!(p.gstin || gst)) },
    kycStatus: p.kycStatus,
    kycRemarks: p.kycRemarks,
    rewardBalance: p.rewardBalance ?? 0,
    partner: p,
  };
}

/** Saves name / email (and for partners business name, address and GSTIN) without touching the rest of the profile. */
export async function savePersonal(profile: BuildMateProfile, v: { fullName: string; email: string; businessName?: string; address?: string; gstin?: string }) {
  if (!profile.isPartner || !profile.partner) {
    await api('/api/account/profile', { method: 'PUT', body: { name: v.fullName, email: v.email || null } });
    return;
  }
  const p = profile.partner;
  const addressChanged = v.address !== undefined && v.address !== profile.personal.address;
  await api('/api/partner/profile', {
    method: 'PUT',
    body: {
      name: v.fullName, partnerType: p.partnerType, businessName: (v.businessName ?? p.businessName) || null,
      // A free-text address replaces the street line; area / city / pincode stay as set at sign-up.
      addressLine: addressChanged ? v.address : p.addressLine ?? null, area: addressChanged ? null : p.area ?? null,
      city: p.city ?? null, state: p.state ?? null, pincode: p.pincode ?? null, latitude: p.latitude ?? null, longitude: p.longitude ?? null,
      gstin: v.gstin !== undefined ? v.gstin || null : p.gstin ?? null, email: v.email || null, preferredLanguage: null,
    },
  });
}

/** Uploads one KYC document and sends the partner's KYC for review. */
export async function uploadKyc(type: KycDocType, number: string, file: File) {
  const form = new FormData();
  form.append('type', type);
  if (number) form.append('number', number);
  form.append('file', file);
  await apiUpload('/api/partner/kyc/documents', form);
  await api('/api/partner/kyc/submit', { method: 'POST' });
}

/** Refreshes the signed-in user (name, email, KYC status) so the header and checkout see the change. */
export async function refreshSessionUser() {
  const { session } = await import('@/lib/api');
  const s = session.get();
  if (!s) return;
  const user = await api<AuthUser>('/api/auth/me');
  session.set({ ...s, user });
}
