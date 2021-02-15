import type { Link } from '../index';
import { Teleportation } from '../index';
import type { FlowLink, NodeFlow } from './helpers';
import { nodeIds } from './helpers';

/*
  Page Rank

  Takes a collection of links
  Modifies the links to set the flow property

  Returns a map from node id to page rank
 */
function pageRank(
  links: Iterable<Link>,
  teleportation: Teleportation = Teleportation.Unrecorded,
  teleportationProb: number = 0.15,
): NodeFlow {
  const nodes = Array.from(nodeIds(links));

  const numNodes = nodes.length;

  const nodeIndexMap: { [node: number]: number } = {};

  nodes.forEach((node, i) => (nodeIndexMap[node] = i));

  let numLinks = 0;
  let sumLinkWeight = 0.0;
  let sumSelfLinkWeight = 0.0;

  for (let link of links) {
    numLinks++;

    sumLinkWeight += link.weight;

    if (link.source.id == link.target.id) {
      sumSelfLinkWeight += link.weight;
    }
  }

  const sumUndirLinkWeight = 2.0 * sumLinkWeight - sumSelfLinkWeight;

  let flowLinks: FlowLink[] = [];
  let outDegree = new Array(numNodes).fill(0);
  let outWeight = new Array(numNodes).fill(0.0);
  let nodeFlow = new Array(numNodes).fill(0.0);

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

    nodeFlow[sourceIndex] = outWeight[sourceIndex] / sumUndirLinkWeight;
  }

  let teleportRates = new Array(numNodes).fill(0.0);

  switch (teleportation) {
    case Teleportation.Recorded:
      for (let link of flowLinks) {
        teleportRates[link.target] += link.flow / sumLinkWeight;
      }
      break;
    case Teleportation.Unrecorded:
      for (let link of flowLinks) {
        teleportRates[link.source] += link.flow / sumLinkWeight;
      }
      break;
  }

  for (let link of flowLinks) {
    let sumOutWeight = outWeight[link.source];
    if (sumOutWeight > 0) {
      link.flow /= sumOutWeight;
    }
  }

  let danglingRank;
  let nodeFlowNext;

  let alpha = teleportationProb;
  let beta = 1 - alpha;

  const ERROR_TOL = 1e-15;
  const NORMALIZATION_TOL = 1.0e-10;
  const EQUILIBRIUM_TOL = 1.0e-15;
  const MAX_ITERATIONS = 200;
  const INITIAL_PHASE_ITERATIONS = 50;

  let danglingIndices = [];

  let i = 0;
  for (let degree of outDegree) {
    if (degree === 0) {
      danglingIndices.push(i);
    }
    ++i;
  }

  let error = 0.0;
  let numIterations = 0;

  let converged = false;
  let iterationsRemaining = true;

  do {
    danglingRank = danglingIndices.reduce((sum, i) => sum + nodeFlow[i], 0.0);

    const teleportFlow = alpha + beta * danglingRank;

    nodeFlowNext = teleportRates.map(
      (teleportRate) => teleportFlow * teleportRate,
    );

    for (let link of flowLinks) {
      nodeFlowNext[link.target] += beta * link.flow * nodeFlow[link.source];
    }

    let nodeFlowDiff = -1.0;
    const prevError = error;
    error = 0.0;

    nodeFlowNext.forEach((next, i) => {
      nodeFlowDiff += next;
      error += Math.abs(nodeFlow[i] - next);
      nodeFlow[i] = next;
    });

    numIterations++;

    if (Math.abs(nodeFlowDiff) > NORMALIZATION_TOL) {
      console.log(`Normalizing after ${numIterations} iterations`);

      let sumNodeFlow = nodeFlowDiff + 1.0;
      for (let i = 0; i < numNodes; ++i) {
        nodeFlow[i] /= sumNodeFlow;
      }
    }

    if (Math.abs(error - prevError) < EQUILIBRIUM_TOL) {
      console.log(`Perturbing after ${numIterations} iterations`);

      alpha += 1.0e-10;
      beta = 1.0 - alpha;
    }

    iterationsRemaining = numIterations < MAX_ITERATIONS;
    let errorTooLarge = error > ERROR_TOL;
    let inInitialPhase = numIterations < INITIAL_PHASE_ITERATIONS;
    converged = !errorTooLarge && !inInitialPhase;
  } while (!converged && iterationsRemaining);

  console.log(`Finished after ${numIterations} iterations with error ${error}`);

  let sumNodeRank = 1.0;

  if (teleportation == Teleportation.Unrecorded) {
    sumNodeRank -= danglingRank;

    nodeFlow = new Array(numNodes).fill(0.0);

    for (let link of flowLinks) {
      nodeFlow[link.target] +=
        (link.flow * nodeFlowNext[link.source]) / sumNodeRank;
    }

    beta = 1.0;
  }

  for (let link of flowLinks) {
    link.flow *= (beta * nodeFlowNext[link.source]) / sumNodeRank;
  }

  const nodeFlowMap: NodeFlow = {};
  let linkIndex = 0;

  for (let source of nodes) {
    const sourceIndex = nodeIndexMap[source];
    nodeFlowMap[source] = nodeFlow[sourceIndex];

    for (let link of links) {
      if (link.source.id === source) {
        link.flow = flowLinks[linkIndex].flow;
        ++linkIndex;
      }
    }
  }

  return nodeFlowMap;
}

export default pageRank;
