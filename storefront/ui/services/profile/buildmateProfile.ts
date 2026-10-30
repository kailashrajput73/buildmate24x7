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

/** GET /api/account/kyc — KYC of the signed-in customer or partner. */
interface MyKyc {
  userType: string; status: PartnerDetail['kycStatus']; remarks?: string | null; submittedAt?: string | null;
  gstin?: string | null; documents: KycDocument[];
}

export async function loadProfile(account: AuthUser): Promise<BuildMateProfile> {
  const phone = account.phone ? `+91 ${account.phone}` : '';
  if (account.userType !== 'Partner') {
    // Customers have KYC and reward points too (customer profile on the API).
    const [addresses, kyc, rewards] = await Promise.all([
      api<Address[]>('/api/account/addresses').catch(() => [] as Address[]),
      api<MyKyc>('/api/account/kyc').catch(() => null),
      api<{ balance: number }>('/api/account/rewards').catch(() => null),
    ]);
    const a = addresses.find((x) => x.isDefault) ?? addresses[0];
    const k: PartnerDetail = {
      userId: account.id, name: account.name ?? '', partnerType: '', kycStatus: kyc?.status ?? 'NotSubmitted',
      kycRemarks: kyc?.remarks ?? null, rewardBalance: rewards?.balance ?? 0, gstin: kyc?.gstin ?? null, documents: kyc?.documents ?? [],
    };
    const aadhaar = latest(k, 'Aadhaar');
    const pan = latest(k, 'Pan');
    const gst = latest(k, 'Gst');
    return {
      isPartner: false,
      personal: {
        fullName: account.name ?? '', mobileNumber: phone, email: account.email ?? '', businessName: '',
        address: a ? joinAddress(a.line1, a.line2, a.landmark, a.city, a.pincode) : '',
      },
      aadhaar: { number: aadhaar?.documentNumberMasked ?? '', document: docOf(aadhaar), status: statusOf(k, !!aadhaar) },
      pan: { number: pan?.documentNumberMasked ?? '', document: docOf(pan), status: statusOf(k, !!pan) },
      gst: { number: k.gstin ?? gst?.documentNumberMasked ?? '', document: docOf(gst), status: statusOf(k, !!(k.gstin || gst)) },
      kycStatus: k.kycStatus,
      kycRemarks: k.kycRemarks,
      rewardBalance: k.rewardBalance,
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

/** Uploads one KYC document and sends the KYC for review (customers and partners; same endpoints). */
export async function uploadKyc(type: KycDocType, number: string, file: File, gstin?: string) {
  const form = new FormData();
  form.append('type', type);
  if (number) form.append('number', number);
  form.append('file', file);
  await apiUpload('/api/account/kyc/documents', form);
  try {
    await api('/api/account/kyc/submit', { method: 'POST', body: { gstin: gstin || null } });
  } catch (e) {
    // A GST certificate alone is saved; the KYC goes for review once Aadhaar or PAN is uploaded too.
    if (type === 'Gst' && e instanceof Error && /Aadhaar or PAN/i.test(e.message)) return;
    throw e;
  }
}

/** GET /api/account/referral — the user's Refer & Earn code (created on first request). */
export interface Referral {
  code: string; referredCount: number; pointsEarned: number; referrerPoints: number; welcomePoints: number; referredByName?: string | null;
}
export const loadReferral = () => api<Referral>('/api/account/referral');

/** Refreshes the signed-in user (name, email, KYC status) so the header and checkout see the change. */
export async function refreshSessionUser() {
  const { session } = await import('@/lib/api');
  const s = session.get();
  if (!s) return;
  const user = await api<AuthUser>('/api/auth/me');
  session.set({ ...s, user });
}
