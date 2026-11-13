import { useState } from 'react';
import { useLocation, useNavigate } from '@/ui/router';
import { AppRoutes } from '../../../routes/appRoutes';
import type { SignupFlowArgs } from '../../../routes/appRoutes';
import type { UserRole } from '../../../services/auth/authModels';
import { useShop } from '@/lib/shop';
import { api } from '@/lib/api';
import { useCurrentLocation } from '../../../session/LocationContext';
import { signInWithVerifiedPhone } from '../../../services/auth/phoneAuth';
import { afterLoginPath } from '../afterLogin';

/** Profession → BuildMate partner type. Anything not listed (Home Owner) signs up as a retail customer. */
const PARTNER_TYPES: Record<string, 'Plumber' | 'Electrician' | 'Contractor' | 'Builder' | 'Flooring' | undefined> = {
  Contractor: 'Contractor',
  Plumber: 'Plumber',
  Electrician: 'Electrician',
  Builder: 'Builder',
  Flooring: 'Flooring',
};
import { LoginFlowBackButton } from '../../../shared/LoginFlowBackButton';
import { LoginFlowContinueButton } from '../../../shared/LoginFlowContinueButton';
import { AuthWebLayout } from '../../../shared/AuthWebLayout';
import {
  Screen,
  Content,
  Header,
  HeaderText,
  Title,
  Subtitle,
  List,
  Option,
  Thumb,
  OptionText,
  OptionTitle,
  OptionSubtitle,
  Indicator,
  ContinueWrap,
} from './ChooseProfession.styles';

/** Flutter `_ProfessionOption`. */
interface ProfessionOption {
  title: string;
  subtitle: string;
  role: UserRole;
}

const options: ProfessionOption[] = [
  { title: 'Contractor', subtitle: 'Building & construction', role: 'contractor' },
  { title: 'Plumber', subtitle: 'Pipes, bathrooms & Fittings', role: 'dealer' },
  { title: 'Electrician', subtitle: 'Wiring, switches & lighting', role: 'builder' },
  { title: 'Flooring', subtitle: 'Tiles & Adhesives', role: 'dealer' },
  { title: 'Home Owner', subtitle: 'Buying for my own house', role: 'individualCustomer' },
];

/** AppRouter fallback when no SignupFlowArgs are passed. */
const fallbackArgs: SignupFlowArgs = { mobileNumber: '', fullName: '' };

/** Step 4 — profession selection before entering the app. */
export function ChooseProfession() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useShop();
  const { currentLocation } = useCurrentLocation();
  const args = (location.state as SignupFlowArgs | null) ?? fallbackArgs;

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Creates the BuildMate account: Home Owner → customer; trades → referral partner (partner prices and reward
  // points after KYC approval). The trade becomes the partner type; the chosen location becomes the partner's address.
  const handleContinue = async () => {
    if (selectedIndex === null || busy) return;
    const option = options[selectedIndex];
    const partnerType = PARTNER_TYPES[option.title];
    setBusy(true);
    setError(null);
    try {
      const result = await signIn(await signInWithVerifiedPhone({
        audience: partnerType ? 'Partner' : 'Customer',
        name: args.fullName || undefined,
        email: args.email || undefined,
        partnerType,
        referralCode: args.referralCode || undefined,
      }));
      if (partnerType && result.user.userType === 'Partner') {
        await api('/api/partner/profile', {
          method: 'PUT',
          body: {
            name: args.fullName || result.user.name || 'Partner',
            partnerType,
            addressLine: currentLocation?.address ?? null,
            latitude: currentLocation?.latitude ?? null,
            longitude: currentLocation?.longitude ?? null,
            email: args.email || null,
          },
        }).catch(() => undefined); // the partner can finish the profile in the KYC step
      }
      navigate(afterLoginPath(), { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create your account. Please try again.');
      setBusy(false);
    }
  };

  return (
    <AuthWebLayout>
      <Screen>
        <Content>
          <Header>
            <LoginFlowBackButton onPressed={() => navigate(-1)} />
            <HeaderText>
              <Title>Choose your profession</Title>
              <Subtitle>
                Pick what best describes you so we can personalize your experience.
              </Subtitle>
            </HeaderText>
          </Header>
          <List>
            {options.map((option, index) => {
              const selected = selectedIndex === index;
              return (
                <Option
                  key={option.title}
                  type="button"
                  $selected={selected}
                  aria-pressed={selected}
                  onClick={() => setSelectedIndex(index)}
                >
                  <Thumb />
                  <OptionText>
                    <OptionTitle>{option.title}</OptionTitle>
                    <OptionSubtitle>{option.subtitle}</OptionSubtitle>
                  </OptionText>
                  <Indicator $selected={selected}>
                    {selected && <i className="pi pi-check" aria-hidden="true" />}
                  </Indicator>
                </Option>
              );
            })}
          </List>
          <ContinueWrap>
            <LoginFlowContinueButton
              label="Continue"
              enabled={selectedIndex !== null}
              loading={busy}
              onPressed={handleContinue}
            />
            {error && <p role="alert" style={{ color: '#DC2626', marginTop: 12, textAlign: 'center' }}>{error}</p>}
          </ContinueWrap>
        </Content>
      </Screen>
    </AuthWebLayout>
  );
}
