import styled from 'styled-components';

/** Flutter painter: Paint(strokeWidth 2.2, round cap/join) */
const STROKE_WIDTH = 2.2;

export const Svg = styled.svg`
  display: block;
  flex-shrink: 0;
  overflow: visible;
  color: ${({ theme }) => theme.loginFlow.link};

  .stroke {
    fill: none;
    stroke: currentColor;
    stroke-width: ${STROKE_WIDTH};
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .fill {
    fill: currentColor;
  }
`;
