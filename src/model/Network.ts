import { FlowModel, Link, Node } from './index';
import { NetworkReader } from '../io';
import type {
  ParserInterface,
  SerializedLink,
  SerializedNetwork,
} from '../io/interfaces';

export type Id = number;

function aggregateLinks(serializedLinks: SerializedLink[]): SerializedLink[] {
  let sourceTargetMap: {
    [source: number]: { [target: number]: number };
  } = {};

  for (let link of serializedLinks) {
    let [source, target] = [
      Math.min(link.source, link.target),
      Math.max(link.source, link.target),
    ];

    if (source in sourceTargetMap) {
      if (target in sourceTargetMap[source]) {
        sourceTargetMap[source][target] += link.weight;
      } else {
        sourceTargetMap[source][target] = link.weight;
      }
    } else {
      sourceTargetMap[source] = {};
      sourceTargetMap[source][target] = link.weight;
    }
  }

  let aggregated: SerializedLink[] = [];

  for (const [source, targets] of Object.entries(sourceTargetMap)) {
    for (const [target, weight] of Object.entries(targets)) {
      aggregated.push({ source: +source, target: +target, weight });
    }
  }

  return aggregated;
}

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

  getNode(id: Id): Node {
    let node = this._nodes.get(id);

    if (!node) {
      throw new Error('Node not found');
    }

    return node;
  }

  get directed(): boolean {
    return this.flowModel === FlowModel.Directed;
  }

  static parse(
    network: SerializedNetwork,
    scalePositions: boolean = true,
  ): Network {
    const {
      flowModel: flowModelStr,
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

    const nodeMap = new Map(nodes.map((node) => [node.id, node]));

    const flowModel =
      flowModelStr === 'directed' ? FlowModel.Directed : FlowModel.Undirected;

    const toParse =
      flowModel === FlowModel.Undirected
        ? aggregateLinks(serializedLinks)
        : serializedLinks;

    const links = toParse.map((link) => Link.deserialize(link, nodeMap));

    return new Network(nodes, links, flowModel);
  }

  static parseString(
    lines: string,
    parser: ParserInterface = NetworkReader.parse,
  ): Network {
    return Network.parse(parser(lines), false);
  }
}

export default Network;
