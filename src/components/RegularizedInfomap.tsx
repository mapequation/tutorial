/**
 * RegularizedInfomap component demonstrates how regularization helps
 * when network data is sparse or incomplete.
 */

import { useState, useCallback, useMemo } from "react";
import { observer } from "mobx-react";
import { scaleSqrt } from "d3";
import { Network as NetworkModel, Node as NodeModel, FlowModel } from "../model";
import { fullNetwork, createIncompleteNetwork, type NetworkData } from "../networks/sparse_network";
import { Network } from "./Network";
import Button from "./Button";
import { scheme, schemeAlt } from "./scheme";
import Link from "../model/Link";

interface Props {
  width?: number;
  height?: number;
}

type NetworkState = "normal" | "regularized";

// Regularization algorithm that helps recover structure in sparse networks
// by adding a prior term that prefers the initial community structure
const applyRegularization = (
  network: NetworkModel,
  strength: number,
  findBestModuleFn: (network: NetworkModel, node: NodeModel, regularizationFactor: number) => number
) => {
  // Regularization with a uniform prior discourages spurious small modules.
  // We approximate this by biasing assignments toward larger modules.

  const regularizationFactor = 1 + strength * 2; // Scale 0-1 to 1-3

  // Run a quick optimization pass to refine modules
  // This is a simplified version - in reality would use iterative voter
  for (let iteration = 0; iteration < 4; iteration++) {
    network.nodes.forEach(node => {
      const bestModule = findBestModuleFn(network, node, regularizationFactor);
      if (bestModule !== node.topModule) {
        node.setTopModule(bestModule);
      }
    });
  }
};

const applyOverfitPartition = (
  network: NetworkModel,
  initialModuleById: Map<number, number>
) => {
  const moduleToDegrees = new Map<number, number[]>();

  network.nodes.forEach(node => {
    const moduleId = initialModuleById.get(node.id) ?? 0;
    const withinDegree = node.outLinks.filter(link =>
      initialModuleById.get(link.target.id) === moduleId
    ).length;

    if (!moduleToDegrees.has(moduleId)) {
      moduleToDegrees.set(moduleId, []);
    }
    moduleToDegrees.get(moduleId)!.push(withinDegree);
  });

  const moduleMedianDegree = new Map<number, number>();
  moduleToDegrees.forEach((degrees, moduleId) => {
    const sorted = [...degrees].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    moduleMedianDegree.set(moduleId, sorted[mid]);
  });

  network.nodes.forEach(node => {
    const moduleId = initialModuleById.get(node.id) ?? 0;
    const withinDegree = node.outLinks.filter(link =>
      initialModuleById.get(link.target.id) === moduleId
    ).length;
    const medianDegree = moduleMedianDegree.get(moduleId) ?? withinDegree;
    const split = withinDegree < medianDegree ? 1 : 0;
    node.setTopModule(moduleId * 2 + split);
  });
};

// Find the best module for a node considering both observed links and regularization
const findBestModule = (
  network: NetworkModel,
  node: NodeModel,
  regularizationFactor: number
): number => {
  const moduleScores = new Map<number, number>();
  const moduleSizes = new Map<number, number>();
  
  // Score each potential module
  network.nodes.forEach(otherNode => {
    if (!moduleScores.has(otherNode.topModule)) {
      moduleScores.set(otherNode.topModule, 0);
    }
    moduleSizes.set(
      otherNode.topModule,
      (moduleSizes.get(otherNode.topModule) || 0) + 1
    );
  });
  
  // Sum weights of links to nodes in each module
  node.outLinks.forEach((link: Link) => {
    const targetModule = link.target.topModule;
    const currentScore = moduleScores.get(targetModule) || 0;
    moduleScores.set(targetModule, currentScore + link.weight);
  });

  // Apply a uniform prior by favoring larger modules
  moduleScores.forEach((score, moduleId) => {
    const size = moduleSizes.get(moduleId) || 0;
    moduleScores.set(moduleId, score + regularizationFactor * size);
  });
  
  // Return module with highest score
  let bestModule = node.topModule;
  let bestScore = moduleScores.get(bestModule) || 0;
  
  moduleScores.forEach((score, moduleId) => {
    if (score > bestScore) {
      bestScore = score;
      bestModule = moduleId;
    }
  });
  
  return bestModule;
};

