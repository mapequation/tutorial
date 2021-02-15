import { Link, Node } from './index';
import { NetworkReader } from '../io';
import type { SerializedNetwork, ParserInterface } from '../io/interfaces';

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

  getNode(id: Id): Node | undefined {
    return this._nodes.get(id);
  }

  static parse(
    json: SerializedNetwork,
    scalePositions: boolean = true,
  ): Network {
    const { nodes: serializedNodes, links: serializedLinks } = json;

    let nodes = serializedNodes.map(Node.deserialize);

    if (scalePositions) {
      nodes.forEach((node) => {
        node.x *= 800;
        node.y *= 800;
      });
    }

    let nodeMap = new Map(nodes.map((node) => [node.id, node]));

    return new Network(
      nodes,
      serializedLinks.map((link) => Link.deserialize(link, nodeMap)),
    );
  }

  static deserialize(
    lines: string,
    parser: ParserInterface = NetworkReader.parse,
  ): Network {
    return Network.parse(parser(lines), false);
  }
}

export default Network;
