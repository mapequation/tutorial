import type { Id, Node } from './index';
import type { SerializedLink } from '../io/interfaces';
import type { SimulationLinkDatum } from 'd3';

class Link implements SimulationLinkDatum<Node> {
  source: Node;
  target: Node;
  private _flow: number;
  weight: number;

  // d3
  index: number = 0;

  constructor(
    source: Node,
    target: Node,
    weight: number = 0.0,
    flow: number = 0.0,
  ) {
    this.source = source;
    this.target = target;
    this._flow = flow;
    this.weight = weight;
  }

  static deserialize(link: SerializedLink, nodeMap: Map<Id, Node>): Link {
    let source = nodeMap.get(link.source);
    let target = nodeMap.get(link.target);

    if (!source || !target) {
      throw new Error('Node not found in nodeMap');
    }

    return new Link(source, target, link.weight);
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
}

export default Link;
