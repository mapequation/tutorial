import { computed, makeObservable } from "mobx";
import { scaleLinear } from "d3"
import Link from "./Link";
import Node from "./Node";
import { FlowModel } from "./enums";
import { NetworkReader } from "../io";
import type {
  Parser,
  SerializedNetwork,
  SerializedNode,
} from "../io/interfaces";
import {
  HuffmanCoder,
  IterativeVoter,
  MapEquation,
  PageRank,
  RandomWalker,
  Tree,
} from "./algorithms";

type Id = number;

export default class Network {
  private _nodes: Map<Id, Node> = new Map();
  links: Link[] = [];

  flowModel: FlowModel;

  tree: Tree;
  walker: RandomWalker;
  mapequation: MapEquation;
  visitRates: PageRank;
  voter: IterativeVoter;
  coder: HuffmanCoder;

  constructor(flowModel: FlowModel = FlowModel.Directed) {
    this.flowModel = flowModel;

    this.tree = new Tree(this);
    this.walker = new RandomWalker(this);
    this.mapequation = new MapEquation(this.tree);
    this.visitRates = new PageRank(this);
    this.voter = new IterativeVoter(this);
    this.coder = new HuffmanCoder(this);

    makeObservable(this, {
      haveModules: computed,
    });
  }

  finalize() {
    this.visitRates.calculate();
    this.tree.update()
    this.mapequation.calculate()
    this.coder.code();
    this.voter.initialize();
    return this;
  }

  setNodeExtents(xRange: number[], yRange: number[]) {
    const xDomain = [Infinity, -Infinity];
    const yDomain = [Infinity, -Infinity];

    for (const node of this.nodes) {
      xDomain[0] = Math.min(node.x, xDomain[0]);
      xDomain[1] = Math.max(node.x, xDomain[1]);
      yDomain[0] = Math.min(node.y, yDomain[0]);
      yDomain[1] = Math.max(node.y, yDomain[1]);
    }

    const xScale = scaleLinear().domain(xDomain).range(xRange);
    const yScale = scaleLinear().domain(yDomain).range(yRange);

    for (const node of this.nodes) {
      node.x = xScale(node.x);
      node.y = yScale(node.y);
    }

    return this;
  }

  get nodes(): Node[] {
    return Array.from(this._nodes.values());
  }

  get numNodes(): number {
    return this._nodes.size;
  }

  get totalLinkWeight(): number {
    return this.links.reduce((weight, link) => weight + link.weight, 0.0);
  }

  get danglingNodes(): Node[] {
    return this.nodes.filter((node) => node.isDangling);
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
    const moduleIds = new Set(this.nodes.map((node) => node.topModule));

    return moduleIds.size > 1;
  }

  moduleFlow(node: Node): number {
    let moduleFlow = 0;

    for (let { topModule, flow } of this._nodes.values()) {
      if (topModule === node.topModule) {
        moduleFlow += flow;
      }
    }

    return moduleFlow;
  }

  get maxNodeFlow(): number {
    let max = -Infinity;

    for (let { flow } of this._nodes.values()) {
      max = Math.max(flow, max);
    }

    return max > 0 ? max : 0;
  }

  addNode = (node: number | SerializedNode): Node => {
    const n =
      typeof node == "number"
        ? new Node(this, node)
        : new Node(this, node.id, node);

    this._nodes.set(n.id, n);

    return n;
  };

  addLink = ({ source, target, weight = 1.0 }: {
    source: number;
    target: number;
    weight: number;
  }) => {
    const duplicate = this.directed
      ? (link: Link) => link.source.id === source && link.target.id === target
      : (link: Link) =>
          (link.source.id === source && link.target.id === target) ||
          (link.source.id === target && link.target.id === source);

    const existing = this.links.find(duplicate);

    if (existing) {
      existing.weight += weight;
      return;
    }

    const sourceNode = this.getNode(source) || this.addNode(source);
    const targetNode = this.getNode(target) || this.addNode(target);

    const link = new Link(sourceNode, targetNode, weight);

    sourceNode.addLink(link);
    this.links.push(link);

    if (!this.directed) {
      targetNode.addLink(link.reversed);
    }
  };

  static parse(network: SerializedNetwork): Network {
    const { flowModel, nodes, links } = network;

    const self = new Network(flowModel as FlowModel);

    const numNodes = nodes.length;
    const initialFlow = numNodes !== 0 ? 1 / numNodes : 1;

    nodes.forEach((node) => {
      if (node.flow === undefined) node.flow = initialFlow;
      self.addNode(node);
    });
    links.forEach(self.addLink);

    self.finalize();

    return self;
  }

  static parseString(
    lines: string,
    parser: Parser = NetworkReader.parse
  ): Network {
    return Network.parse(parser(lines));
  }
}
