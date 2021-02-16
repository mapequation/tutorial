import type { Network, Node } from './index';
import { Teleportation, weightedRandom } from './index';
import { action, observable } from 'mobx';

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

    for (let node of this.network.nodes) {
      node.visits = 0;
    }

    this.prev = this.current = this.network.randomNode();
  }

  @action
  step() {
    if (!this.current) {
      this.prev = this.current = this.network.randomNode();
    }

    if (Math.random() < this.teleportRate || this.current.degree == 0) {
      return this.teleport();
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

  private teleport() {
    let degrees = this.network.nodes.map((node) => node.degree);
    let index = weightedRandom(degrees);

    this.prev = this.current;
    this.current = this.network.nodes[index];

    // record teleportation?
  }
}
