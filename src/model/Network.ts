import { FlowModel, Link, Node } from './index';
import { NetworkReader } from '../io';
import type {
  ParserInterface,
  SerializedLink,
  SerializedNetwork,
} from '../io/interfaces';
import RandomWalk from './RandomWalk';
import { computed, makeObservable, observable } from 'mobx';
import MapEquation from './MapEquation';

export type Id = number;

class Network {
  private _nodes: Map<Id, Node> = new Map();
  links: Link[] = [];
  flowModel: FlowModel;

  walker: RandomWalk;
  mapequation: MapEquation;

  showVisitRate = false;

  constructor(flowModel: FlowModel = FlowModel.Directed) {
    this.flowModel = flowModel;
    this.walker = new RandomWalk(this);
    this.mapequation = new MapEquation(this);

    makeObservable(this, {
      showVisitRate: observable,
      haveModules: computed,
    });
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

  randomNode(): Node {
    const { nodes } = this;
    return nodes[Math.floor(Math.random() * nodes.length)];
  }

  get directed(): boolean {
    return this.flowModel === FlowModel.Directed;
  }

  get haveModules(): boolean {
    return this.nodes.some((node) => node.module !== 0);
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

    const flowModel =
      flowModelStr === 'directed' ? FlowModel.Directed : FlowModel.Undirected;

    let net = new Network(flowModel);

    let nodes = serializedNodes.map((node) => Node.deserialize(node, net));

    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    net._nodes = nodeMap;

    if (scalePositions) {
      nodes.forEach((node) => {
        node.x *= 800;
        node.y *= 800;
      });
    }

    const toParse = net.directed
      ? serializedLinks
      : aggregateLinks(serializedLinks);

    net.links = toParse.map((link) => Link.deserialize(link, nodeMap));

    for (let link of net.links) {
      link.source.addLink(link);
    }

    return net;
  }

  static parseString(
    lines: string,
    parser: ParserInterface = NetworkReader.parse,
  ): Network {
    return Network.parse(parser(lines), false);
  }
}

function aggregateLinks(links: SerializedLink[]): SerializedLink[] {
  type SourceTargetWeight = {
    [source: number]: { [target: number]: number };
  };

  let sourceTargetMap: SourceTargetWeight = {};

  for (let link of links) {
    let [source, target] = [
      Math.min(link.source, link.target),
      Math.max(link.source, link.target),
    ];

    if (!(source in sourceTargetMap)) {
      sourceTargetMap[source] = {};
    }

    if (!(target in sourceTargetMap[source])) {
      sourceTargetMap[source][target] = 0;
    }

    sourceTargetMap[source][target] += link.weight;
  }

  let aggregated: SerializedLink[] = [];

  for (let [source, targets] of Object.entries(sourceTargetMap)) {
    for (let [target, weight] of Object.entries(targets)) {
      aggregated.push({ source: +source, target: +target, weight });
    }
  }

  return aggregated;
}

export default Network;
