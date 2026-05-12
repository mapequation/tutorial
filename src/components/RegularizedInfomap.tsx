/**
 * RegularizedInfomap component demonstrates how regularization helps
 * when network data is sparse or incomplete.
 */

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from "react";
import { observer } from "mobx-react";
import { scaleSqrt } from "d3";
import { Network as NetworkModel, FlowModel } from "../model";
import HelpTooltip from "./HelpTooltip";
import { isolatedModuleColor, scheme as figColors } from "./scheme";
import { getAssetPath } from "../lib/basePath";
import {
  buildRegularizedNetworkData,
  createRegularizedIncompleteNetwork,
  parseRegularizedNetworkDat,
  type NetworkData,
  type RegularizedBaseNetwork,
} from "../networks/regularized_infomap_network";
import { Network } from "./Network";

interface Props {
  width?: number;
  height?: number;
}

type NetworkState = "normal" | "regularized";
type Partition = Map<number, number>;
type NodePositionById = Map<number, { x: number; y: number }>;
type PriorLink = { source: number; target: number };

interface PartitionOutcome {
  moduleByNodeId: Partition;
  moduleCount: number;
  truthModuleCount: number;
  rawModuleCount: number;
  isolatedOnlyModuleCount: number;
  adjustedMutualInformation: number;
  success: boolean;
}

interface OutcomeAssessment {
  label: "pass" | "half-pass" | "fail";
  toneClassName: string;
  description: string;
}

interface TreeRow {
  nodeId: number;
  path: number[];
  flow: number;
  name: string;
}

interface InfomapRun {
  outcome: PartitionOutcome;
  treeText: string;
  trials: number;
}

interface TriedRegularizationRun {
  sparsePercentage: number;
  strength: number;
  run: InfomapRun;
}

interface TriedNormalRun {
  sparsePercentage: number;
  run: InfomapRun;
}

interface SweepChartPoint {
  sparsePercentage: number;
  normalValue: number | null;
  regularizedValue: number | null;
  targetValue?: number | null;
}

interface HoveredSweepPoint {
  sparsePercentage: number;
  value: number;
  seriesLabel: string;
  color: string;
}

interface SweepChartProps {
  title: string;
  helpContent?: ReactNode;
  yLabel: string;
  points: SweepChartPoint[];
  yDomain: [number, number];
  yTicks: number[];
  currentSparsePercentage: number;
  formatYTick: (value: number) => string;
  formatValue: (value: number) => string;
  targetLabel?: string;
}

type RunState =
  | { status: "loading" }
  | { status: "ready"; run: InfomapRun }
  | { status: "error"; message: string };

type DatasetState =
  | { status: "loading" }
  | {
      status: "ready";
      completeData: NetworkData;
      referencePartition: Partition;
    }
  | { status: "error"; message: string };

type PrecomputeState =
  | { status: "idle"; completedRuns: number; totalRuns: number }
  | { status: "running"; completedRuns: number; totalRuns: number }
  | { status: "ready"; completedRuns: number; totalRuns: number }
  | {
      status: "error";
      completedRuns: number;
      totalRuns: number;
      message: string;
    };

interface InfomapRunner {
  runAsync(input: {
    network: {
      nodes: Array<{ id: number; name: string }>;
      links: Array<{ source: number; target: number; weight: number }>;
    };
    filename?: string;
    args?: Record<string, unknown>;
  }): Promise<unknown>;
}

type InfomapConstructor = new () => InfomapRunner;

interface InfomapTreeNodeLike {
  id: number;
  path?: number[];
  flow?: number;
  name?: string;
}

interface InfomapJsonLike {
  nodes?: InfomapTreeNodeLike[];
}

interface InfomapResultLike {
  tree?: string;
  json?: InfomapJsonLike;
}

const NUM_TRIALS = 5;
const SUCCESS_EPSILON = 1e-9;
const NOTICEABLE_IMPROVEMENT = 0.01;
const PASS_DESCRIPTION =
  "Exact recovery of the reference partition from the complete network.";
const REGULARIZED_HALF_PASS_DESCRIPTION =
  "Outperforms standard Infomap, but does not exactly recover the reference partition from the complete network.";
const NORMAL_FAIL_DESCRIPTION =
  "Does not exactly recover the reference partition from the complete network.";
const REGULARIZED_FAIL_DESCRIPTION =
  "Does not recover the reference partition from the complete network and does not outperform standard Infomap.";
const REGULARIZED_RESERVED_ASSESSMENT_LABEL = "half-pass";
const COLLAPSE_WARNING_TITLE = "Strong Regularization Collapses Modules";
const COLLAPSE_WARNING_DESCRIPTION =
  "The regularization strength is currently so strong that Infomap prefers one large module instead of separating the reference communities.";
const COLLAPSE_WARNING_EXPLANATION =
  "A strong uniform prior increases the cost of keeping modules separate, so the best codelength solution can become a single-module partition.";
const COLLISION_PADDING = 2;
const NODE_LENGTH_GAP_MULTIPLIER = 2;
const LAYOUT_EXPANSION_FACTOR = 1.32;
const MODULE_GROUP_CENTER_PULL = 0.18;
const VIEWPORT_MARGIN = 12;
const ISOLATED_CLUSTER_EDGE_OFFSET = 24;
const ISOLATED_CLUSTER_COLUMN_SIZE = 3;
const ISOLATED_NODE_SPACING_MULTIPLIER = 2.75;
const MAX_COLLISION_RELAX_ITERATIONS = 160;
const EPSILON = 1e-9;
const getRegularizedNetworkUrl = () =>
  getAssetPath("/data/VII_network_complete.dat");
const regularizedNodeScale = scaleSqrt().domain([0, 1]).range([3.5, 7]);
const treeLinePattern =
  /^([0-9:]+)\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s+"((?:[^"\\]|\\.)*)"\s+(\d+)\s*$/;
const ISOLATED_MODULE_COLOR = isolatedModuleColor;
const COLORBLIND_FRIENDLY_POOL = figColors;
const LINK_REMOVAL_HELP =
  "Removes the selected share of links at random to simulate incomplete data in both the standard and regularized networks.";
const REGULARIZATION_HELP =
  "Regularization strength controls how strongly Infomap uses the uniform prior when running with --regularized. The uniform prior acts like a weak background assumption that gently links all nodes together before the observed network is taken into account. Increasing this strength makes Infomap rely a bit less on sparse or noisy edge evidence and a bit more on that neutral baseline, instead of interpreting every missing link as strong evidence that nodes should be separated.";
const AMI_HELP =
  "Adjusted mutual information (AMI) compares the current non-isolated-node partition with the reference partition from the complete 0% network while correcting for agreement expected by chance. A value of 1 means the partitions match exactly up to relabeling, values near 0 mean no better agreement than random partitions with similar module sizes, and negative values mean worse-than-chance agreement.";
const MODULE_COUNT_HELP =
  "Module count is measured on the non-isolated nodes used for pass/fail evaluation. Isolated-only modules are ignored because there is no observed flow evidence connecting those nodes to the reference partition.";
const SPARSE_PERCENTAGES = Array.from({ length: 17 }, (_, index) => index * 5);
const MAX_SPARSE_PERCENTAGE = SPARSE_PERCENTAGES[SPARSE_PERCENTAGES.length - 1];
const TOTAL_NORMAL_PRECOMPUTED_RUNS = SPARSE_PERCENTAGES.length;
const TOTAL_REGULARIZED_PRECOMPUTED_RUNS = SPARSE_PERCENTAGES.length;
const CHART_WIDTH = 520;
const CHART_HEIGHT = 230;
const CHART_MARGIN = {
  top: 18,
  right: 18,
  bottom: 42,
  left: 48,
};
const CHART_X_TICKS = SPARSE_PERCENTAGES.filter(
  (value) => value % 20 === 0 || value === MAX_SPARSE_PERCENTAGE,
);
const NORMAL_CHART_COLOR = COLORBLIND_FRIENDLY_POOL[1];
const REGULARIZED_CHART_COLOR = COLORBLIND_FRIENDLY_POOL[2];
const TARGET_CHART_COLOR = ISOLATED_MODULE_COLOR;
const CONTROL_LABEL_CLASS = "grid grid-cols-[9.5rem_8rem] items-center gap-2";
const CONTROL_TEXT_CLASS =
  "inline-grid w-[9.5rem] grid-cols-[1rem_1fr] items-center gap-1 text-xs font-semibold";
const CONTROL_VALUE_CLASS = "whitespace-nowrap tabular-nums";
const CONTROL_RANGE_CLASS = "h-1 w-32 flex-none";
const PRIOR_LINK_STROKE = "#dc2626";

const formatPrecomputeStatusMessage = (
  label: string,
  completedRuns: number,
  totalRuns: number,
) => `precomputing ${label} cache (${completedRuns}/${totalRuns})...`;

let infomapConstructorPromise: Promise<InfomapConstructor> | null = null;

const resolveInfomapConstructor = (moduleValue?: unknown) => {
  const importedModule = (moduleValue ?? {}) as {
    default?: unknown;
    Infomap?: unknown;
  };
  const globalExports = (
    globalThis as typeof globalThis & {
      infomap?: {
        default?: unknown;
        Infomap?: unknown;
      };
    }
  ).infomap;
  const constructor =
    importedModule.default ??
    importedModule.Infomap ??
    globalExports?.default ??
    globalExports?.Infomap;

  return typeof constructor === "function"
    ? (constructor as InfomapConstructor)
    : undefined;
};

const clampNumber = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const getSweepChartValues = (points: SweepChartPoint[]) =>
  points.flatMap((point) =>
    [point.normalValue, point.regularizedValue, point.targetValue].filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    ),
  );

const getAmiChartDomain = (points: SweepChartPoint[]): [number, number] => {
  const values = getSweepChartValues(points);
  const minValue = values.length > 0 ? Math.min(...values) : 0;
  const minTick =
    minValue < 0 ? Math.max(-1, Math.floor(minValue * 10) / 10) : 0;

  return [minTick, 1];
};

const getAmiChartTicks = ([minValue]: [number, number]) => {
  const baseTicks = [0, 0.25, 0.5, 0.75, 1];

  return minValue < 0
    ? [minValue, ...baseTicks.filter((tick) => tick > minValue)]
    : baseTicks;
};

const getModuleChartDomain = (points: SweepChartPoint[]): [number, number] => {
  const values = getSweepChartValues(points);
  const maxValue = values.length > 0 ? Math.max(...values) : 1;

  return [0, Math.max(1, Math.ceil(maxValue + 1))];
};

