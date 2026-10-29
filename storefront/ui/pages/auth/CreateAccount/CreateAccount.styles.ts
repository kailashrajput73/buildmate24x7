import styled from 'styled-components';
import { textStyle } from '../../../theme';
import { authWebCard, authWebStage } from '../../../shared/AuthWebLayout';

/** Scaffold(surface) + DecoratedBox(backdropGradient, top → bottom) + SafeArea */
export const Screen = styled.div`
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  justify-content: center;
  background: linear-gradient(
    to bottom,
    ${({ theme }) => theme.loginFlow.backdropGradient[0]},
    ${({ theme }) => theme.loginFlow.backdropGradient[1]}
  );
  ${authWebStage}
`;

/** Padding(LTRB: space6, space6, space6, space4) > Column(stretch) */
export const Content = styled.div`
  flex: 1;
  width: 100%;
  max-width: ${({ theme }) => theme.layout.authMaxWidth}px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: ${({ theme }) =>
    `${theme.spacing.space6}px ${theme.spacing.space6}px ${theme.spacing.space4}px`};
  ${authWebCard}
`;

/** SizedBox(space4) + Center(LoginFlowIconBadge) */
export const BadgeWrap = styled.div`
  display: flex;
  justify-content: center;
  margin-top: ${({ theme }) => theme.spacing.space4}px;
`;

/** SizedBox(space5) + Text(headlineSmall w800, center) */
export const Title = styled.h1`
  margin: ${({ theme }) => theme.spacing.space5}px 0 0;
  text-align: center;
  ${({ theme }) => textStyle(theme.typography.headlineSmall)}
  font-weight: 800;
`;

/** SizedBox(space2) + Text(bodyLarge, onSurfaceVariant, center) */
export const Subtitle = styled.p`
  margin: ${({ theme }) => theme.spacing.space2}px 0 0;
  text-align: center;
  ${({ theme }) => textStyle(theme.typography.bodyLarge)}
  color: ${({ theme }) => theme.colors.onSurfaceVariant};
`;

/** SizedBox(space8) + LoginFlowOutlinedField('Full Name') */
export const NameFieldWrap = styled.div`
  margin-top: ${({ theme }) => theme.spacing.space8}px;
`;

/** SizedBox(space5) + LoginFlowOutlinedField('Email Address') */
export const EmailFieldWrap = styled.div`
  margin-top: ${({ theme }) => theme.spacing.space5}px;
`;

/** SizedBox(space5) + LoginFlowOutlinedField('Referral Code') */
export const ReferralFieldWrap = styled.div`
  margin-top: ${({ theme }) => theme.spacing.space5}px;
`;

/** Spacer() */
export const Spacer = styled.div`
  flex: 1;

  ${({ theme }) => theme.media.md} {
    flex: none;
    height: ${({ theme }) => theme.spacing.space8}px;
  }
`;

/** SizedBox(space5) + LoginFlowTermsFooter */
export const FooterWrap = styled.div`
  margin-top: ${({ theme }) => theme.spacing.space5}px;
`;
