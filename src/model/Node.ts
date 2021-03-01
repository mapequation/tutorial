import type { SimulationNodeDatum } from 'd3';
import type Link from './Link';
import type Network from './Network';
import { computed, makeObservable, observable } from 'mobx';
import { weightedRandom } from './helpers';

interface Params {
  x?: number;
  y?: number;
  name?: string;
  path?: string;
}

export default class Node implements SimulationNodeDatum {
  id: number;
  name: string;
  path: string;
  outLinks: Link[] = [];

  network: Network;

  flow: number = 0.0;
  visits: number = 0;
  votes: number = 0;
  oneLevelCode: string = '';

  // d3
  index: number = 0;
  x: number;
  y: number;
  vx: number = 0;
  vy: number = 0;

  constructor(
    network: Network,
    id: number,
    { x = 0, y = 0, name = '', path = '0' }: Params = {},
  ) {
    makeObservable(this, {
      flow: observable,
      visits: observable,
      votes: observable,
      oneLevelCode: observable,
      visitRate: computed,
    });

    this.network = network;
    this.id = id;
    this.x = x;
    this.y = y;
    this.name = name || id.toString();
    this.path = path;
  }

  get code(): string {
    const treeNode = this.network.tree.root.getLeaf(this.id);

    return treeNode?.code ?? '';
  }

  get visitRate(): number {
    const { totalVisits } = this.network.walker;

    return totalVisits === 0 ? 0 : this.visits / totalVisits;
  }

  get module(): number {
    return +this.path;
  }

  get degree(): number {
    return this.outLinks.length;
  }

  get outWeight(): number {
    return this.outLinks.reduce((weight, link) => weight + link.weight, 0.0);
  }

  get moduleFlow(): number {
    return this.network.moduleFlow(this);
  }

  get isDangling(): boolean {
    return this.degree === 0;
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
