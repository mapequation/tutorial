import type Network from './Network';
import type Node from './Node';
import { Teleportation } from './enums';
import { weightedRandom } from './random';
import { action, makeObservable, observable } from 'mobx';

export default class RandomWalk {
  network: Network;

  current: Node;
  prev: Node;

  totalVisits = 0;
  teleported = false;

  teleportRate = 0.15;
  teleportModel = Teleportation.Unrecorded;

  constructor(network: Network) {
    this.network = network;

    this.network.nodes.forEach((node) => (node.visits = 0));

    this.prev = this.current = this.network.randomNode();

    makeObservable(this, {
      totalVisits: observable,
      current: observable,
      teleported: observable,
      step: action,
    });
  }

  step() {
    this.teleported = false;

    if (!this.current) {
      // FIXME should run in constructor only
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
    this.teleported = true;

    // set teleport-weight of current to 0 to avoid self-teleportation
    const degrees = this.network.nodes.map((node) =>
      node.id === this.current.id ? 0 : node.degree,
    );

    const index = weightedRandom(degrees);

    this.prev = this.current;
    this.current = this.network.nodes[index];

    // record teleportation?
  }
}
