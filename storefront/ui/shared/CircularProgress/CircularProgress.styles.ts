import styled, { keyframes } from 'styled-components';

const rotate = keyframes`
  100% { transform: rotate(360deg); }
`;

// Arc grows then shrinks, like Material's indeterminate spinner.
const dash = keyframes`
  0%   { stroke-dasharray: 1 100;  stroke-dashoffset: 0; }
  50%  { stroke-dasharray: 75 100; stroke-dashoffset: -10; }
  100% { stroke-dasharray: 75 100; stroke-dashoffset: -99; }
`;

export const Svg = styled.svg`
  display: block;
  animation: ${rotate} 1.4s linear infinite;
`;

export const Track = styled.circle`
  fill: none;
`;

export const Arc = styled.circle`
  fill: none;
  stroke-linecap: butt;
  animation: ${dash} 1.4s ease-in-out infinite;
`;