const getModuleChartTicks = ([, maxValue]: [number, number]) => {
  const step = maxValue <= 8 ? 1 : Math.ceil(maxValue / 5);
  const ticks: number[] = [];

  for (let value = 0; value <= maxValue; value += step) {
    ticks.push(value);
  }

  if (ticks[ticks.length - 1] !== maxValue) {
    ticks.push(maxValue);
  }

  return ticks;
};

const buildLineSegments = (
  points: SweepChartPoint[],
  getValue: (point: SweepChartPoint) => number | null | undefined,
  getSvgPoint: (sparsePercentage: number, value: number) => string,
) => {
  const segments: string[][] = [];
  let currentSegment: string[] = [];

  points.forEach((point) => {
    const value = getValue(point);

    if (typeof value === "number" && Number.isFinite(value)) {
      currentSegment.push(getSvgPoint(point.sparsePercentage, value));
      return;
    }

    if (currentSegment.length > 0) {
      segments.push(currentSegment);
      currentSegment = [];
    }
  });

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
};

function SweepChart({
  title,
  helpContent,
  yLabel,
  points,
  yDomain,
  yTicks,
  currentSparsePercentage,
  formatYTick,
  formatValue,
  targetLabel,
}: SweepChartProps) {
  const plotWidth = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right;
  const plotHeight = CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom;
  const [minY, maxY] = yDomain;
  const ySpan = Math.max(maxY - minY, SUCCESS_EPSILON);
  const xSpan = Math.max(MAX_SPARSE_PERCENTAGE, SUCCESS_EPSILON);
  const scaleX = (value: number) =>
    CHART_MARGIN.left + (value / xSpan) * plotWidth;
  const scaleY = (value: number) =>
    CHART_MARGIN.top +
    ((maxY - clampNumber(value, minY, maxY)) / ySpan) * plotHeight;
  const getSvgPoint = (sparsePercentage: number, value: number) =>
    `${scaleX(sparsePercentage)},${scaleY(value)}`;
  const normalSegments = buildLineSegments(
    points,
    (point) => point.normalValue,
    getSvgPoint,
  );
  const regularizedSegments = buildLineSegments(
    points,
    (point) => point.regularizedValue,
    getSvgPoint,
  );
  const targetSegments = buildLineSegments(
    points,
    (point) => point.targetValue,
    getSvgPoint,
  );
  const currentX = scaleX(currentSparsePercentage);
  const [hoveredPoint, setHoveredPoint] = useState<HoveredSweepPoint | null>(
    null,
  );

  const renderSegments = (
    segments: string[][],
    stroke: string,
    strokeDasharray?: string,
  ) =>
    segments.map((segment, index) => (
      <polyline
        key={`${stroke}-${index}`}
        points={segment.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth={2.5}
        strokeDasharray={strokeDasharray}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ));

  const renderMarker = (
    point: SweepChartPoint,
    value: number | null,
    seriesLabel: string,
    color: string,
  ) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return null;
    }

    const markerLabel = `${seriesLabel} ${yLabel}: ${formatValue(
      value,
    )}, ${point.sparsePercentage}% link removal`;
    const showTooltip = () =>
      setHoveredPoint({
        sparsePercentage: point.sparsePercentage,
        value,
        seriesLabel,
        color,
      });
    const hideTooltip = () => setHoveredPoint(null);

    return (
      <g key={`${seriesLabel}-${point.sparsePercentage}`}>
        <circle
          cx={scaleX(point.sparsePercentage)}
          cy={scaleY(value)}
          r={9}
          fill="transparent"
          className="cursor-pointer"
          pointerEvents="all"
          tabIndex={0}
          aria-label={markerLabel}
          onMouseEnter={showTooltip}
          onMouseOver={showTooltip}
          onPointerEnter={showTooltip}
          onClick={showTooltip}
          onMouseLeave={hideTooltip}
          onPointerLeave={hideTooltip}
          onFocus={showTooltip}
          onBlur={hideTooltip}
        />
        <circle
          cx={scaleX(point.sparsePercentage)}
          cy={scaleY(value)}
          r={point.sparsePercentage === currentSparsePercentage ? 4 : 2.75}
          fill={color}
          stroke="#fff"
          strokeWidth={1.25}
          pointerEvents="none"
        />
      </g>
    );
  };

  const tooltipWidth = yLabel === "AMI" ? 154 : 166;
  const tooltipHeight = 44;
  const tooltipAnchorX =
    hoveredPoint !== null ? scaleX(hoveredPoint.sparsePercentage) : 0;
  const tooltipAnchorY = hoveredPoint !== null ? scaleY(hoveredPoint.value) : 0;
  const tooltipX =
    hoveredPoint !== null
      ? clampNumber(
          tooltipAnchorX + tooltipWidth + 12 > CHART_WIDTH
            ? tooltipAnchorX - tooltipWidth - 10
            : tooltipAnchorX + 10,
          CHART_MARGIN.left,
          CHART_WIDTH - CHART_MARGIN.right - tooltipWidth,
        )
      : 0;
  const tooltipY =
    hoveredPoint !== null
      ? clampNumber(
          tooltipAnchorY - tooltipHeight - 10,
          CHART_MARGIN.top,
          CHART_HEIGHT - CHART_MARGIN.bottom - tooltipHeight,
        )
      : 0;

  return (
    <div className="space-y-2">
      <div className="mb-1 space-y-1 text-center">
        <h4 className="m-0 flex items-center justify-center gap-1 text-sm font-semibold text-gray-900">
          {title}
          {helpContent && <HelpTooltip content={helpContent} />}
        </h4>
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2 w-4 rounded-sm"
              style={{ backgroundColor: NORMAL_CHART_COLOR }}
            />
            Standard
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2 w-4 rounded-sm"
              style={{ backgroundColor: REGULARIZED_CHART_COLOR }}
            />
            Regularized
          </span>
          {targetLabel && (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-0 w-4 border-t border-dashed"
                style={{ borderColor: TARGET_CHART_COLOR }}
              />
              {targetLabel}
            </span>
          )}
        </div>
      </div>
      <svg
        role="img"
        aria-label={`${title} across link removal percentage`}
        className="h-auto w-full overflow-visible"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      >
        {yTicks.map((tick) => {
          const y = scaleY(tick);

          return (
            <g key={`y-${tick}`}>
              <line
                x1={CHART_MARGIN.left}
                x2={CHART_WIDTH - CHART_MARGIN.right}
                y1={y}
                y2={y}
                stroke="#4b5563"
                strokeOpacity={0.18}
                strokeWidth={1}
              />
              <text
                x={CHART_MARGIN.left - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fill="#6b7280"
                fontSize={11}
              >
                {formatYTick(tick)}
              </text>
            </g>
          );
        })}
        {CHART_X_TICKS.map((tick) => {
          const x = scaleX(tick);

          return (
            <g key={`x-${tick}`}>
              <text
                x={x}
                y={CHART_HEIGHT - 18}
                textAnchor="middle"
                fill="#6b7280"
                fontSize={11}
              >
                {tick}
              </text>
            </g>
          );
        })}
        <line
          x1={CHART_MARGIN.left}
          x2={CHART_MARGIN.left}
          y1={CHART_MARGIN.top}
          y2={CHART_HEIGHT - CHART_MARGIN.bottom}
          stroke="#9ca3af"
          strokeOpacity={0.7}
          strokeWidth={1}
        />
        <line
          x1={CHART_MARGIN.left}
          x2={CHART_WIDTH - CHART_MARGIN.right}
          y1={CHART_HEIGHT - CHART_MARGIN.bottom}
          y2={CHART_HEIGHT - CHART_MARGIN.bottom}
          stroke="#9ca3af"
          strokeOpacity={0.7}
          strokeWidth={1}
        />
        <line
          x1={currentX}
          x2={currentX}
          y1={CHART_MARGIN.top}
          y2={CHART_HEIGHT - CHART_MARGIN.bottom}
          stroke="#111827"
          strokeOpacity={0.55}
          strokeDasharray="3 5"
          strokeWidth={1.25}
        />
        {renderSegments(targetSegments, TARGET_CHART_COLOR, "5 5")}
        {renderSegments(normalSegments, NORMAL_CHART_COLOR)}
        {renderSegments(regularizedSegments, REGULARIZED_CHART_COLOR)}
        {points.map((point) => (
          <g key={`markers-${point.sparsePercentage}`}>
            {renderMarker(
              point,
              point.normalValue,
              "Standard",
              NORMAL_CHART_COLOR,
            )}
            {renderMarker(
              point,
              point.regularizedValue,
              "Regularized",
              REGULARIZED_CHART_COLOR,
            )}
          </g>
        ))}
        {hoveredPoint && (
          <g pointerEvents="none">
            <line
              x1={tooltipAnchorX}
              x2={tooltipX}
              y1={tooltipAnchorY}
              y2={tooltipY + tooltipHeight / 2}
              stroke={hoveredPoint.color}
              strokeWidth={1}
              strokeOpacity={0.5}
            />
            <rect
              x={tooltipX}
              y={tooltipY}
              width={tooltipWidth}
              height={tooltipHeight}
              rx={4}
              fill="#111827"
              opacity={0.92}
            />
            <text
              x={tooltipX + tooltipWidth / 2}
              y={tooltipY + 16}
              textAnchor="middle"
              fill="#fff"
              fontSize={11}
              fontWeight={700}
            >
              {hoveredPoint.seriesLabel} {yLabel}:{" "}
              {formatValue(hoveredPoint.value)}
            </text>
            <text
              x={tooltipX + tooltipWidth / 2}
              y={tooltipY + 32}
              textAnchor="middle"
              fill="#d1d5db"
              fontSize={11}
            >
              {hoveredPoint.sparsePercentage}% link removal
            </text>
          </g>
        )}
        <text
          x={CHART_MARGIN.left + plotWidth / 2}
          y={CHART_HEIGHT - 2}
          textAnchor="middle"
          fill="#4b5563"
          fontSize={11}
        >
          Link removal (%)
        </text>
        <text
          x={14}
          y={CHART_MARGIN.top + plotHeight / 2}
          textAnchor="middle"
          fill="#4b5563"
          fontSize={11}
          transform={`rotate(-90 14 ${CHART_MARGIN.top + plotHeight / 2})`}
        >
          {yLabel}
        </text>
      </svg>
    </div>
  );
}

