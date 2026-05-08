import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { Network } from "../model";
import {
  hierarchical_paper_toy,
  hierarchicalPaperToyTopology,
  paperToyFineModules,
} from "../networks";
import { EnterFlow, ExitFlow } from "./CodeBooks";
import Flow from "./CodeBooks/Flow";
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
type HoverTarget =
  | { variant: NetworkViewVariant; kind: "top"; topIndex: number }
  | { variant: NetworkViewVariant; kind: "fine"; fineIndex: number }
  | { variant: NetworkViewVariant; kind: "node"; nodeId: number };

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
  [1, 8, 6],
  [2, 5, 4],
] as const;
const CODEBOOK_BLOCK = {
  width: 40,
  height: 9,
  gap: 1,
  pointer: 6.4,
} as const;
const CODEBOOK_STACK_HEIGHT = 230;
const RECURSIVE_TRIANGLE_LEVELS = 6;
const RECURSIVE_ZOOM_DURATION_MS = 1700;
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

function getRecursiveModuleFillOpacity(module_: RecursiveTriangleModule) {
  if (module_.path.length === 0) {
    return 0;
  }

  return Math.min(0.24, 0.09 + module_.level * 0.025);
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

function getTriangleViewBox(
  corners: [TrianglePoint, TrianglePoint, TrianglePoint],
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
  const topPadding = rawHeight * 0.035;
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

function pointKey(point: TrianglePoint) {
  return `${point.x.toFixed(5)}:${point.y.toFixed(5)}`;
}

function buildRecursiveLeafNetwork(modules: RecursiveTriangleModule[]) {
  const leafModules = modules.filter(
    (module_) => module_.level === RECURSIVE_TRIANGLE_LEVELS - 1,
  );
  const nodeByPoint = new Map<
    string,
    { id: number; x: number; y: number; paths: string[] }
  >();
  const links = new Map<string, { source: number; target: number }>();

  leafModules.forEach((module_) => {
    const nodeIds = module_.corners.map((point) => {
      const key = pointKey(point);
      const existing = nodeByPoint.get(key);

      if (existing) {
        existing.paths.push(module_.key);
        return existing.id;
      }

      const next = {
        id: nodeByPoint.size + 1,
        x: point.x,
        y: point.y,
        paths: [module_.key],
      };

      nodeByPoint.set(key, next);
      return next.id;
    });

    [
      [nodeIds[0], nodeIds[1]],
      [nodeIds[1], nodeIds[2]],
      [nodeIds[2], nodeIds[0]],
    ].forEach(([source, target]) => {
      const key =
        source < target ? `${source}-${target}` : `${target}-${source}`;
      links.set(key, { source, target });
    });
  });

  return {
    nodes: Array.from(nodeByPoint.values()),
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
    .map((link) => `${link.source} ${link.target} 1`);

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

  return getRecursiveModuleColor(parseRecursivePathKey(selectedPath));
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
      weight: 1,
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
  const twoLevelNetwork = createRecursiveCodelengthNetwork(
    leafNetwork,
    "two-level",
  );
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
      total: twoLevelNetwork.mapequation.codelength,
      rows: [
        {
          key: "recursive-two-level-index",
          label: "Index (smallest triangles)",
          value: twoLevelNetwork.mapequation.indexCodelength,
          color: "#4b5563",
        },
        {
          key: "recursive-two-level-modules",
          label: "Node modules",
          value: twoLevelNetwork.mapequation.moduleCodelength,
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

function CodelengthGroupView({ group }: { group: CodelengthGroup }) {
  return (
    <div className="p-1">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="m-0 text-base font-bold text-gray-900">{group.title}</h3>
        <div className="text-sm font-black text-gray-900">
          {formatBits(group.total)}
        </div>
      </div>
      <div className="space-y-1.5">
        {group.rows.map((row) => (
          <div
            key={row.key}
            className="grid grid-cols-[0.65rem_minmax(0,1fr)_auto] items-center gap-2 text-sm"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: row.color }}
            />
            <span className="truncate font-semibold text-gray-700">
              {row.label}
            </span>
            <span className="font-mono text-xs font-bold text-gray-900">
              {formatBits(row.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CodelengthBreakdown() {
  const groups = useMemo(() => buildCodelengthGroups(), []);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {groups.map((group) => (
        <CodelengthGroupView key={group.key} group={group} />
      ))}
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
}: {
  x: number;
  y: number;
  width?: number;
  height?: number;
  color: string;
  kind: CodebookBlockKind;
  label?: string;
  active?: boolean;
}) {
  const fill = active ? darkenHexColor(color, 0.34) : color;
  const stroke = darkenHexColor(color, active ? 0.48 : 0.24);
  const commonProps = {
    fill,
    fillOpacity: active ? 1 : 0.88,
    stroke,
    strokeWidth: active ? 1.35 : 1,
    vectorEffect: "non-scaling-stroke" as const,
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
        <text
          x={x + width / 2}
          y={y + height / 2 + 0.6}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={Math.max(2.8, height * 0.62)}
          fontWeight={900}
          fill={active ? "#ffffff" : "#111827"}
          pointerEvents="none"
        >
          {label}
        </text>
      )}
    </g>
  );
}

function Connector({
  x1,
  y1,
  x2,
  y2,
  color,
  opacity = 0.35,
  strokeWidth = 2,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  opacity?: number;
  strokeWidth?: number;
}) {
  return (
    <path
      d={`M ${x1} ${y1} C ${x1 + 26} ${y1}, ${x2 - 26} ${y2}, ${x2} ${y2}`}
      fill="none"
      stroke={darkenHexColor(color, 0.16)}
      strokeLinecap="round"
      strokeWidth={strokeWidth}
      vectorEffect="non-scaling-stroke"
      opacity={opacity}
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
) {
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

  const fineIndex = getFineModuleIndexForNodeId(hoveredTarget.nodeId);
  const topIndex = getTopModuleIndexForNodeId(hoveredTarget.nodeId);

  return (
    (item.role === "node" && item.nodeId === hoveredTarget.nodeId) ||
    (item.role === "fine" && item.fineIndex === fineIndex) ||
    (hoveredTarget.variant === "multilevel" &&
      item.role === "top" &&
      item.topIndex === topIndex)
  );
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

function CodebookStack({
  x,
  y,
  items,
  hoveredTarget,
  onHoverTargetChange,
}: {
  x: number;
  y: number;
  items: CodebookStackItem[];
  hoveredTarget: HoverTarget | null;
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
              active={isCodebookItemActive(item, hoveredTarget)}
            />
          </g>
        );
      })}
    </g>
  );
}

function CodebookComparison({
  hoveredTarget,
  onHoverTargetChange,
}: {
  hoveredTarget: HoverTarget | null;
  onHoverTargetChange: (target: HoverTarget | null) => void;
}) {
  const panelY = 8;
  const multilevelX = 10;
  const twoLevelX = 408;
  const topIndexX = multilevelX + 6;
  const subIndexX = multilevelX + 84;
  const moduleX = multilevelX + 180;
  const twoLevelIndexX = twoLevelX + 8;
  const twoLevelModuleX = twoLevelX + 112;
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
    <div className="-mt-6 p-0">
      <h3 className="sr-only">Codebook comparison</h3>
      <svg
        viewBox="0 0 820 246"
        className="block w-full overflow-visible"
        role="img"
        aria-label="Codebook comparison"
      >
        {topModules.map((topModule) => {
          const sourceY = getStackBlockCenterY({
            stackY: panelY,
            itemIndex: topModule.topIndex,
            itemCount: topIndexItems.length,
          });

          return (
            <g key={`multilevel-top-connectors-${topModule.key}`}>
              {[
                ...fineModules.filter(
                  (module_) => module_.topIndex === topModule.topIndex,
                ),
                null,
              ].map((module_, localIndex) => (
                <Connector
                  key={`top-to-sub-${topModule.topIndex}-${localIndex}`}
                  x1={topIndexX + CODEBOOK_BLOCK.width}
                  y1={sourceY}
                  x2={subIndexX}
                  y2={getStackBlockCenterY({
                    stackY: panelY,
                    itemIndex:
                      module_ === null
                        ? subIndexExitItemIndex(topModule.topIndex)
                        : subIndexItemIndex(module_),
                    itemCount: subIndexItems.length,
                  })}
                  color={module_?.color ?? topModule.color}
                  opacity={module_ === null ? 0.58 : 0.42}
                  strokeWidth={module_ === null ? 1.8 : 1.35}
                />
              ))}
            </g>
          );
        })}
        {fineModules.map((module_, fineIndex) => {
          return (
            <g key={`multilevel-module-connectors-${module_.key}`}>
              {[0, 1, 2, 3].map((localIndex) => (
                <Connector
                  key={`sub-to-node-${module_.key}-${localIndex}`}
                  x1={subIndexX + CODEBOOK_BLOCK.width}
                  y1={getStackBlockCenterY({
                    stackY: panelY,
                    itemIndex: subIndexItemIndex(module_),
                    itemCount: subIndexItems.length,
                  })}
                  x2={moduleX}
                  y2={getStackBlockCenterY({
                    stackY: panelY,
                    itemIndex: moduleItemIndex(fineIndex, localIndex),
                    itemCount: multilevelModuleItems.length,
                  })}
                  color={module_.color}
                  opacity={localIndex === 3 ? 0.58 : 0.42}
                  strokeWidth={localIndex === 3 ? 1.85 : 1.3}
                />
              ))}
            </g>
          );
        })}
        <CodebookStack
          x={topIndexX}
          y={panelY}
          items={topIndexItems}
          hoveredTarget={hoveredTarget}
          onHoverTargetChange={onHoverTargetChange}
        />
        <CodebookStack
          x={subIndexX}
          y={panelY}
          items={subIndexItems}
          hoveredTarget={hoveredTarget}
          onHoverTargetChange={onHoverTargetChange}
        />
        <CodebookStack
          x={moduleX}
          y={panelY}
          items={multilevelModuleItems}
          hoveredTarget={hoveredTarget}
          onHoverTargetChange={onHoverTargetChange}
        />
        <line
          x1={392}
          y1={7}
          x2={392}
          y2={239}
          stroke="#e5e7eb"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        {fineModules.map((module_, fineIndex) => {
          return (
            <g key={`two-level-module-connectors-${module_.key}`}>
              {[0, 1, 2, 3].map((localIndex) => (
                <Connector
                  key={`two-level-index-to-node-${module_.key}-${localIndex}`}
                  x1={twoLevelIndexX + CODEBOOK_BLOCK.width}
                  y1={getStackBlockCenterY({
                    stackY: panelY,
                    itemIndex: fineIndex,
                    itemCount: twoLevelIndexItems.length,
                  })}
                  x2={twoLevelModuleX}
                  y2={getStackBlockCenterY({
                    stackY: panelY,
                    itemIndex: moduleItemIndex(fineIndex, localIndex),
                    itemCount: twoLevelModuleItems.length,
                  })}
                  color={module_.color}
                  opacity={localIndex === 3 ? 0.58 : 0.42}
                  strokeWidth={localIndex === 3 ? 1.85 : 1.3}
                />
              ))}
            </g>
          );
        })}
        <CodebookStack
          x={twoLevelIndexX}
          y={panelY}
          items={twoLevelIndexItems}
          hoveredTarget={hoveredTarget}
          onHoverTargetChange={onHoverTargetChange}
        />
        <CodebookStack
          x={twoLevelModuleX}
          y={panelY}
          items={twoLevelModuleItems}
          hoveredTarget={hoveredTarget}
          onHoverTargetChange={onHoverTargetChange}
        />
      </svg>
    </div>
  );
}

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
  const selectedModule =
    modules.find((module_) => samePath(module_.path, selectedPath)) ??
    modules[0];
  const targetViewBox = getTriangleViewBox(selectedModule.corners);
  const animatedViewBox = useAnimatedViewBox(
    targetViewBox,
    RECURSIVE_ZOOM_DURATION_MS,
  );
  const directChildren = modules.filter((module_) =>
    isDirectChild(module_.path, selectedPath),
  );
  const labeledModules = modules.filter((module_) => module_.path.length > 0);
  const nodeRadius = Math.max(
    0.4,
    (animatedViewBox.width / RECURSIVE_VIEWBOX.width) * 1.55,
  );
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
    <div className="mx-auto mt-8 max-w-md">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="m-0 text-base font-bold text-gray-900">
          Recursive triangle
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
        aria-label="Six-level recursive triangle network"
        onClick={handleSvgBackgroundClick}
      >
        {modules.map((module_) => {
          const isSelected = samePath(module_.path, selectedPath);
          const isClickable = directChildren.some((child) =>
            samePath(child.path, module_.path),
          );
          const color = getRecursiveModuleColor(module_.path);

          return (
            <polygon
              key={`recursive-module-${module_.key}`}
              points={formatTrianglePoints(module_.corners)}
              fill={color}
              fillOpacity={
                isSelected
                  ? Math.min(0.3, getRecursiveModuleFillOpacity(module_) + 0.08)
                  : getRecursiveModuleFillOpacity(module_)
              }
              stroke={darkenHexColor(color, isSelected ? 0.34 : 0.22)}
              strokeOpacity={
                isSelected ? 0.7 : Math.max(0.1, 0.36 - module_.level * 0.045)
              }
              strokeWidth={isSelected ? 1.6 : 0.85}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              pointerEvents={isClickable ? "all" : "none"}
              className={isClickable ? "cursor-pointer" : undefined}
              onClick={(event) => {
                if (isClickable) {
                  event.stopPropagation();
                  setSelectedPath(module_.path);
                }
              }}
            />
          );
        })}
        {directChildren.map((module_) => {
          const color = getRecursiveModuleColor(module_.path);

          return (
            <polygon
              key={`recursive-click-${module_.key}`}
              points={formatTrianglePoints(module_.corners)}
              fill={color}
              fillOpacity={0.08}
              stroke={darkenHexColor(color, 0.36)}
              strokeOpacity={0.72}
              strokeWidth={1.4}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="cursor-pointer"
              onClick={(event) => {
                event.stopPropagation();
                setSelectedPath(module_.path);
              }}
            />
          );
        })}
        {labeledModules.map((module_) => {
          const center = getTriangleCentroid(module_.corners);
          const fontSize = Math.max(
            1.05,
            getTriangleHeight(module_.corners) * 0.16,
          );
          const color = getRecursiveModuleColor(module_.path);

          return (
            <text
              key={`recursive-label-${module_.key}`}
              x={center.x}
              y={center.y + fontSize * 0.1}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={fontSize}
              fontWeight={900}
              fill={darkenHexColor(color, 0.55)}
              opacity={getRecursiveLabelOpacity(module_)}
              paintOrder="stroke"
              stroke="#ffffff"
              strokeWidth={fontSize * 0.2}
              pointerEvents="none"
            >
              {getRecursiveModuleLabel(module_.path)}
            </text>
          );
        })}
        {selectedPath.length > 0 && (
          <text
            x={selectedModule.corners[0].x}
            y={
              selectedModule.corners[0].y -
              getTriangleHeight(selectedModule.corners) * 0.035
            }
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={Math.max(
              1.2,
              getTriangleHeight(selectedModule.corners) * 0.055,
            )}
            fontWeight={900}
            fill="#111827"
            paintOrder="stroke"
            stroke="#ffffff"
            strokeWidth={Math.max(
              0.22,
              getTriangleHeight(selectedModule.corners) * 0.01,
            )}
            pointerEvents="none"
          >
            {getRecursivePathLabel(selectedPath)}
          </text>
        )}
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
            />
          );
        })}
      </svg>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {recursiveCodelengthGroups.map((group) => (
          <CodelengthGroupView key={group.key} group={group} />
        ))}
      </div>
    </div>
  );
}

