import type Network from '../Network';
import type Node from '../Node';
import { Teleportation } from '../enums';
import { action, makeObservable, observable } from 'mobx';
import { weightedRandom } from '../helpers';

export default class RandomWalker {
  private network: Network;

  current: Node | null = null;
  prev: Node | null = null;

  totalVisits = 0;
  teleported = false;

  teleportRate = 0.15;
  teleportModel = Teleportation.Recorded;

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

    this.setCurrent(null);
  }

  step() {
    if (!this.current) {
      this.setCurrent(this.network.randomNode());
      this.recordVisit();
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

    this.setCurrent(link.target);

    this.recordVisit();
  }

  private teleport() {
    // set teleport-weight of current to 0 to avoid self-teleportation
    const degrees = this.network.nodes.map((node) =>
      node.id === this.current?.id ? 0 : node.degree,
    );

    const index = weightedRandom(degrees);

    this.setCurrent(this.network.nodes[index]);

    if (this.teleportModel == Teleportation.Recorded) {
      this.recordVisit();
    }
  }

  private recordVisit() {
    if (!this.current) return;

    this.current.visits++;
    this.totalVisits++;
  }

  private setCurrent(node: Node | null) {
    this.prev = this.current;
    this.current = node;
  }
}
