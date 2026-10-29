import { Svg } from './LoginFlowOtpIcon.styles';

interface LoginFlowOtpIconProps {
  size?: number;
}

const DIGIT_BOXES = 6;
const TEXT_LINES = 3;

/**
 * Line-art OTP illustration for the verification screen.
 * Inline-SVG port of Flutter `_LoginFlowOtpIconPainter` (same geometry).
 */
export function LoginFlowOtpIcon({ size = 100 }: LoginFlowOtpIconProps) {
  const w = size;
  const h = size;
  const cx = w / 2;

  // Six OTP digit boxes.
  const boxSize = w * 0.09;
  const gap = w * 0.025;
  const rowW = boxSize * DIGIT_BOXES + gap * (DIGIT_BOXES - 1);
  const startX = cx - rowW / 2;
  const boxY = h * 0.84;

  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {/* Message bubble outline. */}
      <rect
        className="stroke"
        x={w * 0.12}
        y={h * 0.1}
        width={w * 0.76}
        height={h * 0.52}
        rx={w * 0.08}
      />
      {/* Bubble tail. */}
      <polyline
        className="stroke"
        points={`${cx - w * 0.06},${h * 0.62} ${cx},${h * 0.78} ${cx + w * 0.06},${h * 0.62}`}
      />
      {/* Three text lines inside the bubble. */}
      {Array.from({ length: TEXT_LINES }, (_, i) => {
        const y = h * (0.24 + i * 0.12);
        const lineW = w * (0.42 - i * 0.06);
        return (
          <line
            key={`line-${i}`}
            className="stroke"
            x1={cx - lineW / 2}
            y1={y}
            x2={cx + lineW / 2}
            y2={y}
          />
        );
      })}
      {Array.from({ length: DIGIT_BOXES }, (_, i) => {
        const x = startX + i * (boxSize + gap);
        return (
          <g key={`box-${i}`}>
            <rect
              className="stroke"
              x={x}
              y={boxY}
              width={boxSize}
              height={boxSize}
              rx={boxSize * 0.22}
            />
            <circle
              className="fill"
              cx={x + boxSize / 2}
              cy={boxY + boxSize / 2}
              r={boxSize * 0.12}
            />
          </g>
        );
      })}
    </Svg>
  );
}
