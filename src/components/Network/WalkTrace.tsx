import { observer } from "mobx-react";
import { motion, SVGMotionProps } from "framer-motion";
import * as d3 from "d3";
import { RandomWalker } from "../../model/algorithms";
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
    maxWidth = 14,
    maxVisiblePaths = 20,
    stroke = "#707070",
  }: Props) {
  const { current, nodeTrace, teleported, interval } = walker;

  if (!current) return null;

  const maxCurveCoords = maxVisiblePaths + 2;
  const nodes = nodeTrace.slice(-maxCurveCoords);
  const coords = nodes.map((node) => [node.x, node.y]);

  const path = new Path();
  draw(coords, path);

  const visiblePaths = path.slice(-maxVisiblePaths);
  const head = visiblePaths.pop();

  const oldPath = new Path();
  draw(coords.slice(0, -1), oldPath);
  const oldVisiblePaths = oldPath.slice(-maxVisiblePaths + 1);

  const scale = d3.scaleLinear().domain([0, maxVisiblePaths - 1]).range([0, 1]);
  const strokeWidth = (i: number) => minWidth + (maxWidth - minWidth) * scale(i);

  const duration = interval / 1000;
  const transition = { duration, type: "spring", bounce: 0 };

  return (
    <>
      {visiblePaths.map((d, i) =>
        <Segment
          key={`${i}-${d}`}
          initial={{ d: oldVisiblePaths[i], strokeWidth: strokeWidth(i + 1), opacity: opacity * scale(i + 1) }}
          animate={{ d, strokeWidth: strokeWidth(i), opacity: opacity * scale(i) }}
          transition={{ duration }}
          fill="none"
          stroke={stroke}
        />)}
      <Segment
        key={head}
        d={head}
        initial={{
          pathLength: 0,
          opacity: 0.5 * opacity * scale(visiblePaths.length),
          stroke: teleported ? "#FE3265" : stroke,
        }}
        animate={{
          pathLength: 1,
          opacity: opacity * scale(visiblePaths.length),
          stroke,
        }}
        transition={transition}
        strokeWidth={strokeWidth(visiblePaths.length)}
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

function Segment(props: SVGMotionProps<SVGPathElement>) {
  return <motion.path
    strokeLinecap="round"
    fill="none"
    {...props}
  />;
}
