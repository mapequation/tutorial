import type { SimulationNodeDatum } from 'd3';
import type Link from './Link';
import type Network from './Network';
import { weightedRandom } from './random';
import { computed, makeObservable, observable } from 'mobx';

type NodeParams = {
  x?: number;
  y?: number;
  name?: string;
  module?: number;
};

export default class Node implements SimulationNodeDatum {
  id: number;
  name: string;
  code: string = '';
  module: number = 0;
  outLinks: Link[] = [];

  network: Network;

  flow: number = 0.0;
  visits: number = 0;
  votes: number = 0;

  // d3
  index: number = 0;
  x: number;
  y: number;
  vx: number = 0;
  vy: number = 0;

  constructor(
    network: Network,
    id: number,
    { x = 0, y = 0, name = '', module = 0 }: NodeParams = {},
  ) {
    makeObservable(this, {
      flow: observable,
      visits: observable,
      votes: observable,
      visitRate: computed,
    });

    this.network = network;
    this.id = id;
    this.x = x;
    this.y = y;
    this.name = name || id.toString();
    this.module = module;
  }

  get visitRate(): number {
    const { totalVisits } = this.network.walker;

    return totalVisits === 0 ? 0 : this.visits / totalVisits;
  }

  get degree(): number {
    return this.outLinks.length;
  }

  addLink(link: Link) {
    this.outLinks.push(link);
  }

  randomLink(): Link | null {
    const weights = this.outLinks.map((link) => link.weight);
    const i = weightedRandom(weights);
    return this.outLinks[i];
  }
}
