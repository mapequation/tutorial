import type Network from './Network';
import type Node from './Node';
import { Teleportation } from './enums';
import { weightedRandom } from './random';
import { action, makeObservable, observable } from 'mobx';

export default class RandomWalker {
  network: Network;

  current: Node | null = null;
  prev: Node | null = null;

  totalVisits = 0;
  teleported = false;

  teleportRate = 0.15;
  teleportModel = Teleportation.Unrecorded;

  constructor(network: Network) {
    this.network = network;

    makeObservable(this, {
      totalVisits: observable,
      current: observable,
      teleported: observable,
      reset: action,
      step: action,
    });
  }

  reset() {
    this.totalVisits = 0;

    this.network.nodes.forEach((node) => (node.visits = 0));

    this.prev = this.current = null;
  }

  step() {
    if (!this.current) {
      this.prev = this.current = this.network.randomNode();
      this.current.visits++;
      this.totalVisits++;
      return;
    }

    this.teleported =
      Math.random() < this.teleportRate || this.current?.degree == 0;

    if (this.teleported) {
      return this.teleport();
    }

    // degree should always be > 0 here
    const link = this.current?.randomLink();

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
    const degrees = this.network.nodes.map((node) =>
      node.id === this.current?.id ? 0 : node.degree,
    );

    const index = weightedRandom(degrees);

    this.prev = this.current;
    this.current = this.network.nodes[index];
  }
}
