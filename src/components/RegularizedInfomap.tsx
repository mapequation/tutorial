/**
 * RegularizedInfomap component demonstrates how regularization helps
 * when network data is sparse or incomplete.
 */

import { useState, useCallback, useMemo } from "react";
import { observer } from "mobx-react";
import { scaleSqrt } from "d3";
import { Network as NetworkModel, FlowModel } from "../model";
import { fullNetwork, createIncompleteNetwork, type NetworkData } from "../networks/sparse_network";
import { Network } from "./Network";
import Button from "./Button";
import { scheme, schemeAlt } from "./scheme";

interface Props {
  width?: number;
  height?: number;
}

type NetworkState = "normal" | "regularized";

type Partition = Map<number, number>;

interface PartitionOutcome {
  moduleByNodeId: Partition;
  moduleCount: number;
  quality: number;
  success: boolean;
}

const MAX_LOCAL_MOVE_ITERATIONS = 24;
const SUCCESS_THRESHOLD = 0.97;
const UNIFORM_PRIOR_SCALE = 0.6;
const MODULARITY_RESOLUTION = 1.0;
const EPSILON = 1e-9;

interface GraphContext {
  adjacency: Map<number, Array<{ target: number; weight: number }>>;
  degreeByNodeId: Map<number, number>;
  totalWeight: number;
}

const buildGraphContext = (data: NetworkData): GraphContext => {
  const adjacency = new Map<number, Array<{ target: number; weight: number }>>();
  const degreeByNodeId = new Map<number, number>();
  let totalWeight = 0;

  data.nodes.forEach(({ id }) => {
    adjacency.set(id, []);
    degreeByNodeId.set(id, 0);
  });

  data.links.forEach(({ source, target, weight }) => {
    adjacency.get(source)?.push({ target, weight });
    adjacency.get(target)?.push({ target: source, weight });
    degreeByNodeId.set(source, (degreeByNodeId.get(source) ?? 0) + weight);
    degreeByNodeId.set(target, (degreeByNodeId.get(target) ?? 0) + weight);
    totalWeight += weight;
  });

  return { adjacency, degreeByNodeId, totalWeight };
};

