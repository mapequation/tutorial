import { Node, Link } from '.';
import { NetworkReader } from '../io';
import type { ParserInterface } from '../io/interfaces';

export type Id = number;

// TODO: parse json

class Network {
  nodes: Map<Id, Node> = new Map();
  links: Link[] = [];

  constructor(nodes: Node[], links: Link[]) {
    nodes.forEach((node) => this.nodes.set(node.id, node));
    this.links = links;

    links.forEach((link) => {
      const node = this.nodes.get(link.source);
      if (node != null) {
        node?.addLink(link);
      }
    });
  }

  static deserialize(
    lines: string,
    parser: ParserInterface = NetworkReader.parse,
  ): Network {
    const { nodes, links } = parser(lines);
    return new Network(
      nodes.map(Node.deserialize),
      links.map(Link.deserialize),
    );
  }
}

export default Network;
