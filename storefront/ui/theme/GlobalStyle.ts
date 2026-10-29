import { createGlobalStyle } from 'styled-components';
import { textStyle } from './textStyle';

export const GlobalStyle = createGlobalStyle`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  html,
  body,
  #root {
    height: 100%;
  }

  body {
    margin: 0;
    background: ${({ theme }) => theme.components.scaffold.background};
    ${({ theme }) => textStyle(theme.typography.bodyMedium)}
    -webkit-font-smoothing: antialiased;
  }
`;
