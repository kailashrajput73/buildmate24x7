import styled from 'styled-components';
import { textStyle, withAlpha } from '../../theme';

/** Flutter: Container(height: 52, padding: 4), animations 220ms */
const TOGGLE_HEIGHT = 52;
const TOGGLE_PADDING = 4;
const DURATION_MS = 220;

export const Track = styled.div`
  width: 100%;
  height: ${TOGGLE_HEIGHT}px;
  padding: ${TOGGLE_PADDING}px;
  background: ${({ theme }) => theme.colors.surfaceContainer};
  border: 1px solid ${({ theme }) => theme.loginFlow.fieldBorder};
  border-radius: ${({ theme }) => theme.radius.lg}px;
`;

/** Stack area inside the padding */
export const Inner = styled.div`
  position: relative;
  display: flex;
  height: 100%;
`;

/** AnimatedAlign sliding pill (single pill, never two highlighted) */
export const Pill = styled.div<{ $isLogin: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  width: 50%;
  height: 100%;
  border-radius: ${({ theme }) => theme.radius.md}px;
  background: linear-gradient(
    to right,
    ${({ theme }) => theme.loginFlow.accentGradient[0]},
    ${({ theme }) => theme.loginFlow.accentGradient[1]}
  );
  box-shadow: 0 4px 10px ${({ theme }) => withAlpha(theme.loginFlow.accent, 0.3)};
  transform: translateX(${({ $isLogin }) => ($isLogin ? '0' : '100%')});
  transition: transform ${DURATION_MS}ms ${({ theme }) => theme.motion.easeOutCubic};
`;

/** _ModeToggleOption: InkWell with no splash + AnimatedDefaultTextStyle */
export const Option = styled.button<{ $selected: boolean }>`
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: ${({ theme }) => theme.radius.md}px;
  cursor: pointer;
  ${({ theme }) => textStyle(theme.typography.titleSmall)}
  font-weight: 700;
  color: ${({ theme, $selected }) =>
    $selected ? theme.colors.white : theme.colors.onSurfaceVariant};
  transition: color ${DURATION_MS}ms ${({ theme }) => theme.motion.easeOutCubic};
  -webkit-tap-highlight-color: transparent;
`;
