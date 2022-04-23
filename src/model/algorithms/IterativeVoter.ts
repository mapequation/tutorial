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

    this.network.nodes.forEach((node) => (node.votes = 1 / numNodes));
  }

  vote() {
    const { nodes, danglingNodes, totalLinkWeight } = this.network;

    this.totalVotes++;

    const next: { [nodeId: string]: number } = {};
    nodes.forEach((node) => (next[node.id] = 0));

    const alpha = this.teleportRate;
    const beta = 1 - alpha;

    const danglingVotes = danglingNodes.reduce(
      (votes, node) => votes + node.votes,
      0.0
    );

    const teleportVotes = alpha + beta * danglingVotes;

    for (let node of nodes) {
      const { votes, outLinks, outWeight } = node;

      const teleportRate = outWeight / totalLinkWeight;

      next[node.id] += teleportRate * teleportVotes;

      for (let { target, weight } of outLinks) {
        const linkFlow = weight / outWeight;

        next[target.id] += beta * linkFlow * votes;
      }
    }

    const totalVotes = Array.from(Object.values(next)).reduce(
      (sum, votes) => sum + votes,
      0.0
    );

    for (let [id, votes] of Object.entries(next)) {
      this.network.getNode(+id)!.votes = votes / totalVotes;
    }
  }
}
