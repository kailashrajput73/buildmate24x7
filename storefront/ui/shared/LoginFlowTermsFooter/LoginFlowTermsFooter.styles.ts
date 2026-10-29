import styled from 'styled-components';
import { textStyle } from '../../theme';

/** Text.rich(bodySmall, color: onSurfaceVariant, height: 1.4) */
export const Footer = styled.p`
  margin: 0;
  text-align: center;
  ${({ theme }) => textStyle(theme.typography.bodySmall)}
  color: ${({ theme }) => theme.colors.onSurfaceVariant};
  line-height: 1.4;
`;

/** TextSpan(link, underline, w500) with an empty onTap */
export const Link = styled.span`
  color: ${({ theme }) => theme.loginFlow.link};
  text-decoration: underline;
  font-weight: 500;
  cursor: pointer;
`;
