import type { SimulationNodeDatum } from 'd3';
import type { Id, Link } from './index';
import type { SerializedNode } from '../io/interfaces';

class Node implements SimulationNodeDatum {
  id: Id;
  label: string;
  private _flow: number = 0.0;
  color: string;
  code: string;
  module: number = 0;
  outLinks: Link[] = [];

  // d3
  index: number = 0;
  x: number;
  y: number;
  vx: number = 0;
  vy: number = 0;

  constructor(
    id: Id,
    x: number = 0,
    y: number = 0,
    label: string = '',
    flow: number = 0.0,
    code: string = '',
    color: string = '',
  ) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.label = label;
    this.flow = flow;
    this.code = code;
    this.color = color;
  }

  static deserialize(node: SerializedNode): Node {
    const label = node.name || '';
    const x = node.x || 0;
    const y = node.y || 0;
    return new Node(node.id, x, y, label);
  }

  set flow(flow: number) {
    if (flow < 0.0 || flow > 1.0) {
      throw new RangeError('flow must be within [0.0, 1.0]');
    }

    this._flow = flow;
  }

  get flow(): number {
    return this._flow;
  }

  get degree(): number {
    return this.outLinks.length;
  }

  addLink(link: Link) {
    this.outLinks.push(link);
  }

  randomLink(): Link | undefined {
    return this.outLinks[Math.floor(Math.random() * this.degree)];
  }
}

export default Node;
