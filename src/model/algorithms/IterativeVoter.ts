/**
 * IterativeVoter computes visit probabilities through iterative belief propagation.
 * 
 * Starts with uniform belief across nodes, then iteratively updates based on
 * network flow. Each iteration spreads vote from each node to its neighbors
 * weighted by edge strength, with teleportation for exploration.
 * 
 * For undirected networks, converges immediately to node degrees.
 * For directed networks, iterates until reaching equilibrium (error stabilizes).
 * Used to visualize consensus emerging from decentralized voting process.
 */
import type Network from "../Network";
import { action, makeObservable, observable } from "mobx";
import { DEFAULT_TELEPORT_RATE } from "./index";

export default class IterativeVoter {
  private readonly network: Network;

  private readonly teleportRate = DEFAULT_TELEPORT_RATE;

  // Track voting process statistics
  totalVotes = 0;
  error = 0;

  constructor(network: Network) {
    this.network = network;

    makeObservable(this, {
      totalVotes: observable,
      error: observable,
      initialize: action,
      vote: action,
    });
  }

  /**
   * Initialize voting: set all nodes to uniform belief (1/n).
   * Compute initial error (MSE between belief and target flow).
   */
  initialize() {
    const { numNodes } = this.network;

    this.totalVotes = 0;
    this.error = 0;

    // Start with uniform distribution
    for (const node of this.network.nodes) {
      node.voteRate = 1 / numNodes;
      this.error += (node.voteRate - node.flow) ** 2;
    }

    this.error /= this.network.numNodes;
  }

  /**
   * Perform one iteration of belief propagation.
   * Returns updated network with new vote rates.
   * Delegates to directed or undirected implementation.
   */
  vote() {
    return this.network.directed ? this.directedVote() : this.undirectedVote();
  }

  /**
   * Undirected voting: immediate convergence.
   * Vote rate equals node degree (flow).
   * Error goes to 0 (represents perfect knowledge).
   */
  private undirectedVote() {
    for (const node of this.network.nodes) {
      node.voteRate = node.flow;
    }
    this.error = 0;
  }

  /**
   * Directed voting: iterative belief propagation with teleportation.
   * 
   * Each node distributes votes to neighbors based on:
   * - Teleportation: uniform broadcast to all (alpha probability)
   * - Following links: biased by node's current vote and edge weights (beta probability)
   * 
   * Process:
   * 1. Calculate dangling node contribution (nodes with no outgoing links)
   * 2. Accumulate votes for each node from all sources
   * 3. Normalize total votes to probability distribution
   * 4. Compute error (MSE vs target flow)
   */
  private directedVote() {
    const { nodes, danglingNodes, totalLinkWeight } = this.network;

    this.totalVotes++;

    // Accumulator for next vote distribution
    const next: { [nodeId: string]: number } = {};
    nodes.forEach((node) => (next[node.id] = 0));

    const alpha = this.teleportRate;         // Teleportation probability
    const beta = 1 - alpha;                   // Following link probability

    // Calculate how much vote is "dangling" (held by nodes with no outgoing links)
    const danglingVoteRate = danglingNodes.reduce(
      (sum, node) => sum + node.voteRate,
      0.0
    );

    // Total teleportation rate available (immediate + dangling redistribution)
    const teleportVoteRate = alpha + beta * danglingVoteRate;

    // Each node sends out votes proportional to current vote rate
    for (let { voteRate, outLinks, outWeight } of nodes) {
      // Teleportation: broad cast to all neighbors weighted by their edge weight
      const teleportVotes = teleportVoteRate * outWeight / totalLinkWeight;
      // Following links: send current votes through edges
      const linkVotes = beta * voteRate;

      // Distribute votes across outgoing edges weighted by edge strength
      for (let { target, weight } of outLinks) {
        const linkFlow = weight / outWeight;
        next[target.id] += (teleportVotes + linkVotes) * linkFlow;
      }
    }

    // Normalize votes to probability distribution (sum to 1)
    const totalVotes = Array.from(Object.values(next)).reduce(
      (sum, voteRates) => sum + voteRates,
      0.0
    );

    this.error = 0;

    // Update nodes and compute error
    for (let [id, votes] of Object.entries(next)) {
      const voteRate = votes / totalVotes;
      const node = this.network.getNode(+id)!;
      node.voteRate = voteRate;
      this.error += (voteRate - node.flow) ** 2;
    }

    this.error /= this.network.numNodes;
  }
}
