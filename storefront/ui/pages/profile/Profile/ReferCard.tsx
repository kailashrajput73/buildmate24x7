import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { textStyle, withAlpha } from '../../../theme';
import { loadReferral, type Referral } from '../../../services/profile/buildmateProfile';

/**
 * Refer & Earn on the profile page: the user's own invite code with Copy, WhatsApp and the device share sheet.
 * The invite link opens the login page with the code filled in (`/login?ref=CODE`); the code is saved with the
 * new account at sign-up.
 */
export function ReferCard({ onSnack }: { onSnack: (message: string) => void }) {
  const [referral, setReferral] = useState<Referral | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    loadReferral().then((r) => live && setReferral(r)).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, []);

  if (failed) return null;

  const link = referral && typeof window !== 'undefined' ? `${window.location.origin}/login?ref=${referral.code}` : '';
  const message = referral
    ? `Join me on BuildMate 24x7 for plumbing, sanitary, electrical and hardware supplies. Use my code ${referral.code} when you sign up: ${link}`
    : '';
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = async () => {
    if (!referral) return;
    try {
      await navigator.clipboard.writeText(referral.code);
      onSnack('Referral code copied');
    } catch {
      onSnack(`Your code is ${referral.code}`);
    }
  };
  const share = async () => {
    if (!referral) return;
    try {
      await navigator.share({ title: 'BuildMate 24x7', text: message, url: link });
    } catch {
      /* closed the share sheet */
    }
  };

  const reward =
    referral && (referral.referrerPoints > 0 || referral.welcomePoints > 0)
      ? `You get ${referral.referrerPoints} points for every friend who joins${referral.welcomePoints > 0 ? `, and they get ${referral.welcomePoints} points` : ''}.`
      : 'Invite friends and fellow tradespeople to BuildMate with your personal code.';

  return (
    <Card aria-labelledby="refer-title">
      <Head>
        <Icon aria-hidden><i className="pi pi-gift" /></Icon>
        <div>
          <Title id="refer-title">Refer &amp; Earn</Title>
          <Body>{reward}</Body>
        </div>
      </Head>

      <CodeRow>
        <Code aria-label="Your referral code">{referral?.code ?? '········'}</Code>
        <Action type="button" onClick={copy} disabled={!referral}>
          <i className="pi pi-copy" aria-hidden /> Copy
        </Action>
      </CodeRow>

      <Buttons>
        <WhatsApp
          href={referral ? `https://wa.me/?text=${encodeURIComponent(message)}` : undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!referral}
        >
          <i className="pi pi-whatsapp" aria-hidden /> Share on WhatsApp
        </WhatsApp>
        {canShare && (
          <Action type="button" onClick={share} disabled={!referral}>
            <i className="pi pi-share-alt" aria-hidden /> Share
          </Action>
        )}
      </Buttons>

      {referral && (
        <Stats>
          <span><strong>{referral.referredCount}</strong> {referral.referredCount === 1 ? 'friend' : 'friends'} joined</span>
          {referral.pointsEarned > 0 && <span><strong>{Math.round(referral.pointsEarned)}</strong> points earned</span>}
          {referral.referredByName && <span>Invited by {referral.referredByName}</span>}
        </Stats>
      )}
    </Card>
  );
}

const Card = styled.section`
  margin-top: ${({ theme }) => theme.spacing.space6}px;
  padding: ${({ theme }) => theme.spacing.space4}px;
  border-radius: ${({ theme }) => theme.radius.lg}px;
  border: 1px solid ${({ theme }) => withAlpha(theme.colors.primary, 0.2)};
  background: ${({ theme }) => withAlpha(theme.colors.primary, 0.04)};
  display: grid;
  gap: ${({ theme }) => theme.spacing.space3}px;
`;

const Head = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.space3}px;
  align-items: flex-start;
`;

const Icon = styled.span`
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  display: grid;
  place-items: center;
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.onPrimary};
  font-size: 18px;
`;

const Title = styled.h2`
  margin: 0;
  ${({ theme }) => textStyle(theme.typography.titleSmall)}
`;

const Body = styled.p`
  margin: 2px 0 0;
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
  color: ${({ theme }) => theme.colors.onSurfaceVariant};
`;

const CodeRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.space2}px;
  align-items: stretch;
`;

const Code = styled.output`
  flex: 1;
  display: flex;
  align-items: center;
  padding: 0 ${({ theme }) => theme.spacing.space4}px;
  min-height: 48px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  border: 1px dashed ${({ theme }) => theme.colors.primary};
  background: ${({ theme }) => theme.colors.surface};
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: ${({ theme }) => theme.colors.primary};
`;

const buttonBase = `
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 16px;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
`;

const Action = styled.button`
  ${buttonBase}
  border: 1px solid ${({ theme }) => theme.colors.divider};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.onSurface};
  ${({ theme }) => textStyle(theme.typography.labelLarge)}
  &:disabled { opacity: 0.6; cursor: default; }
  &:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.primary}; outline-offset: 2px; }
`;

const WhatsApp = styled.a`
  ${buttonBase}
  flex: 1;
  background: #1fa855;
  color: #fff;
  ${({ theme }) => textStyle(theme.typography.labelLarge)}
  &[aria-disabled='true'] { opacity: 0.6; pointer-events: none; }
  &:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.primary}; outline-offset: 2px; }
`;

const Buttons = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.space2}px;
  flex-wrap: wrap;
`;

const Stats = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => `${theme.spacing.space1}px ${theme.spacing.space4}px`};
  ${({ theme }) => textStyle(theme.typography.bodySmall)}
  color: ${({ theme }) => theme.colors.onSurfaceVariant};
  strong { color: ${({ theme }) => theme.colors.onSurface}; }
`;
