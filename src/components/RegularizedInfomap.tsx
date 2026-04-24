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

interface CollapsiblePanelProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

type NetworkState = "normal" | "regularized";
type Partition = Map<number, number>;
type NodePositionById = Map<number, { x: number; y: number }>;

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
  apiCodelength: number;
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
  codelength?: number;
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
  "Outperforms normal Infomap, but does not exactly recover the reference partition from the complete network.";
const NORMAL_FAIL_DESCRIPTION =
  "Does not exactly recover the reference partition from the complete network.";
const REGULARIZED_FAIL_DESCRIPTION =
  "Does not recover the reference partition from the complete network and does not outperform normal Infomap.";
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
  "Removes the selected share of links at random to simulate incomplete data in both the normal and regularized networks.";
const REGULARIZATION_HELP =
  "Regularization strength controls how strongly Infomap uses the uniform prior when running with --regularized. The uniform prior acts like a weak background assumption that gently links all nodes together before the observed network is taken into account. Increasing this strength makes Infomap rely a bit less on sparse or noisy edge evidence and a bit more on that neutral baseline, instead of interpreting every missing link as strong evidence that nodes should be separated.";
const SPARSE_PERCENTAGES = Array.from({ length: 17 }, (_, index) => index * 5);
const MAX_SPARSE_PERCENTAGE =
  SPARSE_PERCENTAGES[SPARSE_PERCENTAGES.length - 1];
const TOTAL_NORMAL_PRECOMPUTED_RUNS = SPARSE_PERCENTAGES.length;
const TOTAL_REGULARIZED_PRECOMPUTED_RUNS = SPARSE_PERCENTAGES.length;

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

