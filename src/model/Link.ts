import type Node from './Node';
import type { SerializedLink } from '../io/interfaces';
import type { SimulationLinkDatum } from 'd3';

class Link implements SimulationLinkDatum<Node> {
  source: Node;
  target: Node;
  weight: number;
  flow: number = 0.0;

  // d3
  index: number = 0;

  constructor(source: Node, target: Node, weight: number = 1.0) {
    this.source = source;
    this.target = target;
    this.weight = weight;
  }

  static deserialize(link: SerializedLink, nodeMap: Map<number, Node>): Link {
    let source = nodeMap.get(link.source);
    let target = nodeMap.get(link.target);

    if (!source || !target) {
      throw new Error('Node not found in nodeMap');
    }

    return new Link(source, target, link.weight);
  }
}

export default Link;
