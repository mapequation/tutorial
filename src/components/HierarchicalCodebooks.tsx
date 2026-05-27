import {
  Fragment,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import TeX from "@matejmazur/react-katex";
import { motion } from "framer-motion";
import { observer } from "mobx-react";
import { Network } from "../model";
import type RandomWalker from "../model/algorithms/RandomWalker";
import {
  hierarchical_paper_toy,
  hierarchicalPaperToyTopology,
  paperToyFineModules,
} from "../networks";
import Button from "./Button";
import { EnterFlow, ExitFlow } from "./CodeBooks";
import Flow from "./CodeBooks/Flow";
import Walker from "./Network/Walker";
import WalkTrace from "./Network/WalkTrace";
import { darkenHexColor, scheme } from "./scheme";

interface SvgViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PositionedNode {
  id: number;
  name: string;
  x: number;
  y: number;
}

interface FineModuleVisual {
  key: string;
  topIndex: number;
  localIndex: number;
  label: string;
  nodeIds: [number, number, number];
  color: string;
}

interface TopModuleVisual {
  key: string;
  topIndex: number;
  label: string;
  cornerNodeIds: [number, number, number];
  color: string;
}

interface CodelengthRow {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface CodelengthGroup {
  key: string;
  title: string;
  total: number;
  rows: CodelengthRow[];
  formula?: ReactNode;
  calculation?: ReactNode;
  note?: ReactNode;
}

interface TrianglePoint {
  x: number;
  y: number;
}

interface RecursiveTriangleModule {
  key: string;
  path: number[];
  level: number;
  corners: [TrianglePoint, TrianglePoint, TrianglePoint];
}

type NetworkViewVariant = "multilevel" | "two-level";
type CodebookBlockKind = "enter" | "exit" | "node";
type CodebookColumnKey =
  | "multilevel-top-index"
  | "multilevel-sub-index"
  | "multilevel-module"
  | "two-level-index"
  | "two-level-module";
type HoverTarget =
  | { variant: NetworkViewVariant; kind: "top"; topIndex: number }
  | { variant: NetworkViewVariant; kind: "fine"; fineIndex: number }
  | { variant: NetworkViewVariant; kind: "node"; nodeId: number };

interface CodebookActivation {
  itemKeys: Set<string>;
  connectorKeys: Set<string>;
  columnUseCounts: Map<CodebookColumnKey, number>;
}

interface CodebookColumnCounterState {
  stepsSinceLast: number | null;
  activationCount: number;
}

const VIEWBOX = {
  width: 800,
  height: 390,
} as const;

const ROOT_VIEWBOX: SvgViewBox = {
  x: 0,
  y: 24,
  width: VIEWBOX.width,
  height: VIEWBOX.height,
};

const NODE_RADIUS = 6.8;
const LINK_STROKE_WIDTH = 1.15;
const LINK_STROKE = "#9ca3af";
const TRIANGLE_EDGE_LENGTH = 52;
const TRIANGLE_HEIGHT = (Math.sqrt(3) / 2) * TRIANGLE_EDGE_LENGTH;
const TOP_TRIANGLE_ANCHOR = { x: 400, y: 66 } as const;
const ROMAN_MODULE_LABELS = ["I", "II", "III"] as const;
const FINE_MODULE_LABELS = ["a", "b", "c"] as const;
const TWO_LEVEL_MODULE_LABELS = [
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
] as const;
const MODULE_COLOR_INDEXES = [
  [0, 3, 7],
  [1, 15, 26],
  [2, 5, 4],
] as const;
const CODEBOOK_BLOCK = {
  width: 40,
  height: 9,
  gap: 1,
  pointer: 6.4,
} as const;
const CODEBOOK_PULSE_FADE_STEPS = 5;
const CODEBOOK_PULSE_JITTER_X = [0, 1.6, -1.2, 0.8, 0];
const HIERARCHICAL_COMPARISON_GRID_CLASS =
  "mx-auto grid w-full max-w-6xl gap-x-4 gap-y-6 lg:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)] lg:items-start";
const CODEBOOK_COLUMN_KEYS: CodebookColumnKey[] = [
  "multilevel-top-index",
  "multilevel-sub-index",
  "multilevel-module",
  "two-level-index",
  "two-level-module",
];
const CODEBOOK_STACK_HEIGHT = 230;
const INTER_MODULE_LINK_WEIGHT = 0.85;
const RECURSIVE_TRIANGLE_LEVELS = 6;
const RECURSIVE_ZOOM_DURATION_MS = 1700;
const RECURSIVE_LEAF_NODE_INSET_RATIO = 0.333;
const RECURSIVE_LEVEL_LABELS = [
  ["I", "II", "III"],
  ["a", "b", "c"],
  ["1", "2", "3"],
  ["A", "B", "C"],
  ["x", "y", "z"],
] as const;
const RECURSIVE_COLOR_FAMILIES = [
  [
    ["#efab6a", "#e78c6e", "#f3aa92"],
    ["#d7be92", "#d2a251", "#ae8635"],
    ["#ceaa9e", "#c29669", "#a68679"],
    ["#d7be61", "#b2a24d", "#a28a5d"],
    ["#c67551", "#aea282", "#9a9a61"],
  ],
  [
    ["#b2ce75", "#82d79e", "#79d7be"],
    ["#aacac2", "#79b696", "#55c2ba"],
    ["#aecaa6", "#9aae96", "#719a82"],
    ["#a6b65d", "#8a9a45", "#82a26d"],
    ["#8ebaba", "#69aaaa", "#55a26d"],
  ],
  [
    ["#75a6d7", "#79d2df", "#8acaf3"],
    ["#a6aaef", "#8e8ace", "#a6a2c2"],
    ["#aec2ef", "#9eb6c6", "#838eab"],
    ["#8aa2ba", "#7592ca", "#7596a2"],
    ["#69b6ca", "#419eb2", "#8aa29e"],
  ],
] as const;
const RECURSIVE_VIEWBOX = {
  width: 460,
  height: 400,
} as const;
const RECURSIVE_STRUCTURE_HELP =
  "The Sierpiński triangle is a recursive structure: the same triangular pattern repeats inside itself at smaller and smaller scales.";
const RECURSIVE_ROOT_CORNERS: [TrianglePoint, TrianglePoint, TrianglePoint] = [
  { x: 230, y: 42 },
  { x: 100, y: 267 },
  { x: 360, y: 267 },
];

const bigTriangleAnchors = [
  TOP_TRIANGLE_ANCHOR,
  {
    x: TOP_TRIANGLE_ANCHOR.x - TRIANGLE_EDGE_LENGTH * 2,
    y: TOP_TRIANGLE_ANCHOR.y + TRIANGLE_HEIGHT * 4,
  },
  {
    x: TOP_TRIANGLE_ANCHOR.x + TRIANGLE_EDGE_LENGTH * 2,
    y: TOP_TRIANGLE_ANCHOR.y + TRIANGLE_HEIGHT * 4,
  },
] as const;

const bigTriangleOffsets = [
  { x: 0, y: 0 },
  { x: TRIANGLE_EDGE_LENGTH / 2, y: TRIANGLE_HEIGHT },
  { x: -TRIANGLE_EDGE_LENGTH / 2, y: TRIANGLE_HEIGHT },
  { x: -TRIANGLE_EDGE_LENGTH, y: TRIANGLE_HEIGHT * 2 },
  { x: -TRIANGLE_EDGE_LENGTH / 2, y: TRIANGLE_HEIGHT * 3 },
  { x: -TRIANGLE_EDGE_LENGTH * 1.5, y: TRIANGLE_HEIGHT * 3 },
  { x: TRIANGLE_EDGE_LENGTH, y: TRIANGLE_HEIGHT * 2 },
  { x: TRIANGLE_EDGE_LENGTH * 1.5, y: TRIANGLE_HEIGHT * 3 },
  { x: TRIANGLE_EDGE_LENGTH / 2, y: TRIANGLE_HEIGHT * 3 },
] as const;

const topModules: TopModuleVisual[] = ROMAN_MODULE_LABELS.map(
  (label, topIndex) => {
    const firstNodeId = topIndex * 9 + 1;
    const color =
      scheme[MODULE_COLOR_INDEXES[topIndex]?.[0] ?? topIndex] ?? scheme[0];

    return {
      key: `top-module-${label}`,
      topIndex,
      label,
      cornerNodeIds: [firstNodeId, firstNodeId + 5, firstNodeId + 7],
      color,
    };
  },
);

const fineModules: FineModuleVisual[] = Array.from(
  { length: 9 },
  (_, fineIndex) => {
    const topIndex = Math.floor(fineIndex / 3);
    const localIndex = fineIndex % 3;
    const firstNodeId = fineIndex * 3 + 1;
    const colorIndex =
      MODULE_COLOR_INDEXES[topIndex]?.[localIndex] ?? fineIndex;

    return {
      key: `fine-module-${topIndex}-${localIndex}`,
      topIndex,
      localIndex,
      label: FINE_MODULE_LABELS[localIndex] ?? String(localIndex + 1),
      nodeIds: [firstNodeId, firstNodeId + 1, firstNodeId + 2],
      color: scheme[colorIndex] ?? scheme[fineIndex] ?? scheme[0],
    };
  },
);

function formatViewBox(viewBox: SvgViewBox) {
  return `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;
}

function interpolateViewBox(
  start: SvgViewBox,
  end: SvgViewBox,
  progress: number,
): SvgViewBox {
  return {
    x: start.x + (end.x - start.x) * progress,
    y: start.y + (end.y - start.y) * progress,
    width: start.width + (end.width - start.width) * progress,
    height: start.height + (end.height - start.height) * progress,
  };
}

function easeInOutCubic(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function useAnimatedViewBox(target: SvgViewBox, durationMs = 1500) {
  const [animatedViewBox, setAnimatedViewBox] = useState(target);
  const currentViewBox = useRef(target);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (frame.current !== null) {
      window.cancelAnimationFrame(frame.current);
    }

    const start = currentViewBox.current;
    const startTime = window.performance.now();

    const animate = (time: number) => {
      const progress = Math.min(1, (time - startTime) / durationMs);
      const nextViewBox = interpolateViewBox(
        start,
        target,
        easeInOutCubic(progress),
      );

      currentViewBox.current = nextViewBox;
      setAnimatedViewBox(nextViewBox);

      if (progress < 1) {
        frame.current = window.requestAnimationFrame(animate);
        return;
      }

      currentViewBox.current = target;
      setAnimatedViewBox(target);
      frame.current = null;
    };

    frame.current = window.requestAnimationFrame(animate);

    return () => {
      if (frame.current !== null) {
        window.cancelAnimationFrame(frame.current);
      }
    };
  }, [durationMs, target.x, target.y, target.width, target.height]);

  return animatedViewBox;
}

function buildPositionedNodes(): PositionedNode[] {
  return hierarchicalPaperToyTopology.nodes
    .map((node) => {
      const anchor = bigTriangleAnchors[Math.floor((node.id - 1) / 9)] ?? {
        x: VIEWBOX.width / 2,
        y: VIEWBOX.height / 2,
      };
      const offset = bigTriangleOffsets[(node.id - 1) % 9] ?? { x: 0, y: 0 };

      return {
        id: node.id,
        name: (((node.id - 1) % 3) + 1).toString(),
        x: anchor.x + offset.x,
        y: anchor.y + offset.y,
      };
    })
    .sort((left, right) => left.id - right.id);
}

function getFineModuleIndexForNodeId(nodeId: number) {
  return Math.floor((nodeId - 1) / 3);
}

function getTopModuleIndexForNodeId(nodeId: number) {
  return Math.floor((nodeId - 1) / 9);
}

function getFineModuleForNodeId(nodeId: number) {
  return fineModules[getFineModuleIndexForNodeId(nodeId)] ?? fineModules[0];
}

function getTrianglePoints(
  nodeById: Map<number, PositionedNode>,
  nodeIds: [number, number, number],
) {
  return nodeIds
    .map((nodeId) => nodeById.get(nodeId))
    .filter((node): node is PositionedNode => node !== undefined);
}

function formatPolygonPoints(points: PositionedNode[]) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function expandTrianglePoints(points: PositionedNode[], scale: number) {
  const center = getCentroid(points);

  return points.map((point) => ({
    ...point,
    x: center.x + (point.x - center.x) * scale,
    y: center.y + (point.y - center.y) * scale,
  }));
}

function getCentroid(points: PositionedNode[]) {
  const total = points.reduce(
    (sum, point) => ({
      x: sum.x + point.x,
      y: sum.y + point.y,
    }),
    { x: 0, y: 0 },
  );

  return {
    x: total.x / Math.max(1, points.length),
    y: total.y / Math.max(1, points.length),
  };
}

function getTriangleCentroid(
  corners: [TrianglePoint, TrianglePoint, TrianglePoint],
) {
  return {
    x: (corners[0].x + corners[1].x + corners[2].x) / 3,
    y: (corners[0].y + corners[1].y + corners[2].y) / 3,
  };
}

function formatTrianglePoints(
  points: [TrianglePoint, TrianglePoint, TrianglePoint],
) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function formatTriangleNodePoints(nodes: { x: number; y: number }[]) {
  return nodes.map((node) => `${node.x},${node.y}`).join(" ");
}

function getTriangleHeight(
  corners: [TrianglePoint, TrianglePoint, TrianglePoint],
) {
  const yValues = corners.map((point) => point.y);

  return Math.max(...yValues) - Math.min(...yValues);
}

function getRecursiveModuleLabel(path: number[]) {
  if (path.length === 0) {
    return "";
  }

  const levelLabels = RECURSIVE_LEVEL_LABELS[path.length - 1];
  const localIndex = path[path.length - 1] ?? 0;

  return levelLabels?.[localIndex] ?? String(localIndex + 1);
}

function getRecursivePathLabel(path: number[]) {
  return path
    .map((_, index) => getRecursiveModuleLabel(path.slice(0, index + 1)))
    .join(".");
}

function getRecursiveModuleColor(path: number[]) {
  if (path.length === 0) {
    return "#111827";
  }

  const familyIndex = path[0] ?? 0;
  const localIndex = path[path.length - 1] ?? 0;
  const family =
    RECURSIVE_COLOR_FAMILIES[familyIndex % RECURSIVE_COLOR_FAMILIES.length] ??
    RECURSIVE_COLOR_FAMILIES[0];
  const levelPalette =
    family[Math.min(path.length - 1, family.length - 1)] ?? family[0];

  return levelPalette[localIndex % levelPalette.length] ?? levelPalette[0];
}

function hexToRgb(hexColor: string) {
  const parsed = Number.parseInt(hexColor.replace("#", ""), 16);

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

function interpolateHexColor(start: string, end: string, progress: number) {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const from = hexToRgb(start);
  const to = hexToRgb(end);

  return rgbToHex({
    r: from.r + (to.r - from.r) * clampedProgress,
    g: from.g + (to.g - from.g) * clampedProgress,
    b: from.b + (to.b - from.b) * clampedProgress,
  });
}

function getCodebookPulseProgress(age: number | null) {
  if (age === null) {
    return null;
  }

  return Math.max(
    0,
    Math.min(1, age / Math.max(CODEBOOK_PULSE_FADE_STEPS - 1, 1)),
  );
}

function getCodebookPulseFill(baseColor: string, age: number | null) {
  const progress = getCodebookPulseProgress(age);

  if (progress === null) {
    return baseColor;
  }

  return interpolateHexColor(darkenHexColor(baseColor, 0.42), baseColor, progress);
}

function getCodebookPulseOpacity(
  baseOpacity: number,
  activeOpacity: number,
  age: number | null,
) {
  const progress = getCodebookPulseProgress(age);

  if (progress === null) {
    return baseOpacity;
  }

  return activeOpacity + (baseOpacity - activeOpacity) * progress;
}

function getCodebookPulseJitterX(age: number | null) {
  return age === 0 ? CODEBOOK_PULSE_JITTER_X : 0;
}

function weightedMixHexColors(parts: { color: string; weight: number }[]) {
  const totalWeight = parts.reduce((total, part) => total + part.weight, 0);

  if (totalWeight <= 0) {
    return "#111827";
  }

  const mixed = parts.reduce(
    (total, part) => {
      const rgb = hexToRgb(part.color);

      return {
        r: total.r + rgb.r * part.weight,
        g: total.g + rgb.g * part.weight,
        b: total.b + rgb.b * part.weight,
      };
    },
    { r: 0, g: 0, b: 0 },
  );

  return rgbToHex({
    r: mixed.r / totalWeight,
    g: mixed.g / totalWeight,
    b: mixed.b / totalWeight,
  });
}

function getRecursiveLeafColor(path: number[]) {
  if (path.length === 0) {
    return "#111827";
  }

  const family =
    RECURSIVE_COLOR_FAMILIES[
      (path[0] ?? 0) % RECURSIVE_COLOR_FAMILIES.length
    ] ?? RECURSIVE_COLOR_FAMILIES[0];
  const levelWeights = [0.24, 0.22, 0.2, 0.18, 0.16];

  return weightedMixHexColors(
    path.map((segment, index) => {
      const palette = family[Math.min(index, family.length - 1)] ?? family[0];

      return {
        color: palette[segment % palette.length] ?? palette[0],
        weight: levelWeights[index] ?? 0.14,
      };
    }),
  );
}

function getRecursivePathLevelColor(path: number[], levelIndex: number) {
  const family =
    RECURSIVE_COLOR_FAMILIES[
      (path[0] ?? 0) % RECURSIVE_COLOR_FAMILIES.length
    ] ?? RECURSIVE_COLOR_FAMILIES[0];
  const clampedLevelIndex = Math.max(
    0,
    Math.min(levelIndex, path.length - 1, family.length - 1),
  );
  const palette = family[clampedLevelIndex] ?? family[0];
  const segment = path[clampedLevelIndex] ?? 0;

  return palette[segment % palette.length] ?? palette[0];
}

function getRecursiveModuleAreaColor(path: number[]): string {
  if (path.length === 0) {
    return "#111827";
  }

  const currentColor = getRecursivePathLevelColor(path, path.length - 1);

  if (path.length === 1) {
    return currentColor;
  }

  return weightedMixHexColors([
    { color: getRecursiveModuleAreaColor(path.slice(0, -1)), weight: 0.34 },
    { color: currentColor, weight: 0.66 },
  ]);
}

function getRecursiveModuleAreaOpacity(module_: RecursiveTriangleModule) {
  return Math.min(0.34, 0.12 + module_.level * 0.045);
}

function getRecursiveLabelOpacity(module_: RecursiveTriangleModule) {
  return Math.max(0.52, 0.95 - module_.level * 0.08);
}

function isPointInsideTriangle(
  point: TrianglePoint,
  corners: [TrianglePoint, TrianglePoint, TrianglePoint],
) {
  const [first, second, third] = corners;
  const sign = (
    current: TrianglePoint,
    left: TrianglePoint,
    right: TrianglePoint,
  ) =>
    (current.x - right.x) * (left.y - right.y) -
    (left.x - right.x) * (current.y - right.y);
  const firstSign = sign(point, first, second);
  const secondSign = sign(point, second, third);
  const thirdSign = sign(point, third, first);
  const hasNegative = firstSign < 0 || secondSign < 0 || thirdSign < 0;
  const hasPositive = firstSign > 0 || secondSign > 0 || thirdSign > 0;

  return !(hasNegative && hasPositive);
}

function midpoint(left: TrianglePoint, right: TrianglePoint): TrianglePoint {
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
  };
}

function getRecursiveTriangleChildren(
  module_: RecursiveTriangleModule,
): RecursiveTriangleModule[] {
  const [top, left, right] = module_.corners;
  const topLeft = midpoint(top, left);
  const topRight = midpoint(top, right);
  const bottom = midpoint(left, right);
  const nextLevel = module_.level + 1;

  return [
    {
      key: [...module_.path, 0].join("."),
      path: [...module_.path, 0],
      level: nextLevel,
      corners: [top, topLeft, topRight],
    },
    {
      key: [...module_.path, 1].join("."),
      path: [...module_.path, 1],
      level: nextLevel,
      corners: [topLeft, left, bottom],
    },
    {
      key: [...module_.path, 2].join("."),
      path: [...module_.path, 2],
      level: nextLevel,
      corners: [topRight, bottom, right],
    },
  ];
}

function buildRecursiveTriangleModules() {
  const root: RecursiveTriangleModule = {
    key: "root",
    path: [],
    level: 0,
    corners: RECURSIVE_ROOT_CORNERS,
  };
  const modules: RecursiveTriangleModule[] = [];

  function visit(module_: RecursiveTriangleModule) {
    modules.push(module_);

    if (module_.level >= RECURSIVE_TRIANGLE_LEVELS - 1) {
      return;
    }

    getRecursiveTriangleChildren(module_).forEach(visit);
  }

  visit(root);

  return modules;
}

function samePath(left: number[], right: number[]) {
  return (
    left.length === right.length &&
    left.every((segment, index) => segment === right[index])
  );
}

function isDirectChild(path: number[], selectedPath: number[]) {
  return (
    path.length === selectedPath.length + 1 &&
    selectedPath.every((segment, index) => path[index] === segment)
  );
}

function recursivePathStartsWith(path: number[], prefix: number[]) {
  return prefix.every((segment, index) => path[index] === segment);
}

function getConvexHull(points: TrianglePoint[]) {
  const uniquePoints = Array.from(
    new Map(
      points.map((point) => [
        `${point.x.toFixed(5)}:${point.y.toFixed(5)}`,
        point,
      ]),
    ).values(),
  ).sort((left, right) =>
    left.x === right.x ? left.y - right.y : left.x - right.x,
  );

  if (uniquePoints.length <= 2) {
    return uniquePoints;
  }

  const cross = (
    origin: TrianglePoint,
    left: TrianglePoint,
    right: TrianglePoint,
  ) =>
    (left.x - origin.x) * (right.y - origin.y) -
    (left.y - origin.y) * (right.x - origin.x);
  const lower: TrianglePoint[] = [];
  const upper: TrianglePoint[] = [];

  uniquePoints.forEach((point) => {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0
    ) {
      lower.pop();
    }

    lower.push(point);
  });

  [...uniquePoints].reverse().forEach((point) => {
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0
    ) {
      upper.pop();
    }

    upper.push(point);
  });

  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function getTriangleViewBox(
  corners: [TrianglePoint, TrianglePoint, TrianglePoint],
  reserveTopLabel = false,
): SvgViewBox {
  const xValues = corners.map((point) => point.x);
  const yValues = corners.map((point) => point.y);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const rawWidth = maxX - minX;
  const rawHeight = maxY - minY;
  const aspect = RECURSIVE_VIEWBOX.width / RECURSIVE_VIEWBOX.height;
  const horizontalPadding = rawWidth * 0.022;
  const topPadding = reserveTopLabel
    ? Math.max(rawHeight * 0.095, 2.2)
    : rawHeight * 0.035;
  const bottomPadding = rawHeight * 0.035;
  const requestedWidth = rawWidth + horizontalPadding * 2;
  const requestedHeight = rawHeight + topPadding + bottomPadding;
  const width =
    requestedWidth / requestedHeight > aspect
      ? requestedWidth
      : requestedHeight * aspect;
  const height = width / aspect;
  const extraHeight = Math.max(0, height - requestedHeight);
  const center = {
    x: (minX + maxX) / 2,
    y: minY - topPadding - extraHeight * 0.08 + height / 2,
  };

  return {
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
  };
}

function getRecursiveInterModuleLinkWeight(parentLevel: number) {
  const exponent = RECURSIVE_TRIANGLE_LEVELS - 1 - parentLevel;

  return Number(Math.pow(INTER_MODULE_LINK_WEIGHT, exponent).toFixed(6));
}

function buildRecursiveLeafNetwork(modules: RecursiveTriangleModule[]) {
  const leafModules = modules.filter(
    (module_) => module_.level === RECURSIVE_TRIANGLE_LEVELS - 1,
  );
  const nonLeafModules = modules.filter(
    (module_) => module_.level < RECURSIVE_TRIANGLE_LEVELS - 1,
  );
  const nodes: {
    id: number;
    x: number;
    y: number;
    paths: string[];
  }[] = [];
  const links = new Map<
    string,
    { source: number; target: number; weight: number }
  >();
  const nodeIdsByLeafPath = new Map<string, number[]>();
  const addLink = (source: number, target: number, weight: number) => {
    const key = source < target ? `${source}-${target}` : `${target}-${source}`;
    links.set(key, { source, target, weight });
  };
  const nodeIdsForModule = (module_: RecursiveTriangleModule) =>
    Array.from(nodeIdsByLeafPath.entries())
      .filter(([leafPathKey]) =>
        recursivePathStartsWith(
          parseRecursivePathKey(leafPathKey),
          module_.path,
        ),
      )
      .flatMap(([, nodeIds]) => nodeIds);
  const nearestNodePair = (
    leftNodeIds: number[],
    rightNodeIds: number[],
  ): { source: number; target: number; distance: number } | null => {
    let nearest: { source: number; target: number; distance: number } | null =
      null;

    for (const leftNodeId of leftNodeIds) {
      const leftNode = nodes[leftNodeId - 1];

      for (const rightNodeId of rightNodeIds) {
        const rightNode = nodes[rightNodeId - 1];
        const distance = Math.hypot(
          leftNode.x - rightNode.x,
          leftNode.y - rightNode.y,
        );

        if (!nearest || distance < nearest.distance) {
          nearest = {
            source: leftNode.id,
            target: rightNode.id,
            distance,
          };
        }
      }
    }

    return nearest;
  };

  leafModules.forEach((module_) => {
    const centroid = getTriangleCentroid(module_.corners);
    const inset =
      getTriangleHeight(module_.corners) * RECURSIVE_LEAF_NODE_INSET_RATIO;
    const nodeIds = module_.corners.map((point) => {
      const dx = centroid.x - point.x;
      const dy = centroid.y - point.y;
      const distance = Math.hypot(dx, dy) || 1;
      const next = {
        id: nodes.length + 1,
        x: point.x + (dx / distance) * inset,
        y: point.y + (dy / distance) * inset,
        paths: [module_.key],
      };

      nodes.push(next);
      return next.id;
    });

    nodeIdsByLeafPath.set(module_.key, nodeIds);

    [
      [nodeIds[0], nodeIds[1]],
      [nodeIds[1], nodeIds[2]],
      [nodeIds[2], nodeIds[0]],
    ].forEach(([source, target]) => {
      addLink(source, target, 1);
    });
  });

  nonLeafModules.forEach((module_) => {
    const childModules = getRecursiveTriangleChildren(module_);

    if (childModules.length !== 3) {
      return;
    }

    [
      [childModules[0], childModules[1]],
      [childModules[0], childModules[2]],
      [childModules[1], childModules[2]],
    ].forEach(([leftModule, rightModule]) => {
      const pair = nearestNodePair(
        nodeIdsForModule(leftModule),
        nodeIdsForModule(rightModule),
      );

      if (pair) {
        addLink(
          pair.source,
          pair.target,
          getRecursiveInterModuleLinkWeight(module_.level),
        );
      }
    });
  });

  return {
    nodes,
    links: Array.from(links.values()),
  };
}

function serializeRecursiveNetworkToPajek(
  leafNetwork: ReturnType<typeof buildRecursiveLeafNetwork>,
) {
  const vertices = leafNetwork.nodes
    .slice()
    .sort((left, right) => left.id - right.id)
    .map((node) => `${node.id} "${node.id}"`);
  const edges = leafNetwork.links
    .slice()
    .sort((left, right) =>
      left.source === right.source
        ? left.target - right.target
        : left.source - right.source,
    )
    .map((link) => `${link.source} ${link.target} ${link.weight}`);

  return [
    `*Vertices ${leafNetwork.nodes.length}`,
    ...vertices,
    "*Edges",
    ...edges,
  ].join("\n");
}

function serializeNetworkToPajek(network: typeof hierarchicalPaperToyTopology) {
  const vertices = network.nodes
    .slice()
    .sort((left, right) => left.id - right.id)
    .map((node) => `${node.id} "${node.name ?? node.id}"`);
  const edges = network.links
    .slice()
    .sort((left, right) =>
      left.source === right.source
        ? left.target - right.target
        : left.source - right.source,
    )
    .map((link) => `${link.source} ${link.target} ${link.weight}`);

  return [
    `*Vertices ${network.nodes.length}`,
    ...vertices,
    "*Edges",
    ...edges,
  ].join("\n");
}

function parseRecursivePathKey(pathKey: string) {
  return pathKey
    .split(".")
    .map((segment) => Number(segment))
    .filter((segment) => Number.isFinite(segment));
}

function getRecursiveNodePath(paths: string[]) {
  const selectedPath = [...paths].sort()[0] ?? "";

  return parseRecursivePathKey(selectedPath).map((segment) => segment + 1);
}

function getRecursiveLeafModuleId(paths: string[]) {
  const selectedPath = [...paths].sort()[0] ?? "";

  return (
    parseRecursivePathKey(selectedPath).reduce(
      (moduleId, segment) => moduleId * 3 + segment,
      0,
    ) + 1
  );
}

function getRecursiveNodeColor(paths: string[]) {
  const selectedPath = [...paths].sort()[0] ?? "";

  return getRecursiveLeafColor(parseRecursivePathKey(selectedPath));
}

function createRecursiveCodelengthNetwork(
  leafNetwork: ReturnType<typeof buildRecursiveLeafNetwork>,
  mode: "multilevel" | "two-level",
) {
  return Network.parse({
    flowModel: "undirected",
    nodes: leafNetwork.nodes.map((node) => ({
      id: node.id,
      name: node.id.toString(),
      x: node.x,
      y: node.y,
      path:
        mode === "multilevel"
          ? getRecursiveNodePath(node.paths)
          : [getRecursiveLeafModuleId(node.paths)],
    })),
    links: leafNetwork.links.map((link) => ({
      source: link.source,
      target: link.target,
      weight: link.weight,
    })),
  });
}

function buildRecursiveCodelengthGroups(
  leafNetwork: ReturnType<typeof buildRecursiveLeafNetwork>,
): CodelengthGroup[] {
  const multilevelNetwork = createRecursiveCodelengthNetwork(
    leafNetwork,
    "multilevel",
  );
  const recursiveTwoLevelIndexCodelength = 0.505699323;
  const recursiveTwoLevelModuleCodelength = 3.579372421;
  const levelCodelengths = Array.from(
    { length: RECURSIVE_TRIANGLE_LEVELS - 1 },
    () => 0,
  );
  let nodeModuleCodelength = 0;

  for (const module_ of multilevelNetwork.tree.depthFirstModules()) {
    if (module_.isLeafModule) {
      nodeModuleCodelength += module_.codelength;
      continue;
    }

    levelCodelengths[module_.depth] += module_.codelength;
  }

  return [
    {
      key: "recursive-multilevel",
      title: "Multilevel codelength",
      total: multilevelNetwork.mapequation.codelength,
      rows: [
        ...levelCodelengths.map((value, levelIndex) => ({
          key: `recursive-level-${levelIndex + 1}`,
          label: `Level ${levelIndex + 1} index (${RECURSIVE_LEVEL_LABELS[
            levelIndex
          ].join(", ")})`,
          value,
          color: getRecursiveModuleColor([levelIndex % 3]),
        })),
        {
          key: "recursive-node-modules",
          label: "Bottom node modules",
          value: nodeModuleCodelength,
          color: "#111827",
        },
      ],
    },
    {
      key: "recursive-two-level",
      title: "Two-level codelength",
      total:
        recursiveTwoLevelIndexCodelength + recursiveTwoLevelModuleCodelength,
      rows: [
        {
          key: "recursive-two-level-index",
          label: "Index (A, B, C)",
          value: recursiveTwoLevelIndexCodelength,
          color: "#4b5563",
        },
        {
          key: "recursive-two-level-modules",
          label: "Node modules",
          value: recursiveTwoLevelModuleCodelength,
          color: "#111827",
        },
      ],
    },
  ];
}

function createTwoLevelNetwork() {
  const network = Network.parse(hierarchical_paper_toy);

  paperToyFineModules.forEach((module_) => {
    module_.nodeIds.forEach((nodeId) => {
      network.getNode(nodeId)?.setPath([module_.id]);
    });
  });

  return network.finalize();
}

function applyPaperToyPositions(network: Network) {
  const positions = buildPositionedNodes();

  positions.forEach((position) => {
    const node = network.getNode(position.id);

    if (!node) {
      return;
    }

    node.x = position.x;
    node.y = position.y;
  });

  return network;
}

function createHierarchicalWalkerNetwork() {
  const network = applyPaperToyPositions(Network.parse(hierarchical_paper_toy));

  network.walker.setTeleportRate(0);

  return network;
}

function addColumnUse(
  columnUseCounts: Map<CodebookColumnKey, number>,
  columnKey: CodebookColumnKey,
) {
  columnUseCounts.set(columnKey, (columnUseCounts.get(columnKey) ?? 0) + 1);
}

function getCodebookActivationForTransition(
  variant: NetworkViewVariant,
  currentNodeId: number | null,
  previousNodeId: number | null,
): CodebookActivation {
  const itemKeys = new Set<string>();
  const connectorKeys = new Set<string>();
  const columnUseCounts = new Map<CodebookColumnKey, number>();

  if (currentNodeId === null) {
    return { itemKeys, connectorKeys, columnUseCounts };
  }

  const currentFineIndex = getFineModuleIndexForNodeId(currentNodeId);
  const currentFineModule = fineModules[currentFineIndex];

  if (!currentFineModule) {
    return { itemKeys, connectorKeys, columnUseCounts };
  }

  const currentNodeLocalIndex = currentFineModule.nodeIds.indexOf(
    currentNodeId,
  );
  const previousFineIndex =
    previousNodeId === null ? null : getFineModuleIndexForNodeId(previousNodeId);
  const previousFineModule =
    previousFineIndex === null ? null : fineModules[previousFineIndex];
  const currentTopIndex = getTopModuleIndexForNodeId(currentNodeId);
  const previousTopIndex =
    previousNodeId === null ? null : getTopModuleIndexForNodeId(previousNodeId);
  const changedFineModule =
    previousFineIndex === null || previousFineIndex !== currentFineIndex;
  const changedTopModule =
    previousTopIndex === null || previousTopIndex !== currentTopIndex;

  if (variant === "multilevel") {
    itemKeys.add(`multilevel-node-${currentFineModule.key}-${currentNodeId}`);
    connectorKeys.add(
      `multilevel-sub-to-node-${currentFineModule.key}-${currentNodeLocalIndex}`,
    );
    addColumnUse(columnUseCounts, "multilevel-module");

    if (changedFineModule) {
      itemKeys.add(`subindex-enter-${currentFineModule.key}`);
      connectorKeys.add(
        `multilevel-top-to-sub-${currentTopIndex}-${currentFineModule.localIndex}`,
      );
      addColumnUse(columnUseCounts, "multilevel-sub-index");
    }

    if (previousFineModule && changedFineModule) {
      itemKeys.add(`multilevel-exit-${previousFineModule.key}`);
      connectorKeys.add(`multilevel-sub-to-node-${previousFineModule.key}-3`);
      addColumnUse(columnUseCounts, "multilevel-module");
    }

    if (changedTopModule) {
      const currentTopModule = topModules[currentTopIndex];

      if (currentTopModule) {
        itemKeys.add(`top-index-${currentTopModule.key}`);
        addColumnUse(columnUseCounts, "multilevel-top-index");
      }
    }

    if (previousTopIndex !== null && changedTopModule) {
      const previousTopModule = topModules[previousTopIndex];

      if (previousTopModule) {
        itemKeys.add(`subindex-exit-${previousTopModule.key}`);
        connectorKeys.add(`multilevel-top-to-sub-${previousTopIndex}-3`);
        addColumnUse(columnUseCounts, "multilevel-sub-index");
      }
    }

    return { itemKeys, connectorKeys, columnUseCounts };
  }

  itemKeys.add(`two-level-node-${currentFineModule.key}-${currentNodeId}`);
  connectorKeys.add(
    `two-level-index-to-node-${currentFineModule.key}-${currentNodeLocalIndex}`,
  );
  addColumnUse(columnUseCounts, "two-level-module");

  if (changedFineModule) {
    itemKeys.add(`two-level-index-${currentFineModule.key}`);
    addColumnUse(columnUseCounts, "two-level-index");
  }

  if (previousFineModule && changedFineModule) {
    itemKeys.add(`two-level-exit-${previousFineModule.key}`);
    connectorKeys.add(`two-level-index-to-node-${previousFineModule.key}-3`);
    addColumnUse(columnUseCounts, "two-level-module");
  }

  return { itemKeys, connectorKeys, columnUseCounts };
}

function getCodebookActiveItemKeys(walker: RandomWalker) {
  const activeKeys = new Set<string>();

  if (walker.totalVisits <= 1) {
    return activeKeys;
  }

  (["multilevel", "two-level"] as const).forEach((variant) => {
    const activation = getCodebookActivationForTransition(
      variant,
      walker.current?.id ?? null,
      walker.prev?.id ?? null,
    );

    activation.itemKeys.forEach((key) => activeKeys.add(key));
  });

  return activeKeys;
}

function getRecentCodebookPulseAges(walker: RandomWalker) {
  const itemAges = new Map<string, number>();
  const connectorAges = new Map<string, number>();
  const trace = Array.from(walker.trace);
  const firstVisibleStep = walker.totalVisits - trace.length + 1;

  for (let traceIndex = trace.length - 1; traceIndex >= 0; traceIndex--) {
    const stepNumber = firstVisibleStep + traceIndex;
    const age = walker.totalVisits - stepNumber;

    if (stepNumber <= 1 || age >= CODEBOOK_PULSE_FADE_STEPS) {
      continue;
    }

    const currentNodeId = trace[traceIndex];
    const previousNodeId = traceIndex > 0 ? trace[traceIndex - 1] : null;

    (["multilevel", "two-level"] as const).forEach((variant) => {
      const activation = getCodebookActivationForTransition(
        variant,
        currentNodeId,
        previousNodeId,
      );

      activation.itemKeys.forEach((key) => {
        if (!itemAges.has(key)) {
          itemAges.set(key, age);
        }
      });
      activation.connectorKeys.forEach((key) => {
        if (!connectorAges.has(key)) {
          connectorAges.set(key, age);
        }
      });
    });
  }

  return { itemAges, connectorAges };
}

function createEmptyColumnActivationTotals() {
  return new Map<CodebookColumnKey, number>(
    CODEBOOK_COLUMN_KEYS.map((columnKey) => [columnKey, 0] as const),
  );
}

function useCodebookColumnActivationTotals(walker: RandomWalker) {
  const totalsRef = useRef(createEmptyColumnActivationTotals());
  const lastProcessedStepRef = useRef(0);
  const trace = Array.from(walker.trace);
  const totalVisits = walker.totalVisits;
  const firstVisibleStep = totalVisits - trace.length + 1;
  const shouldReset = totalVisits < lastProcessedStepRef.current;

  if (shouldReset) {
    totalsRef.current = createEmptyColumnActivationTotals();
    lastProcessedStepRef.current = 0;
  }

  trace.forEach((currentNodeId, traceIndex) => {
    const stepNumber = firstVisibleStep + traceIndex;

    if (stepNumber <= 1 || stepNumber <= lastProcessedStepRef.current) {
      return;
    }

    const previousNodeId = traceIndex > 0 ? trace[traceIndex - 1] : null;

    (["multilevel", "two-level"] as const).forEach((variant) => {
      const activation = getCodebookActivationForTransition(
        variant,
        currentNodeId,
        previousNodeId,
      );

      activation.columnUseCounts.forEach((useCount, columnKey) => {
        totalsRef.current.set(
          columnKey,
          (totalsRef.current.get(columnKey) ?? 0) + useCount,
        );
      });
    });

    lastProcessedStepRef.current = stepNumber;
  });

  return totalsRef.current;
}

function getCodebookColumnCounters(
  walker: RandomWalker,
  activationTotals: Map<CodebookColumnKey, number>,
) {
  const lastUsedStep = new Map<CodebookColumnKey, number>();
  const trace = Array.from(walker.trace);
  const firstVisibleStep = walker.totalVisits - trace.length + 1;

  trace.forEach((currentNodeId, traceIndex) => {
    const stepNumber = firstVisibleStep + traceIndex;

    if (stepNumber <= 1) {
      return;
    }

    const previousNodeId = traceIndex > 0 ? trace[traceIndex - 1] : null;

    (["multilevel", "two-level"] as const).forEach((variant) => {
      const activation = getCodebookActivationForTransition(
        variant,
        currentNodeId,
        previousNodeId,
      );

      activation.columnUseCounts.forEach((useCount, columnKey) => {
        if (useCount <= 0) {
          return;
        }

        lastUsedStep.set(columnKey, traceIndex + 1);
      });
    });
  });

  return new Map(
    CODEBOOK_COLUMN_KEYS.map((columnKey) => {
      const lastStep = lastUsedStep.get(columnKey);
      const stepsSinceLast =
        lastStep === undefined
          ? trace.length > 0 && walker.totalVisits > trace.length
            ? -trace.length
            : null
          : trace.length - lastStep;

      return [
        columnKey,
        {
          stepsSinceLast,
          activationCount: activationTotals.get(columnKey) ?? 0,
        },
      ] as const;
    }),
  );
}

function buildCodelengthGroups(): CodelengthGroup[] {
  const multilevelNetwork = Network.parse(hierarchical_paper_toy);
  const twoLevelNetwork = createTwoLevelNetwork();
  let topIndex = 0;
  let submoduleIndex = 0;
  let multilevelModules = 0;

  for (const module_ of multilevelNetwork.tree.depthFirstModules()) {
    if (module_.isLeafModule) {
      multilevelModules += module_.codelength;
      continue;
    }

    if (module_.depth === 0) {
      topIndex += module_.codelength;
      continue;
    }

    submoduleIndex += module_.codelength;
  }

  return [
    {
      key: "multilevel",
      title: "Multilevel codelength",
      total: multilevelNetwork.mapequation.codelength,
      note:
        "The multilevel sum combines the top index, lower indexes inside top modules, and local module codebooks for node visits and exits.",
      formula: (
        <TeX math="L_{\mathrm{multi}}(M)=q_{\curvearrowright}H(\mathcal{Q})+\sum_i q_{\circlearrowright}^{i}H(\mathcal{Q}^{i})+\sum_{ij}p_{\circlearrowright}^{ij}H(\mathcal{P}^{ij})" />
      ),
      calculation: (
        <TeX
          math={`L_{\\mathrm{multi}}=${topIndex.toFixed(3)}+${submoduleIndex.toFixed(3)}+${multilevelModules.toFixed(3)}=${multilevelNetwork.mapequation.codelength.toFixed(3)}\\ \\text{bits}`}
        />
      ),
      rows: [
        {
          key: "top-index",
          label: "Level 1 index (I-III)",
          value: topIndex,
          color: topModules[0].color,
        },
        {
          key: "submodule-index",
          label: "Level 2 index (a-c)",
          value: submoduleIndex,
          color: topModules[1].color,
        },
        {
          key: "multilevel-modules",
          label: "Node modules (1-3)",
          value: multilevelModules,
          color: topModules[2].color,
        },
      ],
    },
    {
      key: "two-level",
      title: "Two-level codelength",
      total: twoLevelNetwork.mapequation.codelength,
      note:
        "The two-level sum has one flat index term plus the local module-codebook terms for node visits and exits.",
      formula: (
        <TeX math="L_{\mathrm{two}}(M)=q_{\curvearrowright}H(\mathcal{Q})+\sum_i p_{\circlearrowright}^{i}H(\mathcal{P}^{i})" />
      ),
      calculation: (
        <TeX
          math={`L_{\\mathrm{two}}=${twoLevelNetwork.mapequation.indexCodelength.toFixed(3)}+${twoLevelNetwork.mapequation.moduleCodelength.toFixed(3)}=${twoLevelNetwork.mapequation.codelength.toFixed(3)}\\ \\text{bits}`}
        />
      ),
      rows: [
        {
          key: "two-level-index",
          label: "Index (a-i)",
          value: twoLevelNetwork.mapequation.indexCodelength,
          color: scheme[0],
        },
        {
          key: "two-level-modules",
          label: "Node modules (1-3)",
          value: twoLevelNetwork.mapequation.moduleCodelength,
          color: scheme[2],
        },
      ],
    },
  ];
}

function formatBits(value: number) {
  return `${value.toFixed(3)} bits`;
}

function formatStepsSinceUsed(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "not used";
  }

  if (value === 0) {
    return "now";
  }

  if (value < 0) {
    return `${Math.abs(value)}+ steps ago`;
  }

  return value === 1 ? "1 step ago" : `${value} steps ago`;
}

function CodelengthGroupView({ group }: { group: CodelengthGroup }) {
  const labelColumnWidth = Math.min(
    42,
    Math.max(
      group.title.length,
      ...group.rows.map((row) => row.label.length),
      12,
    ) + 1,
  );

  return (
    <div className="w-max max-w-full p-1">
      {(group.note || group.formula || group.calculation) && (
        <div className="mb-3 max-w-xl space-y-1.5">
          {group.note && (
            <p className="m-0 text-sm leading-relaxed text-gray-600">
              {group.note}
            </p>
          )}
          {group.formula && (
            <div className="overflow-x-auto py-1 text-base leading-8 text-gray-900">
              {group.formula}
            </div>
          )}
          {group.calculation && (
            <div className="overflow-x-auto py-1 text-base leading-8 text-gray-900">
              {group.calculation}
            </div>
          )}
        </div>
      )}
      <div
        className="grid items-baseline gap-x-3 gap-y-1.5"
        style={{
          gridTemplateColumns: `minmax(0, ${labelColumnWidth}ch) 8ch`,
        }}
      >
        <h3 className="m-0 text-base font-bold text-gray-900">{group.title}</h3>
        <div className="text-right font-mono text-sm font-black text-gray-900">
          {formatBits(group.total)}
        </div>
        {group.rows.map((row) => (
          <Fragment key={row.key}>
            <span className="min-w-0 font-semibold leading-snug text-gray-700">
              {row.label}
            </span>
            <span className="text-right font-mono text-xs font-bold text-gray-900">
              {formatBits(row.value)}
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function CodelengthBreakdown() {
  const groups = useMemo(() => {
    const groupsByKey = new Map(
      buildCodelengthGroups().map((group) => [group.key, group]),
    );

    return ["two-level", "multilevel"]
      .map((key) => groupsByKey.get(key))
      .filter((group): group is CodelengthGroup => Boolean(group));
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <p className="m-0 max-w-4xl text-sm leading-relaxed text-gray-600">
        Following the paper calculation, every term is a codebook contribution:
        how often that codebook is used multiplied by the entropy of the
        symbols in it. The total codelength is the sum of those contributions.
      </p>
      <div className="grid gap-8 md:grid-cols-2">
        {groups.map((group) => (
          <CodelengthGroupView key={group.key} group={group} />
        ))}
      </div>
    </div>
  );
}

function CodebookBlock({
  x,
  y,
  width = CODEBOOK_BLOCK.width,
  height = CODEBOOK_BLOCK.height,
  color,
  kind,
  label,
  active = false,
  pulseAge = null,
  duration,
}: {
  x: number;
  y: number;
  width?: number;
  height?: number;
  color: string;
  kind: CodebookBlockKind;
  label?: string;
  active?: boolean;
  pulseAge?: number | null;
  duration: number;
}) {
  const fill = active
    ? darkenHexColor(color, 0.34)
    : getCodebookPulseFill(color, pulseAge);
  const stroke = darkenHexColor(color, active ? 0.48 : 0.24);
  const commonProps = {
    initial: {
      fill: color,
      fillOpacity: 0.88,
      translateX: 0,
    },
    animate: {
      fill,
      fillOpacity: getCodebookPulseOpacity(0.88, 1, active ? 0 : pulseAge),
      translateX: getCodebookPulseJitterX(active ? 0 : pulseAge),
    },
    transition: { duration },
    stroke,
    strokeWidth: active || pulseAge === 0 ? 1.35 : 1,
    vectorEffect: "non-scaling-stroke" as const,
    style: {
      transformBox: "fill-box" as const,
      transformOrigin: "left center" as const,
    },
  };
  const shape =
    kind === "enter" ? (
      <EnterFlow
        {...commonProps}
        x={x}
        y={y + height}
        width={width}
        height={height}
        dx={CODEBOOK_BLOCK.pointer}
      />
    ) : kind === "exit" ? (
      <ExitFlow
        {...commonProps}
        x={x}
        y={y + height}
        width={width - CODEBOOK_BLOCK.pointer}
        height={height}
        dx={CODEBOOK_BLOCK.pointer}
      />
    ) : (
      <Flow
        {...commonProps}
        x={x}
        y={y + height}
        width={width}
        height={height}
      />
    );

  return (
    <g>
      {shape}
      {label && (
        <motion.text
          x={x + width / 2}
          y={y + height / 2 + 0.6}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={Math.max(2.8, height * 0.62)}
          fontWeight={900}
          initial={{ fill: "#111827", translateX: 0 }}
          animate={{
            fill:
              active || pulseAge === 0
                ? "#ffffff"
                : "#111827",
            translateX: getCodebookPulseJitterX(active ? 0 : pulseAge),
          }}
          transition={{ duration }}
          style={{
            transformBox: "fill-box",
            transformOrigin: "left center",
          }}
          pointerEvents="none"
        >
          {label}
        </motion.text>
      )}
    </g>
  );
}

function Connector({
  startX,
  startTop,
  startBottom,
  endX,
  endTop,
  endBottom,
  color,
  opacity = 0.24,
  pulseAge = null,
  duration,
}: {
  startX: number;
  startTop: number;
  startBottom: number;
  endX: number;
  endTop: number;
  endBottom: number;
  color: string;
  opacity?: number;
  pulseAge?: number | null;
  duration: number;
}) {
  const span = endX - startX;
  const firstControlX = startX + span * 0.28;
  const secondControlX = endX - span * 0.28;
  const path = [
    `M ${startX} ${startTop}`,
    `C ${firstControlX} ${startTop} ${secondControlX} ${endTop} ${endX} ${endTop}`,
    `L ${endX} ${endBottom}`,
    `C ${secondControlX} ${endBottom} ${firstControlX} ${startBottom} ${startX} ${startBottom}`,
    "Z",
  ].join(" ");

  return (
    <motion.path
      d={path}
      initial={{
        fill: color,
        fillOpacity: opacity,
      }}
      animate={{
        fill: getCodebookPulseFill(color, pulseAge),
        fillOpacity: getCodebookPulseOpacity(opacity, 0.56, pulseAge),
      }}
      transition={{ duration }}
      stroke="none"
    />
  );
}

interface CodebookStackItem {
  key: string;
  kind: CodebookBlockKind;
  color: string;
  label?: string;
  variant: NetworkViewVariant;
  role: "top" | "fine" | "node";
  topIndex?: number;
  fineIndex?: number;
  nodeId?: number;
}

function isCodebookItemActive(
  item: CodebookStackItem,
  hoveredTarget: HoverTarget | null,
  activeItemKeys: Set<string>,
) {
  if (activeItemKeys.has(item.key)) {
    return true;
  }

  if (item.kind === "exit") {
    return false;
  }

  if (!hoveredTarget) {
    return false;
  }

  if (item.variant !== hoveredTarget.variant) {
    return false;
  }

  if (hoveredTarget.kind === "top") {
    return item.role === "top" && item.topIndex === hoveredTarget.topIndex;
  }

  if (hoveredTarget.kind === "fine") {
    return item.role === "fine" && item.fineIndex === hoveredTarget.fineIndex;
  }

  return item.role === "node" && item.nodeId === hoveredTarget.nodeId;
}

function getHoverTargetForCodebookItem(
  item: CodebookStackItem,
): HoverTarget | null {
  if (item.role === "top" && item.topIndex !== undefined) {
    return {
      variant: item.variant,
      kind: "top",
      topIndex: item.topIndex,
    };
  }

  if (item.role === "fine" && item.fineIndex !== undefined) {
    return {
      variant: item.variant,
      kind: "fine",
      fineIndex: item.fineIndex,
    };
  }

  if (item.role === "node" && item.nodeId !== undefined) {
    return {
      variant: item.variant,
      kind: "node",
      nodeId: item.nodeId,
    };
  }

  return null;
}

function getStackMetrics(itemCount: number, maxHeight = CODEBOOK_STACK_HEIGHT) {
  const naturalTotal =
    itemCount * CODEBOOK_BLOCK.height +
    Math.max(0, itemCount - 1) * CODEBOOK_BLOCK.gap;

  if (naturalTotal <= maxHeight) {
    return {
      blockHeight: CODEBOOK_BLOCK.height,
      gap: CODEBOOK_BLOCK.gap,
      offsetY: (maxHeight - naturalTotal) / 2,
    };
  }

  const gap = 0.3;

  return {
    blockHeight: (maxHeight - Math.max(0, itemCount - 1) * gap) / itemCount,
    gap,
    offsetY: 0,
  };
}

function getStackBlockY({
  stackY,
  itemIndex,
  itemCount,
  maxHeight = CODEBOOK_STACK_HEIGHT,
}: {
  stackY: number;
  itemIndex: number;
  itemCount: number;
  maxHeight?: number;
}) {
  const { blockHeight, gap, offsetY } = getStackMetrics(itemCount, maxHeight);

  return stackY + offsetY + itemIndex * (blockHeight + gap);
}

function getStackBlockCenterY({
  stackY,
  itemIndex,
  itemCount,
  maxHeight = CODEBOOK_STACK_HEIGHT,
}: {
  stackY: number;
  itemIndex: number;
  itemCount: number;
  maxHeight?: number;
}) {
  const { blockHeight } = getStackMetrics(itemCount, maxHeight);

  return (
    getStackBlockY({ stackY, itemIndex, itemCount, maxHeight }) +
    blockHeight / 2
  );
}

function getStackBlockBounds({
  stackY,
  itemIndex,
  itemCount,
  maxHeight = CODEBOOK_STACK_HEIGHT,
}: {
  stackY: number;
  itemIndex: number;
  itemCount: number;
  maxHeight?: number;
}) {
  const { blockHeight } = getStackMetrics(itemCount, maxHeight);
  const top = getStackBlockY({ stackY, itemIndex, itemCount, maxHeight });

  return {
    top,
    bottom: top + blockHeight,
    height: blockHeight,
  };
}

function getStackBlockSliceBounds({
  stackY,
  itemIndex,
  itemCount,
  sliceIndex,
  sliceCount,
  maxHeight = CODEBOOK_STACK_HEIGHT,
}: {
  stackY: number;
  itemIndex: number;
  itemCount: number;
  sliceIndex: number;
  sliceCount: number;
  maxHeight?: number;
}) {
  const bounds = getStackBlockBounds({
    stackY,
    itemIndex,
    itemCount,
    maxHeight,
  });
  const sliceHeight = bounds.height / sliceCount;
  const top = bounds.top + sliceIndex * sliceHeight;

  return {
    top,
    bottom:
      sliceIndex === sliceCount - 1
        ? bounds.bottom
        : top + sliceHeight,
  };
}

function CodebookStack({
  x,
  y,
  items,
  hoveredTarget,
  activeItemKeys,
  itemPulseAges,
  duration,
  onHoverTargetChange,
}: {
  x: number;
  y: number;
  items: CodebookStackItem[];
  hoveredTarget: HoverTarget | null;
  activeItemKeys: Set<string>;
  itemPulseAges: Map<string, number>;
  duration: number;
  onHoverTargetChange: (target: HoverTarget | null) => void;
}) {
  const { blockHeight } = getStackMetrics(items.length);

  return (
    <g>
      {items.map((item, itemIndex) => {
        const target = getHoverTargetForCodebookItem(item);

        return (
          <g
            key={item.key}
            onMouseEnter={() => onHoverTargetChange(target)}
            onMouseLeave={() => onHoverTargetChange(null)}
          >
            <CodebookBlock
              x={x}
              y={getStackBlockY({
                stackY: y,
                itemIndex,
                itemCount: items.length,
              })}
              height={blockHeight}
              color={item.color}
              kind={item.kind}
              label={item.label}
              active={isCodebookItemActive(item, hoveredTarget, activeItemKeys)}
              pulseAge={itemPulseAges.get(item.key) ?? null}
              duration={duration}
            />
          </g>
        );
      })}
    </g>
  );
}

function CodebookColumnCounter({
  x,
  y,
  counter,
  showLastUsed = true,
}: {
  x: number;
  y: number;
  counter: CodebookColumnCounterState | undefined;
  showLastUsed?: boolean;
}) {
  const activationCount = counter?.activationCount ?? 0;

  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontSize={7.2}
      fontWeight={800}
      fill="#4b5563"
    >
      {showLastUsed && (
        <tspan x={x}>
          last: {formatStepsSinceUsed(counter?.stepsSinceLast)}
        </tspan>
      )}
      <tspan x={x} dy={showLastUsed ? 9.2 : 0}>
        total: {activationCount}
      </tspan>
    </text>
  );
}

const CodebookComparison = observer(function CodebookComparison({
  walker,
  hoveredTarget,
  onHoverTargetChange,
}: {
  walker: RandomWalker;
  hoveredTarget: HoverTarget | null;
  onHoverTargetChange: (target: HoverTarget | null) => void;
}) {
  const panelY = 8;
  const multilevelSvgWidth = 330;
  const twoLevelSvgWidth = 300;
  const codebookSvgHeight = 274;
  const topIndexX = 42;
  const subIndexX = 132;
  const moduleX = 240;
  const twoLevelIndexX = 78;
  const twoLevelModuleX = 182;
  const duration = (0.5 * walker.interval) / 1000;
  const activeItemKeys = getCodebookActiveItemKeys(walker);
  const { itemAges, connectorAges } = getRecentCodebookPulseAges(walker);
  const columnActivationTotals = useCodebookColumnActivationTotals(walker);
  const columnCounters = getCodebookColumnCounters(
    walker,
    columnActivationTotals,
  );
  const topIndexItems: CodebookStackItem[] = topModules.map((module_) => ({
    key: `top-index-${module_.key}`,
    kind: "enter",
    color: module_.color,
    label: module_.label,
    variant: "multilevel",
    role: "top",
    topIndex: module_.topIndex,
  }));
  const subIndexItems: CodebookStackItem[] = topModules.flatMap((topModule) => [
    ...fineModules
      .filter((module_) => module_.topIndex === topModule.topIndex)
      .map((module_, localIndex) => ({
        key: `subindex-enter-${module_.key}`,
        kind: "enter" as const,
        color: module_.color,
        label: module_.label,
        variant: "multilevel" as const,
        role: "fine" as const,
        topIndex: topModule.topIndex,
        fineIndex: topModule.topIndex * 3 + localIndex,
      })),
    {
      key: `subindex-exit-${topModule.key}`,
      kind: "exit" as const,
      color: topModule.color,
      variant: "multilevel" as const,
      role: "top" as const,
      topIndex: topModule.topIndex,
    },
  ]);
  const multilevelModuleItems: CodebookStackItem[] = fineModules.flatMap(
    (module_, fineIndex) => [
      ...module_.nodeIds.map((nodeId, nodeIndex) => ({
        key: `multilevel-node-${module_.key}-${nodeId}`,
        kind: "node" as const,
        color: module_.color,
        label: (nodeIndex + 1).toString(),
        variant: "multilevel" as const,
        role: "node" as const,
        fineIndex,
        nodeId,
      })),
      {
        key: `multilevel-exit-${module_.key}`,
        kind: "exit" as const,
        color: module_.color,
        variant: "multilevel" as const,
        role: "fine" as const,
        fineIndex,
      },
    ],
  );
  const twoLevelIndexItems: CodebookStackItem[] = fineModules.map(
    (module_, fineIndex) => ({
      key: `two-level-index-${module_.key}`,
      kind: "enter",
      color: module_.color,
      label: TWO_LEVEL_MODULE_LABELS[fineIndex],
      variant: "two-level",
      role: "fine",
      fineIndex,
    }),
  );
  const twoLevelModuleItems: CodebookStackItem[] = fineModules.flatMap(
    (module_, fineIndex) => [
      ...module_.nodeIds.map((nodeId, nodeIndex) => ({
        key: `two-level-node-${module_.key}-${nodeId}`,
        kind: "node" as const,
        color: module_.color,
        label: (nodeIndex + 1).toString(),
        variant: "two-level" as const,
        role: "node" as const,
        fineIndex,
        nodeId,
      })),
      {
        key: `two-level-exit-${module_.key}`,
        kind: "exit" as const,
        color: module_.color,
        variant: "two-level" as const,
        role: "fine" as const,
        fineIndex,
      },
    ],
  );
  const subIndexItemIndex = (module_: FineModuleVisual) =>
    module_.topIndex * 4 + module_.localIndex;
  const subIndexExitItemIndex = (topIndex: number) => topIndex * 4 + 3;
  const moduleItemIndex = (fineIndex: number, localIndex: number) =>
    fineIndex * 4 + localIndex;

  return (
    <div className={`-mt-6 p-0 ${HIERARCHICAL_COMPARISON_GRID_CLASS}`}>
      <h3 className="sr-only">Codebook comparison</h3>
      <svg
        viewBox={`0 0 ${twoLevelSvgWidth} ${codebookSvgHeight}`}
        className="mx-auto block w-full max-w-[23rem] overflow-visible"
        role="img"
        aria-label="Two-level codebook comparison"
      >
        {fineModules.map((module_, fineIndex) => {
          return (
            <g key={`two-level-module-connectors-${module_.key}`}>
              {[0, 1, 2, 3].map((localIndex) => {
                const sourceBounds = getStackBlockSliceBounds({
                  stackY: panelY,
                  itemIndex: fineIndex,
                  itemCount: twoLevelIndexItems.length,
                  sliceIndex: localIndex,
                  sliceCount: 4,
                });
                const targetBounds = getStackBlockBounds({
                  stackY: panelY,
                  itemIndex: moduleItemIndex(fineIndex, localIndex),
                  itemCount: twoLevelModuleItems.length,
                });

                return (
                  <Connector
                    key={`two-level-index-to-node-${module_.key}-${localIndex}`}
                    startX={twoLevelIndexX + CODEBOOK_BLOCK.width}
                    startTop={sourceBounds.top}
                    startBottom={sourceBounds.bottom}
                    endX={twoLevelModuleX}
                    endTop={targetBounds.top}
                    endBottom={targetBounds.bottom}
                    color={module_.color}
                    opacity={localIndex === 3 ? 0.32 : 0.24}
                    pulseAge={
                      connectorAges.get(
                        `two-level-index-to-node-${module_.key}-${localIndex}`,
                      ) ?? null
                    }
                    duration={duration}
                  />
                );
              })}
            </g>
          );
        })}
        <CodebookStack
          x={twoLevelIndexX}
          y={panelY}
          items={twoLevelIndexItems}
          hoveredTarget={hoveredTarget}
          activeItemKeys={activeItemKeys}
          itemPulseAges={itemAges}
          duration={duration}
          onHoverTargetChange={onHoverTargetChange}
        />
        <CodebookStack
          x={twoLevelModuleX}
          y={panelY}
          items={twoLevelModuleItems}
          hoveredTarget={hoveredTarget}
          activeItemKeys={activeItemKeys}
          itemPulseAges={itemAges}
          duration={duration}
          onHoverTargetChange={onHoverTargetChange}
        />
        <CodebookColumnCounter
          x={twoLevelIndexX + CODEBOOK_BLOCK.width / 2}
          y={250}
          counter={columnCounters.get("two-level-index")}
        />
        <CodebookColumnCounter
          x={twoLevelModuleX + CODEBOOK_BLOCK.width / 2}
          y={250}
          counter={columnCounters.get("two-level-module")}
          showLastUsed={false}
        />
      </svg>
      <div className="hidden lg:block" aria-hidden="true" />
      <svg
        viewBox={`0 0 ${multilevelSvgWidth} ${codebookSvgHeight}`}
        className="mx-auto block w-full max-w-[27rem] overflow-visible"
        role="img"
        aria-label="Multilevel codebook comparison"
      >
        {topModules.map((topModule) => {
          return (
            <g key={`multilevel-top-connectors-${topModule.key}`}>
              {[
                ...fineModules.filter(
                  (module_) => module_.topIndex === topModule.topIndex,
                ),
                null,
              ].map((module_, localIndex) => {
                const sourceBounds = getStackBlockSliceBounds({
                  stackY: panelY,
                  itemIndex: topModule.topIndex,
                  itemCount: topIndexItems.length,
                  sliceIndex: localIndex,
                  sliceCount: 4,
                });
                const targetBounds = getStackBlockBounds({
                  stackY: panelY,
                  itemIndex:
                    module_ === null
                      ? subIndexExitItemIndex(topModule.topIndex)
                      : subIndexItemIndex(module_),
                  itemCount: subIndexItems.length,
                });

                return (
                  <Connector
                    key={`top-to-sub-${topModule.topIndex}-${localIndex}`}
                    startX={topIndexX + CODEBOOK_BLOCK.width}
                    startTop={sourceBounds.top}
                    startBottom={sourceBounds.bottom}
                    endX={subIndexX}
                    endTop={targetBounds.top}
                    endBottom={targetBounds.bottom}
                    color={module_?.color ?? topModule.color}
                    opacity={module_ === null ? 0.32 : 0.24}
                    pulseAge={
                      connectorAges.get(
                        `multilevel-top-to-sub-${topModule.topIndex}-${localIndex}`,
                      ) ?? null
                    }
                    duration={duration}
                  />
                );
              })}
            </g>
          );
        })}
        {fineModules.map((module_, fineIndex) => {
          return (
            <g key={`multilevel-module-connectors-${module_.key}`}>
              {[0, 1, 2, 3].map((localIndex) => {
                const sourceBounds = getStackBlockSliceBounds({
                  stackY: panelY,
                  itemIndex: subIndexItemIndex(module_),
                  itemCount: subIndexItems.length,
                  sliceIndex: localIndex,
                  sliceCount: 4,
                });
                const targetBounds = getStackBlockBounds({
                  stackY: panelY,
                  itemIndex: moduleItemIndex(fineIndex, localIndex),
                  itemCount: multilevelModuleItems.length,
                });

                return (
                  <Connector
                    key={`sub-to-node-${module_.key}-${localIndex}`}
                    startX={subIndexX + CODEBOOK_BLOCK.width}
                    startTop={sourceBounds.top}
                    startBottom={sourceBounds.bottom}
                    endX={moduleX}
                    endTop={targetBounds.top}
                    endBottom={targetBounds.bottom}
                    color={module_.color}
                    opacity={localIndex === 3 ? 0.32 : 0.24}
                    pulseAge={
                      connectorAges.get(
                        `multilevel-sub-to-node-${module_.key}-${localIndex}`,
                      ) ?? null
                    }
                    duration={duration}
                  />
                );
              })}
            </g>
          );
        })}
        <CodebookStack
          x={topIndexX}
          y={panelY}
          items={topIndexItems}
          hoveredTarget={hoveredTarget}
          activeItemKeys={activeItemKeys}
          itemPulseAges={itemAges}
          duration={duration}
          onHoverTargetChange={onHoverTargetChange}
        />
        <CodebookStack
          x={subIndexX}
          y={panelY}
          items={subIndexItems}
          hoveredTarget={hoveredTarget}
          activeItemKeys={activeItemKeys}
          itemPulseAges={itemAges}
          duration={duration}
          onHoverTargetChange={onHoverTargetChange}
        />
        <CodebookStack
          x={moduleX}
          y={panelY}
          items={multilevelModuleItems}
          hoveredTarget={hoveredTarget}
          activeItemKeys={activeItemKeys}
          itemPulseAges={itemAges}
          duration={duration}
          onHoverTargetChange={onHoverTargetChange}
        />
        <CodebookColumnCounter
          x={topIndexX + CODEBOOK_BLOCK.width / 2}
          y={250}
          counter={columnCounters.get("multilevel-top-index")}
        />
        <CodebookColumnCounter
          x={subIndexX + CODEBOOK_BLOCK.width / 2}
          y={250}
          counter={columnCounters.get("multilevel-sub-index")}
        />
        <CodebookColumnCounter
          x={moduleX + CODEBOOK_BLOCK.width / 2}
          y={250}
          counter={columnCounters.get("multilevel-module")}
          showLastUsed={false}
        />
      </svg>
    </div>
  );
});

const HierarchicalWalkerControls = observer(function HierarchicalWalkerControls({
  network,
  speed,
  onSpeedChange,
}: {
  network: Network;
  speed: number;
  onSpeedChange: (speed: number) => void;
}) {
  const { walker } = network;
  const buttonStyle = {
    padding: "0.35rem 0.75rem",
    fontSize: "0.85rem",
    textAlign: "center",
    justifyContent: "center",
  } as const;

  return (
    <div className="flex flex-row flex-nowrap items-center justify-center gap-3 overflow-x-auto py-2 text-sm lg:flex-col lg:justify-start lg:overflow-visible lg:px-2 lg:pt-24 xl:items-center">
      <Button
        className="button shrink-0 whitespace-nowrap"
        style={{ ...buttonStyle, width: "4.8rem" }}
        onClick={() => {
          walker.reset();
          walker.step();
        }}
      >
        Reset
      </Button>
      <Button
        className="button shrink-0 whitespace-nowrap"
        style={{ ...buttonStyle, width: "4.4rem" }}
        onClick={() => walker.step()}
      >
        Step
      </Button>
      <Button
        className={`button shrink-0 whitespace-nowrap ${walker.isStarted ? "button--primary" : ""}`}
        style={{ ...buttonStyle, width: "5.8rem" }}
        onClick={() => (walker.isStarted ? walker.stop() : walker.start())}
      >
        {walker.isStarted ? "Stop" : "Start"}
      </Button>
      <label className="flex shrink-0 flex-col items-center gap-1 text-xs font-semibold text-gray-600">
        <input
          className="h-4 w-28 lg:w-24"
          type="range"
          min={1}
          max={12}
          step={1}
          value={speed}
          onChange={(event) => onSpeedChange(Number(event.target.value))}
        />
        <span>{speed} steps/s</span>
      </label>
    </div>
  );
});

function RecursiveTriangleZoomNetwork() {
  const [selectedPath, setSelectedPath] = useState<number[]>([]);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const modules = useMemo(() => buildRecursiveTriangleModules(), []);
  const leafNetwork = useMemo(
    () => buildRecursiveLeafNetwork(modules),
    [modules],
  );
  const pajekNetwork = useMemo(
    () => serializeRecursiveNetworkToPajek(leafNetwork),
    [leafNetwork],
  );
  const recursiveCodelengthGroups = useMemo(
    () => buildRecursiveCodelengthGroups(leafNetwork),
    [leafNetwork],
  );
  const nodeById = useMemo(
    () => new Map(leafNetwork.nodes.map((node) => [node.id, node])),
    [leafNetwork.nodes],
  );
  const recursiveLeafNodeGroups = useMemo(() => {
    const groups = new Map<string, typeof leafNetwork.nodes>();

    leafNetwork.nodes.forEach((node) => {
      const pathKey = node.paths[0];

      groups.set(pathKey, [...(groups.get(pathKey) ?? []), node]);
    });

    return Array.from(groups.entries());
  }, [leafNetwork.nodes]);
  const selectedModule =
    modules.find((module_) => samePath(module_.path, selectedPath)) ??
    modules[0];
  const targetViewBox = getTriangleViewBox(
    selectedModule.corners,
    selectedPath.length > 0,
  );
  const animatedViewBox = useAnimatedViewBox(
    targetViewBox,
    RECURSIVE_ZOOM_DURATION_MS,
  );
  const directChildren = modules.filter((module_) =>
    isDirectChild(module_.path, selectedPath),
  );
  const labeledModules = modules.filter((module_) => module_.path.length > 0);
  const moduleAreaPointsByKey = useMemo(() => {
    const entries = modules
      .filter((module_) => module_.path.length > 0)
      .map((module_) => {
        const descendantPoints = leafNetwork.nodes
          .filter((node) =>
            recursivePathStartsWith(
              parseRecursivePathKey(node.paths[0]),
              module_.path,
            ),
          )
          .map((node) => ({ x: node.x, y: node.y }));

        return [module_.key, getConvexHull(descendantPoints)] as const;
      });

    return new Map(entries);
  }, [leafNetwork.nodes, modules]);
  const nodeRadius = Math.max(
    0.4,
    (animatedViewBox.width / RECURSIVE_VIEWBOX.width) * 1.55,
  );
  const selectedModuleHeight = getTriangleHeight(selectedModule.corners);
  const selectedPathFontSize = Math.max(1, selectedModuleHeight * 0.045);
  const selectedPathLabelOffset = Math.max(
    selectedPathFontSize * 0.82,
    selectedModuleHeight * 0.035,
  );
  const selectedPathLabelY =
    selectedModule.corners[0].y - selectedPathLabelOffset;
  const selectedPathLabelX =
    selectedModule.corners[0].x + selectedPathFontSize * 1.25;
  const canZoomOut = selectedPath.length > 0;
  const handleSvgBackgroundClick = (event: MouseEvent<SVGSVGElement>) => {
    if (!canZoomOut) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const point = {
      x:
        animatedViewBox.x +
        ((event.clientX - bounds.left) / bounds.width) * animatedViewBox.width,
      y:
        animatedViewBox.y +
        ((event.clientY - bounds.top) / bounds.height) * animatedViewBox.height,
    };

    if (!isPointInsideTriangle(point, selectedModule.corners)) {
      setSelectedPath((path) => path.slice(0, -1));
    }
  };
  const handleCopyPajek = async () => {
    try {
      await navigator.clipboard.writeText(pajekNetwork);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 1600);
    } catch {
      setCopyStatus("failed");
      window.setTimeout(() => setCopyStatus("idle"), 2200);
    }
  };

  return (
    <div className="mx-auto mt-8 max-w-4xl">
      <div className="mx-auto max-w-md">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="m-0 text-base font-bold text-gray-900">
            Sierpiński triangle
          </h3>
          <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
            <span>
              Level {selectedPath.length + 1} / {RECURSIVE_TRIANGLE_LEVELS}
            </span>
            <button
              type="button"
              className="rounded-full border border-gray-300 px-2 py-1"
              onClick={handleCopyPajek}
            >
              {copyStatus === "copied"
                ? "Copied"
                : copyStatus === "failed"
                  ? "Copy failed"
                  : "Copy Pajek"}
            </button>
            <button
              type="button"
              className="rounded-full border border-gray-300 px-2 py-1 disabled:opacity-40"
              disabled={!canZoomOut}
              onClick={() => setSelectedPath((path) => path.slice(0, -1))}
            >
              Back
            </button>
            <button
              type="button"
              className="rounded-full border border-gray-300 px-2 py-1 disabled:opacity-40"
              disabled={!canZoomOut}
              onClick={() => setSelectedPath([])}
            >
              Reset
            </button>
          </div>
        </div>
        <svg
          viewBox={formatViewBox(animatedViewBox)}
          className="block w-full overflow-hidden"
          style={{
            aspectRatio: `${RECURSIVE_VIEWBOX.width} / ${RECURSIVE_VIEWBOX.height}`,
          }}
          role="img"
          aria-label="Six-level Sierpiński triangle network"
          onClick={handleSvgBackgroundClick}
        >
          {labeledModules.map((module_) => {
            const areaPoints = moduleAreaPointsByKey.get(module_.key);

            if (!areaPoints || areaPoints.length < 3) {
              return null;
            }

            return (
              <polygon
                key={`recursive-module-area-${module_.key}`}
                points={formatTriangleNodePoints(areaPoints)}
                fill={getRecursiveModuleAreaColor(module_.path)}
                fillOpacity={getRecursiveModuleAreaOpacity(module_)}
                stroke="none"
                pointerEvents="none"
              />
            );
          })}
          {recursiveLeafNodeGroups.map(([pathKey, nodes]) => {
            const path = parseRecursivePathKey(pathKey);
            const color = getRecursiveLeafColor(path);

            if (nodes.length !== 3) {
              return null;
            }

            return (
              <polygon
                key={`recursive-leaf-fill-${pathKey}`}
                points={formatTriangleNodePoints(nodes)}
                fill={color}
                fillOpacity={0.3}
                stroke="none"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            );
          })}
          {leafNetwork.links.map((link) => {
            const source = nodeById.get(link.source);
            const target = nodeById.get(link.target);

            if (!source || !target) {
              return null;
            }

            return (
              <line
                key={`recursive-link-${link.source}-${link.target}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke="#374151"
                strokeOpacity={0.54}
                strokeLinecap="round"
                strokeWidth={1.1}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            );
          })}
          {leafNetwork.nodes.map((node) => {
            const color = getRecursiveNodeColor(node.paths);

            return (
              <circle
                key={`recursive-node-${node.id}`}
                cx={node.x}
                cy={node.y}
                r={nodeRadius}
                fill={darkenHexColor(color, 0.3)}
                fillOpacity={0.9}
                stroke="#ffffff"
                strokeWidth={0.8}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            );
          })}
          {labeledModules.map((module_) => {
            const center = getTriangleCentroid(module_.corners);
            const fontSize = Math.max(
              1.05,
              getTriangleHeight(module_.corners) * 0.16,
            );
            const label = getRecursiveModuleLabel(module_.path);
            const color = getRecursiveModuleAreaColor(module_.path);
            const opacity = getRecursiveLabelOpacity(module_);

            return (
              <text
                key={`recursive-label-${module_.key}`}
                x={center.x}
                y={center.y + fontSize * 0.1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={fontSize}
                fontWeight={900}
                fill={darkenHexColor(color, 0.68)}
                opacity={opacity}
                paintOrder="stroke"
                stroke="#ffffff"
                strokeWidth={fontSize * 0.14}
                pointerEvents="none"
              >
                {label}
              </text>
            );
          })}
          {selectedPath.length > 0 && (
            <text
              x={selectedPathLabelX}
              y={selectedPathLabelY}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={selectedPathFontSize}
              fontWeight={900}
              fill="#111827"
              paintOrder="stroke"
              stroke="#ffffff"
              strokeWidth={Math.max(
                0.22,
                selectedModuleHeight * 0.01,
              )}
              pointerEvents="none"
            >
              {getRecursivePathLabel(selectedPath)}
            </text>
          )}
          {directChildren.map((module_) => (
            <polygon
              key={`recursive-click-${module_.key}`}
              points={formatTrianglePoints(module_.corners)}
              fill="transparent"
              stroke="none"
              pointerEvents="all"
              className="cursor-pointer"
              onClick={(event) => {
                event.stopPropagation();
                setSelectedPath(module_.path);
              }}
            />
          ))}
        </svg>
      </div>
      <div className="mx-auto mt-4 grid max-w-max gap-8 md:grid-cols-[max-content_max-content]">
        {recursiveCodelengthGroups.map((group) => (
          <CodelengthGroupView key={group.key} group={group} />
        ))}
      </div>
    </div>
  );
}

