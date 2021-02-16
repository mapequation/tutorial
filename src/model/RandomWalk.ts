import type { Network, Node } from './index';
import { Teleportation, weightedRandom } from './index';
import { action, computed, makeObservable, observable } from 'mobx';

export default class RandomWalk {
  network: Network;

  current: Node;
  prev: Node;

  totalVisits = 0;

  teleportRate = 0.15;
  teleportModel = Teleportation.Unrecorded;

  constructor(network: Network) {
    makeObservable(this, {
      totalVisits: observable,
      step: action,
    });

    this.network = network;

    for (let node of this.network.nodes) {
      node.visits = 0;
    }

    this.prev = this.current = this.network.randomNode();
  }

  step() {
    if (!this.current) {
      // FIXME should run in constructor only
      this.prev = this.current = this.network.randomNode();
    }

    this.network.showVisitRate = true;

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