function RawTopologyNetworkView({
  title,
  description,
  variant,
  hoveredTarget,
  onHoverTargetChange,
}: {
  title: string;
  description: string;
  variant: NetworkViewVariant;
  hoveredTarget: HoverTarget | null;
  onHoverTargetChange: (target: HoverTarget | null) => void;
}) {
  const nodes = useMemo(() => buildPositionedNodes(), []);
  const nodeById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );

  return (
    <div className="space-y-3">
      <div className="mb-3">
        <h3 className="m-0 text-base font-bold text-gray-900">{title}</h3>
        <p className="m-0 mt-1 text-sm text-gray-600">{description}</p>
      </div>
      <svg
        viewBox={formatViewBox(ROOT_VIEWBOX)}
        className="block w-full overflow-visible"
        style={{
          aspectRatio: `${ROOT_VIEWBOX.width} / ${ROOT_VIEWBOX.height}`,
        }}
        role="img"
        aria-label={title}
      >
        {topModules.map((module_) => {
          const points = getTrianglePoints(nodeById, module_.cornerNodeIds);
          const active =
            hoveredTarget?.variant === variant &&
            ((hoveredTarget.kind === "top" &&
              hoveredTarget.topIndex === module_.topIndex) ||
              (hoveredTarget.kind === "node" &&
                getTopModuleIndexForNodeId(hoveredTarget.nodeId) ===
                  module_.topIndex));

          if (points.length !== 3) {
            return null;
          }

          return (
            <polygon
              key={module_.key}
              points={formatPolygonPoints(points)}
              fill={module_.color}
              fillOpacity={active ? 0.18 : 0.075}
              stroke={darkenHexColor(module_.color, 0.18)}
              strokeWidth={active ? 2 : 1.35}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
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
            ((hoveredTarget.kind === "fine" &&
              hoveredTarget.fineIndex === fineIndex) ||
              (hoveredTarget.kind === "node" &&
                module_.nodeIds.includes(hoveredTarget.nodeId)));

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
                r={active ? NODE_RADIUS + 1 : NODE_RADIUS}
                fill={module_.color}
                fillOpacity={0.94}
                stroke={darkenHexColor(module_.color, active ? 0.48 : 0.28)}
                strokeWidth={active ? 1.55 : 1.1}
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
      </svg>
    </div>
  );
}

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
    <div className="flex justify-end">
      <button
        type="button"
        className="rounded-full border border-gray-300 px-2 py-1 text-xs font-bold text-gray-600"
        onClick={handleCopyPajek}
      >
        {copyStatus === "copied"
          ? "Copied"
          : copyStatus === "failed"
            ? "Copy failed"
            : "Copy Pajek"}
      </button>
    </div>
  );
}

function HierarchicalCodebooks() {
  const [hoveredTarget, setHoveredTarget] = useState<HoverTarget | null>(null);

  return (
    <section id="hierarchical-codebooks" className="col-span-4 mb-48">
      <div className="mb-8 max-w-4xl">
        <h2>Hierarchical codebooks</h2>
        <p>
          Hierarchical codebooks are the multilevel version of the map equation
          idea. Instead of naming every part of a network from one flat list,
          the description can first name a broad region, then a smaller module,
          and finally the node inside it.
        </p>
        <p>
          This view now starts from the raw Untitled network only. The small
          triangles are fine modules, and each group of three fine modules forms
          a roman-numbered top-level module.
        </p>
      </div>

      <div className="space-y-1">
        <ComparisonNetworkPajekCopyButton />
        <div className="grid gap-6 lg:grid-cols-2">
          <RawTopologyNetworkView
            title="Multilevel network view"
            description="Small triangles are fine modules; each large triangle is a top-level module."
            variant="multilevel"
            hoveredTarget={hoveredTarget}
            onHoverTargetChange={setHoveredTarget}
          />
          <RawTopologyNetworkView
            title="Two-level network view"
            description="The same raw topology, ready for the flat two-level grouping comparison."
            variant="two-level"
            hoveredTarget={hoveredTarget}
            onHoverTargetChange={setHoveredTarget}
          />
        </div>
        <CodebookComparison
          hoveredTarget={hoveredTarget}
          onHoverTargetChange={setHoveredTarget}
        />
        <CodelengthBreakdown />
        <RecursiveTriangleZoomNetwork />
      </div>
    </section>
  );
}

export default HierarchicalCodebooks;
