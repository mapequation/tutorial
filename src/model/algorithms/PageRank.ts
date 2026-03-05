/**
 * PageRank calculates steady-state flow (visit probabilities) for network nodes.
 * 
 * Uses the PageRank algorithm with teleportation to model a random walker's
 * long-run behavior. Supports both directed and undirected networks, with
 * configurable teleportation (recorded via links vs unrecorded jumps).
 * 
 * Directed flow: Iterative until convergence, accounting for dangling nodes
 * (sinks with no outgoing links). Undirected flow: Direct calculation from
 * link weights. Results stored in node.flow and link.flow properties.
 */
import { Teleportation } from "../enums";
import type Network from "../Network";
import { action, makeObservable } from "mobx";
import { DEFAULT_TELEPORT_MODEL, DEFAULT_TELEPORT_RATE } from ".";

/**
 * Map of node ID to flow value.
 */
interface NodeFlow {
  [nodeId: number]: number;
}

/**
 * Link with source, target node indices and current flow value.
 * Used during algorithm computation to avoid direct Network object access.
 */
interface FlowLink {
  source: number;
  target: number;
  flow: number;
}

export default class PageRank {
  private readonly network: Network;

  private readonly teleportModel = DEFAULT_TELEPORT_MODEL;
  private readonly teleportProb = DEFAULT_TELEPORT_RATE;

  constructor(network: Network) {
    this.network = network;

    makeObservable(this, {
      calculate: action,
    });
  }

  /**
   * Calculate PageRank flow for all nodes and links.
   * Dispatches to directed or undirected calculation based on network type.
   * Updates node.flow and link.flow in-place.
   */
  calculate() {
    return this.network.directed
      ? this.calcDirectedFlow()
      : this.calcUndirectedFlow();
  }

