import { useTheme } from 'styled-components';
import { Svg, Track, Arc } from './CircularProgress.styles';

interface CircularProgressProps {
  /** Outer size in px. */
  size: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
}

/** Indeterminate Material `CircularProgressIndicator`. */
export function CircularProgress({
  size,
  strokeWidth = 4,
  color,
  trackColor,
}: CircularProgressProps) {
  const theme = useTheme();
  const r = (size - strokeWidth) / 2;
  const c = size / 2;

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="progressbar"
      aria-busy="true"
    >
      <Track
        cx={c}
        cy={c}
        r={r}
        strokeWidth={strokeWidth}
        stroke={trackColor ?? theme.components.progressIndicator.trackColor}
      />
      <Arc
        cx={c}
        cy={c}
        r={r}
        strokeWidth={strokeWidth}
        stroke={color ?? theme.components.progressIndicator.color}
        pathLength={100}
      />
    </Svg>
  );
}
