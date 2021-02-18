import Link from './Link';
import Node from './Node';
import { FlowModel } from './enums';
import { NetworkReader } from '../io';
import type {
  ParserInterface,
  SerializedLink,
  SerializedNetwork,
  SerializedNode,
} from '../io/interfaces';
import RandomWalk from './RandomWalk';
import { computed, makeObservable } from 'mobx';
import MapEquation from './MapEquation';
import PageRank from './PageRank';

type Id = number;

export default class Network {
  private _nodes: Map<Id, Node> = new Map();
  links: Link[] = [];
  flowModel: FlowModel;

  walker: RandomWalk;
  mapequation: MapEquation;
  flowCalculator: PageRank;

  constructor(flowModel: FlowModel = FlowModel.Directed) {
    this.flowModel = flowModel;

    this.walker = new RandomWalk(this);
    this.mapequation = new MapEquation(this);
    this.flowCalculator = new PageRank(this);

    makeObservable(this, {
      haveModules: computed,
    });
  }

  get nodes(): Node[] {
    return Array.from(this._nodes.values());
  }

  getNode(id: Id): Node | null {
    return this._nodes.get(id) ?? null;
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

  addNode(node: number | SerializedNode): Node {
    const n =
      typeof node == 'number'
        ? new Node(this, node)
        : new Node(this, node.id, node);

    this._nodes.set(n.id, n);

    return n;
  }

  addLink({
    source,
    target,
    weight = 1.0,
  }: {
    source: number;
    target: number;
    weight: number;
  }) {
    const sourceNode = this.getNode(source) || this.addNode(source);
    const targetNode = this.getNode(target) || this.addNode(target);

    const link = new Link(sourceNode, targetNode, weight);

    sourceNode.addLink(link);

    this.links.push(link);
  }

  static parse(network: SerializedNetwork): Network {
    const { flowModel, nodes, links } = network;

    const self = new Network(flowModel as FlowModel);

    nodes.forEach((node) => self.addNode(node));
    links.forEach((link) => self.addLink(link));

    return self;
  }

  static parseString(
    lines: string,
    parser: ParserInterface = NetworkReader.parse,
  ): Network {
    return Network.parse(parser(lines));
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