const loadInfomapConstructor = async (): Promise<InfomapConstructor> => {
  if (!infomapConstructorPromise) {
    const existingConstructor = resolveInfomapConstructor();
    if (existingConstructor) {
      return existingConstructor;
    }

    infomapConstructorPromise = import("@mapequation/infomap").then(
      (module) => {
        // In @mapequation/infomap 2.9.x the package executes as a side-effect
        // bundle and attaches itself to `self.infomap`, while the ESM import
        // namespace can be empty. Support both export styles.
        const constructor = resolveInfomapConstructor(module);
        if (!constructor) {
          throw new Error(
            "Infomap constructor was not found in @mapequation/infomap.",
          );
        }
        return constructor;
      },
    );
  }

  return infomapConstructorPromise;
};

const buildModuleSchemes = (
  data: NetworkData,
  partition: Partition,
  isolatedNodeIds: Set<number>,
) => {
  const moduleStats = new Map<
    number,
    { isolated: number; nonIsolated: number }
  >();

  data.nodes.forEach(({ id }) => {
    const moduleId = partition.get(id) ?? 0;
    const stats = moduleStats.get(moduleId) ?? {
      isolated: 0,
      nonIsolated: 0,
    };
    if (isolatedNodeIds.has(id)) {
      stats.isolated++;
    } else {
      stats.nonIsolated++;
    }
    moduleStats.set(moduleId, stats);
  });

  const moduleIds = [...moduleStats.keys()].sort((a, b) => a - b);
  const maxModuleId = moduleIds.length > 0 ? Math.max(...moduleIds) : 0;
  const scheme = Array.from(
    { length: maxModuleId + 1 },
    () => ISOLATED_MODULE_COLOR,
  );
  const schemeAlt = Array.from({ length: maxModuleId + 1 }, () =>
    darkenHex(ISOLATED_MODULE_COLOR),
  );
  let nonIsolatedColorIndex = 0;

  moduleIds.forEach((moduleId) => {
    const stats = moduleStats.get(moduleId)!;
    if (stats.nonIsolated === 0) {
      scheme[moduleId] = ISOLATED_MODULE_COLOR;
      schemeAlt[moduleId] = darkenHex(ISOLATED_MODULE_COLOR);
      return;
    }

    const color =
      nonIsolatedColorIndex < COLORBLIND_FRIENDLY_POOL.length
        ? COLORBLIND_FRIENDLY_POOL[nonIsolatedColorIndex]
        : generatedModuleColor(nonIsolatedColorIndex);
    scheme[moduleId] = color;
    schemeAlt[moduleId] = darkenHex(color);
    nonIsolatedColorIndex++;
  });

  return { moduleScheme: scheme, moduleSchemeAlt: schemeAlt };
};

