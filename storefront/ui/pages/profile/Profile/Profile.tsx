import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from '@/ui/router';
import { useTheme } from 'styled-components';
import { api } from '@/lib/api';
import { AppRoutes } from '../../../routes/appRoutes';
import { useSession } from '../../../session/SessionContext';
import { loadProfile, refreshSessionUser, savePersonal as savePersonalApi, uploadKyc } from '../../../services/profile/buildmateProfile';
import { ReferCard } from './ReferCard';
import type { BuildMateProfile } from '../../../services/profile/buildmateProfile';
import type { ProfileDocument } from '../../../services/profile/profileModels';
import { profileValidators as v } from '../../../services/profile/profileValidators';
import { CircularProgress } from '../../../shared/CircularProgress';
import { SnackBar } from '../../../shared/SnackBar';
import { StorefrontHeader } from '../../../shared/StorefrontHeader';
import { userInitials } from '../../../shared/userInitials';
import { ProfileSection } from './ProfileSection';
import type { SectionValues } from './ProfileSection';
import mock from './Profile.mock.json';
import {
  Screen,
  Root,
  MobileHeader,
  MobileBack,
  HeaderRow,
  Avatar,
  HeaderTitle,
  HeaderSubtitle,
  Page,
  WebHead,
  WebHeadMain,
  BackLink,
  WebTitle,
  WebSubtitle,
  Banner,
  Sections,
  AccountTitle,
  AccountRow,
  AccountTile,
  AccountText,
  Loading,
} from './Profile.styles';

const { _sections, _fields, _snack, _buttons, _account } = mock;

type SectionKey = keyof typeof _sections;

function ApprovalBanner({ placement }: { placement: 'mobile' | 'web' }) {
  return (
    <Banner $placement={placement} role="note">
      <i className="pi pi-info-circle" aria-hidden />
      <span>
        <strong>{mock._approvalBanner.title}</strong> {mock._approvalBanner.body}
      </span>
    </Banner>
  );
}

interface ProfileContentProps {
  /** True for the standalone `/profile` route (back button); false in the shell tab. */
  showBack?: boolean;
}

/**
 * Flutter `ProfileTabBody` — personal info + PAN / GST / Bank KYC sections.
 * Mobile mirrors the Flutter card list; web (≥ md) shows boxed fields in a
 * grid with inline editing. Approved sections are locked, and saving a KYC
 * section sends it back for approval.
 */
