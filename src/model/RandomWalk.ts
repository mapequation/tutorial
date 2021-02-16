import type { Network, Node } from './index';
import { Teleportation, weightedRandom } from './index';
import { action, makeObservable, observable } from 'mobx';

export default class RandomWalk {
  network: Network;

  current: Node;
  prev: Node;

  totalVisits = 0;

  teleportRate = 0.15;
  teleportModel = Teleportation.Unrecorded;

  constructor(network: Network) {
    this.network = network;

    this.network.nodes.forEach((node) => (node.visits = 0));

    this.prev = this.current = this.network.randomNode();

    makeObservable(this, {
      totalVisits: observable,
      current: observable,
      step: action,
    });
  }

  step() {
    if (!this.current) {
      // FIXME should run in constructor only
      this.prev = this.current = this.network.randomNode();
    }

    this.network.showVisitRate = true; // FIXME move this?

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
    // set teleport-weight of current to 0 to avoid self-teleportation
    let degrees = this.network.nodes.map((node) =>
      node.id === this.current.id ? 0 : node.degree,
    );

    let index = weightedRandom(degrees);

    this.prev = this.current;
    this.current = this.network.nodes[index];

    // record teleportation?
  }
}
