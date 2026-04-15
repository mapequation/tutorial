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
import Button from "./Button";

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
const RUNNING_STATUS_MESSAGE = `running Infomap API with -N ${NUM_TRIALS}...`;
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
const LAYOUT_EXPANSION_FACTOR = 1.2;
const MODULE_GROUP_CENTER_PULL = 0.18;
const VIEWPORT_MARGIN = 18;
const ISOLATED_CLUSTER_EDGE_OFFSET = 34;
const ISOLATED_CLUSTER_COLUMN_SIZE = 3;
const ISOLATED_NODE_SPACING_MULTIPLIER = 2.75;
const MAX_COLLISION_RELAX_ITERATIONS = 160;
const EPSILON = 1e-9;
const getRegularizedNetworkUrl = () =>
  getAssetPath("/data/VII_network_complete.dat");
const regularizedNodeScale = scaleSqrt().domain([0, 1]).range([7, 14]);
const treeLinePattern =
  /^([0-9:]+)\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s+"((?:[^"\\]|\\.)*)"\s+(\d+)\s*$/;
const ISOLATED_MODULE_COLOR = isolatedModuleColor;
const COLORBLIND_FRIENDLY_POOL = figColors;

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
) => {
  const net = new NetworkModel(FlowModel.Undirected);

  data.nodes.forEach(({ id, x, y }) => {
    const moduleId = partitionByNodeId.get(id) ?? 0;
    net.addNode({
      id,
      x: x * width,
      y: y * height,
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
  const [networkState, setNetworkState] = useState<NetworkState>("normal");
  const [sparsePercentage, setSparsePercentage] = useState(0);
  const [regularizationStrength, setRegularizationStrength] = useState(0.7);
  const [copyStatus, setCopyStatus] = useState("");
  const [treeCopyStatus, setTreeCopyStatus] = useState("");
  const [datasetState, setDatasetState] = useState<DatasetState>({
    status: "loading",
  });
  const [regularizedHistory, setRegularizedHistory] = useState<
    TriedRegularizationRun[]
  >([]);
  const [normalRunState, setNormalRunState] = useState<RunState>({
    status: "loading",
  });
  const [regularizedRunState, setRegularizedRunState] = useState<RunState>({
    status: "loading",
  });

  useEffect(() => {
    let cancelled = false;
    setDatasetState({ status: "loading" });

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

  useEffect(() => {
    if (datasetState.status !== "ready") {
      return;
    }

    let cancelled = false;
    setNormalRunState({ status: "loading" });

    const run = async () => {
      try {
        const runResult = await runInfomap({
          data,
          truthByNodeId,
          isolatedNodeIds,
          regularizationStrength: null,
        });
        if (!cancelled) {
          setNormalRunState({ status: "ready", run: runResult });
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : String(error);
          setNormalRunState({
            status: "error",
            message: `Failed to run Infomap API (${message})`,
          });
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [data, datasetState.status, truthByNodeId, isolatedNodeIds]);

  useEffect(() => {
    if (datasetState.status !== "ready") {
      return;
    }

    let cancelled = false;
    setRegularizedRunState({ status: "loading" });

    const run = async () => {
      try {
        const runResult = await runInfomap({
          data,
          truthByNodeId,
          isolatedNodeIds,
          regularizationStrength,
        });
        if (!cancelled) {
          setRegularizedRunState({ status: "ready", run: runResult });
          setRegularizedHistory((previous) => {
            const nextEntry = {
              sparsePercentage,
              strength: regularizationStrength,
              run: runResult,
            };
            const filtered = previous.filter(
              (entry) =>
                !(
                  entry.sparsePercentage === sparsePercentage &&
                  Math.abs(entry.strength - regularizationStrength) <=
                    SUCCESS_EPSILON
                ),
            );
            return [...filtered, nextEntry];
          });
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : String(error);
          setRegularizedRunState({
            status: "error",
            message: `Failed to run regularized Infomap API (${message})`,
          });
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [
    data,
    datasetState.status,
    truthByNodeId,
    isolatedNodeIds,
    regularizationStrength,
    sparsePercentage,
  ]);

  const isNormal = networkState === "normal";
  const isRegularized = networkState === "regularized";
  const activeRunState = isRegularized ? regularizedRunState : normalRunState;

  const fallbackPartition = useMemo(
    () =>
      new Map<number, number>(
        data.nodes.map(({ id, topModule }) => [id, topModule]),
      ),
    [data],
  );

  const activePartition = useMemo(() => {
    if (activeRunState.status === "ready") {
      return activeRunState.run.outcome.moduleByNodeId;
    }
    return fallbackPartition;
  }, [activeRunState, fallbackPartition]);

  const { moduleScheme, moduleSchemeAlt } = useMemo(() => {
    const moduleStats = new Map<
      number,
      { isolated: number; nonIsolated: number }
    >();

    data.nodes.forEach(({ id }) => {
      const moduleId = activePartition.get(id) ?? 0;
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
  }, [activePartition, data.nodes, isolatedNodeIds]);

  const network = useMemo(
    () =>
      buildVisualizationNetwork(
        data,
        activePartition,
        isolatedNodeIds,
        width,
        height,
        regularizedNodeScale,
      ),
    [activePartition, data, height, isolatedNodeIds, width],
  );

  const allLinksText = useMemo(() => {
    const vertices = [...network.nodes]
      .sort((a, b) => a.id - b.id)
      .map((node) => {
        const escapedName = node.name.replace(/"/g, '\\"');
        return `${node.id} "${escapedName}"`;
      });

    const edges = [...network.links]
      .sort(
        (a, b) =>
          a.source.id - b.source.id ||
          a.target.id - b.target.id ||
          a.weight - b.weight,
      )
      .map(
        (link) =>
          `${link.source.id} ${link.target.id} ${link.weight.toFixed(6)}`,
      );

    return [
      `*Vertices ${network.nodes.length}`,
      ...vertices,
      "*Edges",
      ...edges,
    ].join("\n");
  }, [network]);

  const fallbackTreeText = useMemo(
    () =>
      [...network.nodes]
        .sort((a, b) => a.topModule - b.topModule || a.id - b.id)
        .map((node) => {
          const escapedName = node.name.replace(/"/g, '\\"');
          const oneBasedPath = node.topModule + 1;
          return `${oneBasedPath} ${node.flow.toFixed(6)} "${escapedName}" ${node.id}`;
        })
        .join("\n"),
    [network],
  );

  const treeText =
    activeRunState.status === "ready"
      ? activeRunState.run.treeText
      : fallbackTreeText;

  const handleNormalInfomap = useCallback(() => {
    setNetworkState("normal");
  }, []);

  const handleRegularize = useCallback(() => {
    setNetworkState("regularized");
  }, []);

  const handleCopyLinks = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(allLinksText);
      setCopyStatus("Copied");
    } catch {
      setCopyStatus("Copy failed");
    }

    setTimeout(() => setCopyStatus(""), 1500);
  }, [allLinksText]);

  const handleCopyTree = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(treeText);
      setTreeCopyStatus("Copied");
    } catch {
      setTreeCopyStatus("Copy failed");
    }

    setTimeout(() => setTreeCopyStatus(""), 1500);
  }, [treeText]);

  const handleDownloadTree = useCallback(() => {
    const blob = new Blob([`${treeText}\n`], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "network.tree";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [treeText]);

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
  const displayedOutcome =
    activeRunState.status === "ready" ? activeRunState.run.outcome : null;
  const normalOutcome =
    normalRunState.status === "ready" ? normalRunState.run.outcome : null;
  const displayedAssessment = displayedOutcome
    ? assessOutcome(
        displayedOutcome,
        isRegularized ? "regularized" : "normal",
        isRegularized ? normalOutcome : null,
      )
    : null;
  const reservedRegularizedOutcome =
    displayedOutcome ?? latestTriedRegularization?.run.outcome ?? null;
  const currentRegularizedComparison =
    normalOutcome && regularizedRunState.status === "ready"
      ? regularizedRunState.run.outcome.adjustedMutualInformation -
        normalOutcome.adjustedMutualInformation
      : null;

  const apiTotalCodelength =
    activeRunState.status === "ready"
      ? activeRunState.run.apiCodelength
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

      <div className="xl:grid xl:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] xl:items-start xl:gap-8">
        <div className="relative z-10 space-y-6 xl:pr-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <strong className="block">Network Type:</strong>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  className={`button w-full whitespace-nowrap ${isNormal ? "bg-blue-600" : ""}`}
                  style={{ padding: "0.375rem 0.625rem", fontSize: "0.75rem" }}
                  onClick={handleNormalInfomap}
                >
                  Normal Infomap
                </Button>
                <Button
                  className={`button w-full whitespace-nowrap ${isRegularized ? "bg-green-600" : ""}`}
                  style={{ padding: "0.375rem 0.625rem", fontSize: "0.75rem" }}
                  onClick={handleRegularize}
                >
                  Regularized Infomap
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-3">
                <strong className="min-w-[200px]">
                  Link Removal: {sparsePercentage}%
                </strong>
                <input
                  type="range"
                  min="0"
                  max="80"
                  step="5"
                  value={sparsePercentage}
                  onChange={(e) => setSparsePercentage(Number(e.target.value))}
                  className="flex-1"
                />
              </label>
              <p className="text-sm text-gray-600">
                Removes {sparsePercentage}% of links at random to simulate
                incomplete data
              </p>
            </div>

            <div className="min-h-[5.75rem]">
              {isRegularized && (
                <div className="space-y-2">
                  <label className="flex items-center gap-3">
                    <strong className="min-w-[200px]">
                      Regularization: {regularizationStrength.toFixed(2)}
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
                      className="flex-1"
                    />
                  </label>
                  <p className="text-sm text-gray-600">
                    Uniform prior strength used with <code>--regularized</code>{" "}
                    <span
                      className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-gray-400 text-[10px] font-bold text-gray-500 align-middle"
                      title="The uniform prior acts like a weak background assumption that gently links all nodes together before the observed network is taken into account. Increasing this strength makes Infomap rely a bit less on sparse or noisy edge evidence and a bit more on that neutral baseline, instead of interpreting every missing link as strong evidence that nodes should be separated."
                    >
                      ?
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="min-h-[7.5rem]">
              {displayedOutcome && normalOutcome && (
                <div>
                  <h4 className="font-semibold mb-2">Evaluation</h4>
                  <div className="space-y-1 text-sm">
                    <div>
                      AMI{" "}
                      <span
                        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-gray-400 text-[10px] font-bold text-gray-500 align-middle"
                        title="Adjusted mutual information (AMI) compares the current non-isolated-node partition with the reference partition from the complete 0% network while correcting for agreement expected by chance. A value of 1 means the partitions match exactly up to relabeling, values near 0 mean no better agreement than random partitions with similar module sizes, and negative values mean worse-than-chance agreement."
                      >
                        ?
                      </span>
                      :{" "}
                      <strong>
                        {formatAmi(displayedOutcome.adjustedMutualInformation)}
                      </strong>
                    </div>
                    <div>
                      Distance from reference module count:{" "}
                      <strong>
                        {moduleDistanceFromTruth(displayedOutcome)}
                      </strong>
                    </div>
                    {isRegularized && currentRegularizedComparison !== null && (
                      <div>
                        Compared with normal Infomap:{" "}
                        <strong>
                          {formatSignedAmiDifference(
                            currentRegularizedComparison,
                          )}
                        </strong>{" "}
                        in AMI
                        {currentRegularizedComparison > NOTICEABLE_IMPROVEMENT
                          ? " (better agreement with the reference partition)"
                          : currentRegularizedComparison <
                              -NOTICEABLE_IMPROVEMENT
                            ? " (worse agreement than normal)"
                            : " (about the same AMI)"}
                        .
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="min-h-[6.5rem]">
              {isRegularized &&
                displayedOutcome &&
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

        <div className="mt-6 xl:mt-0 xl:self-start xl:sticky xl:top-0">
          <Network
            network={network}
            scheme={moduleScheme}
            schemeAlt={moduleSchemeAlt}
            showLabels={false}
            showModules={true}
            colorIntraModuleLinks={true}
            baseLinkStrokeWidth={1}
            showNodeId={true}
            nodeIdPosition="middle"
            nodeIdFontSize={10}
            nodeStroke="#fff"
            nodeStrokeWidth={1.5}
            width={width}
            height={height}
            nodeScale={regularizedNodeScale}
          />

          <div className="mt-4 space-y-4">
            <div
              className={
                datasetState.status === "ready"
                  ? "grid min-h-[2.75rem]"
                  : "min-h-[2.75rem]"
              }
            >
              {datasetState.status === "ready" && (
                <div aria-hidden="true" className="invisible [grid-area:1/1]">
                  <strong>
                    {isRegularized ? "Regularized Infomap" : "Normal Infomap"}:
                  </strong>{" "}
                  {RUNNING_STATUS_MESSAGE}
                </div>
              )}
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
              {datasetState.status === "ready" &&
                activeRunState.status === "loading" && (
                  <div className="text-blue-700 [grid-area:1/1]">
                    <strong>
                      {isRegularized ? "Regularized Infomap" : "Normal Infomap"}
                      :
                    </strong>{" "}
                    {RUNNING_STATUS_MESSAGE}
                  </div>
                )}
              {datasetState.status === "ready" &&
                activeRunState.status === "error" && (
                  <div className="text-red-700 [grid-area:1/1]">
                    <strong>
                      {isRegularized ? "Regularized Infomap" : "Normal Infomap"}
                      :
                    </strong>{" "}
                    {activeRunState.message}
                  </div>
                )}
            </div>

            <div
              className={
                isRegularized ? "grid min-h-[4.5rem]" : "min-h-[4.5rem]"
              }
            >
              {isRegularized && reservedRegularizedOutcome && (
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
              {displayedOutcome && displayedAssessment && (
                <div
                  className={`${displayedAssessment.toneClassName}${isRegularized ? " [grid-area:1/1]" : ""}`}
                >
                  {displayedAssessment.label === "pass"
                    ? "✓"
                    : displayedAssessment.label === "half-pass"
                      ? "~"
                      : "⚠"}{" "}
                  <strong>
                    {isRegularized ? "Regularized Infomap" : "Normal Infomap"}:
                  </strong>{" "}
                  {displayedAssessment.label}
                  {isRegularized && (
                    <>
                      {" "}
                      at regularization strength{" "}
                      {regularizationStrength.toFixed(2)}
                    </>
                  )}{" "}
                  ({displayedAssessment.description} Modules{" "}
                  {displayedOutcome.moduleCount}/
                  {displayedOutcome.truthModuleCount}
                  {displayedOutcome.rawModuleCount !==
                    displayedOutcome.moduleCount && (
                    <> - ignoring isolated node modules</>
                  )}
                  ).
                </div>
              )}
            </div>

            <div className="min-h-[7rem]">
              {isolatedNodeIds.size > 0 && (
                <div className="text-sky-900 space-y-2">
                  <div className="font-semibold">Isolated Nodes</div>
                  <div className="text-sm">
                    {`${isolatedNodeIds.size} isolated node${isolatedNodeIds.size === 1 ? "" : "s"} detected.`}
                  </div>
                  <div className="text-sm">
                    Isolated nodes have no links, so Infomap has no flow
                    evidence connecting them to the reference partition.
                    Regularization cannot recover missing information when a
                    node has zero observed links, so isolated-only modules are
                    excluded from pass/fail module counting.
                  </div>
                </div>
              )}
            </div>

            <div
              className={
                isRegularized ? "grid min-h-[6.5rem]" : "min-h-[6.5rem]"
              }
            >
              {isRegularized && (
                <div
                  aria-hidden="true"
                  className="invisible space-y-2 [grid-area:1/1]"
                >
                  <div className="font-semibold">{COLLAPSE_WARNING_TITLE}</div>
                  <div className="text-sm">{COLLAPSE_WARNING_DESCRIPTION}</div>
                  <div className="text-sm">{COLLAPSE_WARNING_EXPLANATION}</div>
                </div>
              )}
              {isRegularized &&
                displayedOutcome &&
                displayedOutcome.moduleCount === 1 &&
                activeRunState.status === "ready" && (
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
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <CollapsiblePanel title="Codelength">
          <div className="space-y-1 font-mono text-sm">
            <div>
              total (Infomap API):{" "}
              {activeRunState.status === "ready"
                ? Number.isFinite(apiTotalCodelength)
                  ? `${apiTotalCodelength.toFixed(9)} bits`
                  : "unavailable from API"
                : "running..."}
            </div>
            <div>
              trials run:{" "}
              {activeRunState.status === "ready"
                ? activeRunState.run.trials
                : NUM_TRIALS}{" "}
              (best solution shown)
            </div>
            <div className="font-sans text-gray-600">
              Exact JS API output exposes the total codelength, but not the
              exact module/index/one-level split.
            </div>
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
          <div className="mb-2 flex items-center justify-end gap-2">
            <button
              type="button"
              className="button text-xs py-1 px-2"
              onClick={handleCopyTree}
            >
              Copy tree
            </button>
            <button
              type="button"
              className="button text-xs py-1 px-2"
              onClick={handleDownloadTree}
            >
              Download .tree
            </button>
          </div>
          <textarea
            readOnly
            spellCheck={false}
            value={treeText}
            className="font-mono text-xs text-gray-700 h-56 w-full border-0 bg-transparent p-0 resize-none outline-none"
            onFocus={(e) => e.currentTarget.select()}
          />
          <div className="text-xs text-gray-500 mt-2">
            Click in the box, then press Cmd+A and Cmd+C to copy all tree rows.
            {treeCopyStatus ? ` ${treeCopyStatus}.` : ""}
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
          {isNormal ? (
            <li>
              <strong>Normal Infomap:</strong> Runs{" "}
              <code>@mapequation/infomap</code> with two-level optimization and{" "}
              <code>-N {NUM_TRIALS}</code> trials.
            </li>
          ) : (
            <li>
              <strong>Regularized Infomap:</strong> Runs the same API with
              <code>
                {" "}
                --regularized --regularization-strength{" "}
                {regularizationStrength.toFixed(2)}
              </code>{" "}
              and <code>-N {NUM_TRIALS}</code> trials.
            </li>
          )}
          <li>
            <strong>Evaluation:</strong> A run passes only if it recovers
            exactly the reference partition from the complete network.
          </li>
        </ol>
      </div>
    </div>
  );
});
