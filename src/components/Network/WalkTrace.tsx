import { observer } from "mobx-react";
import { motion, SVGMotionProps } from "framer-motion";
import { useMemo } from "react";
import * as d3 from "d3";
import { RandomWalker } from "../../model/algorithms";
import { neutralLinkColor } from "../scheme";
import Path from "./utils/Path";

interface Props {
  walker: RandomWalker;
  opacity?: number;
  minWidth?: number;
  maxWidth?: number;
  maxVisiblePaths?: number;
  stroke?: string;
}

/**
 * WalkTrace renders a fading trail of the random walker's recent path.
 *
 * It builds smoothed path segments with D3's Catmull-Rom curve generator and
 * animates the segments using `framer-motion`. The most recent segments are
 * rendered more prominently while older segments fade out. When the walker
 * teleports a special color is used for the head segment.
 */
export default observer(function WalkTrace({
    walker,
    opacity = 0.7,
    minWidth = 1,
    maxWidth = 14,
    maxVisiblePaths = 15,
    stroke = neutralLinkColor,
  }: Props) {
  const { current, nodeTrace, teleported, interval } = walker;

  // Always call hooks, even if we return early
  const pathData = useMemo(() => {
    if (!current) return { visiblePaths: [], head: undefined, oldVisiblePaths: [] };
    
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

    return { visiblePaths, head, oldVisiblePaths };
  }, [nodeTrace, maxVisiblePaths, current]);

  const scale = useMemo(
    () => d3.scaleLinear().domain([0, maxVisiblePaths - 1]).range([0, 1]),
    [maxVisiblePaths]
  );

  const strokeWidth = useMemo(
    () => (i: number) => minWidth + (maxWidth - minWidth) * scale(i),
    [minWidth, maxWidth, scale]
  );

  // Return null if no current walker position
  if (!current) return null;

  const duration = interval / 1000;
  const transition = { duration, type: "spring" as const, bounce: 0 };

  return (
    <>
      {pathData.visiblePaths.map((d, i) =>
        <Segment
          key={`${i}-${d}`}
          initial={{ d: pathData.oldVisiblePaths[i], strokeWidth: strokeWidth(i + 1), opacity: opacity * scale(i + 1) }}
          animate={{ d, strokeWidth: strokeWidth(i), opacity: opacity * scale(i) }}
          transition={{ duration }}
          fill="none"
          stroke={stroke}
        />)}
      <Segment
        key={pathData.head}
        d={pathData.head}
        initial={{
          pathLength: 0,
          opacity: 0.5 * opacity * scale(pathData.visiblePaths.length),
          stroke: teleported ? "#FE3265" : stroke,
        }}
        animate={{
          pathLength: 1,
          opacity: opacity * scale(pathData.visiblePaths.length),
          stroke,
        }}
        transition={transition}
        strokeWidth={strokeWidth(pathData.visiblePaths.length)}
      />
    </>
  );
});

const curve = d3.curveCatmullRom.alpha(0.5);

// Helper that converts a sequence of coordinates into a Path object using
// a D3 curve generator. The Path abstraction stores a list of path strings
// which are later rendered as SVG `path` elements.
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