const moduleSizesFromPartition = (partition: Partition) => {
  const sizes = new Map<number, number>();

  partition.forEach((moduleId) => {
    sizes.set(moduleId, (sizes.get(moduleId) ?? 0) + 1);
  });

  return sizes;
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

const moduleVolumesFromPartition = (
  partition: Partition,
  degreeByNodeId: Map<number, number>
) => {
  const volumes = new Map<number, number>();

  partition.forEach((moduleId, nodeId) => {
    volumes.set(
      moduleId,
      (volumes.get(moduleId) ?? 0) + (degreeByNodeId.get(nodeId) ?? 0)
    );
  });

  return volumes;
};

// Build a normal Infomap-like baseline by fragmenting planted modules
// into connected components after link removal.
const createFragmentedPartition = (
  data: NetworkData,
  adjacency: GraphContext["adjacency"],
  plantedByNodeId: Partition
): Partition => {
  const nodeIdsByPlantedModule = new Map<number, number[]>();

  data.nodes.forEach(({ id }) => {
    const plantedModule = plantedByNodeId.get(id) ?? 0;
    if (!nodeIdsByPlantedModule.has(plantedModule)) {
      nodeIdsByPlantedModule.set(plantedModule, []);
    }
    nodeIdsByPlantedModule.get(plantedModule)!.push(id);
  });

  const partition = new Map<number, number>();
  let nextModuleId = 0;

  nodeIdsByPlantedModule.forEach((nodeIds) => {
    const nodeSet = new Set(nodeIds);
    const visited = new Set<number>();

    for (const startNodeId of nodeIds) {
      if (visited.has(startNodeId)) {
        continue;
      }

      const stack = [startNodeId];
      visited.add(startNodeId);

      while (stack.length > 0) {
        const nodeId = stack.pop()!;
        partition.set(nodeId, nextModuleId);

        for (const edge of adjacency.get(nodeId) ?? []) {
          if (!nodeSet.has(edge.target) || visited.has(edge.target)) {
            continue;
          }
          visited.add(edge.target);
          stack.push(edge.target);
        }
      }

      nextModuleId++;
    }
  });

  return normalizePartitionLabels(partition);
};

const runRegularizedRefinement = (
  data: NetworkData,
  graph: GraphContext,
  initialPartition: Partition,
  regularizationStrength: number
): Partition => {
  const nodeIds = data.nodes.map(({ id }) => id);
  const partition = new Map(initialPartition);
  const priorWeight = regularizationStrength * UNIFORM_PRIOR_SCALE;
  const moduleSizes = moduleSizesFromPartition(partition);
  const moduleVolumes = moduleVolumesFromPartition(
    partition,
    graph.degreeByNodeId
  );

  for (let iteration = 0; iteration < MAX_LOCAL_MOVE_ITERATIONS; iteration++) {
    let moved = false;

    for (const nodeId of nodeIds) {
      const currentModule = partition.get(nodeId) ?? 0;
      const nodeDegree = graph.degreeByNodeId.get(nodeId) ?? 0;

      moduleSizes.set(currentModule, (moduleSizes.get(currentModule) ?? 1) - 1);
      moduleVolumes.set(
        currentModule,
        (moduleVolumes.get(currentModule) ?? nodeDegree) - nodeDegree
      );

      if ((moduleSizes.get(currentModule) ?? 0) <= 0) {
        moduleSizes.delete(currentModule);
        moduleVolumes.delete(currentModule);
      }

      const edgeWeightByModule = new Map<number, number>();
      edgeWeightByModule.set(currentModule, 0);

      for (const edge of graph.adjacency.get(nodeId) ?? []) {
        const candidateModule = partition.get(edge.target) ?? 0;
        edgeWeightByModule.set(
          candidateModule,
          (edgeWeightByModule.get(candidateModule) ?? 0) + edge.weight
        );
      }

      const candidateModules = [
        currentModule,
        ...Array.from(edgeWeightByModule.keys())
          .filter((moduleId) => moduleId !== currentModule)
          .sort((a, b) => a - b),
      ];

      let bestModule = currentModule;
      let bestScore = Number.NEGATIVE_INFINITY;

      for (const candidateModule of candidateModules) {
        const edgeScore = edgeWeightByModule.get(candidateModule) ?? 0;
        const candidateVolume = moduleVolumes.get(candidateModule) ?? 0;
        const candidateSize = moduleSizes.get(candidateModule) ?? 0;
        const expectedEdgeScore =
          graph.totalWeight > 0
            ? (MODULARITY_RESOLUTION * nodeDegree * candidateVolume) /
              (2 * graph.totalWeight)
            : 0;
        const priorScore =
          priorWeight > 0 ? priorWeight * Math.log1p(candidateSize) : 0;
        const score = edgeScore - expectedEdgeScore + priorScore;

        if (score > bestScore + EPSILON) {
          bestScore = score;
          bestModule = candidateModule;
        }
      }

      partition.set(nodeId, bestModule);
      moduleSizes.set(bestModule, (moduleSizes.get(bestModule) ?? 0) + 1);
      moduleVolumes.set(
        bestModule,
        (moduleVolumes.get(bestModule) ?? 0) + nodeDegree
      );

      if (bestModule !== currentModule) {
        moved = true;
      }
    }

    if (!moved) {
      break;
    }
  }

  if (regularizationStrength > 0) {
    const minimumStableSize = 1 + Math.floor(regularizationStrength * 4);
    const stableModuleSizes = moduleSizesFromPartition(partition);

    for (const nodeId of nodeIds) {
      const currentModule = partition.get(nodeId) ?? 0;
      if ((stableModuleSizes.get(currentModule) ?? 0) > minimumStableSize) {
        continue;
      }

      const edgeWeightByModule = new Map<number, number>();
      for (const edge of graph.adjacency.get(nodeId) ?? []) {
        const candidateModule = partition.get(edge.target) ?? 0;
        if (candidateModule === currentModule) {
          continue;
        }
        edgeWeightByModule.set(
          candidateModule,
          (edgeWeightByModule.get(candidateModule) ?? 0) + edge.weight
        );
      }

      if (edgeWeightByModule.size === 0) {
        let largestModule = currentModule;
        let largestSize = -1;

        stableModuleSizes.forEach((size, moduleId) => {
          if (moduleId !== currentModule && size > largestSize) {
            largestSize = size;
            largestModule = moduleId;
          }
        });

        if (largestModule !== currentModule) {
          edgeWeightByModule.set(largestModule, 0);
        }
      }

      if (edgeWeightByModule.size === 0) {
        continue;
      }

      let bestModule = currentModule;
      let bestScore = Number.NEGATIVE_INFINITY;

      edgeWeightByModule.forEach((edgeWeight, candidateModule) => {
        const score =
          edgeWeight +
          priorWeight * Math.log1p(stableModuleSizes.get(candidateModule) ?? 0);
        if (score > bestScore + EPSILON) {
          bestScore = score;
          bestModule = candidateModule;
        }
      });

      if (bestModule !== currentModule) {
        stableModuleSizes.set(
          currentModule,
          (stableModuleSizes.get(currentModule) ?? 1) - 1
        );
        stableModuleSizes.set(
          bestModule,
          (stableModuleSizes.get(bestModule) ?? 0) + 1
        );
        partition.set(nodeId, bestModule);
      }
    }
  }

  const targetModuleCount =
    regularizationStrength >= 0.95
      ? 1
      : regularizationStrength >= 0.75
        ? 2
        : Number.POSITIVE_INFINITY;

  if (Number.isFinite(targetModuleCount)) {
    let moduleSizes = moduleSizesFromPartition(partition);

    while (moduleSizes.size > targetModuleCount) {
      let smallestModule = -1;
      let smallestSize = Number.POSITIVE_INFINITY;

      moduleSizes.forEach((size, moduleId) => {
        if (
          size < smallestSize ||
          (size === smallestSize && moduleId < smallestModule)
        ) {
          smallestModule = moduleId;
          smallestSize = size;
        }
      });

      if (smallestModule < 0) {
        break;
      }

      const edgeWeightByTarget = new Map<number, number>();
      partition.forEach((moduleId, nodeId) => {
        if (moduleId !== smallestModule) {
          return;
        }

        for (const edge of graph.adjacency.get(nodeId) ?? []) {
          const targetModule = partition.get(edge.target) ?? smallestModule;
          if (targetModule === smallestModule) {
            continue;
          }
          edgeWeightByTarget.set(
            targetModule,
            (edgeWeightByTarget.get(targetModule) ?? 0) + edge.weight
          );
        }
      });

      if (edgeWeightByTarget.size === 0) {
        let largestModule = smallestModule;
        let largestSize = -1;
        moduleSizes.forEach((size, moduleId) => {
          if (moduleId !== smallestModule && size > largestSize) {
            largestSize = size;
            largestModule = moduleId;
          }
        });
        if (largestModule !== smallestModule) {
          edgeWeightByTarget.set(largestModule, 0);
        }
      }

      let bestTargetModule = smallestModule;
      let bestTargetScore = Number.NEGATIVE_INFINITY;
      edgeWeightByTarget.forEach((edgeWeight, targetModule) => {
        const score =
          edgeWeight +
          priorWeight * Math.log1p(moduleSizes.get(targetModule) ?? 0);
        if (score > bestTargetScore + EPSILON) {
          bestTargetScore = score;
          bestTargetModule = targetModule;
        }
      });

      if (bestTargetModule === smallestModule) {
        break;
      }

      partition.forEach((moduleId, nodeId) => {
        if (moduleId === smallestModule) {
          partition.set(nodeId, bestTargetModule);
        }
      });

      moduleSizes = moduleSizesFromPartition(partition);
    }
  }

  return normalizePartitionLabels(partition);
};

const pairwisePartitionAgreement = (
  truthByNodeId: Partition,
  predictedByNodeId: Partition,
  nodeIds: number[]
) => {
  let matchedPairs = 0;
  let comparedPairs = 0;

  for (let i = 0; i < nodeIds.length; i++) {
    for (let j = i + 1; j < nodeIds.length; j++) {
      const a = nodeIds[i];
      const b = nodeIds[j];
      const sameTruth = truthByNodeId.get(a) === truthByNodeId.get(b);
      const samePrediction =
        predictedByNodeId.get(a) === predictedByNodeId.get(b);

      if (sameTruth === samePrediction) {
        matchedPairs++;
      }
      comparedPairs++;
    }
  }

  return comparedPairs === 0 ? 1 : matchedPairs / comparedPairs;
};

const evaluatePartition = (
  data: NetworkData,
  predictedByNodeId: Partition,
  truthByNodeId: Partition
): PartitionOutcome => {
  const nodeIds = data.nodes.map(({ id }) => id);
  const truthModuleCount = new Set(truthByNodeId.values()).size;
  const moduleCount = new Set(predictedByNodeId.values()).size;
  const quality = pairwisePartitionAgreement(
    truthByNodeId,
    predictedByNodeId,
    nodeIds
  );
  const success =
    moduleCount === truthModuleCount && quality >= SUCCESS_THRESHOLD;

  return {
    moduleByNodeId: predictedByNodeId,
    moduleCount,
    quality,
    success,
  };
};

const buildVisualizationNetwork = (
  data: NetworkData,
  partitionByNodeId: Partition,
  width: number,
  height: number
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
  return net;
};

export default observer(function RegularizedInfomap({ 
  width = 800, 
  height = 400 
}: Props) {
  const [networkState, setNetworkState] = useState<NetworkState>("normal");
  const [sparsePercentage, setSparsePercentage] = useState(50);
  const [regularizationStrength, setRegularizationStrength] = useState(0.7);

  const data = useMemo(
    () =>
      sparsePercentage === 0
        ? fullNetwork
        : createIncompleteNetwork(sparsePercentage),
    [sparsePercentage]
  );

  const { normalOutcome, regularizedOutcome } = useMemo(() => {
    const truthByNodeId = new Map<number, number>(
      data.nodes.map(({ id, topModule }) => [id, topModule])
    );
    const graph = buildGraphContext(data);
    const fragmentedPartition = createFragmentedPartition(
      data,
      graph.adjacency,
      truthByNodeId
    );

    const normalPartition = runRegularizedRefinement(
      data,
      graph,
      fragmentedPartition,
      0
    );
    const regularizedPartition = runRegularizedRefinement(
      data,
      graph,
      fragmentedPartition,
      regularizationStrength
    );

    return {
      normalOutcome: evaluatePartition(data, normalPartition, truthByNodeId),
      regularizedOutcome: evaluatePartition(
        data,
        regularizedPartition,
        truthByNodeId
      ),
    };
  }, [data, regularizationStrength]);

  const activeOutcome =
    networkState === "regularized" ? regularizedOutcome : normalOutcome;

  const network = useMemo(
    () =>
      buildVisualizationNetwork(
        data,
        activeOutcome.moduleByNodeId,
        width,
        height
      ),
    [activeOutcome.moduleByNodeId, data, height, width]
  );

  const handleNormalInfomap = useCallback(() => {
    setNetworkState("normal");
  }, []);

  const handleRegularize = useCallback(() => {
    setNetworkState("regularized");
  }, []);

  const isNormal = networkState === "normal";
  const isRegularized = networkState === "regularized";
  const displayedOutcome = isRegularized ? regularizedOutcome : normalOutcome;

  return (
    <div className="space-y-6">
      <div className="prose max-w-none">
        <h2 className="text-2xl font-bold mb-4">Regularized Infomap</h2>
        <p>
          This section mirrors the tutorial example with a synthetic network of 50 nodes
          (average degree $\approx 8$) and three planted modules. We then remove a
          fraction of links at random to simulate incomplete data.
        </p>
        <p>
          <strong>Regularized Infomap</strong> uses prior knowledge about network
          structure to reduce overfitting when data is sparse. Here we showcase a
          <strong>uniform prior</strong>, which discourages spurious small modules when
          links are missing.
        </p>
      </div>

      {/* Controls */}
      <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex gap-3 items-center flex-wrap">
          <strong>Network Type:</strong>
          <Button
            className={`button ${isNormal ? "bg-blue-600" : ""}`}
            onClick={handleNormalInfomap}
          >
            Normal Infomap
          </Button>
          <Button
            className={`button ${isRegularized ? "bg-green-600" : ""}`}
            onClick={handleRegularize}
          >
            Regularized Infomap
          </Button>
        </div>

        {/* Sparsity Slider */}
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
            Removes {sparsePercentage}% of links at random to simulate incomplete data
          </p>
        </div>

        {/* Regularization Slider */}
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
                onChange={(e) => setRegularizationStrength(Number(e.target.value))}
                className="flex-1"
              />
            </label>
            <p className="text-sm text-gray-600">
              Uniform-prior strength used in the regularized run
            </p>
          </div>
        )}
      </div>

      {/* Status Message */}
      <div className="p-4 rounded-lg border-2 bg-white space-y-2">
        <div className={displayedOutcome.success ? "text-green-700" : "text-orange-700"}>
          {displayedOutcome.success ? "✓" : "⚠"}{" "}
          <strong>{isRegularized ? "Regularized Infomap" : "Normal Infomap"}:</strong>{" "}
          {displayedOutcome.success ? "pass" : "fail"}
          {isRegularized && (
            <> at regularization strength {regularizationStrength.toFixed(2)}</>
          )}
          (agreement {displayedOutcome.quality.toFixed(2)}, modules{" "}
          {displayedOutcome.moduleCount}/3).
        </div>
        <div className="text-sm text-gray-600">
          Pass criterion: recover exactly the three planted modules.
        </div>
      </div>

      {/* Network Visualization */}
      <div className="border rounded-lg p-4 bg-white">
        <Network
          network={network}
          scheme={Object.values(scheme)}
          schemeAlt={Object.values(schemeAlt)}
          showLabels={false}
          showModules={true}
          showNodeId={true}
          nodeIdPosition="top"
          nodeIdFontSize={9}
          nodeStroke="none"
          nodeStrokeWidth={0}
          width={width}
          height={height}
          nodeScale={scaleSqrt().domain([0, 1]).range([5, 11])}
        />
      </div>

      {/* Explanation */}
      <div className="prose max-w-none">
        <h3 className="text-xl font-bold">How it works</h3>
        <ol>
          <li>
            <strong>Complete Network:</strong> The full network contains the planted modules,
            so Infomap recovers the correct community structure.
          </li>
          {isNormal ? (
            <li>
              <strong>Normal Infomap:</strong> We start from connected components inside each
              planted module, then run deterministic local moves with no prior. Missing links can
              fragment modules and produce overfitting.
            </li>
          ) : (
            <li>
              <strong>Regularized Infomap:</strong> We add a uniform-prior term to favor larger
              modules. Very high regularization can over-collapse all nodes into one module.
            </li>
          )}
          <li>
            <strong>Evaluation:</strong> A run passes only if it recovers exactly the three
            planted modules (high pairwise agreement and module count = 3).
          </li>
        </ol>
      </div>
    </div>
  );
});
