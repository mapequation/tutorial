import type { SimulationNodeDatum } from 'd3';
import type { Id, Link } from './index';
import { Network, weightedRandom } from './index';
import type { SerializedNode } from '../io/interfaces';
import { computed, observable } from 'mobx';

type NodeParams = {
  x?: number;
  y?: number;
  label?: string;
  flow?: number;
  code?: string;
  color?: string;
};

class Node implements SimulationNodeDatum {
  id: Id;
  label: string;
  code: string = '';
  module: number = 0;
  outLinks: Link[] = [];

  network: Network;

  @observable flow: number = 0.0;

  @observable visits: number = 0;

  @observable votes: number = 0;

  // d3
  index: number = 0;
  x: number;
  y: number;
  vx: number = 0;
  vy: number = 0;

  constructor(
    network: Network,
    id: number,
    { x = 0, y = 0, label = '' }: NodeParams = {},
  ) {
    this.network = network;
    this.id = id;
    this.x = x;
    this.y = y;
    this.label = label;
  }

  static deserialize(node: SerializedNode, network: Network): Node {
    const label = node.name || '';
    const x = node.x || 0;
    const y = node.y || 0;
    return new Node(network, node.id, { x, y, label });
  }

  @computed
  get visitRate(): number {
    return this.visits / this.network.walker.totalVisits;
  }

  get degree(): number {
    return this.outLinks.length;
  }

  addLink(link: Link) {
    this.outLinks.push(link);
  }

  randomLink(): Link | undefined {
    const weights = this.outLinks.map((link) => link.weight);
    const i = weightedRandom(weights);
    return this.outLinks[i];
  }
}

export default Node;
