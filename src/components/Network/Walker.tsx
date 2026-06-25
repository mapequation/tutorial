import { observer } from "mobx-react";
import { animated, to, useSpring } from "react-spring";
import { RandomWalker } from "../../model/algorithms";

/**
 * Constructs an SVG path representing a "squishy" walker glyph that points
 * in the direction of movement and animates between positions.
 */
const path = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r: number,
  length: number
): string => {
  const dx = x2 - x1 || 1e-7;
  const dy = y2 - y1 || 1e-7;

  const l = Math.sqrt(dx * dx + dy * dy);

  const dir = { x: dx / l, y: dy / l };

  const xa = x2 + dir.y * r;
  const ya = y2 - dir.x * r;
  const xb = x2 - dir.y * r;
  const yb = y2 + dir.x * r;

  const xDeg = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;

  const tailLength = r + Math.sin(length) * (l - r);

  /*
    SVG path arc
    A rx ry x-axis-rotation large-arc-flag sweep-flag x y
   */
  return `M ${xa} ${ya} \
          A ${r} ${r} 0 0 1 ${xb} ${yb} \
          A ${tailLength} ${r} ${xDeg} 0 1 ${xa} ${ya}`;
};

interface Props {
  walker: RandomWalker;
  r?: number;
  fill?: string;
  teleportFill?: string;
  stroke?: string;
  strokeWidth?: number;
  squishy?: boolean;
}

/**
 * `Walker` renders an animated glyph representing the random walker on the network.
 * Uses `react-spring` for smooth transitions and supports a "squishy" animated
 * mode where the glyph morphs as it moves, or a simple circle mode.
 */
function Walker({
  walker,
  r = 10,
  fill = "#393939",
  teleportFill = "#fe3265",
  stroke = "none",
  strokeWidth = 0,
  squishy = true,
}: Props) {
  const { current, prev, teleported } = walker;

  const x2 = current?.x ?? 0;
  const y2 = current?.y ?? 0;

  const x1 = prev ? prev.x : x2;
  const y1 = prev ? prev.y : y2;

  const { x, y, length, fill: animatedFill, opacity } = useSpring({
    reset: true,
    from: { x: x1, y: y1, length: 0, fill, opacity: 1 },
    to: [
      {
        x: x2,
        y: y2,
        length: Math.PI,
        fill: teleported ? teleportFill : fill,
        opacity: 1,
      },
      {
        opacity: 0.5,
      },
    ],
  });

  if (!walker.current) return null;

  if (!walker.prev) return <circle cx={x2} cy={y2} r={r} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;

  if (!squishy) return <animated.circle cx={x} cy={y} r={r} fill={animatedFill} stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} />;

  // @ts-ignore
  return (
    <animated.path
      d={to([x, y, length], (x, y, length) => path(x1, y1, x, y, r, length))}
      fill={animatedFill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      opacity={opacity}
    />
  );
}

export default observer(Walker);