  /**
   * Directed PageRank: Iterative algorithm with teleportation.
   * 
   * Algorithm outline:
   * 1. Build flow links normalized by out-degree
   * 2. Compute teleportation rates based on model (Recorded/Unrecorded)
   * 3. Iterate: each node's new flow = teleport flow + incoming flow from neighbors
   * 4. Handle dangling nodes (no out-links) by redistributing their flow
   * 5. Normalize and check convergence (error < threshold, min iterations reached)
   * 6. Apply post-processing for Unrecorded teleportation model
   */
  private calcDirectedFlow() {
    const { network, teleportModel, teleportProb } = this;
    const { links } = network;

    // Build indexed node and link structures for efficient computation
    const nodes = network.nodes.map((node) => node.id);
    const numNodes = nodes.length;
    const nodeIndexMap: { [node: number]: number } = {};
    nodes.forEach((node, i) => (nodeIndexMap[node] = i));

    // Calculate link weight statistics
    let sumLinkWeight = 0.0;
    let sumSelfLinkWeight = 0.0;
    for (let link of links) {
      sumLinkWeight += link.weight;
      if (link.source.id === link.target.id) {
        sumSelfLinkWeight += link.weight;
      }
    }
    const sumUndirLinkWeight = 2.0 * sumLinkWeight - sumSelfLinkWeight;

    // Initialize flow computation data structures
    let flowLinks: FlowLink[] = [];
    let outDegree = new Array(numNodes).fill(0);
    let outWeight = new Array(numNodes).fill(0.0);
    let nodeFlow = new Array(numNodes).fill(0.0);

    // Build normalized flow links and out-degree counts
    for (let source of nodes) {
      const sourceIndex = nodeIndexMap[source];

      for (let link of links) {
        if (link.source.id === source) {
          const targetIndex = nodeIndexMap[link.target.id];

          flowLinks.push({
            source: sourceIndex,
            target: targetIndex,
            flow: link.weight,
          });

          outDegree[sourceIndex]++;
          outWeight[sourceIndex] += link.weight;
        }
      }

      // Initial flow: node gets fraction of network's undirected link weight
      nodeFlow[sourceIndex] = outWeight[sourceIndex] / sumUndirLinkWeight;
    }

    // Compute teleportation rates based on model
    let teleportRates = new Array(numNodes).fill(0.0);
    switch (teleportModel) {
      case Teleportation.Recorded:
        // Teleport to nodes that have incoming links
        for (let link of flowLinks) {
          teleportRates[link.target] += link.flow / sumLinkWeight;
        }
        break;
      case Teleportation.Unrecorded:
        // Teleport from nodes that have outgoing links
        for (let link of flowLinks) {
          teleportRates[link.source] += link.flow / sumLinkWeight;
        }
        break;
    }

    // Normalize flow links by source node's out-weight
    for (let link of flowLinks) {
      let sumOutWeight = outWeight[link.source];
      if (sumOutWeight > 0) {
        link.flow /= sumOutWeight;
      }
    }

    // Convergence parameters
    let danglingRank;
    let nodeFlowNext;
    let alpha = teleportProb;        // Teleportation probability
    let beta = 1 - alpha;             // Following link probability
    
    const ERROR_TOL = 1e-15;
    const NORMALIZATION_TOL = 1.0e-10;
    const EQUILIBRIUM_TOL = 1.0e-15;
    const MAX_ITERATIONS = 200;
    const INITIAL_PHASE_ITERATIONS = 50;

    // Find dangling nodes (no outgoing links)
    let danglingIndices = [];
    let i = 0;
    for (let degree of outDegree) {
      if (degree === 0) {
        danglingIndices.push(i);
      }
      ++i;
    }

    // Iterative power iteration until convergence
    let error = 0.0;
    let numIterations = 0;
    let converged = false;
    let iterationsRemaining = true;

    do {
      // Calculate flow redistribution from dangling nodes
      danglingRank = danglingIndices.reduce((sum, i) => sum + nodeFlow[i], 0.0);
      const teleportFlow = alpha + beta * danglingRank;

      // Initialize next flow state with teleportation
      nodeFlowNext = teleportRates.map(
        (teleportRate) => teleportFlow * teleportRate,
      );

      // Add flow from incoming links
      for (let link of flowLinks) {
        nodeFlowNext[link.target] += beta * link.flow * nodeFlow[link.source];
      }

      // Compute error (L1 norm of flow change)
      let nodeFlowDiff = -1.0;
      const prevError = error;
      error = 0.0;

      nodeFlowNext.forEach((next, i) => {
        nodeFlowDiff += next;
        error += Math.abs(nodeFlow[i] - next);
        nodeFlow[i] = next;
      });

      numIterations++;

      // Handle numerical normalization issues
      if (Math.abs(nodeFlowDiff) > NORMALIZATION_TOL) {
        console.log(`Normalizing after ${numIterations} iterations`);
        let sumNodeFlow = nodeFlowDiff + 1.0;
        for (let i = 0; i < numNodes; ++i) {
          nodeFlow[i] /= sumNodeFlow;
        }
      }

      // Handle equilibrium detection by perturbing alpha
      if (Math.abs(error - prevError) < EQUILIBRIUM_TOL) {
        console.log(`Perturbing after ${numIterations} iterations`);
        alpha += 1.0e-10;
        beta = 1.0 - alpha;
      }

      // Check convergence conditions
      iterationsRemaining = numIterations < MAX_ITERATIONS;
      let errorTooLarge = error > ERROR_TOL;
      let inInitialPhase = numIterations < INITIAL_PHASE_ITERATIONS;
      converged = !errorTooLarge && !inInitialPhase;
    } while (!converged && iterationsRemaining);

    console.log(
      `Finished after ${numIterations} iterations with error ${error}`,
    );

    // Post-processing for unrecorded teleportation model
    let sumNodeRank = 1.0;

    if (teleportModel === Teleportation.Unrecorded) {
      // Account for dangling flow and redistribute through links only
      sumNodeRank -= danglingRank;
      nodeFlow = new Array(numNodes).fill(0.0);

      for (let link of flowLinks) {
        nodeFlow[link.target] +=
          (link.flow * nodeFlowNext[link.source]) / sumNodeRank;
      }

      beta = 1.0;
    }

    // Apply final normalization to link flows
    for (let link of flowLinks) {
      link.flow *= (beta * nodeFlowNext[link.source]) / sumNodeRank;
    }

    // Write results back to network nodes and links
    let linkIndex = 0;

    for (let source of nodes) {
      const sourceIndex = nodeIndexMap[source];
      const node = network.getNode(source);
      if (node) {
        node.flow = nodeFlow[sourceIndex];
      }

      for (let link of links) {
        if (link.source.id === source) {
          link.flow = flowLinks[linkIndex].flow;
          ++linkIndex;
        }
      }
    }
  }

  /**
   * Undirected PageRank: Direct calculation from link weights.
   * 
   * For undirected networks, the steady-state flow is simply proportional
   * to node degree. Simpler than directed case, no iteration needed.
   * Each link contributes equally to both its endpoints.
   */
  private calcUndirectedFlow() {
    const { links } = this.network;

    // Calculate link weight statistics
    let sumLinkWeight = 0.0;
    let sumSelfLinkWeight = 0.0;

    for (let link of links) {
      sumLinkWeight += link.weight;

      if (link.source.id === link.target.id) {
        sumSelfLinkWeight += link.weight;
      }
    }

    const sumUndirLinkWeight = 2.0 * sumLinkWeight - sumSelfLinkWeight;

    // Calculate node flow as sum of incident edge weights
    const nodeFlowMap: NodeFlow = {};

    for (let link of links) {
      // Link flow proportional to its weight relative to total
      link.flow = link.weight / (0.5 * sumUndirLinkWeight);

      const linkFlow = link.weight / sumUndirLinkWeight;

      // Each node gets contribution from both endpoints of the link
      for (let nodeId of [link.source.id, link.target.id]) {
        if (nodeId in nodeFlowMap) {
          nodeFlowMap[nodeId] += linkFlow;
        } else {
          nodeFlowMap[nodeId] = linkFlow;
        }
      }
    }

    // Write computed flows back to network
    for (let [nodeId, flow] of Object.entries(nodeFlowMap)) {
      const node = this.network.getNode(+nodeId)!;
      node.flow = flow
    }
  }
}