export function ProfileContent({ showBack = false }: ProfileContentProps) {
  const navigate = useNavigate();
  const theme = useTheme();
  const { user, account, ready, isLoggedIn, logout } = useSession();
  const [details, setDetails] = useState<BuildMateProfile | null>(null);
  const [editing, setEditing] = useState<SectionKey | null>(null);
  const [snack, setSnack] = useState<{ id: number; message: string } | null>(null);

  const showSnack = (message: string) =>
    setSnack((previous) => ({ id: (previous?.id ?? 0) + 1, message }));
  const hideSnack = useCallback(() => setSnack(null), []);

  useEffect(() => {
    if (ready && !isLoggedIn) navigate(`${AppRoutes.login}?next=/account`, { replace: true });
  }, [ready, isLoggedIn, navigate]);

  const reload = useCallback(async () => {
    if (!account) return;
    try {
      setDetails(await loadProfile(account));
    } catch (e) {
      setSnack({ id: Date.now(), message: e instanceof Error ? e.message : 'Could not load your profile' });
    }
  }, [account?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void reload(); }, [reload]);

  const goBack = () => navigate(-1);

  const signOut = async () => {
    try {
      await logout();
      navigate(AppRoutes.login, { replace: true });
    } catch {
      showSnack('Could not sign out. Please try again.');
    }
  };

  const preview = (document: ProfileDocument) => {
    if (document.previewUrl) window.open(document.previewUrl, '_blank', 'noopener');
    else showSnack('Uploaded documents are kept private. The store team can view them.');
  };

  const lockedSnack = (key: SectionKey) => () =>
    showSnack(`${_sections[key].snackName}${_snack.lockedSuffix}`);

  /** Runs a save; errors are shown and the form stays open. */
  const attempt = async (run: () => Promise<void>, message: string) => {
    try {
      await run();
      await reload();
      setEditing(null);
      showSnack(message);
    } catch (e) {
      showSnack(e instanceof Error ? e.message : 'Could not save. Please try again.');
    }
  };

  const savePersonal = (values: SectionValues) =>
    attempt(async () => {
      if (!details) return;
      await savePersonalApi(details, {
        fullName: values.fullName,
        email: values.email,
        businessName: details.isPartner ? values.businessName : undefined,
        address: details.isPartner ? values.address : undefined,
      });
      await refreshSessionUser().catch(() => undefined);
    }, _snack.personalSaved);

  const saveKyc = (key: 'aadhaar' | 'pan', type: 'Aadhaar' | 'Pan') => (values: SectionValues, file: File | null) =>
    attempt(async () => {
      if (!file) throw new Error('Attach a photo or PDF of the document.');
      await uploadKyc(type, values.number, file);
      await refreshSessionUser().catch(() => undefined);
    }, `${_sections[key].snackName}${_snack.kycSubmittedSuffix}`);

  const saveGst = (values: SectionValues, file: File | null) =>
    attempt(async () => {
      if (!details) return;
      const gstin = values.number.toUpperCase();
      if (details.isPartner) {
        await savePersonalApi(details, { fullName: details.personal.fullName, email: details.personal.email, gstin });
        if (file) await uploadKyc('Gst', gstin, file);
      } else {
        // Customers keep the GSTIN with their KYC; it needs the certificate.
        if (!file) throw new Error('Attach your GST certificate.');
        await uploadKyc('Gst', gstin, file, gstin);
      }
    }, `${_sections.gst.snackName} saved`);

  const sectionProps = (key: SectionKey) => ({
    icon: _sections[key].icon,
    title: _sections[key].title,
    subtitle: _sections[key].subtitle,
    editing: editing === key,
    onEdit: () => setEditing(key),
    onCancel: () => setEditing(null),
    onLocked: lockedSnack(key),
    onPreview: preview,
  });

  const deleteAccount = async () => {
    if (!window.confirm('Delete your account? Your order history is kept for GST records, but your name, phone and addresses are removed. This cannot be undone.')) return;
    try {
      await api('/api/account', { method: 'DELETE' });
      await logout().catch(() => undefined);
      window.location.href = '/';
    } catch (e) {
      showSnack(e instanceof Error ? e.message : 'Could not delete the account');
    }
  };

  const pending = details?.kycStatus === 'Pending';
  const balance = Math.round(details?.rewardBalance ?? 0);
  const initials = userInitials(user.name);

  return (
    <Root>
      <MobileHeader>
        {showBack && (
          <MobileBack type="button" aria-label={mock._backLabel} onClick={goBack}>
            <i className="pi pi-chevron-left" aria-hidden />
          </MobileBack>
        )}
        <HeaderRow>
          <Avatar>
            {initials}
          </Avatar>
          <div>
            <HeaderTitle>{mock._title}</HeaderTitle>
            <HeaderSubtitle>{mock._subtitle}</HeaderSubtitle>
          </div>
        </HeaderRow>
      </MobileHeader>

      <Page>
        <WebHead>
          <div>
            {showBack && (
              <BackLink type="button" onClick={goBack}>
                <i className="pi pi-arrow-left" aria-hidden />
                {mock._backLabel}
              </BackLink>
            )}
            <WebHeadMain>
              <Avatar $wide>
                {initials}
              </Avatar>
              <div>
                <WebTitle>{mock._title}</WebTitle>
                <WebSubtitle>{mock._webSubtitle}</WebSubtitle>
              </div>
            </WebHeadMain>
          </div>
          {pending && <ApprovalBanner placement="web" />}
        </WebHead>

        {!details ? (
          <Loading>
            <CircularProgress size={32} color={theme.colors.primary} />
          </Loading>
        ) : (
          <>
            {pending && <ApprovalBanner placement="mobile" />}
            {details.kycStatus === 'Rejected' && (
              <Banner $placement="mobile" role="alert" style={{ display: 'flex' }}>
                <i className="pi pi-exclamation-triangle" aria-hidden />
                <span><strong>KYC needs attention.</strong> {details.kycRemarks ?? 'Please upload a clearer document.'}</span>
              </Banner>
            )}

            <Sections>
              <ProfileSection
                {...sectionProps('personal')}
                cols={2}
                fields={[
                  { key: 'fullName', label: _fields.fullName, value: details.personal.fullName, validator: v.fullName },
                  { key: 'mobileNumber', label: _fields.mobileNumber, value: details.personal.mobileNumber, readOnly: true },
                  { key: 'email', label: _fields.email, value: details.personal.email, validator: v.optionalEmail, type: 'email', inputMode: 'email' },
                  ...(details.isPartner
                    ? [
                        { key: 'businessName', label: 'Business / firm name', value: details.personal.businessName },
                        { key: 'address', label: _fields.address, value: details.personal.address, validator: v.address, multiline: true },
                      ]
                    : [{ key: 'address', label: 'Default delivery address', value: details.personal.address || 'Add one at checkout', readOnly: true, multiline: true }]),
                ]}
                onSave={savePersonal}
              />

              {/* KYC for every account: customers and partners (same /api/account/kyc endpoints). */}
              {(
                <>
                  <ProfileSection
                    {...sectionProps('aadhaar')}
                    status={details.aadhaar.status}
                    cols={2}
                    document={details.aadhaar.document}
                    fields={[{
                      key: 'number', label: 'Aadhaar Number', value: details.aadhaar.number, validator: v.aadhaar, digitsOnly: true,
                      inputMode: 'numeric', maxLength: 12, editInitial: '', placeholder: details.aadhaar.number || '12-digit number',
                    }]}
                    onSave={saveKyc('aadhaar', 'Aadhaar')}
                  />
                  <ProfileSection
                    {...sectionProps('pan')}
                    status={details.pan.status}
                    cols={2}
                    document={details.pan.document}
                    fields={[{
                      key: 'number', label: _fields.panNumber, value: details.pan.number, validator: v.pan, uppercase: true, maxLength: 10,
                      editInitial: '', placeholder: details.pan.number || 'ABCDE1234F',
                    }]}
                    onSave={saveKyc('pan', 'Pan')}
                  />
                  <ProfileSection
                    {...sectionProps('gst')}
                    status={details.gst.status}
                    cols={2}
                    document={details.gst.document}
                    fields={[{ key: 'number', label: _fields.gstNumber, value: details.gst.number, validator: v.optionalGst, uppercase: true, maxLength: 15 }]}
                    onSave={saveGst}
                  />
                </>
              )}
            </Sections>

            <ReferCard onSnack={showSnack} />

            <AccountTitle>{_account.title}</AccountTitle>
            <AccountRow>
              {(
              <AccountTile type="button" onClick={() => navigate(AppRoutes.myRewards)}>
                <i className="pi pi-star-fill" aria-hidden />
                <AccountText>
                  <strong>{_account.rewardsTitle}</strong>
                  <small>
                    {balance}
                    {_account.rewardsSuffix}
                  </small>
                </AccountText>
                <i className="pi pi-chevron-right" aria-hidden />
              </AccountTile>
              )}
              <AccountTile type="button" onClick={() => { window.location.href = '/account/orders'; }}>
                <i className="pi pi-box" aria-hidden />
                <AccountText><strong>My orders</strong></AccountText>
                <i className="pi pi-chevron-right" aria-hidden />
              </AccountTile>
              <AccountTile type="button" onClick={() => navigate('/quotations')}>
                <i className="pi pi-file" aria-hidden />
                <AccountText><strong>Quotations</strong></AccountText>
                <i className="pi pi-chevron-right" aria-hidden />
              </AccountTile>
              <AccountTile type="button" onClick={() => { window.location.href = '/account/addresses'; }}>
                <i className="pi pi-map-marker" aria-hidden />
                <AccountText><strong>Saved addresses</strong></AccountText>
                <i className="pi pi-chevron-right" aria-hidden />
              </AccountTile>
              <AccountTile type="button" $danger onClick={signOut}>
                <i className="pi pi-sign-out" aria-hidden />
                <AccountText>
                  <strong>{_account.signOut}</strong>
                </AccountText>
                <i className="pi pi-chevron-right" aria-hidden />
              </AccountTile>
              {!details.isPartner && (
                <AccountTile type="button" $danger onClick={deleteAccount}>
                  <i className="pi pi-trash" aria-hidden />
                  <AccountText><strong>Delete my account</strong></AccountText>
                  <i className="pi pi-chevron-right" aria-hidden />
                </AccountTile>
              )}
            </AccountRow>
          </>
        )}
      </Page>

      {snack && (
        <SnackBar
          key={snack.id}
          message={snack.message}
          onDismissed={hideSnack}
          webAlign="center"
        />
      )}
    </Root>
  );
}

/** `/profile` route — storefront header on web + the profile content. */
export function Profile() {
  return (
    <Screen>
      <StorefrontHeader webOnly />
      <ProfileContent showBack />
    </Screen>
  );
}
