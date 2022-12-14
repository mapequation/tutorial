import type Network from "../Network";
import { action, makeObservable, observable } from "mobx";

export default class IterativeVoter {
  private readonly network: Network;

  readonly teleportRate = 0.15;

  totalVotes = 0;

  constructor(network: Network) {
    this.network = network;

    makeObservable(this, {
      totalVotes: observable,
      initialize: action,
      vote: action,
    });
  }

  initialize() {
    const { numNodes } = this.network;

    this.totalVotes = 0;

    this.network.nodes.forEach((node) => (node.voteRate = 1 / numNodes));
  }

  vote() {
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

    for (let [id, votes] of Object.entries(next)) {
      this.network.getNode(+id)!.voteRate = votes / totalVotes;
    }
  }
}
