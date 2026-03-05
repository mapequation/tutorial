import type Node from "./Node";
import type { SimulationLinkDatum } from "d3";

/**
 * Lightweight link model connecting two `Node` instances.
 *
 * `weight` represents the adjacency weight used by walkers and visualization
 * stroke widths. `flow` is a derived value computed by algorithms and used
 * for visual emphasis.
 */
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

  /**
   * Convenience to obtain the reversed direction of this link. Useful when
   * building undirected representations where the same edge should appear
   * as a reversed link for the target node.
   */
  get reversed(): Link {
    return new Link(this.target, this.source, this.weight);
  }
}
