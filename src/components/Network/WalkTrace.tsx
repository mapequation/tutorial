import { observer } from "mobx-react";
import { motion, SVGMotionProps } from "framer-motion";
import { useId, useMemo, useRef } from "react";
import * as d3 from "d3";
import type { Node as NodeModel } from "../../model";
import { RandomWalker } from "../../model/algorithms";
import { neutralLinkColor } from "../scheme";
import Path from "./utils/Path";

type StableSegmentStroke =
  | string
  | {
      from: string;
      to: string;
    };

interface Props {
  walker: RandomWalker;
  opacity?: number;
  minWidth?: number;
  maxWidth?: number;
  maxVisiblePaths?: number;
  stroke?: string;
  stableSegments?: boolean;
  getStableSegmentStroke?: (
    source: NodeModel,
    target: NodeModel,
  ) => StableSegmentStroke;
}

interface StableSegmentData {
  key: string;
  d: string;
  from: string;
  to: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface StableSegmentStrokeData {
  from: string;
  to: string;
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
  stableSegments = false,
  getStableSegmentStroke,
}: Props) {
  const { current, nodeTrace, teleported, interval, totalVisits } = walker;
  const gradientIdPrefix = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const stableSegmentStrokeCache = useRef(
    new Map<string, StableSegmentStrokeData>(),
  );

  // Always call hooks, even if we return early
  const pathData = useMemo(() => {
    if (!current) {
      return {
        visiblePaths: [],
        head: undefined,
        oldVisiblePaths: [],
        stableVisiblePaths: [],
        stableHead: undefined,
      };
    }

    const maxCurveCoords = maxVisiblePaths + 2;
    const nodes = nodeTrace.slice(-maxCurveCoords);

    if (stableSegments) {
      const firstStep = Math.max(1, totalVisits - nodes.length + 1);
      const stablePaths: StableSegmentData[] = [];

      for (let i = 0; i < nodes.length - 1; i++) {
        const source = nodes[i];
        const target = nodes[i + 1];
        const key = `${firstStep + i + 1}-${source.id}-${target.id}`;
        const customStroke = getStableSegmentStroke?.(source, target);
        let segmentStroke = stableSegmentStrokeCache.current.get(key);

        if (!segmentStroke) {
          segmentStroke = normalizeStableSegmentStroke(customStroke, stroke);
          stableSegmentStrokeCache.current.set(key, segmentStroke);
        }

        stablePaths.push({
          key,
          d: stableSegmentPath(source, target),
          from: segmentStroke.from,
          to: segmentStroke.to,
          x1: source.x,
          y1: source.y,
          x2: target.x,
          y2: target.y,
        });
      }

      pruneStableSegmentStrokeCache(
        stableSegmentStrokeCache.current,
        stablePaths,
      );

      const visibleStablePaths = stablePaths.slice(-maxVisiblePaths);
      const stableHead = visibleStablePaths[visibleStablePaths.length - 1];

      return {
        visiblePaths: [],
        head: undefined,
        oldVisiblePaths: [],
        stableVisiblePaths: visibleStablePaths.slice(0, -1),
        stableHead,
      };
    }

    stableSegmentStrokeCache.current.clear();

    const coords = nodes.map((node) => [node.x, node.y]);

    const path = new Path();
    draw(coords, path);

    const visiblePaths = path.slice(-maxVisiblePaths);
    const head = visiblePaths.pop();

    const oldPath = new Path();
    draw(coords.slice(0, -1), oldPath);
    const oldVisiblePaths = oldPath.slice(-maxVisiblePaths + 1);

    return {
      visiblePaths,
      head,
      oldVisiblePaths,
      stableVisiblePaths: [],
      stableHead: undefined,
    };
  }, [
    nodeTrace,
    maxVisiblePaths,
    current,
    stableSegments,
    totalVisits,
    getStableSegmentStroke,
    stroke,
  ]);

  const scale = useMemo(
    () =>
      d3
        .scaleLinear()
        .domain([0, maxVisiblePaths - 1])
        .range([0, 1]),
    [maxVisiblePaths],
  );

  const strokeWidth = useMemo(
    () => (i: number) => minWidth + (maxWidth - minWidth) * scale(i),
    [minWidth, maxWidth, scale],
  );

  // Return null if no current walker position
  if (!current) return null;

  const duration = interval / 1000;
  const transition = { duration, type: "spring" as const, bounce: 0 };

  if (stableSegments) {
    const stableSegmentCount =
      pathData.stableVisiblePaths.length + (pathData.stableHead ? 1 : 0);
    const stableIntensity = (index: number) =>
      stableTraceIntensity(index, stableSegmentCount, maxVisiblePaths);
    const stableSegmentsWithIndexes = [
      ...pathData.stableVisiblePaths.map((segment, i) => ({
        segment,
        index: i,
      })),
      ...(pathData.stableHead
        ? [
            {
              segment: pathData.stableHead,
              index: pathData.stableVisiblePaths.length,
            },
          ]
        : []),
    ];
    const gradients = stableSegmentsWithIndexes.filter(
      ({ segment }) => segment.from !== segment.to,
    );

    return (
      <>
        <defs>
          {gradients.map(({ segment, index }) => {
            const intensity = stableIntensity(index);

            return (
              <linearGradient
                key={segment.key}
                id={stableSegmentGradientId(gradientIdPrefix, segment.key)}
                x1={segment.x1}
                y1={segment.y1}
                x2={segment.x2}
                y2={segment.y2}
                gradientUnits="userSpaceOnUse"
              >
                <stop
                  offset="0%"
                  stopColor={trailAgeColor(segment.from, intensity)}
                />
                <stop
                  offset="50%"
                  stopColor={trailAgeColor(transitionBlendColor, intensity)}
                />
                <stop
                  offset="100%"
                  stopColor={trailAgeColor(segment.to, intensity)}
                />
              </linearGradient>
            );
          })}
        </defs>
        {pathData.stableVisiblePaths.map((segment, i) => (
          <Segment
            key={segment.key}
            d={segment.d}
            initial={false}
            animate={{
              strokeWidth: stableStrokeWidth(
                minWidth,
                maxWidth,
                stableIntensity(i),
              ),
              opacity: opacity * stableIntensity(i),
            }}
            transition={{ duration }}
            stroke={stableSegmentStroke(
              segment,
              gradientIdPrefix,
              stableIntensity(i),
            )}
          />
        ))}
        {pathData.stableHead && (
          <Segment
            key={pathData.stableHead.key}
            d={pathData.stableHead.d}
            initial={{
              pathLength: 0,
              opacity: 0,
              stroke: stableSegmentStroke(
                pathData.stableHead,
                gradientIdPrefix,
                stableIntensity(pathData.stableVisiblePaths.length),
              ),
            }}
            animate={{
              pathLength: 1,
              opacity:
                opacity * stableIntensity(pathData.stableVisiblePaths.length),
              stroke: stableSegmentStroke(
                pathData.stableHead,
                gradientIdPrefix,
                stableIntensity(pathData.stableVisiblePaths.length),
              ),
            }}
            transition={transition}
            strokeWidth={stableStrokeWidth(
              minWidth,
              maxWidth,
              stableIntensity(pathData.stableVisiblePaths.length),
            )}
          />
        )}
      </>
    );
  }

  return (
    <>
      {pathData.visiblePaths.map((d, i) => (
        <Segment
          key={`${i}-${d}`}
          initial={{
            d: pathData.oldVisiblePaths[i],
            strokeWidth: strokeWidth(i + 1),
            opacity: opacity * scale(i + 1),
          }}
          animate={{
            d,
            strokeWidth: strokeWidth(i),
            opacity: opacity * scale(i),
          }}
          transition={{ duration }}
          fill="none"
          stroke={stroke}
        />
      ))}
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
const transitionBlendColor = "#8f9699";
const trailDarkenAmount = 0.12;

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

function stableSegmentPath(
  source: { x: number; y: number },
  target: { x: number; y: number },
) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;

  return [
    `M${source.x},${source.y}`,
    `C${source.x + dx * 0.35},${source.y + dy * 0.35},`,
    `${source.x + dx * 0.65},${source.y + dy * 0.65},`,
    `${target.x},${target.y}`,
  ].join("");
}

function stableTraceIntensity(index: number, count: number, maxAge: number) {
  if (count <= 1) {
    return 1;
  }

  const age = count - 1 - index;
  const normalizedAge =
    Math.min(age, Math.max(1, maxAge - 1)) / Math.max(1, maxAge - 1);

  return Math.pow(1 - normalizedAge, 0.75);
}

function stableStrokeWidth(
  minWidth: number,
  maxWidth: number,
  intensity: number,
) {
  return minWidth + (maxWidth - minWidth) * intensity;
}

function stableSegmentStroke(
  segment: StableSegmentData,
  gradientIdPrefix: string,
  intensity: number,
) {
  if (segment.from === segment.to) {
    return trailAgeColor(segment.to, intensity);
  }

  return `url(#${stableSegmentGradientId(gradientIdPrefix, segment.key)})`;
}

function stableSegmentGradientId(prefix: string, key: string) {
  return `walk-trace-${prefix}-${key}`;
}

function normalizeStableSegmentStroke(
  segmentStroke: StableSegmentStroke | undefined,
  fallbackStroke: string,
): StableSegmentStrokeData {
  if (!segmentStroke) {
    return {
      from: fallbackStroke,
      to: fallbackStroke,
    };
  }

  if (typeof segmentStroke === "string") {
    return {
      from: segmentStroke,
      to: segmentStroke,
    };
  }

  return segmentStroke;
}

function trailAgeColor(color: string, intensity: number) {
  const clampedIntensity = Math.max(0, Math.min(1, intensity));

  return mixHexColor(color, "#000000", trailDarkenAmount * clampedIntensity);
}

function mixHexColor(from: string, to: string, amount: number) {
  const fromRgb = hexToRgb(from);
  const toRgb = hexToRgb(to);
  const clampedAmount = Math.max(0, Math.min(1, amount));

  return rgbToHex({
    r: fromRgb.r + (toRgb.r - fromRgb.r) * clampedAmount,
    g: fromRgb.g + (toRgb.g - fromRgb.g) * clampedAmount,
    b: fromRgb.b + (toRgb.b - fromRgb.b) * clampedAmount,
  });
}

function hexToRgb(hexColor: string) {
  const hex = hexColor.replace("#", "");
  const parsed = Number.parseInt(hex, 16);

  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${[r, g, b]
    .map((value) =>
      Math.max(0, Math.min(255, Math.round(value)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function pruneStableSegmentStrokeCache(
  cache: Map<string, StableSegmentStrokeData>,
  stablePaths: StableSegmentData[],
) {
  const activeKeys = new Set(stablePaths.map((path) => path.key));

  cache.forEach((_, key) => {
    if (!activeKeys.has(key)) {
      cache.delete(key);
    }
  });
}

function Segment(props: SVGMotionProps<SVGPathElement>) {
  return <motion.path strokeLinecap="round" fill="none" {...props} />;
}