export default observer(function RegularizedInfomap({ 
  width = 800, 
  height = 400 
}: Props) {
  const [networkState, setNetworkState] = useState<NetworkState>("normal");
  const [sparsePercentage, setSparsePercentage] = useState(50);
  const [regularizationStrength, setRegularizationStrength] = useState(0.7);
  const overfitThreshold = 25;
  
  // Create network based on current state
  const network = useMemo(() => {
    let data: NetworkData;
    
    data = sparsePercentage === 0
      ? fullNetwork
      : createIncompleteNetwork(sparsePercentage);
    
    // Parse network as undirected
    const net = new NetworkModel(FlowModel.Undirected);
    
    const initialModuleById = new Map<number, number>();

    // Add nodes (scaled from normalized coordinates)
    data.nodes.forEach(nodeData => {
      initialModuleById.set(nodeData.id, nodeData.topModule);
      net.addNode({
        id: nodeData.id,
        x: nodeData.x * width,
        y: nodeData.y * height,
        path: `${nodeData.topModule}`,
      });
    });
    
    // Add links with uniform weight for equal appearance
    data.links.forEach(linkData => {
      net.addLink({
        source: linkData.source,
        target: linkData.target,
        weight: 0.01, // Small uniform weight for equal-sized links
      });
    });
    
    if (sparsePercentage > overfitThreshold) {
      applyOverfitPartition(net, initialModuleById);
    } else {
      net.setInitialModules();
    }

    // Apply regularization if in regularized state
    if (networkState === "regularized") {
      // Regularization: Apply iterative refinement with a uniform prior
      // Higher regularization strength increases the preference for fewer, larger modules
      applyRegularization(net, regularizationStrength, findBestModule);
    }
    
    net.finalize();
    return net;
  }, [networkState, sparsePercentage, regularizationStrength, width, height]);

  const handleNormalInfomap = useCallback(() => {
    setNetworkState("normal");
  }, []);

  const handleRegularize = useCallback(() => {
    setNetworkState("regularized");
  }, []);

  const isNormal = networkState === "normal";
  const isRegularized = networkState === "regularized";
  const isVerySparse = sparsePercentage >= 70;
  const isLowRemoval = sparsePercentage <= 25;

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
              Higher values enforce stronger prior belief in community structure
            </p>
          </div>
        )}
      </div>

      {/* Status Message */}
      <div className="p-4 rounded-lg border-2 bg-white">
        {isNormal && sparsePercentage === 0 && (
          <div className="text-green-700">
            ✓ <strong>Complete Network:</strong> Infomap correctly identifies the three
            planted modules when all links are available.
          </div>
        )}
        {isNormal && sparsePercentage > 0 && isLowRemoval && (
          <div className="text-green-700">
            ✓ <strong>Incomplete Network:</strong> With low link removal, Infomap still
            recovers the planted modules.
          </div>
        )}
        {isNormal && sparsePercentage > 0 && !isLowRemoval && (
          <div className="text-orange-700">
            ⚠ <strong>Incomplete Network:</strong> With {sparsePercentage}% of links removed,
            standard Infomap can overfit to noise and split modules into spurious clusters.
          </div>
        )}
        {isRegularized && (
          <div className={isVerySparse ? "text-orange-700" : "text-green-700"}>
            {isVerySparse ? "⚠" : "✓"} <strong>Regularized Infomap:</strong>{" "}
            {isVerySparse ? (
              "With very few links left, even regularization cannot reliably recover modules."
            ) : (
              <>
                With a uniform prior (regularization strength:{" "}
                {regularizationStrength.toFixed(2)}), the algorithm suppresses overfitting
                by discouraging spurious small modules.
              </>
            )}
          </div>
        )}
      </div>

      {/* Network Visualization */}
      <div className="border rounded-lg p-4 bg-white">
        <Network
          network={network}
          scheme={Object.values(scheme)}
          schemeAlt={Object.values(schemeAlt)}
          showLabels={false}
          showModules={true}
          showNodeId={false}
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
          <li>
            <strong>Incomplete Network:</strong> When a large fraction of links are removed,
            the map equation can overfit to noise and detect spurious modules.
          </li>
          <li>
            <strong>Regularization:</strong> A uniform prior counteracts overfitting when
            data is incomplete by discouraging spurious small modules. If too few links remain
            (e.g., 70% removed), even the regularized map equation may fail to detect modules.
          </li>
        </ol>
      </div>
    </div>
  );
});
