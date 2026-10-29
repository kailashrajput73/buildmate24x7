import styled from 'styled-components';
import { textStyle } from '../../theme';

export const Wrapper = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => theme.colors.background};
  ${({ theme }) => textStyle(theme.typography.labelSmallMono)}
`;
