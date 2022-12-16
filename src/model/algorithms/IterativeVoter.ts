import type Network from "../Network";
import { action, makeObservable, observable } from "mobx";
import { DEFAULT_TELEPORT_RATE } from "./index";

export default class IterativeVoter {
  private readonly network: Network;

  private readonly teleportRate = DEFAULT_TELEPORT_RATE;

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

  initialize() {
    const { numNodes } = this.network;

    this.totalVotes = 0;
    this.error = 0;

    for (const node of this.network.nodes) {
      node.voteRate = 1 / numNodes;
      this.error += (node.voteRate - node.flow) ** 2;
    }

    this.error /= this.network.numNodes;
  }

  vote() {
    return this.network.directed ? this.directedVote() : this.undirectedVote();
  }

  private undirectedVote() {
    for (const node of this.network.nodes) {
      node.voteRate = node.flow;
    }
    this.error = 0;
  }

  private directedVote() {
    const { nodes, danglingNodes, totalLinkWeight } = this.network;

    this.totalVotes++;

    const next: { [nodeId: string]: number } = {};
    nodes.forEach((node) => (next[node.id] = 0));

    const alpha = this.teleportRate;
    const beta = 1 - alpha;

    const danglingVoteRate = danglingNodes.reduce(
      (sum, node) => sum + node.voteRate,
      0.0
    );

    const teleportVoteRate = alpha + beta * danglingVoteRate;

    for (let { voteRate, outLinks, outWeight } of nodes) {
      const teleportVotes = teleportVoteRate * outWeight / totalLinkWeight;
      const linkVotes = beta * voteRate;

      for (let { target, weight } of outLinks) {
        const linkFlow = weight / outWeight;

        next[target.id] += (teleportVotes + linkVotes) * linkFlow;
      }
    }

    const totalVotes = Array.from(Object.values(next)).reduce(
      (sum, voteRates) => sum + voteRates,
      0.0
    );

    this.error = 0;

    for (let [id, votes] of Object.entries(next)) {
      const voteRate = votes / totalVotes;
      const node = this.network.getNode(+id)!;
      node.voteRate = voteRate;
      this.error += (voteRate - node.flow) ** 2;
    }

    this.error /= this.network.numNodes;
  }
}
