import { Node, Link } from '.';
import { NetworkReader } from '../io';

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

  static deserialize(lines: string[]): Network {
    const { nodes, links } = NetworkReader.parse(lines);
    return new Network(
      nodes.map(Node.deserialize),
      links.map(Link.deserialize),
    );
  }
}

export default Network;
