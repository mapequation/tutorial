import { FlowModel, Link, Node } from './index';
import { NetworkReader } from '../io';
import type { ParserInterface, SerializedNetwork } from '../io/interfaces';

export type Id = number;

// TODO: parse json

class Network {
  private _nodes: Map<Id, Node> = new Map();
  links: Link[] = [];
  flowModel: FlowModel;

  constructor(
    nodes: Node[],
    links: Link[],
    flowModel: FlowModel = FlowModel.Directed,
  ) {
    nodes.forEach((node) => this._nodes.set(node.id, node));

    this.links = links;
    this.flowModel = flowModel;

    links.forEach((link) => link.source.addLink(link));
  }

  get nodes(): Node[] {
    return Array.from(this._nodes.values());
  }

  getNode(id: Id): Node | undefined {
    return this._nodes.get(id);
  set directed(directed: boolean) {
    this.flowModel = directed ? FlowModel.Directed : FlowModel.Undirected;
  }

  get directed(): boolean {
    return this.flowModel === FlowModel.Directed;
  }

  static parse(
    network: SerializedNetwork,
    scalePositions: boolean = true,
  ): Network {
    const {
      flowModel,
      nodes: serializedNodes,
      links: serializedLinks,
    } = network;

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
      flowModel === 'directed' ? FlowModel.Directed : FlowModel.Undirected,
    );
  }

  static parseString(
    lines: string,
    parser: ParserInterface = NetworkReader.parse,
  ): Network {
    return Network.parse(parser(lines), false);
  }
}

export default Network;
