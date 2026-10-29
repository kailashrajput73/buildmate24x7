'use client';
import type { ReactNode } from 'react';
import styled from 'styled-components';
import { StorefrontHeader } from '../StorefrontHeader';
import { StorefrontFooter } from '../StorefrontFooter';
import { textStyle } from '../../theme';

const Shell = styled.div`
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.background};
`;

const Main = styled.main`
  flex: 1;
  min-width: 0;
`;

/** Content column used by the simple pages (search, categories, wishlist). */
export const PageColumn = styled.div`
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: ${({ theme }) => `${theme.spacing.space4}px ${theme.spacing.space4}px ${theme.spacing.space8}px`};

  ${({ theme }) => theme.media.md} {
    padding: ${({ theme }) => `${theme.spacing.space8}px ${theme.spacing.space6}px ${theme.spacing.space10}px`};
  }
`;

export const PageTitle = styled.h1`
  margin: 0;
  ${({ theme }) => textStyle(theme.typography.headlineMedium)}
`;

export const PageSubtitle = styled.p`
  margin: ${({ theme }) => theme.spacing.space1}px 0 0;
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
  color: ${({ theme }) => theme.colors.onSurfaceVariant};
`;

/**
 * Standard page chrome: the navy storefront header, the page, and the footer. Used by every page that does not
 * have its own app bar (the pages ported from the kit keep theirs).
 */
export function SitePage({ children }: { children: ReactNode }) {
  return (
    <Shell>
      <StorefrontHeader />
      <Main>{children}</Main>
      <StorefrontFooter />
    </Shell>
  );
}