const buildFallbackTreeText = (network: NetworkModel) =>
  [...network.nodes]
    .sort((a, b) => a.topModule - b.topModule || a.id - b.id)
    .map((node) => {
      const escapedName = node.name.replace(/"/g, '\\"');
      const oneBasedPath = node.topModule + 1;
      return `${oneBasedPath} ${node.flow.toFixed(6)} "${escapedName}" ${node.id}`;
    })
    .join("\n");

const normalizePartitionLabels = (partition: Partition): Partition => {
  const normalized = new Map<number, number>();
  const labelByOriginal = new Map<number, number>();
  let nextLabel = 0;

  partition.forEach((moduleId, nodeId) => {
    if (!labelByOriginal.has(moduleId)) {
      labelByOriginal.set(moduleId, nextLabel++);
    }
    normalized.set(nodeId, labelByOriginal.get(moduleId)!);
  });

  return normalized;
};

const darkenHex = (hexColor: string, factor = 0.78) => {
  const hex = hexColor.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return hexColor;
  }

  const r = Math.max(
    0,
    Math.min(255, Math.round(parseInt(hex.slice(0, 2), 16) * factor)),
  );
  const g = Math.max(
    0,
    Math.min(255, Math.round(parseInt(hex.slice(2, 4), 16) * factor)),
  );
  const b = Math.max(
    0,
    Math.min(255, Math.round(parseInt(hex.slice(4, 6), 16) * factor)),
  );

  return `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
};

const generatedModuleColor = (index: number) => {
  const hue = (index * 137.50776405003785) % 360;
  const saturation = 72;
  const lightness = index % 2 === 0 ? 45 : 58;
  return `hsl(${hue.toFixed(2)} ${saturation}% ${lightness}%)`;
};

const getIsolatedNodeIds = (data: NetworkData) => {
  const degreeByNodeId = new Map<number, number>();
  data.nodes.forEach(({ id }) => degreeByNodeId.set(id, 0));

  data.links.forEach(({ source, target }) => {
    degreeByNodeId.set(source, (degreeByNodeId.get(source) ?? 0) + 1);
    degreeByNodeId.set(target, (degreeByNodeId.get(target) ?? 0) + 1);
  });

  return new Set(
    [...degreeByNodeId.entries()]
      .filter(([, degree]) => degree === 0)
      .map(([nodeId]) => nodeId),
  );
};

const formatAmi = (value: number) => value.toFixed(3);

const formatAmiTick = (value: number) => value.toFixed(2).replace(/\.00$/, "");

const formatModuleCount = (value: number) => Math.round(value).toString();

const moduleDistanceFromTruth = (outcome: PartitionOutcome) =>
  Math.abs(outcome.moduleCount - outcome.truthModuleCount);

const assessOutcome = (
  outcome: PartitionOutcome,
  context: "normal" | "regularized",
  baselineOutcome?: PartitionOutcome | null,
): OutcomeAssessment => {
  const moduleDistance = moduleDistanceFromTruth(outcome);
  const adjustedMutualInformationDelta = baselineOutcome
    ? outcome.adjustedMutualInformation -
      baselineOutcome.adjustedMutualInformation
    : 0;
  const baselineDistance = baselineOutcome
    ? moduleDistanceFromTruth(baselineOutcome)
    : Number.POSITIVE_INFINITY;
  const improvedRelativeToBaseline =
    baselineOutcome &&
    (adjustedMutualInformationDelta > SUCCESS_EPSILON ||
      (Math.abs(adjustedMutualInformationDelta) <= SUCCESS_EPSILON &&
        moduleDistance < baselineDistance));

  if (outcome.success) {
    return {
      label: "pass",
      toneClassName: "text-green-700",
      description: PASS_DESCRIPTION,
    };
  }

  if (context === "regularized" && improvedRelativeToBaseline) {
    return {
      label: "half-pass",
      toneClassName: "text-yellow-700",
      description: REGULARIZED_HALF_PASS_DESCRIPTION,
    };
  }

  return {
    label: "fail",
    toneClassName: "text-orange-700",
    description:
      context === "regularized"
        ? REGULARIZED_FAIL_DESCRIPTION
        : NORMAL_FAIL_DESCRIPTION,
  };
};

const isBetterRegularizationRun = (
  left: TriedRegularizationRun,
  right: TriedRegularizationRun,
) => {
  const leftOutcome = left.run.outcome;
  const rightOutcome = right.run.outcome;

  if (leftOutcome.success !== rightOutcome.success) {
    return leftOutcome.success;
  }

  if (
    Math.abs(
      leftOutcome.adjustedMutualInformation -
        rightOutcome.adjustedMutualInformation,
    ) > SUCCESS_EPSILON
  ) {
    return (
      leftOutcome.adjustedMutualInformation >
      rightOutcome.adjustedMutualInformation
    );
  }

  const leftModuleDistance = moduleDistanceFromTruth(leftOutcome);
  const rightModuleDistance = moduleDistanceFromTruth(rightOutcome);
  if (leftModuleDistance !== rightModuleDistance) {
    return leftModuleDistance < rightModuleDistance;
  }

  return left.strength < right.strength;
};

const LOG_FACTORIAL_CACHE = [0];

const logFactorial = (n: number) => {
  if (n <= 1) {
    return 0;
  }

  for (let i = LOG_FACTORIAL_CACHE.length; i <= n; i++) {
    LOG_FACTORIAL_CACHE[i] = LOG_FACTORIAL_CACHE[i - 1] + Math.log(i);
  }

  return LOG_FACTORIAL_CACHE[n];
};

const buildContingencyTable = (
  truthByNodeId: Partition,
  predictedByNodeId: Partition,
  nodeIds: number[],
) => {
  const truthLabels = [
    ...new Set(nodeIds.map((nodeId) => truthByNodeId.get(nodeId) ?? 0)),
  ];
  const predictedLabels = [
    ...new Set(nodeIds.map((nodeId) => predictedByNodeId.get(nodeId) ?? 0)),
  ];
  const truthIndexByLabel = new Map<number, number>();
  const predictedIndexByLabel = new Map<number, number>();

  truthLabels.forEach((label, index) => truthIndexByLabel.set(label, index));
  predictedLabels.forEach((label, index) =>
    predictedIndexByLabel.set(label, index),
  );

  const matrix = Array.from({ length: truthLabels.length }, () =>
    Array.from({ length: predictedLabels.length }, () => 0),
  );
  const truthCounts = Array.from({ length: truthLabels.length }, () => 0);
  const predictedCounts = Array.from(
    { length: predictedLabels.length },
    () => 0,
  );

  nodeIds.forEach((nodeId) => {
    const truthIndex = truthIndexByLabel.get(truthByNodeId.get(nodeId) ?? 0)!;
    const predictedIndex = predictedIndexByLabel.get(
      predictedByNodeId.get(nodeId) ?? 0,
    )!;

    matrix[truthIndex][predictedIndex]++;
    truthCounts[truthIndex]++;
    predictedCounts[predictedIndex]++;
  });

  return {
    matrix,
    truthCounts,
    predictedCounts,
  };
};

const partitionEntropyFromCounts = (counts: number[], totalCount: number) =>
  counts.reduce((entropy, count) => {
    if (count <= 0 || totalCount <= 0) {
      return entropy;
    }

    const probability = count / totalCount;
    return entropy - probability * Math.log2(probability);
  }, 0);

const mutualInformationFromContingencyTable = (
  matrix: number[][],
  truthCounts: number[],
  predictedCounts: number[],
  totalCount: number,
) => {
  let mutualInformation = 0;

  for (let truthIndex = 0; truthIndex < matrix.length; truthIndex++) {
    for (
      let predictedIndex = 0;
      predictedIndex < matrix[truthIndex].length;
      predictedIndex++
    ) {
      const intersectionCount = matrix[truthIndex][predictedIndex];
      if (intersectionCount <= 0) {
        continue;
      }

      mutualInformation +=
        (intersectionCount / totalCount) *
        Math.log2(
          (totalCount * intersectionCount) /
            (truthCounts[truthIndex] * predictedCounts[predictedIndex]),
        );
    }
  }

  return mutualInformation;
};

const expectedMutualInformation = (
  truthCounts: number[],
  predictedCounts: number[],
  totalCount: number,
) => {
  if (totalCount <= 1) {
    return 0;
  }

  let expectedValue = 0;

  truthCounts.forEach((truthCount) => {
    predictedCounts.forEach((predictedCount) => {
      const minIntersection = Math.min(truthCount, predictedCount);
      const maxIntersection = Math.max(
        1,
        truthCount + predictedCount - totalCount,
      );

      if (maxIntersection > minIntersection) {
        return;
      }

      const logCombinationPrefix =
        logFactorial(truthCount) +
        logFactorial(predictedCount) +
        logFactorial(totalCount - truthCount) +
        logFactorial(totalCount - predictedCount) -
        logFactorial(totalCount);

      for (
        let intersectionCount = maxIntersection;
        intersectionCount <= minIntersection;
        intersectionCount++
      ) {
        const logProbability =
          logCombinationPrefix -
          logFactorial(intersectionCount) -
          logFactorial(truthCount - intersectionCount) -
          logFactorial(predictedCount - intersectionCount) -
          logFactorial(
            totalCount - truthCount - predictedCount + intersectionCount,
          );
        const probability = Math.exp(logProbability);

        expectedValue +=
          (intersectionCount / totalCount) *
          Math.log2(
            (totalCount * intersectionCount) / (truthCount * predictedCount),
          ) *
          probability;
      }
    });
  });

  return expectedValue;
};

const adjustedMutualInformation = (
  truthByNodeId: Partition,
  predictedByNodeId: Partition,
  nodeIds: number[],
) => {
  const totalCount = nodeIds.length;
  if (totalCount <= 1) {
    return 1;
  }

  const { matrix, truthCounts, predictedCounts } = buildContingencyTable(
    truthByNodeId,
    predictedByNodeId,
    nodeIds,
  );
  const truthEntropy = partitionEntropyFromCounts(truthCounts, totalCount);
  const predictedEntropy = partitionEntropyFromCounts(
    predictedCounts,
    totalCount,
  );
  const mutualInformation = mutualInformationFromContingencyTable(
    matrix,
    truthCounts,
    predictedCounts,
    totalCount,
  );
  const expectedInformation = expectedMutualInformation(
    truthCounts,
    predictedCounts,
    totalCount,
  );
  const denominator =
    (truthEntropy + predictedEntropy) / 2 - expectedInformation;

  if (Math.abs(denominator) <= SUCCESS_EPSILON) {
    return Math.abs(mutualInformation - expectedInformation) <= SUCCESS_EPSILON
      ? 1
      : 0;
  }

  return Math.max(
    -1,
    Math.min(1, (mutualInformation - expectedInformation) / denominator),
  );
};

const evaluatePartition = (
  data: NetworkData,
  predictedByNodeId: Partition,
  truthByNodeId: Partition,
  isolatedNodeIds: Set<number>,
): PartitionOutcome => {
  const allNodeIds = data.nodes.map(({ id }) => id);
  const evaluatedNodeIds = allNodeIds.filter((id) => !isolatedNodeIds.has(id));
  const truthModuleCount = new Set(
    evaluatedNodeIds.map((id) => truthByNodeId.get(id) ?? 0),
  ).size;
  const moduleCount = new Set(
    evaluatedNodeIds.map((id) => predictedByNodeId.get(id) ?? 0),
  ).size;
  const rawModuleCount = new Set(predictedByNodeId.values()).size;
  const nodesByModule = new Map<number, number[]>();
  allNodeIds.forEach((nodeId) => {
    const moduleId = predictedByNodeId.get(nodeId) ?? 0;
    if (!nodesByModule.has(moduleId)) {
      nodesByModule.set(moduleId, []);
    }
    nodesByModule.get(moduleId)!.push(nodeId);
  });
  let isolatedOnlyModuleCount = 0;
  nodesByModule.forEach((nodeIds) => {
    if (
      nodeIds.length > 0 &&
      nodeIds.every((nodeId) => isolatedNodeIds.has(nodeId))
    ) {
      isolatedOnlyModuleCount++;
    }
  });
  const adjustedMutualInformationScore = adjustedMutualInformation(
    truthByNodeId,
    predictedByNodeId,
    evaluatedNodeIds,
  );
  const success =
    moduleCount === truthModuleCount &&
    Math.abs(adjustedMutualInformationScore - 1) <= SUCCESS_EPSILON;

  return {
    moduleByNodeId: predictedByNodeId,
    moduleCount,
    truthModuleCount,
    rawModuleCount,
    isolatedOnlyModuleCount,
    adjustedMutualInformation: adjustedMutualInformationScore,
    success,
  };
};

const buildVisualizationNetwork = (
  data: NetworkData,
  partitionByNodeId: Partition,
  isolatedNodeIds: Set<number>,
  width: number,
  height: number,
  nodeScale: (value: number) => number,
  fixedPositionsByNodeId?: NodePositionById,
) => {
  const net = new NetworkModel(FlowModel.Undirected);
  const useFixedPositions =
    fixedPositionsByNodeId !== undefined &&
    data.nodes.every(({ id }) => fixedPositionsByNodeId.has(id));

  data.nodes.forEach(({ id, x, y }) => {
    const moduleId = partitionByNodeId.get(id) ?? 0;
    const fixedPosition = useFixedPositions
      ? fixedPositionsByNodeId.get(id)
      : undefined;

    net.addNode({
      id,
      x: fixedPosition?.x ?? x * width,
      y: fixedPosition?.y ?? y * height,
      path: `${moduleId}`,
    });
  });

  data.links.forEach(({ source, target, weight }) => {
    net.addLink({
      source,
      target,
      weight,
    });
  });

  net.finalize();

  if (useFixedPositions) {
    return net;
  }

  const nodes = net.nodes;
  const centerX = width / 2;
  const centerY = height / 2;

  nodes.forEach((node) => {
    node.x = centerX + (node.x - centerX) * LAYOUT_EXPANSION_FACTOR;
    node.y = centerY + (node.y - centerY) * LAYOUT_EXPANSION_FACTOR;
  });

  const nodesByModule = new Map<number, typeof nodes>();
  nodes.forEach((node) => {
    const moduleId = partitionByNodeId.get(node.id) ?? 0;
    if (!nodesByModule.has(moduleId)) {
      nodesByModule.set(moduleId, []);
    }
    nodesByModule.get(moduleId)!.push(node);
  });

  nodesByModule.forEach((groupNodes) => {
    if (groupNodes.length === 0) {
      return;
    }

    const centroidX =
      groupNodes.reduce((sum, node) => sum + node.x, 0) / groupNodes.length;
    const centroidY =
      groupNodes.reduce((sum, node) => sum + node.y, 0) / groupNodes.length;
    const shiftX = (centerX - centroidX) * MODULE_GROUP_CENTER_PULL;
    const shiftY = (centerY - centroidY) * MODULE_GROUP_CENTER_PULL;

    groupNodes.forEach((node) => {
      node.x += shiftX;
      node.y += shiftY;
    });
  });

  for (
    let iteration = 0;
    iteration < MAX_COLLISION_RELAX_ITERATIONS;
    iteration++
  ) {
    let hadOverlap = false;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const radiusA = nodeScale(a.flow);
        const radiusB = nodeScale(b.flow);
        const oneNodeLengthGap =
          NODE_LENGTH_GAP_MULTIPLIER * Math.max(radiusA, radiusB);
        const minimumDistance =
          radiusA + radiusB + oneNodeLengthGap + COLLISION_PADDING;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distance = Math.hypot(dx, dy);

        if (distance >= minimumDistance) {
          continue;
        }

        hadOverlap = true;

        if (distance < EPSILON) {
          const angle = (((a.id * 37 + b.id * 17) % 360) * Math.PI) / 180;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }

        const overlap = (minimumDistance - distance) / 2;
        const ux = dx / distance;
        const uy = dy / distance;

        a.x -= ux * overlap;
        a.y -= uy * overlap;
        b.x += ux * overlap;
        b.y += uy * overlap;
      }
    }

    nodes.forEach((node) => {
      const radius = nodeScale(node.flow);
      const minX = radius + VIEWPORT_MARGIN;
      const maxX = Math.max(minX, width - radius - VIEWPORT_MARGIN);
      const minY = radius + VIEWPORT_MARGIN;
      const maxY = Math.max(minY, height - radius - VIEWPORT_MARGIN);

      node.x = Math.max(minX, Math.min(maxX, node.x));
      node.y = Math.max(minY, Math.min(maxY, node.y));
    });

    if (!hadOverlap) {
      break;
    }
  }

  const isolatedNodes = nodes
    .filter((node) => isolatedNodeIds.has(node.id))
    .sort((a, b) => a.id - b.id);

  if (isolatedNodes.length > 0) {
    const maxIsolatedRadius = isolatedNodes.reduce(
      (maxRadius, node) => Math.max(maxRadius, nodeScale(node.flow)),
      0,
    );
    const edgeOffset = Math.max(
      ISOLATED_CLUSTER_EDGE_OFFSET,
      VIEWPORT_MARGIN + maxIsolatedRadius,
    );
    const isolatedClusterX = width - edgeOffset - maxIsolatedRadius;
    const isolatedClusterY = edgeOffset + maxIsolatedRadius;
    const columnSize = ISOLATED_CLUSTER_COLUMN_SIZE;
    const spacing =
      maxIsolatedRadius * ISOLATED_NODE_SPACING_MULTIPLIER + COLLISION_PADDING;

    isolatedNodes.forEach((node, index) => {
      const radius = nodeScale(node.flow);
      const row = index % columnSize;
      const col = Math.floor(index / columnSize);
      const targetX = isolatedClusterX - col * spacing;
      const targetY = isolatedClusterY + row * spacing;
      const minX = radius + VIEWPORT_MARGIN;
      const maxX = Math.max(minX, width - radius - VIEWPORT_MARGIN);
      const minY = radius + VIEWPORT_MARGIN;
      const maxY = Math.max(minY, height - radius - VIEWPORT_MARGIN);

      node.x = Math.max(minX, Math.min(maxX, targetX));
      node.y = Math.max(minY, Math.min(maxY, targetY));
    });
  }

  return net;
};

const normalizePathValues = (path: number[]) => {
  const normalized = path
    .filter((value) => Number.isFinite(value))
    .map((value) => (value <= 0 ? value + 1 : value));

  return normalized.length > 0 ? normalized : [1];
};

const parseTreeRowsFromText = (
  treeText: string | undefined,
  nodeIdSet: Set<number>,
) => {
  if (!treeText) {
    return [];
  }

  const rows: TreeRow[] = [];

  for (const rawLine of treeText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const matched = line.match(treeLinePattern);
    if (matched) {
      const path = normalizePathValues(
        matched[1]
          .split(":")
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value)),
      );
      const flow = Number(matched[2]);
      const nodeId = Number(matched[4]);
      const name = matched[3].replace(/\\"/g, '"');

      if (nodeIdSet.has(nodeId)) {
        rows.push({
          nodeId,
          path,
          flow: Number.isFinite(flow) ? flow : 0,
          name,
        });
      }
      continue;
    }

    const tokens = line.split(/\s+/);
    if (tokens.length < 3) {
      continue;
    }

    const path = normalizePathValues(
      tokens[0]
        .split(":")
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value)),
    );
    const flow = Number(tokens[1]);
    const nodeId = Number(tokens[tokens.length - 1]);
    const fallbackName = tokens.slice(2, -1).join(" ").replace(/^"|"$/g, "");

    if (nodeIdSet.has(nodeId)) {
      rows.push({
        nodeId,
        path,
        flow: Number.isFinite(flow) ? flow : 0,
        name: fallbackName || nodeId.toString(),
      });
    }
  }

  return rows;
};

const parseTreeRowsFromJson = (
  json: InfomapJsonLike | undefined,
  nodeIdSet: Set<number>,
) => {
  if (!json?.nodes) {
    return [];
  }

  const rows: TreeRow[] = [];

  json.nodes.forEach((node) => {
    if (!nodeIdSet.has(node.id)) {
      return;
    }

    rows.push({
      nodeId: node.id,
      path: normalizePathValues(node.path ?? [1]),
      flow: Number.isFinite(node.flow) ? (node.flow as number) : 0,
      name: node.name ?? node.id.toString(),
    });
  });

  return rows;
};

const buildTreeText = (rows: TreeRow[]) =>
  rows
    .slice()
    .sort((a, b) => a.nodeId - b.nodeId)
    .map((row) => {
      const escapedName = row.name.replace(/"/g, '\\"');
      return `${row.path.join(":")} ${row.flow.toFixed(6)} "${escapedName}" ${row.nodeId}`;
    })
    .join("\n");

const runInfomap = async ({
  data,
  truthByNodeId,
  isolatedNodeIds,
  regularizationStrength,
}: {
  data: NetworkData;
  truthByNodeId: Partition;
  isolatedNodeIds: Set<number>;
  regularizationStrength: number | null;
}): Promise<InfomapRun> => {
  const Infomap = await loadInfomapConstructor();
  const infomap = new Infomap();

  const args: Record<string, unknown> = {
    twoLevel: true,
    directed: false,
    silent: true,
    numTrials: NUM_TRIALS,
    output: ["json", "tree"],
  };

  if (
    regularizationStrength !== null &&
    regularizationStrength > SUCCESS_EPSILON
  ) {
    args.regularized = true;
    args.regularizationStrength = regularizationStrength;
  }

  const result = (await infomap.runAsync({
    filename: "network.net",
    network: {
      nodes: data.nodes.map(({ id }) => ({
        id,
        name: id.toString(),
      })),
      links: data.links.map(({ source, target, weight }) => ({
        source,
        target,
        weight,
      })),
    },
    args,
  })) as InfomapResultLike;

  const nodeIds = data.nodes.map(({ id }) => id).sort((a, b) => a - b);
  const nodeIdSet = new Set(nodeIds);

  const rowsFromTree = parseTreeRowsFromText(result.tree, nodeIdSet);
  const parsedRows =
    rowsFromTree.length > 0
      ? rowsFromTree
      : parseTreeRowsFromJson(result.json, nodeIdSet);

  const rowsByNodeId = new Map<number, TreeRow>();
  parsedRows.forEach((row) => rowsByNodeId.set(row.nodeId, row));

  let syntheticModulePath =
    parsedRows.reduce(
      (maxModule, row) => Math.max(maxModule, row.path[0] ?? 1),
      0,
    ) + 1;

  for (const nodeId of nodeIds) {
    if (rowsByNodeId.has(nodeId)) {
      continue;
    }
    rowsByNodeId.set(nodeId, {
      nodeId,
      path: [syntheticModulePath++],
      flow: 0,
      name: nodeId.toString(),
    });
  }

  const rows = [...rowsByNodeId.values()].sort((a, b) => a.nodeId - b.nodeId);

  const rawPartition = new Map<number, number>();
  rows.forEach((row) => {
    rawPartition.set(row.nodeId, row.path[0] ?? row.nodeId);
  });

  const moduleByNodeId = normalizePartitionLabels(rawPartition);
  const outcome = evaluatePartition(
    data,
    moduleByNodeId,
    truthByNodeId,
    isolatedNodeIds,
  );

  return {
    outcome,
    treeText: buildTreeText(rows),
    trials: NUM_TRIALS,
  };
};

const EMPTY_NETWORK_DATA: NetworkData = {
  nodes: [],
  links: [],
};
const EMPTY_PARTITION: Partition = new Map();

const createPlaceholderNetworkData = (
  baseNetwork: RegularizedBaseNetwork,
): NetworkData => ({
  nodes: baseNetwork.nodeIds.map((id) => ({
    id,
    x: 0.5,
    y: 0.5,
    topModule: 0,
  })),
  links: baseNetwork.links.map((link) => ({ ...link })),
});

const linkKey = (source: number, target: number) =>
  source < target ? `${source}:${target}` : `${target}:${source}`;

const buildPriorLinks = (data: NetworkData): PriorLink[] => {
  const observedLinkKeys = new Set(
    data.links.map(({ source, target }) => linkKey(source, target)),
  );
  const nodeIds = data.nodes.map(({ id }) => id).sort((a, b) => a - b);
  const priorLinks: PriorLink[] = [];

  nodeIds.forEach((source, sourceIndex) => {
    nodeIds.slice(sourceIndex + 1).forEach((target) => {
      if (!observedLinkKeys.has(linkKey(source, target))) {
        priorLinks.push({ source, target });
      }
    });
  });

  return priorLinks;
};

function PriorLinksOverlay({
  network,
  links,
  nodeScale,
}: {
  network: NetworkModel;
  links: PriorLink[];
  nodeScale: (value: number) => number;
}) {
  const nodeById = useMemo(
    () => new Map(network.nodes.map((node) => [node.id, node])),
    [network.nodes],
  );
  const nodeRadius = nodeScale(1 / Math.max(network.numNodes, 1));

  return (
    <g aria-hidden="true" pointerEvents="none">
      {links.map(({ source, target }) => {
        const sourceNode = nodeById.get(source);
        const targetNode = nodeById.get(target);

        if (!sourceNode || !targetNode) {
          return null;
        }

        const x1 = sourceNode.x || 0;
        const y1 = sourceNode.y || 0;
        const x2 = targetNode.x || 0;
        const y2 = targetNode.y || 0;
        const dx = x2 - x1 || 1e-6;
        const dy = y2 - y1 || 1e-6;
        const length = Math.sqrt(dx * dx + dy * dy);
        const unitX = dx / length;
        const unitY = dy / length;

        return (
          <line
            key={`prior-link-${source}-${target}`}
            x1={x1 + nodeRadius * unitX}
            y1={y1 + nodeRadius * unitY}
            x2={x2 - nodeRadius * unitX}
            y2={y2 - nodeRadius * unitY}
            stroke={PRIOR_LINK_STROKE}
            strokeOpacity={0.22}
            strokeWidth={0.7}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </g>
  );
}

export default observer(function RegularizedInfomap({
  width = 800,
  height = 400,
}: Props) {
  const [sparsePercentage, setSparsePercentage] = useState(0);
  const [regularizationStrength, setRegularizationStrength] = useState(0.7);
  const [showPriorLinks, setShowPriorLinks] = useState(false);
  const [linksCopyStatus, setLinksCopyStatus] = useState("");
  const [treeCopyStatus, setTreeCopyStatus] = useState<
    Record<NetworkState, string>
  >({
    normal: "",
    regularized: "",
  });
  const [datasetState, setDatasetState] = useState<DatasetState>({
    status: "loading",
  });
  const [normalPrecomputeState, setNormalPrecomputeState] =
    useState<PrecomputeState>({
      status: "idle",
      completedRuns: 0,
      totalRuns: TOTAL_NORMAL_PRECOMPUTED_RUNS,
    });
  const [regularizedPrecomputeState, setRegularizedPrecomputeState] =
    useState<PrecomputeState>({
      status: "idle",
      completedRuns: 0,
      totalRuns: TOTAL_REGULARIZED_PRECOMPUTED_RUNS,
    });
  const [normalHistory, setNormalHistory] = useState<TriedNormalRun[]>([]);
  const [regularizedHistory, setRegularizedHistory] = useState<
    TriedRegularizationRun[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    setDatasetState({ status: "loading" });
    setNormalPrecomputeState({
      status: "idle",
      completedRuns: 0,
      totalRuns: TOTAL_NORMAL_PRECOMPUTED_RUNS,
    });
    setRegularizedPrecomputeState({
      status: "idle",
      completedRuns: 0,
      totalRuns: TOTAL_REGULARIZED_PRECOMPUTED_RUNS,
    });
    setNormalHistory([]);
    setRegularizedHistory([]);

    const load = async () => {
      try {
        const response = await fetch(getRegularizedNetworkUrl());
        if (!response.ok) {
          throw new Error(
            `Could not load the complete network (${response.status})`,
          );
        }

        const baseNetwork = parseRegularizedNetworkDat(await response.text());
        const placeholderData = createPlaceholderNetworkData(baseNetwork);
        const placeholderTruth = new Map<number, number>(
          baseNetwork.nodeIds.map((id) => [id, 0]),
        );
        const referenceRun = await runInfomap({
          data: placeholderData,
          truthByNodeId: placeholderTruth,
          isolatedNodeIds: getIsolatedNodeIds(placeholderData),
          regularizationStrength: null,
        });
        const completeData = buildRegularizedNetworkData(
          baseNetwork,
          referenceRun.outcome.moduleByNodeId,
        );

        if (!cancelled) {
          setDatasetState({
            status: "ready",
            completeData,
            referencePartition: referenceRun.outcome.moduleByNodeId,
          });
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : String(error);
          setDatasetState({
            status: "error",
            message: `Failed to prepare the complete network (${message})`,
          });
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const completeData =
    datasetState.status === "ready"
      ? datasetState.completeData
      : EMPTY_NETWORK_DATA;
  const truthByNodeId =
    datasetState.status === "ready"
      ? datasetState.referencePartition
      : EMPTY_PARTITION;
  const data = useMemo(
    () =>
      datasetState.status === "ready"
        ? createRegularizedIncompleteNetwork(completeData, sparsePercentage)
        : EMPTY_NETWORK_DATA,
    [completeData, datasetState.status, sparsePercentage],
  );
  const priorLinks = useMemo(() => buildPriorLinks(data), [data]);
  const isolatedNodeIds = useMemo(() => getIsolatedNodeIds(data), [data]);
  const cachedNormalRun = useMemo(
    () =>
      normalHistory.find((entry) => entry.sparsePercentage === sparsePercentage)
        ?.run ?? null,
    [normalHistory, sparsePercentage],
  );
  const cachedRegularizedRun = useMemo(
    () =>
      regularizedHistory.find(
        (entry) =>
          entry.sparsePercentage === sparsePercentage &&
          Math.abs(entry.strength - regularizationStrength) <= SUCCESS_EPSILON,
      )?.run ?? null,
    [regularizationStrength, regularizedHistory, sparsePercentage],
  );

  useEffect(() => {
    if (datasetState.status !== "ready") {
      return;
    }

    let cancelled = false;
    setNormalPrecomputeState({
      status: "running",
      completedRuns: 0,
      totalRuns: TOTAL_NORMAL_PRECOMPUTED_RUNS,
    });

    const precomputeNormal = async () => {
      let completedRuns = 0;
      try {
        for (const sparseValue of SPARSE_PERCENTAGES) {
          const sparseData = createRegularizedIncompleteNetwork(
            completeData,
            sparseValue,
          );
          const sparseIsolatedNodeIds = getIsolatedNodeIds(sparseData);

          const normalRun = await runInfomap({
            data: sparseData,
            truthByNodeId,
            isolatedNodeIds: sparseIsolatedNodeIds,
            regularizationStrength: null,
          });

          if (cancelled) {
            return;
          }

          setNormalHistory((previous) => {
            const nextEntry = {
              sparsePercentage: sparseValue,
              run: normalRun,
            };
            const filtered = previous.filter(
              (entry) => entry.sparsePercentage !== sparseValue,
            );
            return [...filtered, nextEntry];
          });
          completedRuns += 1;
          setNormalPrecomputeState({
            status: "running",
            completedRuns,
            totalRuns: TOTAL_NORMAL_PRECOMPUTED_RUNS,
          });
        }

        if (!cancelled) {
          setNormalPrecomputeState({
            status: "ready",
            completedRuns: TOTAL_NORMAL_PRECOMPUTED_RUNS,
            totalRuns: TOTAL_NORMAL_PRECOMPUTED_RUNS,
          });
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : String(error);
          setNormalPrecomputeState({
            status: "error",
            completedRuns,
            totalRuns: TOTAL_NORMAL_PRECOMPUTED_RUNS,
            message: `Failed to precompute standard Infomap cache (${message})`,
          });
        }
      }
    };

    precomputeNormal();

    return () => {
      cancelled = true;
    };
  }, [completeData, datasetState.status, truthByNodeId]);

  useEffect(() => {
    if (datasetState.status !== "ready") {
      return;
    }

    let cancelled = false;
    setRegularizedHistory([]);
    setRegularizedPrecomputeState({
      status: "running",
      completedRuns: 0,
      totalRuns: TOTAL_REGULARIZED_PRECOMPUTED_RUNS,
    });

    const precomputeRegularized = async () => {
      let completedRuns = 0;
      try {
        for (const sparseValue of SPARSE_PERCENTAGES) {
          const sparseData = createRegularizedIncompleteNetwork(
            completeData,
            sparseValue,
          );
          const sparseIsolatedNodeIds = getIsolatedNodeIds(sparseData);

          const regularizedRun = await runInfomap({
            data: sparseData,
            truthByNodeId,
            isolatedNodeIds: sparseIsolatedNodeIds,
            regularizationStrength,
          });

          if (cancelled) {
            return;
          }

          setRegularizedHistory((previous) => {
            const nextEntry = {
              sparsePercentage: sparseValue,
              strength: regularizationStrength,
              run: regularizedRun,
            };
            const filtered = previous.filter(
              (entry) =>
                !(
                  entry.sparsePercentage === sparseValue &&
                  Math.abs(entry.strength - regularizationStrength) <=
                    SUCCESS_EPSILON
                ),
            );
            return [...filtered, nextEntry];
          });
          completedRuns += 1;
          setRegularizedPrecomputeState({
            status: "running",
            completedRuns,
            totalRuns: TOTAL_REGULARIZED_PRECOMPUTED_RUNS,
          });
        }

        if (!cancelled) {
          setRegularizedPrecomputeState({
            status: "ready",
            completedRuns: TOTAL_REGULARIZED_PRECOMPUTED_RUNS,
            totalRuns: TOTAL_REGULARIZED_PRECOMPUTED_RUNS,
          });
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : String(error);
          setRegularizedPrecomputeState({
            status: "error",
            completedRuns,
            totalRuns: TOTAL_REGULARIZED_PRECOMPUTED_RUNS,
            message: `Failed to precompute regularized Infomap cache (${message})`,
          });
        }
      }
    };

    precomputeRegularized();

    return () => {
      cancelled = true;
    };
  }, [
    completeData,
    datasetState.status,
    regularizationStrength,
    truthByNodeId,
  ]);

  const normalRunState: RunState = cachedNormalRun
    ? { status: "ready", run: cachedNormalRun }
    : normalPrecomputeState.status === "error"
      ? { status: "error", message: normalPrecomputeState.message }
      : { status: "loading" };
  const regularizedRunState: RunState = cachedRegularizedRun
    ? { status: "ready", run: cachedRegularizedRun }
    : regularizedPrecomputeState.status === "error"
      ? { status: "error", message: regularizedPrecomputeState.message }
      : { status: "loading" };
  const normalPrecomputeStatusMessage = formatPrecomputeStatusMessage(
    "standard Infomap runs",
    normalPrecomputeState.completedRuns,
    normalPrecomputeState.totalRuns,
  );
  const regularizedPrecomputeStatusMessage = formatPrecomputeStatusMessage(
    `regularized Infomap runs at strength ${regularizationStrength.toFixed(2)}`,
    regularizedPrecomputeState.completedRuns,
    regularizedPrecomputeState.totalRuns,
  );

  const fallbackPartition = useMemo(
    () =>
      new Map<number, number>(
        data.nodes.map(({ id, topModule }) => [id, topModule]),
      ),
    [data],
  );

  const networkWidth = Math.max(320, Math.round(width / 2));
  const networkHeight = Math.max(280, Math.round(height * 0.82));
  const lockedNodePositions = useMemo<NodePositionById | undefined>(() => {
    if (datasetState.status !== "ready") {
      return undefined;
    }

    const referenceNetwork = buildVisualizationNetwork(
      completeData,
      truthByNodeId,
      getIsolatedNodeIds(completeData),
      networkWidth,
      networkHeight,
      regularizedNodeScale,
    );

    return new Map(
      referenceNetwork.nodes.map((node) => [node.id, { x: node.x, y: node.y }]),
    );
  }, [
    completeData,
    datasetState.status,
    networkHeight,
    networkWidth,
    truthByNodeId,
  ]);
  const normalPartition = useMemo(
    () =>
      normalRunState.status === "ready"
        ? normalRunState.run.outcome.moduleByNodeId
        : fallbackPartition,
    [fallbackPartition, normalRunState],
  );
  const regularizedPartition = useMemo(
    () =>
      regularizedRunState.status === "ready"
        ? regularizedRunState.run.outcome.moduleByNodeId
        : fallbackPartition,
    [fallbackPartition, regularizedRunState],
  );
  const {
    moduleScheme: normalModuleScheme,
    moduleSchemeAlt: normalModuleSchemeAlt,
  } = useMemo(
    () => buildModuleSchemes(data, normalPartition, isolatedNodeIds),
    [data, isolatedNodeIds, normalPartition],
  );
  const {
    moduleScheme: regularizedModuleScheme,
    moduleSchemeAlt: regularizedModuleSchemeAlt,
  } = useMemo(
    () => buildModuleSchemes(data, regularizedPartition, isolatedNodeIds),
    [data, isolatedNodeIds, regularizedPartition],
  );

  const normalNetwork = useMemo(
    () =>
      buildVisualizationNetwork(
        data,
        normalPartition,
        isolatedNodeIds,
        networkWidth,
        networkHeight,
        regularizedNodeScale,
        lockedNodePositions,
      ),
    [
      data,
      isolatedNodeIds,
      lockedNodePositions,
      networkHeight,
      networkWidth,
      normalPartition,
    ],
  );
  const regularizedNetwork = useMemo(
    () =>
      buildVisualizationNetwork(
        data,
        regularizedPartition,
        isolatedNodeIds,
        networkWidth,
        networkHeight,
        regularizedNodeScale,
        lockedNodePositions,
      ),
    [
      data,
      isolatedNodeIds,
      lockedNodePositions,
      networkHeight,
      networkWidth,
      regularizedPartition,
    ],
  );

  const allLinksText = useMemo(() => {
    const vertices = [...data.nodes]
      .sort((a, b) => a.id - b.id)
      .map((node) => `${node.id} "${node.id}"`);

    const edges = [...data.links]
      .sort(
        (a, b) =>
          a.source - b.source || a.target - b.target || a.weight - b.weight,
      )
      .map((link) => `${link.source} ${link.target} ${link.weight.toFixed(6)}`);

    return [
      `*Vertices ${data.nodes.length}`,
      ...vertices,
      "*Edges",
      ...edges,
    ].join("\n");
  }, [data]);

  const normalFallbackTreeText = useMemo(
    () => buildFallbackTreeText(normalNetwork),
    [normalNetwork],
  );
  const regularizedFallbackTreeText = useMemo(
    () => buildFallbackTreeText(regularizedNetwork),
    [regularizedNetwork],
  );
  const normalTreeText =
    normalRunState.status === "ready"
      ? normalRunState.run.treeText
      : normalFallbackTreeText;
  const regularizedTreeText =
    regularizedRunState.status === "ready"
      ? regularizedRunState.run.treeText
      : regularizedFallbackTreeText;

  const handleCopyLinks = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(allLinksText);
      setLinksCopyStatus("Links copied");
    } catch {
      setLinksCopyStatus("Link copy failed");
    }

    setTimeout(() => setLinksCopyStatus(""), 1500);
  }, [allLinksText]);

  const handleCopyTree = useCallback(
    async (networkType: NetworkState, value: string) => {
      try {
        await navigator.clipboard.writeText(value);
        setTreeCopyStatus((previous) => ({
          ...previous,
          [networkType]: "Copied",
        }));
      } catch {
        setTreeCopyStatus((previous) => ({
          ...previous,
          [networkType]: "Copy failed",
        }));
      }

      setTimeout(
        () =>
          setTreeCopyStatus((previous) => ({
            ...previous,
            [networkType]: "",
          })),
        1500,
      );
    },
    [],
  );

  const triedRegularizationsForCurrentSparsity = useMemo(
    () =>
      regularizedHistory.filter(
        (entry) => entry.sparsePercentage === sparsePercentage,
      ),
    [regularizedHistory, sparsePercentage],
  );
  const bestTriedRegularization = useMemo(() => {
    if (triedRegularizationsForCurrentSparsity.length === 0) {
      return null;
    }

    return triedRegularizationsForCurrentSparsity.reduce((best, candidate) =>
      isBetterRegularizationRun(candidate, best) ? candidate : best,
    );
  }, [triedRegularizationsForCurrentSparsity]);
  const latestTriedRegularization = useMemo(() => {
    if (triedRegularizationsForCurrentSparsity.length === 0) {
      return null;
    }

    return triedRegularizationsForCurrentSparsity[
      triedRegularizationsForCurrentSparsity.length - 1
    ];
  }, [triedRegularizationsForCurrentSparsity]);
  const normalOutcome =
    normalRunState.status === "ready" ? normalRunState.run.outcome : null;
  const regularizedOutcome =
    regularizedRunState.status === "ready"
      ? regularizedRunState.run.outcome
      : null;
  const normalAssessment = normalOutcome
    ? assessOutcome(normalOutcome, "normal", null)
    : null;
  const regularizedAssessment =
    regularizedOutcome && normalOutcome
      ? assessOutcome(regularizedOutcome, "regularized", normalOutcome)
      : regularizedOutcome
        ? assessOutcome(regularizedOutcome, "regularized", null)
        : null;
  const reservedRegularizedOutcome =
    regularizedOutcome ?? latestTriedRegularization?.run.outcome ?? null;
  const sweepOutcomePoints = useMemo(
    () =>
      SPARSE_PERCENTAGES.map((sparseValue) => ({
        sparsePercentage: sparseValue,
        normalOutcome:
          normalHistory.find((entry) => entry.sparsePercentage === sparseValue)
            ?.run.outcome ?? null,
        regularizedOutcome:
          regularizedHistory.find(
            (entry) =>
              entry.sparsePercentage === sparseValue &&
              Math.abs(entry.strength - regularizationStrength) <=
                SUCCESS_EPSILON,
          )?.run.outcome ?? null,
      })),
    [normalHistory, regularizationStrength, regularizedHistory],
  );
  const amiChartPoints = useMemo(
    () =>
      sweepOutcomePoints.map(
        ({
          sparsePercentage: sparseValue,
          normalOutcome,
          regularizedOutcome,
        }) => ({
          sparsePercentage: sparseValue,
          normalValue: normalOutcome?.adjustedMutualInformation ?? null,
          regularizedValue:
            regularizedOutcome?.adjustedMutualInformation ?? null,
          targetValue: 1,
        }),
      ),
    [sweepOutcomePoints],
  );
  const moduleChartPoints = useMemo(
    () =>
      sweepOutcomePoints.map(
        ({
          sparsePercentage: sparseValue,
          normalOutcome,
          regularizedOutcome,
        }) => ({
          sparsePercentage: sparseValue,
          normalValue: normalOutcome?.moduleCount ?? null,
          regularizedValue: regularizedOutcome?.moduleCount ?? null,
          targetValue:
            normalOutcome?.truthModuleCount ??
            regularizedOutcome?.truthModuleCount ??
            null,
        }),
      ),
    [sweepOutcomePoints],
  );
  const amiChartDomain = useMemo(
    () => getAmiChartDomain(amiChartPoints),
    [amiChartPoints],
  );
  const moduleChartDomain = useMemo(
    () => getModuleChartDomain(moduleChartPoints),
    [moduleChartPoints],
  );
  const amiChartTicks = useMemo(
    () => getAmiChartTicks(amiChartDomain),
    [amiChartDomain],
  );
  const moduleChartTicks = useMemo(
    () => getModuleChartTicks(moduleChartDomain),
    [moduleChartDomain],
  );

  const completeNetworkNodeCount = completeData.nodes.length;
  const completeNetworkUniqueLinkCount = new Set(
    completeData.links.map(({ source, target }) => {
      const minNodeId = Math.min(source, target);
      const maxNodeId = Math.max(source, target);
      return `${minNodeId}:${maxNodeId}`;
    }),
  ).size;
  const completeNetworkAvgLinksPerNode =
    completeNetworkNodeCount > 0
      ? Math.round(
          ((2 * completeNetworkUniqueLinkCount) / completeNetworkNodeCount) * 2,
        ) / 2
      : 0;
  const isolatedNodeNotice =
    isolatedNodeIds.size > 0 ? (
      <div className="mx-auto max-w-[240px] space-y-1 text-center text-xs text-sky-900">
        <div className="font-semibold">Isolated Nodes</div>
        <div>
          {`${isolatedNodeIds.size} isolated node${isolatedNodeIds.size === 1 ? "" : "s"} detected.`}
        </div>
        <div>
          Isolated nodes have no links, so isolated-only modules are excluded
          from pass/fail module counting.
        </div>
      </div>
    ) : null;
  const collapseWarningNotice =
    regularizedOutcome &&
    regularizedOutcome.moduleCount === 1 &&
    regularizedRunState.status === "ready" ? (
      <div className="mx-auto max-w-[240px] space-y-1 text-center text-xs text-amber-900">
        <div className="font-semibold">{COLLAPSE_WARNING_TITLE}</div>
        <div>{COLLAPSE_WARNING_DESCRIPTION}</div>
        <div>{COLLAPSE_WARNING_EXPLANATION}</div>
      </div>
    ) : null;
  const amiSummaryIsVisible =
    normalOutcome !== null && regularizedOutcome !== null;
  const renderAmiSummary = (className: string) => (
    <div className="grid">
      <div
        aria-hidden="true"
        className={`${className} invisible [grid-area:1/1]`}
      >
        <div>
          Standard AMI ?: <strong>0.000</strong>
        </div>
        <div>
          Regularized AMI: <strong>0.000</strong>
        </div>
      </div>
      {amiSummaryIsVisible && normalOutcome && regularizedOutcome && (
        <div className={`${className} [grid-area:1/1]`}>
          <div>
            Standard AMI <HelpTooltip content={AMI_HELP} />:{" "}
            <strong>
              {formatAmi(normalOutcome.adjustedMutualInformation)}
            </strong>
          </div>
          <div>
            Regularized AMI:{" "}
            <strong>
              {formatAmi(regularizedOutcome.adjustedMutualInformation)}
            </strong>
          </div>
        </div>
      )}
    </div>
  );
  const renderPriorLinksToggleButton = () => (
    <button
      type="button"
      className="mx-auto block rounded-full border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50"
      onClick={() => setShowPriorLinks((visible) => !visible)}
    >
      {showPriorLinks ? "hide prior links" : "show prior links"}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="prose max-w-none">
        <h2 className="text-2xl font-bold mb-4">Regularized Infomap</h2>
        <p>
          In real life you often deal with incomplete data, such as missing
          links or inaccurate link weights. Regularized Infomap is useful in
          those settings because it can make the detected modules less brittle
          when the observed network is only a partial or noisy picture of the
          underlying system.
        </p>
        <p>
          This example uses a complete network
          {completeNetworkNodeCount > 0 && (
            <>
              {" "}
              with {completeNetworkNodeCount} nodes, where each node has about{" "}
              {completeNetworkAvgLinksPerNode.toFixed(1)} links on average
            </>
          )}
          . We first run standard Infomap on that complete network and use the
          resulting partition as the reference structure. We then remove a
          fraction of links at random to simulate incomplete data and ask
          Infomap to recover that reference partition.
        </p>
        <p>
          <strong>Regularized Infomap</strong> adds a weak structural prior that
          makes the partition less eager to overreact to missing links and noisy
          evidence. When the observed network is sparse, that incorporated prior
          assumption can stabilize the solution by balancing the measured flow
          against a simpler baseline model, instead of trusting every missing
          edge as a strong signal. Here we use the <strong>Infomap API</strong>{" "}
          and compare regularized and non-regularized solutions directly.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-gray-700 xl:hidden">
          <div className="space-y-1">
            {renderPriorLinksToggleButton()}
            <label className={CONTROL_LABEL_CLASS}>
              <strong className={CONTROL_TEXT_CLASS}>
                <HelpTooltip content={LINK_REMOVAL_HELP} />
                <span className={CONTROL_VALUE_CLASS}>
                  Link Removal: {sparsePercentage}%
                </span>
              </strong>
              <input
                type="range"
                min="0"
                max={MAX_SPARSE_PERCENTAGE}
                step="5"
                value={sparsePercentage}
                onChange={(e) => setSparsePercentage(Number(e.target.value))}
                className={CONTROL_RANGE_CLASS}
              />
            </label>
          </div>

          <div className="space-y-1">
            <label className={CONTROL_LABEL_CLASS}>
              <strong className={CONTROL_TEXT_CLASS}>
                <HelpTooltip content={REGULARIZATION_HELP} />
                <span className={CONTROL_VALUE_CLASS}>
                  Regularization: {regularizationStrength.toFixed(2)}
                </span>
              </strong>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={regularizationStrength}
                onChange={(e) =>
                  setRegularizationStrength(Number(e.target.value))
                }
                className={CONTROL_RANGE_CLASS}
              />
            </label>
          </div>
        </div>

        {datasetState.status === "loading" && (
          <div className="text-blue-700">
            <strong>Dataset:</strong> loading{" "}
            <code>VII_network_complete.dat</code> and deriving the 0%
            standard-Infomap reference partition...
          </div>
        )}
        {datasetState.status === "error" && (
          <div className="text-red-700">
            <strong>Dataset:</strong> {datasetState.message}
          </div>
        )}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:items-start xl:gap-x-6">
          <div className="xl:col-start-2 xl:row-start-1 xl:self-start xl:justify-self-center xl:pt-7">
            <div className="hidden xl:block">
              <div className="flex flex-col items-center gap-3 text-xs text-gray-700">
                <div className="space-y-1">
                  {renderPriorLinksToggleButton()}
                  <label className={CONTROL_LABEL_CLASS}>
                    <strong className={CONTROL_TEXT_CLASS}>
                      <HelpTooltip content={LINK_REMOVAL_HELP} />
                      <span className={CONTROL_VALUE_CLASS}>
                        Link Removal: {sparsePercentage}%
                      </span>
                    </strong>
                    <input
                      type="range"
                      min="0"
                      max={MAX_SPARSE_PERCENTAGE}
                      step="5"
                      value={sparsePercentage}
                      onChange={(e) =>
                        setSparsePercentage(Number(e.target.value))
                      }
                      className={CONTROL_RANGE_CLASS}
                    />
                  </label>
                </div>

                <div className="space-y-1">
                  <label className={CONTROL_LABEL_CLASS}>
                    <strong className={CONTROL_TEXT_CLASS}>
                      <HelpTooltip content={REGULARIZATION_HELP} />
                      <span className={CONTROL_VALUE_CLASS}>
                        Regularization: {regularizationStrength.toFixed(2)}
                      </span>
                    </strong>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.05"
                      value={regularizationStrength}
                      onChange={(e) =>
                        setRegularizationStrength(Number(e.target.value))
                      }
                      className={CONTROL_RANGE_CLASS}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 hidden min-w-[220px] xl:block">
              <div className="space-y-4">
                {renderAmiSummary(
                  "space-y-2 text-center text-sm text-gray-900",
                )}
                {isolatedNodeNotice}
                {collapseWarningNotice}
              </div>
            </div>
          </div>

          <div className="space-y-2 xl:col-start-1 xl:row-start-1">
            <h3 className="text-center text-sm font-semibold uppercase tracking-[0.12em] text-gray-600">
              Standard Infomap
            </h3>
            <Network
              network={normalNetwork}
              scheme={normalModuleScheme}
              schemeAlt={normalModuleSchemeAlt}
              showLabels={false}
              showModules={true}
              colorIntraModuleLinks={true}
              baseLinkStrokeWidth={1}
              showNodeId={false}
              nodeStroke="#fff"
              nodeStrokeWidth={1.5}
              width={networkWidth}
              height={networkHeight}
              nodeScale={regularizedNodeScale}
            />

            {datasetState.status === "ready" &&
              normalRunState.status === "loading" && (
                <div className="text-blue-700">
                  <strong>Standard Infomap:</strong>{" "}
                  {normalPrecomputeStatusMessage}
                </div>
              )}
            {datasetState.status === "ready" &&
              normalRunState.status === "error" && (
                <div className="text-red-700">
                  <strong>Standard Infomap:</strong> {normalRunState.message}
                </div>
              )}

            <div className="min-h-[3.25rem]">
              {normalOutcome && normalAssessment && (
                <div className={normalAssessment.toneClassName}>
                  {normalAssessment.label === "pass"
                    ? "✓"
                    : normalAssessment.label === "half-pass"
                      ? "~"
                      : "⚠"}{" "}
                  <strong>Standard Infomap:</strong> {normalAssessment.label} (
                  {normalAssessment.description} Modules{" "}
                  {normalOutcome.moduleCount}/{normalOutcome.truthModuleCount}
                  {normalOutcome.rawModuleCount !==
                    normalOutcome.moduleCount && (
                    <> - ignoring isolated node modules</>
                  )}
                  ).
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2 xl:col-start-3 xl:row-start-1">
            <h3 className="text-center text-sm font-semibold uppercase tracking-[0.12em] text-gray-600">
              Regularized Infomap
            </h3>
            <Network
              network={regularizedNetwork}
              scheme={regularizedModuleScheme}
              schemeAlt={regularizedModuleSchemeAlt}
              showLabels={false}
              showModules={true}
              colorIntraModuleLinks={true}
              baseLinkStrokeWidth={1}
              showNodeId={false}
              nodeStroke="#fff"
              nodeStrokeWidth={1.5}
              width={networkWidth}
              height={networkHeight}
              nodeScale={regularizedNodeScale}
              underlayChildren={
                showPriorLinks ? (
                  <PriorLinksOverlay
                    network={regularizedNetwork}
                    links={priorLinks}
                    nodeScale={regularizedNodeScale}
                  />
                ) : undefined
              }
            />

            {datasetState.status === "ready" &&
              regularizedRunState.status === "loading" && (
                <div className="text-blue-700">
                  <strong>Regularized Infomap:</strong>{" "}
                  {regularizedPrecomputeStatusMessage}
                </div>
              )}
            {datasetState.status === "ready" &&
              regularizedRunState.status === "error" && (
                <div className="text-red-700">
                  <strong>Regularized Infomap:</strong>{" "}
                  {regularizedRunState.message}
                </div>
              )}

            <div className="grid min-h-[3.25rem]">
              {reservedRegularizedOutcome && (
                <div aria-hidden="true" className="invisible [grid-area:1/1]">
                  ~ <strong>Regularized Infomap:</strong>{" "}
                  {REGULARIZED_RESERVED_ASSESSMENT_LABEL} at regularization
                  strength {regularizationStrength.toFixed(2)} (
                  {REGULARIZED_FAIL_DESCRIPTION} Modules{" "}
                  {Math.max(
                    reservedRegularizedOutcome.moduleCount,
                    reservedRegularizedOutcome.rawModuleCount,
                  )}
                  /{reservedRegularizedOutcome.truthModuleCount}
                  <> - ignoring isolated node modules</>
                  ).
                </div>
              )}
              {regularizedOutcome && regularizedAssessment && (
                <div
                  className={`${regularizedAssessment.toneClassName} [grid-area:1/1]`}
                >
                  {regularizedAssessment.label === "pass"
                    ? "✓"
                    : regularizedAssessment.label === "half-pass"
                      ? "~"
                      : "⚠"}{" "}
                  <strong>Regularized Infomap:</strong>{" "}
                  {regularizedAssessment.label} at regularization strength{" "}
                  {regularizationStrength.toFixed(2)} (
                  {regularizedAssessment.description} Modules{" "}
                  {regularizedOutcome.moduleCount}/
                  {regularizedOutcome.truthModuleCount}
                  {regularizedOutcome.rawModuleCount !==
                    regularizedOutcome.moduleCount && (
                    <> - ignoring isolated node modules</>
                  )}
                  ).
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SweepChart
            title={`AMI / Link removal at regularization strength ${regularizationStrength.toFixed(
              2,
            )}`}
            helpContent={AMI_HELP}
            yLabel="AMI"
            points={amiChartPoints}
            yDomain={amiChartDomain}
            yTicks={amiChartTicks}
            currentSparsePercentage={sparsePercentage}
            formatYTick={formatAmiTick}
            formatValue={formatAmi}
            targetLabel="Exact recovery"
          />
          <SweepChart
            title={`Modules / Link removal at regularization strength ${regularizationStrength.toFixed(
              2,
            )}`}
            helpContent={MODULE_COUNT_HELP}
            yLabel="Modules"
            points={moduleChartPoints}
            yDomain={moduleChartDomain}
            yTicks={moduleChartTicks}
            currentSparsePercentage={sparsePercentage}
            formatYTick={formatModuleCount}
            formatValue={formatModuleCount}
            targetLabel="Reference"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="xl:hidden min-h-[4rem]">
            <div className="space-y-4">
              {renderAmiSummary("space-y-2 text-sm text-gray-900")}
              {isolatedNodeNotice}
              {collapseWarningNotice}
            </div>
          </div>

          <div className="min-h-[6.5rem]">
            {regularizedOutcome &&
              normalOutcome &&
              bestTriedRegularization &&
              triedRegularizationsForCurrentSparsity.length > 1 && (
                <div>
                  <h4 className="font-semibold mb-2">Best Tried Strength</h4>
                  <div className="space-y-1 text-sm">
                    <div>
                      Best tried regularization strength for {sparsePercentage}%
                      link removal:{" "}
                      <strong>
                        {bestTriedRegularization.strength.toFixed(2)}
                      </strong>
                    </div>
                    <div>
                      AMI:{" "}
                      <strong>
                        {formatAmi(
                          bestTriedRegularization.run.outcome
                            .adjustedMutualInformation,
                        )}
                      </strong>
                    </div>
                    <div>
                      Assessment:{" "}
                      <strong>
                        {
                          assessOutcome(
                            bestTriedRegularization.run.outcome,
                            "regularized",
                            normalOutcome,
                          ).label
                        }
                      </strong>
                    </div>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          className="button text-xs py-1 px-2"
          onClick={handleCopyLinks}
        >
          Copy links (Pajek format)
        </button>
        <button
          type="button"
          className="button text-xs py-1 px-2"
          onClick={() => handleCopyTree("normal", normalTreeText)}
        >
          Copy tree output (standard)
        </button>
        <button
          type="button"
          className="button text-xs py-1 px-2"
          onClick={() => handleCopyTree("regularized", regularizedTreeText)}
        >
          Copy tree output (regularized)
        </button>
        {(linksCopyStatus ||
          treeCopyStatus.normal ||
          treeCopyStatus.regularized) && (
          <span className="text-xs text-gray-500">
            {[
              linksCopyStatus,
              treeCopyStatus.normal,
              treeCopyStatus.regularized,
            ]
              .filter(Boolean)
              .join(" ")}
          </span>
        )}
      </div>

      <div className="prose max-w-none">
        <h3 className="text-xl font-bold">How it works</h3>
        <ol>
          <li>
            <strong>Complete Network:</strong> We load the edge list from{" "}
            <code>VII_network_complete.dat</code> and run standard Infomap at 0%
            link removal to get the reference partition.
          </li>
          <li>
            <strong>Standard Infomap:</strong> Runs{" "}
            <code>@mapequation/infomap</code> with two-level optimization and{" "}
            <code>-N {NUM_TRIALS}</code> trials.
          </li>
          <li>
            <strong>Regularized Infomap:</strong> Runs the same API with
            <code>
              {" "}
              --regularized --regularization-strength{" "}
              {regularizationStrength.toFixed(2)}
            </code>{" "}
            and <code>-N {NUM_TRIALS}</code> trials.
          </li>
          <li>
            <strong>Evaluation:</strong> A run passes only if it recovers
            exactly the reference partition from the complete network.
          </li>
        </ol>
      </div>
    </div>
  );
});
