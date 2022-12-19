import { observer } from "mobx-react";
import { animated, useSpring } from "react-spring";
import { RandomWalker } from "../../model/algorithms";
import * as d3 from "d3";
import Path from "./utils/Path";

interface Props {
  walker: RandomWalker;
  opacity?: number;
  minWidth?: number;
  maxWidth?: number;
  maxVisiblePaths?: number;
  stroke?: string;
}

export default observer(function WalkTrace({
    walker,
    opacity = 0.7,
    minWidth = 1,
    maxWidth = 8,
    maxVisiblePaths = 20,
    stroke = "#707070",
  }: Props) {
  const { current, nodeTrace, teleported } = walker;

  const headProps = useSpring({
    reset: true,
    config: { duration: 500 },
    from: {
      opacity: 0, stroke: teleported ? "#FE3265" : stroke,
    },
    to: { opacity, stroke },
  });

  if (!current) return null;

  const maxCurveCoords = maxVisiblePaths + 2;
  const nodes = nodeTrace.slice(-maxCurveCoords);
  const coords = nodes.map((node) => [node.x, node.y]);

  const path = new Path();
  draw(coords, path);

  const visiblePaths = path.slice(-maxVisiblePaths);
  const head = visiblePaths.pop();

  const scale = d3.scaleLinear().domain([0, maxVisiblePaths - 1]).range([0, 1]);
  const strokeWidth = (i: number) => minWidth + (maxWidth - minWidth) * scale(i);

  return (
    <>
      {visiblePaths.map((d, i) =>
        <path
          key={i}
          d={d}
          stroke={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeWidth={strokeWidth(i)}
          opacity={opacity * scale(i)}
        />)}
      <animated.path
        d={head}
        {...headProps}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeWidth={strokeWidth(visiblePaths.length - 1)}
      />
    </>
  );
});

const curve = d3.curveCatmullRom.alpha(0.5);

function draw(coords: number[][], path: Path) {
  const c = curve(path);
  c.lineStart();
  for (let coord of coords) {
    c.point(coord[0], coord[1]);
  }
  c.lineEnd();
}
