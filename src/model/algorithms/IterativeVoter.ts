import type Network from '../Network';
import { action, makeObservable, observable } from 'mobx';

export default class IterativeVoter {
  private network: Network;

  totalVotes = 0;

  constructor(network: Network) {
    this.network = network;

    makeObservable(this, {
      totalVotes: observable,
      vote: action,
    });
  }

  vote() {
    const { nodes } = this.network;

    const next = {};

    const danglingNodes = nodes.filter((node) => node.isDangling);

    for (let node of nodes) {
      const { votes, degree } = node;
    }
  }
}
