import type Node from './Node';
import type { SimulationLinkDatum } from 'd3';

export default class Link implements SimulationLinkDatum<Node> {
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
}
