import type { Network, Node } from './index';
import { Teleportation, weightedRandom } from './index';
import { observable, action } from 'mobx';

interface VisitRates {
  [nodeId: number]: number;
}

export default class RandomWalk {
  network: Network;

  current: Node;
  prev: Node;

  @observable
  totalVisits = 0;

  teleportRate = 0.15;
  teleportModel = Teleportation.Unrecorded;

  constructor(network: Network) {
    this.network = network;

    for (let node of network.nodes) {
      node.visits = 0;
    }

    this.prev = this.current = network.randomNode();
  }

  @action
  step() {
    const r = Math.random();

    // teleport?
    if (r < this.teleportRate || this.current.degree == 0) {
      let degrees = this.network.nodes.map((node) => node.degree);
      let i = weightedRandom(degrees);

      this.prev = this.current;
      this.current = this.network.nodes[i];

      // no record?
      return;
    }

    // degree should always be > 0 here
    let link = this.current.randomLink();

    if (!link) {
      throw new Error('No link found, but node has out degree > 0');
    }

    this.prev = this.current;
    this.current = link.target;

    this.current.visits++;
    this.totalVisits++;
  }
}
