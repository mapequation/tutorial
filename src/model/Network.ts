import { Link, Node } from './index';
import { NetworkReader } from '../io';
import type { ParserInterface } from '../io/interfaces';

export type Id = number;

// TODO: parse json

class Network {
  private _nodes: Map<Id, Node> = new Map();
  links: Link[] = [];

  constructor(nodes: Node[], links: Link[]) {
    nodes.forEach((node) => this._nodes.set(node.id, node));

    this.links = links;

    links.forEach((link) => link.source.addLink(link));
  }

  get nodes(): Node[] {
    return Array.from(this._nodes.values());
  }

  static deserialize(
    lines: string,
    parser: ParserInterface = NetworkReader.parse,
  ): Network {
    const { nodes: serializedNodes, links: serializedLinks } = parser(lines);

    let nodes = serializedNodes.map(Node.deserialize);

    let nodeMap = new Map(nodes.map((node) => [node.id, node]));

    return new Network(
      nodes,
      serializedLinks.map((link) => Link.deserialize(link, nodeMap)),
    );
  }
}

export default Network;