const RawTopologyNetworkView = observer(function RawTopologyNetworkView({
  title,
  variant,
  walker,
  hoveredTarget,
  onHoverTargetChange,
}: {
  title: string;
  variant: NetworkViewVariant;
  walker: RandomWalker;
  hoveredTarget: HoverTarget | null;
  onHoverTargetChange: (target: HoverTarget | null) => void;
}) {
  const nodes = useMemo(() => buildPositionedNodes(), []);
  const nodeById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );

  return (
    <div className="space-y-3 text-center">
      <div className="mb-3">
        <h3 className="m-0 text-base font-bold text-gray-900">{title}</h3>
      </div>
      <div className="relative">
        {variant === "two-level" && (
          <div className="absolute right-2 top-2 z-10">
            <ComparisonNetworkPajekCopyButton />
          </div>
        )}
        <svg
          viewBox={formatViewBox(ROOT_VIEWBOX)}
          className="block w-full overflow-visible"
          style={{
            aspectRatio: `${ROOT_VIEWBOX.width} / ${ROOT_VIEWBOX.height}`,
          }}
          role="img"
          aria-label={title}
        >
          {variant === "multilevel" &&
            topModules.map((module_) => {
              const points = getTrianglePoints(nodeById, module_.cornerNodeIds);
              const topPoints = expandTrianglePoints(points, 1.32);
              const active =
                hoveredTarget?.variant === variant &&
                hoveredTarget.kind === "top" &&
                hoveredTarget.topIndex === module_.topIndex;

              if (points.length !== 3) {
                return null;
              }

              return (
                <polygon
                  key={module_.key}
                  points={formatPolygonPoints(topPoints)}
                  fill={module_.color}
                  fillOpacity={active ? 0.4 : 0.26}
                  stroke="none"
                  onMouseEnter={() =>
                    onHoverTargetChange({
                      variant,
                      kind: "top",
                      topIndex: module_.topIndex,
                    })
                  }
                  onMouseLeave={() => onHoverTargetChange(null)}
                />
              );
            })}
        {fineModules.map((module_, fineIndex) => {
          const points = getTrianglePoints(nodeById, module_.nodeIds);
          const active =
            hoveredTarget?.variant === variant &&
            hoveredTarget.kind === "fine" &&
            hoveredTarget.fineIndex === fineIndex;

          if (points.length !== 3) {
            return null;
          }

          return (
            <polygon
              key={module_.key}
              points={formatPolygonPoints(points)}
              fill={module_.color}
              fillOpacity={active ? 0.42 : 0.28}
              stroke={darkenHexColor(module_.color, 0.16)}
              strokeWidth={active ? 1.8 : 1.15}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              onMouseEnter={() =>
                onHoverTargetChange({
                  variant,
                  kind: "fine",
                  fineIndex,
                })
              }
              onMouseLeave={() => onHoverTargetChange(null)}
            />
          );
        })}
        {hierarchicalPaperToyTopology.links.map((link, index) => {
          const source = nodeById.get(link.source);
          const target = nodeById.get(link.target);

          if (!source || !target) {
            return null;
          }

          const sourceFineModule = getFineModuleForNodeId(link.source);
          const isWithinFineModule =
            getFineModuleIndexForNodeId(link.source) ===
            getFineModuleIndexForNodeId(link.target);
          const isWithinTopModule =
            getTopModuleIndexForNodeId(link.source) ===
            getTopModuleIndexForNodeId(link.target);

          return (
            <line
              key={`raw-link-${link.source}-${link.target}-${index}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={
                isWithinFineModule
                  ? darkenHexColor(sourceFineModule.color, 0.16)
                  : isWithinTopModule
                    ? darkenHexColor(sourceFineModule.color, 0.28)
                    : LINK_STROKE
              }
              strokeLinecap="round"
              strokeWidth={LINK_STROKE_WIDTH}
              vectorEffect="non-scaling-stroke"
              opacity={isWithinFineModule || isWithinTopModule ? 0.76 : 0.58}
            />
          );
        })}
        <WalkTrace
          walker={walker}
          stroke="#111827"
          opacity={0.28}
          minWidth={1.5}
          maxWidth={8}
          maxVisiblePaths={10}
          stableSegments
          getStableSegmentStroke={(source, target) => ({
            from: getFineModuleForNodeId(source.id).color,
            to: getFineModuleForNodeId(target.id).color,
          })}
        />
        {fineModules.map((module_, fineIndex) => {
          const points = getTrianglePoints(nodeById, module_.nodeIds);
          const center = getCentroid(points);
          const label =
            variant === "two-level"
              ? TWO_LEVEL_MODULE_LABELS[fineIndex]
              : module_.label;

          if (points.length !== 3) {
            return null;
          }

          return (
            <text
              key={`${module_.key}-label`}
              x={center.x}
              y={center.y + 1.5}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={12}
              fontWeight={900}
              fill={darkenHexColor(module_.color, 0.46)}
              paintOrder="stroke"
              stroke="#ffffff"
              strokeWidth={3}
              pointerEvents="none"
            >
              {label}
            </text>
          );
        })}
        {variant === "multilevel" &&
          topModules.map((module_) => {
            const points = getTrianglePoints(nodeById, module_.cornerNodeIds);
            const center = getCentroid(points);

            if (points.length !== 3) {
              return null;
            }

            return (
              <text
                key={`${module_.key}-label`}
                x={center.x}
                y={center.y + 3}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={18}
                fontWeight={900}
                fill={darkenHexColor(module_.color, 0.36)}
                paintOrder="stroke"
                stroke="#ffffff"
                strokeWidth={3.6}
                pointerEvents="none"
              >
                {module_.label}
              </text>
            );
          })}
        {nodes.map((node) => {
          const module_ = getFineModuleForNodeId(node.id);
          const active =
            hoveredTarget?.variant === variant &&
            hoveredTarget.kind === "node" &&
            hoveredTarget.nodeId === node.id;
          const visiting = walker.current?.id === node.id;

          return (
            <g
              key={`raw-node-${node.id}`}
              onMouseEnter={() =>
                onHoverTargetChange({ variant, kind: "node", nodeId: node.id })
              }
              onMouseLeave={() => onHoverTargetChange(null)}
            >
              <circle
                cx={node.x}
                cy={node.y}
                r={active || visiting ? NODE_RADIUS + 1 : NODE_RADIUS}
                fill={module_.color}
                fillOpacity={visiting ? 1 : 0.94}
                stroke={darkenHexColor(
                  module_.color,
                  active || visiting ? 0.52 : 0.28,
                )}
                strokeWidth={active || visiting ? 1.65 : 1.1}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={node.x}
                y={node.y + 0.25}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={6.6}
                fontWeight={800}
                fill="#111827"
                pointerEvents="none"
              >
                {node.name}
              </text>
            </g>
          );
        })}
        <Walker
          walker={walker}
          r={7.6}
          fill="#111827"
          teleportFill="#991b1b"
          stroke="#ffffff"
          strokeWidth={1.2}
          squishy={false}
        />
        </svg>
      </div>
    </div>
  );
});

function ComparisonNetworkPajekCopyButton() {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const pajekNetwork = useMemo(
    () => serializeNetworkToPajek(hierarchicalPaperToyTopology),
    [],
  );
  const handleCopyPajek = async () => {
    try {
      await navigator.clipboard.writeText(pajekNetwork);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 1600);
    } catch {
      setCopyStatus("failed");
      window.setTimeout(() => setCopyStatus("idle"), 2200);
    }
  };

  return (
    <button
      type="button"
      className="rounded-full border border-gray-300 bg-white/90 px-2 py-1 text-xs font-bold text-gray-600 shadow-sm"
      onClick={handleCopyPajek}
    >
      {copyStatus === "copied"
        ? "Copied"
        : copyStatus === "failed"
          ? "Copy failed"
          : "Copy Pajek"}
    </button>
  );
}

function HierarchicalCodebooks() {
  const [hoveredTarget, setHoveredTarget] = useState<HoverTarget | null>(null);
  const [walkerSpeed, setWalkerSpeed] = useState(3);
  const walkerNetwork = useMemo(() => createHierarchicalWalkerNetwork(), []);
  const handleWalkerSpeedChange = (speed: number) => {
    setWalkerSpeed(speed);
    walkerNetwork.walker.setSpeed(speed);
  };

  useEffect(() => {
    if (!walkerNetwork.walker.current) {
      walkerNetwork.walker.step();
    }

    return () => walkerNetwork.walker.stop();
  }, [walkerNetwork]);

  return (
    <section id="hierarchical-codebooks" className="col-span-4 mb-48">
      <div className="mb-8 max-w-4xl space-y-4">
        <p className="mb-2 text-sm font-black uppercase tracking-[0.22em] text-[#b22222]">
          Multilevel Infomap
        </p>
        <h2 className="m-0">Hierarchical codebooks</h2>
        <p className="m-0 text-lg leading-relaxed text-gray-700">
          Two-level Infomap gives us one flat layer of modules. Multilevel
          Infomap keeps the same compression idea, but lets a module be split
          again if that makes the flow description shorter.
        </p>
        <p className="m-0 text-gray-700">
          The result is a hierarchy of codebooks. A code can name a broad
          module, then a submodule, and only then the node or exit event. The
          levels are not chosen beforehand; they appear only when the added
          structure lowers codelength.
        </p>
      </div>

      <div className="space-y-3">
        <div className="max-w-4xl">
          <h3 className="mb-1 text-lg font-bold">
            Two descriptions of the same network
          </h3>
          <p className="m-0 text-sm leading-relaxed text-gray-600">
            The networks below use the same weighted nodes and links. The
            two-level network on the left puts all nine small modules in one
            flat index. The multilevel network on the right groups those same
            small modules into broader modules I-III.
          </p>
        </div>
        <div className={HIERARCHICAL_COMPARISON_GRID_CLASS}>
          <RawTopologyNetworkView
            title="Two-level network"
            variant="two-level"
            walker={walkerNetwork.walker}
            hoveredTarget={hoveredTarget}
            onHoverTargetChange={setHoveredTarget}
          />
          <div className="order-first lg:order-none">
            <HierarchicalWalkerControls
              network={walkerNetwork}
              speed={walkerSpeed}
              onSpeedChange={handleWalkerSpeedChange}
            />
          </div>
          <RawTopologyNetworkView
            title="Multilevel network"
            variant="multilevel"
            walker={walkerNetwork.walker}
            hoveredTarget={hoveredTarget}
            onHoverTargetChange={setHoveredTarget}
          />
        </div>
        <div className="max-w-4xl pt-3">
          <h3 className="mb-1 text-lg font-bold">Codebooks for each map</h3>
          <p className="m-0 text-sm leading-relaxed text-gray-600">
            The stacks show what each description has to print. The two-level
            map uses fewer stages. The multilevel map uses more stages, but the
            codebooks used most often can be smaller and cheaper.
          </p>
        </div>
        <CodebookComparison
          walker={walkerNetwork.walker}
          hoveredTarget={hoveredTarget}
          onHoverTargetChange={setHoveredTarget}
        />
        <div className="max-w-5xl pt-3 text-sm leading-relaxed text-gray-600">
          <h3 className="mb-1 text-lg font-bold text-gray-900">
            What changes in the equation?
          </h3>
          <p className="m-0">
            Compared with the two-level equation, the new part is that a
            module can contain its own smaller map. The recursive term{" "}
            <TeX math="\sum_i L(M^i)" /> says: after the top index chooses
            module <TeX math="i" />, calculate the codelength of the submap
            inside that module.
          </p>
          <div className="overflow-x-auto py-1 text-center text-base leading-8 text-gray-900">
            <TeX math="L(M)=q_{\curvearrowright}H(\mathcal{Q})+\sum_i L(M^i),\quad L(M^i)=q_{\circlearrowright}^{i}H(\mathcal{Q}^{i})+\sum_j L(M^{ij})" />
          </div>
          <div className="overflow-x-auto pb-1 text-center text-base leading-8 text-gray-900">
            <TeX math="L(M^{ij})=p_{\circlearrowright}^{ij}H(\mathcal{P}^{ij})\quad \text{when }M^{ij}\text{ is a final module}" />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <p className="m-0">
              <span className="font-semibold text-gray-800">
                Top index:
              </span>{" "}
              <TeX math="q_{\curvearrowright}H(\mathcal{Q})" />.{" "}
              This chooses among broad modules.
            </p>
            <p className="m-0">
              <span className="font-semibold text-gray-800">
                Recursive part:
              </span>{" "}
              <TeX math="\sum_i L(M^i)" />. Each broad module gets its own
              submap contribution instead of immediately ending in one local
              codebook.
            </p>
            <p className="m-0">
              <span className="font-semibold text-gray-800">
                Subindex inside a module:
              </span>{" "}
              <TeX math="q_{\circlearrowright}^{i}H(\mathcal{Q}^{i})" />. This
              is the extra index codebook used to choose among submodules inside
              module <TeX math="i" />.
            </p>
            <p className="m-0">
              <span className="font-semibold text-gray-800">
                Final local codebooks:
              </span>{" "}
              <TeX math="\sum_{ij}p_{\circlearrowright}^{ij}H(\mathcal{P}^{ij})" />
              . When a submodule has no deeper levels, its contribution becomes
              the local codebook for node visits and exits.
            </p>
            <p className="m-0">
              <span className="font-semibold text-gray-800">Two-level:</span>{" "}
              the same idea becomes{" "}
              <TeX math="q_{\curvearrowright}H(\mathcal{Q})+\sum_i p_{\circlearrowright}^{i}H(\mathcal{P}^{i})" />
              . There is no recursive step, so nested structure is flattened.
            </p>
          </div>
        </div>
        <p className="max-w-4xl pt-2 text-sm leading-relaxed text-gray-600">
          The breakdown below shows the tradeoff directly. Multilevel has more
          codebook activations, but the frequently used local codebooks become
          cheaper. If those savings beat the added index costs, the multilevel
          description is shorter.
        </p>
        <CodelengthBreakdown />
      </div>
    </section>
  );
}

export default HierarchicalCodebooks;
