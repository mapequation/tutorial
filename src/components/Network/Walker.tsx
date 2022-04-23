import { RandomWalker } from "../../model/algorithms";
import { animated, to, useSpring } from "react-spring";

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
}

export default function Walker({ walker, r = 10 }: Props) {
  const { current, prev, teleported } = walker;

  const x2 = current?.x ?? 0;
  const y2 = current?.y ?? 0;

  const x1 = prev ? prev.x : x2;
  const y1 = prev ? prev.y : y2;

  const defaultFill = "#393939";

  const { x, y, length, fill, opacity } = useSpring({
    reset: true,
    from: { x: x1, y: y1, length: 0, fill: defaultFill, opacity: 1 },
    to: [
      {
        x: x2,
        y: y2,
        length: Math.PI,
        fill: teleported ? "#FE3265" : defaultFill,
        opacity: 1,
      },
      {
        opacity: 0.5,
      },
    ],
  });

  if (!walker.current) return null;

  if (!walker.prev) return <circle cx={x2} cy={y2} r={r} fill={defaultFill} />;

  // @ts-ignore
  return (
    <animated.path
      d={to([x, y, length], (x, y, length) => path(x1, y1, x, y, r, length))}
      fill={fill}
      opacity={opacity}
    />
  );
}