function CollapsiblePanel({
  title,
  children,
  defaultOpen = false,
}: CollapsiblePanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 py-2 text-left"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
      >
        <h4 className="font-semibold">{title}</h4>
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {isOpen ? "Hide" : "Show"}
        </span>
      </button>
      {isOpen && <div>{children}</div>}
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
  const moduleStats = new Map<number, { isolated: number; nonIsolated: number }>();

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

const formatSignedAmiDifference = (value: number) =>
  `${value >= 0 ? "+" : ""}${value.toFixed(3)}`;

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

const parseTreeHeaderCodelength = (treeText: string | undefined) => {
  if (!treeText) {
    return Number.NaN;
  }

  const line = treeText
    .split(/\r?\n/)
    .find((candidate) => /codelength/i.test(candidate));
  if (!line) {
    return Number.NaN;
  }

  const match = line.match(
    /codelength(?:\s*[:=])?\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/i,
  );
  if (!match) {
    return Number.NaN;
  }

  const value = Number(match[1]);
  return Number.isFinite(value) ? value : Number.NaN;
};

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

  const jsonCodelength = result.json?.codelength;
  const apiCodelength = Number.isFinite(jsonCodelength)
    ? (jsonCodelength as number)
    : parseTreeHeaderCodelength(result.tree);

  return {
    outcome,
    treeText: buildTreeText(rows),
    apiCodelength,
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

export default observer(function RegularizedInfomap({
  width = 800,
  height = 400,
}: Props) {
  const [sparsePercentage, setSparsePercentage] = useState(0);
  const [regularizationStrength, setRegularizationStrength] = useState(0.7);
  const [copyStatus, setCopyStatus] = useState("");
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
            message: `Failed to precompute normal Infomap cache (${message})`,
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
  }, [completeData, datasetState.status, regularizationStrength, truthByNodeId]);

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
    "normal Infomap runs",
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
      referenceNetwork.nodes.map((node) => [
        node.id,
        { x: node.x, y: node.y },
      ]),
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
  const { moduleScheme: normalModuleScheme, moduleSchemeAlt: normalModuleSchemeAlt } =
    useMemo(
      () => buildModuleSchemes(data, normalPartition, isolatedNodeIds),
      [data, isolatedNodeIds, normalPartition],
    );
  const {
    moduleScheme: regularizedModuleScheme,
    moduleSchemeAlt: regularizedModuleSchemeAlt,
  } = useMemo(
    () =>
      buildModuleSchemes(data, regularizedPartition, isolatedNodeIds),
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
          a.source - b.source ||
          a.target - b.target ||
          a.weight - b.weight,
      )
      .map(
        (link) =>
          `${link.source} ${link.target} ${link.weight.toFixed(6)}`,
      );

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
      setCopyStatus("Copied");
    } catch {
      setCopyStatus("Copy failed");
    }

    setTimeout(() => setCopyStatus(""), 1500);
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

  const handleDownloadTree = useCallback((value: string, filename: string) => {
    const blob = new Blob([`${value}\n`], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, []);

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
  const currentRegularizedComparison =
    normalOutcome && regularizedOutcome
      ? regularizedOutcome.adjustedMutualInformation -
        normalOutcome.adjustedMutualInformation
      : null;

  const normalApiTotalCodelength =
    normalRunState.status === "ready"
      ? normalRunState.run.apiCodelength
      : Number.NaN;
  const regularizedApiTotalCodelength =
    regularizedRunState.status === "ready"
      ? regularizedRunState.run.apiCodelength
      : Number.NaN;
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
          This example uses the complete network in{" "}
          <code>VII_network_complete.dat</code>
          {completeNetworkNodeCount > 0 && (
            <>
              {" "}
              with {completeNetworkNodeCount} nodes, where each node has about{" "}
              {completeNetworkAvgLinksPerNode.toFixed(1)} links on average
            </>
          )}
          . We first run normal Infomap on that full network and use the
          resulting partition as the reference structure. We then remove a
          fraction of links at random to simulate incomplete data and ask
          Infomap to recover that reference partition.
        </p>
        <p>
          <strong>Regularized Infomap</strong> adds a weak structural prior that
          makes the partition less eager to overreact to missing links and noisy
          evidence. When the observed network is sparse, that extra bias can
          stabilize the solution by balancing the measured flow against a
          simpler baseline model, instead of trusting every missing edge as a
          strong signal. Here we use the <strong>Infomap API</strong> and
          compare regularized and non-regularized solutions directly.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-gray-700 xl:hidden">
          <div className="space-y-1">
            <label className="flex items-center gap-1.5">
              <strong className="inline-flex min-w-[116px] items-center gap-1 text-xs font-semibold">
                <HelpTooltip content={LINK_REMOVAL_HELP} />
                <span>Link Removal: {sparsePercentage}%</span>
              </strong>
              <input
                type="range"
                min="0"
                max={MAX_SPARSE_PERCENTAGE}
                step="5"
                value={sparsePercentage}
                onChange={(e) => setSparsePercentage(Number(e.target.value))}
                className="h-1 w-24 flex-none md:w-28 lg:w-32"
              />
            </label>
          </div>

          <div className="space-y-1">
            <label className="flex items-center gap-1.5">
              <strong className="inline-flex min-w-[116px] items-center gap-1 text-xs font-semibold">
                <HelpTooltip content={REGULARIZATION_HELP} />
                <span>
                  Regularization: {regularizationStrength.toFixed(2)}
                </span>
              </strong>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={regularizationStrength}
                onChange={(e) =>
                  setRegularizationStrength(Number(e.target.value))
                }
                className="h-1 w-24 flex-none md:w-28 lg:w-32"
              />
            </label>
          </div>
        </div>

        {datasetState.status === "loading" && (
          <div className="text-blue-700">
            <strong>Dataset:</strong> loading{" "}
            <code>VII_network_complete.dat</code> and deriving the 0%
            normal-Infomap reference partition...
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
                  <label className="flex items-center gap-1.5">
                    <strong className="inline-flex min-w-[116px] items-center gap-1 text-xs font-semibold">
                      <HelpTooltip content={LINK_REMOVAL_HELP} />
                      <span>Link Removal: {sparsePercentage}%</span>
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
                      className="h-1 w-24 flex-none md:w-28 lg:w-32"
                    />
                  </label>
                </div>

                <div className="space-y-1">
                  <label className="flex items-center gap-1.5">
                    <strong className="inline-flex min-w-[116px] items-center gap-1 text-xs font-semibold">
                      <HelpTooltip content={REGULARIZATION_HELP} />
                      <span>
                        Regularization: {regularizationStrength.toFixed(2)}
                      </span>
                    </strong>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={regularizationStrength}
                      onChange={(e) =>
                        setRegularizationStrength(Number(e.target.value))
                      }
                      className="h-1 w-24 flex-none md:w-28 lg:w-32"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 hidden min-w-[220px] xl:block">
              {normalOutcome && regularizedOutcome && (
                <div className="space-y-2 text-sm text-gray-900">
                  <div>
                    Normal AMI{" "}
                    <HelpTooltip
                      content="Adjusted mutual information (AMI) compares the current non-isolated-node partition with the reference partition from the complete 0% network while correcting for agreement expected by chance. A value of 1 means the partitions match exactly up to relabeling, values near 0 mean no better agreement than random partitions with similar module sizes, and negative values mean worse-than-chance agreement."
                    />
                    :{" "}
                    <strong>{formatAmi(normalOutcome.adjustedMutualInformation)}</strong>
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
          </div>

          <div className="space-y-2 xl:col-start-1 xl:row-start-1">
            <h3 className="text-center text-sm font-semibold uppercase tracking-[0.12em] text-gray-600">
              Normal Infomap
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
                  <strong>Normal Infomap:</strong>{" "}
                  {normalPrecomputeStatusMessage}
                </div>
              )}
            {datasetState.status === "ready" &&
              normalRunState.status === "error" && (
                <div className="text-red-700">
                  <strong>Normal Infomap:</strong> {normalRunState.message}
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
                  <strong>Normal Infomap:</strong> {normalAssessment.label} (
                  {normalAssessment.description} Modules{" "}
                  {normalOutcome.moduleCount}/{normalOutcome.truthModuleCount}
                  {normalOutcome.rawModuleCount !== normalOutcome.moduleCount && (
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

            <div className="grid min-h-[6.5rem]">
              <div
                aria-hidden="true"
                className="invisible space-y-2 [grid-area:1/1]"
              >
                <div className="font-semibold">{COLLAPSE_WARNING_TITLE}</div>
                <div className="text-sm">{COLLAPSE_WARNING_DESCRIPTION}</div>
                <div className="text-sm">{COLLAPSE_WARNING_EXPLANATION}</div>
              </div>
              {regularizedOutcome &&
                regularizedOutcome.moduleCount === 1 &&
                regularizedRunState.status === "ready" && (
                  <div className="text-amber-900 space-y-2 [grid-area:1/1]">
                    <div className="font-semibold">
                      {COLLAPSE_WARNING_TITLE}
                    </div>
                    <div className="text-sm">
                      {COLLAPSE_WARNING_DESCRIPTION}
                    </div>
                    <div className="text-sm">
                      {COLLAPSE_WARNING_EXPLANATION}
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>

        <div className="min-h-[7rem]">
          {isolatedNodeIds.size > 0 && (
            <div className="text-sky-900 space-y-2">
              <div className="font-semibold">Isolated Nodes</div>
              <div className="text-sm">
                {`${isolatedNodeIds.size} isolated node${isolatedNodeIds.size === 1 ? "" : "s"} detected.`}
              </div>
              <div className="text-sm">
                Isolated nodes have no links, so Infomap has no flow evidence
                connecting them to the reference partition. Regularization
                cannot recover missing information when a node has zero observed
                links, so isolated-only modules are excluded from pass/fail
                module counting.
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="xl:hidden min-h-[4rem]">
            {normalOutcome && regularizedOutcome && (
              <div className="space-y-2 text-sm text-gray-900">
                <div>
                  Normal AMI{" "}
                  <HelpTooltip
                    content="Adjusted mutual information (AMI) compares the current non-isolated-node partition with the reference partition from the complete 0% network while correcting for agreement expected by chance. A value of 1 means the partitions match exactly up to relabeling, values near 0 mean no better agreement than random partitions with similar module sizes, and negative values mean worse-than-chance agreement."
                  />
                  :{" "}
                  <strong>{formatAmi(normalOutcome.adjustedMutualInformation)}</strong>
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

          <div className="min-h-[6.5rem]">
            {regularizedOutcome &&
              normalOutcome &&
              bestTriedRegularization &&
              triedRegularizationsForCurrentSparsity.length > 1 && (
                <div>
                  <h4 className="font-semibold mb-2">Best Tried Strength</h4>
                  <div className="space-y-1 text-sm">
                    <div>
                      Best tried regularization strength for{" "}
                      {sparsePercentage}% link removal:{" "}
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

      <div className="grid gap-4 md:grid-cols-2">
        <CollapsiblePanel title="Codelength">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1 font-mono text-sm">
              <div className="font-sans font-semibold text-gray-900">
                Normal Infomap
              </div>
              <div>
                total (Infomap API):{" "}
                {normalRunState.status === "ready"
                  ? Number.isFinite(normalApiTotalCodelength)
                    ? `${normalApiTotalCodelength.toFixed(9)} bits`
                    : "unavailable from API"
                  : "running..."}
              </div>
              <div>
                trials run:{" "}
                {normalRunState.status === "ready"
                  ? normalRunState.run.trials
                  : NUM_TRIALS}{" "}
                (best solution shown)
              </div>
            </div>
            <div className="space-y-1 font-mono text-sm">
              <div className="font-sans font-semibold text-gray-900">
                Regularized Infomap
              </div>
              <div>
                total (Infomap API):{" "}
                {regularizedRunState.status === "ready"
                  ? Number.isFinite(regularizedApiTotalCodelength)
                    ? `${regularizedApiTotalCodelength.toFixed(9)} bits`
                    : "unavailable from API"
                  : "running..."}
              </div>
              <div>
                trials run:{" "}
                {regularizedRunState.status === "ready"
                  ? regularizedRunState.run.trials
                  : NUM_TRIALS}{" "}
                (best solution shown)
              </div>
            </div>
          </div>
          <div className="mt-3 font-sans text-sm text-gray-600">
            Exact JS API output exposes the total codelength, but not the exact
            module/index/one-level split.
          </div>
        </CollapsiblePanel>

        <CollapsiblePanel title="Current Links (Pajek format)">
          <div className="mb-2 flex items-center justify-end gap-2">
            <button
              type="button"
              className="button text-xs py-1 px-2"
              onClick={handleCopyLinks}
            >
              Copy Pajek
            </button>
          </div>
          <textarea
            readOnly
            spellCheck={false}
            value={allLinksText}
            className="font-mono text-xs text-gray-700 h-56 w-full border-0 bg-transparent p-0 resize-none outline-none"
            onFocus={(e) => e.currentTarget.select()}
          />
          <div className="text-xs text-gray-500 mt-2">
            Click in the box, then press Cmd+A and Cmd+C to copy the full Pajek
            output.
            {copyStatus ? ` ${copyStatus}.` : ""}
          </div>
        </CollapsiblePanel>

        <CollapsiblePanel title={'Tree Output (path flow "name" node_id)'}>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h5 className="font-semibold">Normal Infomap</h5>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="button text-xs py-1 px-2"
                    onClick={() => handleCopyTree("normal", normalTreeText)}
                  >
                    Copy tree
                  </button>
                  <button
                    type="button"
                    className="button text-xs py-1 px-2"
                    onClick={() =>
                      handleDownloadTree(normalTreeText, "network-normal.tree")
                    }
                  >
                    Download .tree
                  </button>
                </div>
              </div>
              <textarea
                readOnly
                spellCheck={false}
                value={normalTreeText}
                className="font-mono text-xs text-gray-700 h-56 w-full border-0 bg-transparent p-0 resize-none outline-none"
                onFocus={(e) => e.currentTarget.select()}
              />
              <div className="text-xs text-gray-500 mt-2">
                Click in the box, then press Cmd+A and Cmd+C to copy all tree
                rows.
                {treeCopyStatus.normal ? ` ${treeCopyStatus.normal}.` : ""}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h5 className="font-semibold">Regularized Infomap</h5>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="button text-xs py-1 px-2"
                    onClick={() =>
                      handleCopyTree("regularized", regularizedTreeText)
                    }
                  >
                    Copy tree
                  </button>
                  <button
                    type="button"
                    className="button text-xs py-1 px-2"
                    onClick={() =>
                      handleDownloadTree(
                        regularizedTreeText,
                        "network-regularized.tree",
                      )
                    }
                  >
                    Download .tree
                  </button>
                </div>
              </div>
              <textarea
                readOnly
                spellCheck={false}
                value={regularizedTreeText}
                className="font-mono text-xs text-gray-700 h-56 w-full border-0 bg-transparent p-0 resize-none outline-none"
                onFocus={(e) => e.currentTarget.select()}
              />
              <div className="text-xs text-gray-500 mt-2">
                Click in the box, then press Cmd+A and Cmd+C to copy all tree
                rows.
                {treeCopyStatus.regularized
                  ? ` ${treeCopyStatus.regularized}.`
                  : ""}
              </div>
            </div>
          </div>
        </CollapsiblePanel>
      </div>

      <div className="prose max-w-none">
        <h3 className="text-xl font-bold">How it works</h3>
        <ol>
          <li>
            <strong>Complete Network:</strong> We load the edge list from{" "}
            <code>VII_network_complete.dat</code> and run normal Infomap at 0%
            link removal to get the reference partition.
          </li>
          <li>
            <strong>Normal Infomap:</strong> Runs{" "}
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
